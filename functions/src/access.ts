import { featuresDoc, forgetFeatures } from './featuresCleanup';
import { forgetFeedback } from './feedbackCleanup';
import { forgetPushData, forgetPushDevices } from './pushCleanup';
import { adminAuth, adminDb } from './adminApp';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import {
  canDecide,
  decideOnSync,
  decideRequest,
  DECISIONS,
  isRecentSignIn,
  DEMO_ADMIN_EMAIL,
  buildEmail,
  isAdminToken,
  isCurrentAdminMarker,
  normalizeEmail,
  normalizeMessage,
  profileOf,
  publicAppUrl,
  type AccessEmail,
  type AccessRecord,
  type DecisionStatus
} from './accessLogic';

export const REGION = 'europe-west1';

// En CI se escriben en functions/.env desde los secretos del repositorio; la contraseña va en Secret Manager
const adminEmailParam = defineString('ADMIN_EMAIL', {
  default: '',
  description: 'Email de la cuenta de Google que aprueba los accesos'
});
// Buzón que envía los avisos y las respuestas (y recibe lo que contesten), por SMTP con TLS
const smtpUser = defineString('SMTP_USER', {
  default: '',
  description: 'Buzón que envía los avisos y recibe las respuestas (p. ej. info@clar.life)'
});
const smtpHost = defineString('SMTP_HOST', { default: 'smtp.ionos.es', description: 'Servidor SMTP del buzón' });
const smtpPassword = defineSecret('SMTP_PASSWORD');
// Dirección pública de la app en los emails (p. ej. https://clar.life); sin ella, la de Firebase Hosting
const appUrlParam = defineString('APP_URL', { default: '', description: 'Dirección pública de la app' });
export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
// En los emuladores no se envían correos; sin el secreto enlazado, el emulador no intenta leerlo de Secret Manager
// (cada intento bloquea la llamada varios segundos)
export const emailSecrets = isEmulator ? [] : [smtpPassword];

const db = adminDb;

const isDemoProject = () => (process.env.GCLOUD_PROJECT ?? '').startsWith('demo-');
export const adminEmail = () => (isDemoProject() ? DEMO_ADMIN_EMAIL : adminEmailParam.value());
export const appUrl = () => publicAppUrl(appUrlParam.value(), process.env.GCLOUD_PROJECT ?? '');

// Avisos por email desde el buzón de SMTP_USER. En los emuladores no se envía nada. Un fallo del
// correo no deshace la solicitud, la decisión ni el mensaje: queda en los logs, sin datos personales (ni el uid).
const EMAIL_CONCURRENCY = 3;
const createTransport = (pool = false) =>
  nodemailer.createTransport({
    host: smtpHost.value(),
    port: 465,
    secure: true,
    auth: { user: smtpUser.value(), pass: smtpPassword.value() },
    // Varios correos seguidos (aprobaciones en bloque) comparten unas pocas conexiones
    ...(pool ? { pool: true, maxConnections: EMAIL_CONCURRENCY } : {})
  });

export const sendEmail = async (
  kind: string,
  to: string,
  { subject, text }: { subject: string; text: string },
  transport?: ReturnType<typeof createTransport>
): Promise<'sent' | 'skipped' | 'failed'> => {
  if (isEmulator || !smtpUser.value() || !to) {
    logger.info('Email skipped', { kind, emulator: isEmulator });
    return 'skipped';
  }
  try {
    await (transport ?? createTransport()).sendMail({
      from: `CLAR <${smtpUser.value()}>`,
      to,
      subject,
      text
    });
    logger.info('Email sent', { kind });
    return 'sent';
  } catch (error) {
    logger.error('Email failed', { kind, code: (error as { code?: string }).code ?? 'unknown' });
    return 'failed';
  }
};

const sendAccessEmail = (kind: AccessEmail, record: AccessRecord, transport?: ReturnType<typeof createTransport>) =>
  sendEmail(kind, kind === 'new-request' ? adminEmail() : record.email, buildEmail(kind, record, appUrl()), transport);

// Borra las marcas de administración que no son de la cuenta configurada. Se hace en cada llamada, así una
// cuenta que deja de ser administración pierde la lectura de las solicitudes aunque no vuelva a entrar.
export const removeStaleAdminMarkers = async () => {
  const markers = await db().collection('admins').get();
  await Promise.all(
    markers.docs.filter((d) => !isCurrentAdminMarker(d.data(), adminEmail())).map((d) => d.ref.delete())
  );
};

