import { forgetFeedback } from './feedbackCleanup';
import { adminAuth, adminDb } from './adminApp';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import nodemailer from 'nodemailer';
import {
  canDecide,
  decideOnSync,
  decideRequest,
  DECISIONS,
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
const gmailUser = defineString('GMAIL_USER', { default: '', description: 'Cuenta de Gmail que envía los avisos' });
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');
// Dirección pública de la app en los emails (p. ej. https://clar.life); sin ella, la de Firebase Hosting
const appUrlParam = defineString('APP_URL', { default: '', description: 'Dirección pública de la app' });
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
// En los emuladores no se envían correos; sin el secreto enlazado, el emulador no intenta leerlo de Secret Manager
// (cada intento bloquea la llamada varios segundos)
export const emailSecrets = isEmulator ? [] : [gmailAppPassword];

const db = adminDb;

const isDemoProject = () => (process.env.GCLOUD_PROJECT ?? '').startsWith('demo-');
export const adminEmail = () => (isDemoProject() ? DEMO_ADMIN_EMAIL : adminEmailParam.value());
export const appUrl = () => publicAppUrl(appUrlParam.value(), process.env.GCLOUD_PROJECT ?? '');

// Avisos por email (Gmail con contraseña de aplicación). En los emuladores no se envía nada. Un fallo del
// correo no deshace la solicitud, la decisión ni el mensaje: queda en los logs, sin datos personales (ni el uid).
export const sendEmail = async (
  kind: string,
  to: string,
  { subject, text, replyTo }: { subject: string; text: string; replyTo?: string }
) => {
  if (isEmulator || !gmailUser.value() || !to) {
    logger.info('Email skipped', { kind, emulator: isEmulator });
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser.value(), pass: gmailAppPassword.value() }
    });
    await transport.sendMail({ from: `CLAR <${gmailUser.value()}>`, to, subject, text, replyTo });
    logger.info('Email sent', { kind });
  } catch (error) {
    logger.error('Email failed', { kind, code: (error as { code?: string }).code ?? 'unknown' });
  }
};

const sendAccessEmail = (kind: AccessEmail, record: AccessRecord) =>
  sendEmail(kind, kind === 'new-request' ? adminEmail() : record.email, buildEmail(kind, record, appUrl()));

// Borra las marcas de administración que no son de la cuenta configurada. Se hace en cada llamada, así una
// cuenta que deja de ser administración pierde la lectura de las solicitudes aunque no vuelva a entrar.
const removeStaleAdminMarkers = async () => {
  const markers = await db().collection('admins').get();
  await Promise.all(
    markers.docs.filter((d) => !isCurrentAdminMarker(d.data(), adminEmail())).map((d) => d.ref.delete())
  );
};

// Modo de aprobación (settings/access): obligatoria salvo que la administración la haya desactivado
const settingsRef = () => db().doc('settings/access');
const isApprovalRequired = async () => (await settingsRef().get()).data()?.approvalRequired !== false;

// Lista negra por email (blocked_emails/{email}): una cuenta bloqueada no vuelve con otra cuenta del mismo email.
// Se conserva aunque la cuenta se elimine: es lo que impide volver a entrar.
const blockedEmailRef = (email: string) => db().doc(`blocked_emails/${encodeURIComponent(email)}`);
const isEmailBlocked = async (email: string) => Boolean(email) && (await blockedEmailRef(email).get()).exists;

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
  const [approvalRequired, emailBlocked] = await Promise.all([isApprovalRequired(), isEmailBlocked(email)]);
  const status = await db().runTransaction(async (tx) => {
    const access = await tx.get(accessRef);
    const current = access.data() as AccessRecord | undefined;
    const action = decideOnSync({
      current: current?.status,
      approvalRequired,
      emailBlocked,
      emailVerified: auth.token.email_verified === true
    });
    if (action === 'keep') return current?.status ?? 'none';
    const now = new Date().toISOString();
    const record: AccessRecord = {
      ...profileOf(auth.token),
      message: current?.message ?? '',
      status: action === 'approve' ? 'approved' : 'blocked',
      requestedAt: current?.requestedAt ?? now,
      decidedAt: now
    };
    tx.set(accessRef, record);
    return record.status;
  });
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
  const [approvalRequired, emailBlocked] = await Promise.all([
    isApprovalRequired(),
    isEmailBlocked(normalizeEmail(auth.token.email))
  ]);

  const created = await db().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    // Email en la lista negra: la cuenta queda bloqueada y no se crea solicitud
    if (emailBlocked) {
      const now = new Date().toISOString();
      tx.set(ref, { ...profileOf(auth.token), message: '', status: 'blocked', requestedAt: now, decidedAt: now });
      return { status: 'blocked' as const };
    }
    const decision = decideRequest(current.data() as AccessRecord | undefined, new Date());
    if (decision.action === 'keep') return { status: decision.status };
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
    return { ...data, status: status as DecisionStatus, decidedAt };
  });
  logger.info('Access decided', { status });
  // La persona recibe un aviso cuando se aprueba su acceso (rechazos y retiradas se ven al entrar)
  if (record.status === 'approved' && normalizeEmail(record.email) !== normalizeEmail(adminEmail())) {
    await sendAccessEmail('approved', record);
  }
  return { status };
});

// Activa o desactiva la aprobación obligatoria de cuentas. Al pasar a libre, las solicitudes pendientes se aprueban
// al momento (y cada persona recibe su aviso)
const BATCH_LIMIT = 450;
export const setAccessMode = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
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
  for (let i = 0; i < pending.docs.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    pending.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.update(d.ref, { status: 'approved', decidedAt: now }));
    await batch.commit();
  }
  for (const d of pending.docs) {
    const record = d.data() as AccessRecord;
    if (normalizeEmail(record.email) !== normalizeEmail(adminEmail())) {
      await sendAccessEmail('approved', { ...record, status: 'approved', decidedAt: now });
    }
  }
  return { approvalRequired, approved: pending.size };
});

// Al eliminar la cuenta se borra también la solicitud de acceso (la lista negra por email se conserva)
export const forgetAccess = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await Promise.all([
    db().doc(`access/${auth.uid}`).delete(),
    db().doc(`admins/${auth.uid}`).delete(),
    forgetFeedback(auth.uid)
  ]);
  return { ok: true };
});

// Cierra la sesión en todos los dispositivos: invalida los tokens de renovación de la cuenta
export const revokeSessions = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await adminAuth().revokeRefreshTokens(auth.uid);
  logger.info('Sessions revoked');
  return { ok: true };
});