// Modo de aprobación (settings/access): obligatoria salvo que la administración la haya desactivado
const settingsRef = () => db().doc('settings/access');

// Lista negra por email (blocked_emails/{email}): una cuenta bloqueada no vuelve con otra cuenta del mismo email.
// Se conserva aunque la cuenta se elimine: es lo que impide volver a entrar.
const blockedEmailRef = (email: string) => db().doc(`blocked_emails/${encodeURIComponent(email)}`);

// El modo de aprobación y la lista negra se leen dentro de la misma transacción que la solicitud: si cambian
// mientras tanto, la transacción se repite y decide con lo nuevo (no aprueba con un modo ya cambiado ni deshace
// un desbloqueo)
const readPolicy = async (tx: Transaction, email: string) => {
  const [settings, blocked] = await Promise.all([
    tx.get(settingsRef()),
    email ? tx.get(blockedEmailRef(email)) : Promise.resolve(null)
  ]);
  return { approvalRequired: settings.data()?.approvalRequired !== false, emailBlocked: Boolean(blocked?.exists) };
};

// Una cuenta bloqueada por su email (al entrar o al pedir acceso) deja de recibir alarmas push. Si falla, no se
// interrumpe la respuesta: queda en los logs (sin el uid), y sus dispositivos se borran solos a los 30 días, porque
// sin acceso no puede renovarlos
const forgetBlockedDevices = async (uid: string) => {
  try {
    await forgetPushDevices(uid);
  } catch (error) {
    logger.error('Push devices not removed', { code: (error as { code?: string }).code ?? 'unknown' });
  }
};

export const requireAuth = (request: CallableRequest) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return request.auth;
};

// Al iniciar sesión: la cuenta de administración se aprueba y se marca como tal; el resto solo consulta su estado
export const syncAccess = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const accessRef = db().doc(`access/${auth.uid}`);
  const adminRef = db().doc(`admins/${auth.uid}`);
  await removeStaleAdminMarkers();

  if (isAdminToken(auth.token, adminEmail())) {
    await db().runTransaction(async (tx) => {
      const [access, admin] = await Promise.all([tx.get(accessRef), tx.get(adminRef)]);
      const current = access.data() as AccessRecord | undefined;
      const now = new Date().toISOString();
      if (current?.status !== 'approved') {
        const record: AccessRecord = {
          ...profileOf(auth.token),
          message: '',
          status: 'approved',
          requestedAt: current?.requestedAt ?? now,
          decidedAt: now
        };
        tx.set(accessRef, record);
      }
      // Con el email: las reglas comprueban que coincide con el de quien lee
      if (!isCurrentAdminMarker(admin.data(), adminEmail()))
        tx.set(adminRef, { email: normalizeEmail(auth.token.email), since: now });
    });
    return { status: 'approved', isAdmin: true };
  }

  // El resto: según la lista negra y el modo de aprobación, la cuenta puede quedar bloqueada o entrar sola
  const email = normalizeEmail(auth.token.email);
  const { status, blocked } = await db().runTransaction(async (tx) => {
    const [access, { approvalRequired, emailBlocked }] = await Promise.all([tx.get(accessRef), readPolicy(tx, email)]);
    const current = access.data() as AccessRecord | undefined;
    const action = decideOnSync({
      current: current?.status,
      approvalRequired,
      emailBlocked,
      emailVerified: auth.token.email_verified === true
    });
    if (action === 'keep') return { status: current?.status ?? 'none', blocked: false };
    const now = new Date().toISOString();
    const record: AccessRecord = {
      ...profileOf(auth.token),
      message: current?.message ?? '',
      status: action === 'approve' ? 'approved' : 'blocked',
      requestedAt: current?.requestedAt ?? now,
      decidedAt: now
    };
    tx.set(accessRef, record);
    // Bloqueada por su email: pierde también sus funciones extra (ver setAccess)
    if (record.status === 'blocked') tx.delete(featuresDoc(auth.uid));
    return { status: record.status, blocked: record.status === 'blocked' };
  });
  if (blocked) await forgetBlockedDevices(auth.uid);
  return { status, isAdmin: false };
});

export const requestAccess = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  if (!auth.token.email) throw new HttpsError('failed-precondition', 'Tu cuenta no tiene email.');
  // Las cuentas con contraseña confirman antes su email (las de Google ya vienen verificadas)
  if (auth.token.email_verified !== true)
    throw new HttpsError('permission-denied', 'Verifica tu email antes de solicitar acceso.');
  const message = normalizeMessage((request.data as { message?: unknown } | null)?.message);
  const ref = db().doc(`access/${auth.uid}`);

  const created = await db().runTransaction(async (tx) => {
    const [current, { approvalRequired, emailBlocked }] = await Promise.all([
      tx.get(ref),
      readPolicy(tx, normalizeEmail(auth.token.email))
    ]);
    // Email en la lista negra: la cuenta queda bloqueada y no se crea solicitud
    if (emailBlocked) {
      const now = new Date().toISOString();
      tx.set(ref, { ...profileOf(auth.token), message: '', status: 'blocked', requestedAt: now, decidedAt: now });
      tx.delete(featuresDoc(auth.uid));
      return { status: 'blocked' as const, blocked: true };
    }
    const decision = decideRequest(current.data() as AccessRecord | undefined, new Date(), approvalRequired);
    if (decision.action === 'keep') return { status: decision.status };
    // Pendiente con la aprobación libre: se aprueba conservando la solicitud original. Sin aviso por email, igual
    // que al entrar: la persona ya está en la app
    if (decision.action === 'approve') {
      tx.update(ref, { status: 'approved', decidedAt: new Date().toISOString() });
      return { status: 'approved' as const };
    }
    if (decision.action === 'wait') {
      throw new HttpsError('resource-exhausted', 'Podrás volver a pedir acceso más adelante.', {
        retryAt: decision.retryAt
      });
    }
    // Con la aprobación libre, la solicitud se aprueba al momento
    const now = new Date().toISOString();
    const record: AccessRecord = approvalRequired
      ? { ...profileOf(auth.token), message, status: 'pending', requestedAt: now }
      : { ...profileOf(auth.token), message, status: 'approved', requestedAt: now, decidedAt: now };
    tx.set(ref, record);
    return { status: record.status, record };
  });

  if ('blocked' in created) await forgetBlockedDevices(auth.uid);
  if ('record' in created && created.record?.status === 'pending') {
    logger.info('Access requested', { hasMessage: message.length > 0 });
    await sendAccessEmail('new-request', created.record);
  }
  return { status: created.status };
});

export const setAccess = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw new HttpsError('permission-denied', 'Solo la administración puede decidir los accesos.');
  }
  const { uid, status } = (request.data ?? {}) as { uid?: unknown; status?: unknown };
  if (typeof uid !== 'string' || !uid || !DECISIONS.includes(status as DecisionStatus)) {
    throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  }
  if (uid === auth.uid) throw new HttpsError('failed-precondition', 'No puedes cambiar tu propio acceso.');

  const ref = db().doc(`access/${uid}`);
  const record = await db().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) throw new HttpsError('not-found', 'La solicitud ya no existe.');
    const data = current.data() as AccessRecord;
    if (!canDecide(data.status, status as DecisionStatus)) {
      throw new HttpsError('failed-precondition', 'Ese cambio no es posible desde el estado actual.');
    }
    const decidedAt = new Date().toISOString();
    tx.update(ref, { status, decidedAt });
    // Bloquear también bloquea el email; desbloquear (retirar o aprobar a una cuenta bloqueada) lo quita
    if (status === 'blocked' && data.email) {
      tx.set(blockedEmailRef(normalizeEmail(data.email)), { uid, since: decidedAt });
    } else if (data.status === 'blocked' && data.email) {
      tx.delete(blockedEmailRef(normalizeEmail(data.email)));
    }
    // Sin acceso no conserva sus funciones extra: al volver a aprobarla, empieza sin ninguna. Van en la transacción,
    // así no quedan si algo falla después
    if (status !== 'approved') tx.delete(featuresDoc(uid));
    return { ...data, status: status as DecisionStatus, decidedAt };
  });
  logger.info('Access decided', { status });
  // Sin acceso, tampoco recibe alarmas push en sus dispositivos
  if (status !== 'approved') await forgetPushDevices(uid);
  // La persona recibe un aviso cuando se aprueba su acceso (rechazos y retiradas se ven al entrar)
  if (record.status === 'approved' && normalizeEmail(record.email) !== normalizeEmail(adminEmail())) {
    await sendAccessEmail('approved', record);
  }
  return { status };
});

// Activa o desactiva la aprobación obligatoria de cuentas. Al pasar a libre, las solicitudes pendientes se aprueban
// al momento (y cada persona recibe su aviso). Cada una se aprueba en su propia transacción, que comprueba antes que
// sigue pendiente, que su email no está bloqueado y que la aprobación sigue libre: si entretanto se rechazó, se
// bloqueó o se volvió a activar la aprobación, no se toca. Solo se cuentan y avisan las que de verdad se aprobaron.
// Una solicitud que llega mientras tanto lee el modo nuevo en su transacción y se aprueba sola.
const APPROVE_CONCURRENCY = 10;
const inChunks = async <T>(items: T[], size: number, run: (item: T) => Promise<unknown>) => {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(run));
};

const approveIfStillPending = (ref: DocumentReference, decidedAt: string) =>
  db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = snapshot.data() as AccessRecord | undefined;
    if (current?.status !== 'pending') return null;
    const { approvalRequired, emailBlocked } = await readPolicy(tx, normalizeEmail(current.email));
    if (approvalRequired || emailBlocked) return null;
    tx.update(ref, { status: 'approved', decidedAt });
    return { ...current, status: 'approved' as const, decidedAt };
  });

export const setAccessMode = onCall({ region: REGION, secrets: emailSecrets, timeoutSeconds: 300 }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw new HttpsError('permission-denied', 'Solo la administración puede cambiar la aprobación de cuentas.');
  }
  const { approvalRequired } = (request.data ?? {}) as { approvalRequired?: unknown };
  if (typeof approvalRequired !== 'boolean') throw new HttpsError('invalid-argument', 'Solicitud no válida.');

  const now = new Date().toISOString();
  await settingsRef().set({ approvalRequired, updatedAt: now });
  logger.info('Access mode changed', { approvalRequired });
  if (approvalRequired) return { approvalRequired, approved: 0 };

  const pending = await db().collection('access').where('status', '==', 'pending').get();
  const approved: AccessRecord[] = [];
  await inChunks(pending.docs, APPROVE_CONCURRENCY, async (d) => {
    const record = await approveIfStillPending(d.ref, now);
    if (record) approved.push(record);
  });
  logger.info('Pending requests approved', { approved: approved.length, skipped: pending.size - approved.length });

  // Avisos con unas pocas conexiones compartidas; un fallo queda en los logs y no afecta a los demás
  const toNotify = approved.filter((record) => normalizeEmail(record.email) !== normalizeEmail(adminEmail()));
  const transport = isEmulator || !smtpUser.value() || toNotify.length === 0 ? undefined : createTransport(true);
  try {
    await inChunks(toNotify, EMAIL_CONCURRENCY, (record) => sendAccessEmail('approved', record, transport));
  } finally {
    transport?.close();
  }
  return { approvalRequired, approved: approved.length };
});

// Último paso para eliminar la cuenta: la borra de Auth y después sus datos, su solicitud de acceso, su marca de
// administración, sus mensajes, sus dispositivos y alarmas de las notificaciones push y sus funciones extra (la lista
// negra por email se conserva). Borrar la solicitud sin borrar la cuenta
// dejaría a una cuenta rechazada o retirada volver a entrar o a pedir acceso al momento, sin decisión de nadie: por
// eso la cuenta va primero y si falla no se borra nada. Pide un inicio de sesión reciente, como Firebase para borrar
// la cuenta desde el navegador.
export const forgetAccess = onCall({ region: REGION, timeoutSeconds: 300 }, async (request) => {
  const auth = requireAuth(request);
  if (!isRecentSignIn(auth.token.auth_time, new Date())) {
    throw new HttpsError('failed-precondition', 'Vuelve a iniciar sesión para eliminar la cuenta.');
  }
  await adminAuth().deleteUser(auth.uid);
  await Promise.all([
    db().recursiveDelete(db().doc(`users/${auth.uid}`)),
    db().doc(`access/${auth.uid}`).delete(),
    db().doc(`admins/${auth.uid}`).delete(),
    forgetFeedback(auth.uid),
    forgetPushData(auth.uid),
    forgetFeatures(auth.uid)
  ]);
  logger.info('Account deleted');
  return { ok: true };
});

// Cierra la sesión en todos los dispositivos: invalida los tokens de renovación de la cuenta
export const revokeSessions = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await adminAuth().revokeRefreshTokens(auth.uid);
  // Los dispositivos tampoco reciben ya sus alarmas (p. ej. un móvil perdido); cada uno vuelve a registrarse al entrar
  await forgetPushDevices(auth.uid);
  logger.info('Sessions revoked');
  return { ok: true };
});
