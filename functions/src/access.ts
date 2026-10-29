import { calendarKeySecrets, disconnectCalendar } from './calendarCleanup';
import { featuresDoc, forgetFeatures } from './featuresCleanup';
import { forgetFeedback } from './feedbackCleanup';
import { forgetPushData, forgetPushDevices } from './pushCleanup';
import { adminAuth, adminDb } from './adminApp';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import { FieldValue, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import {
  canDecide,
  decideOnSync,
  decideRequest,
  DECISIONS,
  isRecentSignIn,
  newRequestStatus,
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
import { callerLanguage, invalidRequest, onUserCall, requireAuth, userErrors } from './callable';
import { isLanguage, languageOf, messages, type Language } from './i18n';

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

// El idioma de los emails a una persona: el de su cuenta o, si aún no lo tiene (no ha entrado nunca con acceso, así que
// no tiene perfil), el de la app cuando pidió acceso. Si no se puede leer, el de la solicitud: el aviso sale igual
const recipientLanguage = async (uid: string, record: AccessRecord): Promise<Language> => {
  const profile: unknown = await db()
    .doc(`users/${uid}`)
    .get()
    .then((d): unknown => d.data()?.language)
    .catch(() => undefined);
  return isLanguage(profile) ? profile : languageOf(record.language);
};

// A la administración, en español; a la persona (`uid`), en su idioma
const sendAccessEmail = async (
  kind: AccessEmail,
  record: AccessRecord,
  uid?: string,
  transport?: ReturnType<typeof createTransport>
) => {
  const language = kind === 'approved' && uid ? await recipientLanguage(uid, record) : 'es';
  return sendEmail(
    kind,
    kind === 'new-request' ? adminEmail() : record.email,
    buildEmail(kind, record, appUrl(), language),
    transport
  );
};

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

const fail = userErrors(
  messages(
    {
      noEmail: 'Tu cuenta no tiene email.',
      verifyEmail: 'Verifica tu email antes de solicitar acceso.',
      retryLater: 'Podrás volver a pedir acceso más adelante.',
      adminOnlyDecide: 'Solo la administración puede decidir los accesos.',
      ownAccess: 'No puedes cambiar tu propio acceso.',
      requestGone: 'La solicitud ya no existe.',
      notPossible: 'Ese cambio no es posible desde el estado actual.',
      adminOnlyMode: 'Solo la administración puede cambiar la aprobación de cuentas.',
      signInAgain: 'Vuelve a iniciar sesión para eliminar la cuenta.'
    },
    {
      noEmail: "Your account doesn't have an email.",
      verifyEmail: 'Verify your email before requesting access.',
      retryLater: 'You can request access again later.',
      adminOnlyDecide: 'Only the admin can decide on access.',
      ownAccess: "You can't change your own access.",
      requestGone: 'The request no longer exists.',
      notPossible: "That change isn't possible from the current status.",
      adminOnlyMode: 'Only the admin can change account approval.',
      signInAgain: 'Sign in again to delete the account.'
    }
  )
);

// Al iniciar sesión: la cuenta de administración se aprueba y se marca como tal; el resto solo consulta su estado
export const syncAccess = onUserCall({ region: REGION }, async (request) => {
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
      review: current?.review === true,
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

export const requestAccess = onUserCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  if (!auth.token.email) throw fail('failed-precondition', (t) => t.noEmail);
  // Las cuentas con contraseña confirman antes su email (las de Google ya vienen verificadas)
  if (auth.token.email_verified !== true) throw fail('permission-denied', (t) => t.verifyEmail);
  const message = normalizeMessage((request.data as { message?: unknown } | null)?.message);
  const ref = db().doc(`access/${auth.uid}`);
  // El idioma de la app al pedirlo: el del aviso cuando se apruebe, si para entonces la cuenta aún no tiene el suyo
  const language = await callerLanguage(request);

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
      throw fail('resource-exhausted', (t) => t.retryLater, { retryAt: decision.retryAt });
    }
    // Con la aprobación libre, una cuenta nueva se aprueba al momento; una rechazada o retirada, no (ver newRequestStatus)
    const now = new Date().toISOString();
    const record: AccessRecord =
      newRequestStatus(current.data() as AccessRecord | undefined, approvalRequired) === 'pending'
        ? {
            ...profileOf(auth.token),
            message,
            language,
            status: 'pending',
            requestedAt: now,
            ...(current.exists && { review: true })
          }
        : { ...profileOf(auth.token), message, language, status: 'approved', requestedAt: now, decidedAt: now };
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

export const setAccess = onUserCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw fail('permission-denied', (t) => t.adminOnlyDecide);
  }
  const { uid, status } = (request.data ?? {}) as { uid?: unknown; status?: unknown };
  if (typeof uid !== 'string' || !uid || !DECISIONS.includes(status as DecisionStatus)) {
    throw invalidRequest();
  }
  if (uid === auth.uid) throw fail('failed-precondition', (t) => t.ownAccess);

  const ref = db().doc(`access/${uid}`);
  const record = await db().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) throw fail('not-found', (t) => t.requestGone);
    const data = current.data() as AccessRecord;
    if (!canDecide(data.status, status as DecisionStatus)) {
      throw fail('failed-precondition', (t) => t.notPossible);
    }
    const decidedAt = new Date().toISOString();
    // Ya decidida: deja de ser una solicitud a revisar
    tx.update(ref, { status, decidedAt, review: FieldValue.delete() });
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
    await sendAccessEmail('approved', record, uid);
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
    // Las de cuentas rechazadas o retiradas siguen esperando a la administración
    if (current?.status !== 'pending' || current.review) return null;
    const { approvalRequired, emailBlocked } = await readPolicy(tx, normalizeEmail(current.email));
    if (approvalRequired || emailBlocked) return null;
    tx.update(ref, { status: 'approved', decidedAt });
    return { uid: ref.id, record: { ...current, status: 'approved' as const, decidedAt } };
  });

export const setAccessMode = onUserCall(
  { region: REGION, secrets: emailSecrets, timeoutSeconds: 300 },
  async (request) => {
    const auth = requireAuth(request);
    await removeStaleAdminMarkers();
    if (!isAdminToken(auth.token, adminEmail())) {
      throw fail('permission-denied', (t) => t.adminOnlyMode);
    }
    const { approvalRequired } = (request.data ?? {}) as { approvalRequired?: unknown };
    if (typeof approvalRequired !== 'boolean') throw invalidRequest();

    const now = new Date().toISOString();
    await settingsRef().set({ approvalRequired, updatedAt: now });
    logger.info('Access mode changed', { approvalRequired });
    if (approvalRequired) return { approvalRequired, approved: 0 };

    const pending = await db().collection('access').where('status', '==', 'pending').get();
    const approved: { uid: string; record: AccessRecord }[] = [];
    await inChunks(pending.docs, APPROVE_CONCURRENCY, async (d) => {
      const result = await approveIfStillPending(d.ref, now);
      if (result) approved.push(result);
    });
    logger.info('Pending requests approved', { approved: approved.length, skipped: pending.size - approved.length });

    // Avisos con unas pocas conexiones compartidas; un fallo queda en los logs y no afecta a los demás
    const toNotify = approved.filter(({ record }) => normalizeEmail(record.email) !== normalizeEmail(adminEmail()));
    const transport = isEmulator || !smtpUser.value() || toNotify.length === 0 ? undefined : createTransport(true);
    try {
      await inChunks(toNotify, EMAIL_CONCURRENCY, ({ uid, record }) =>
        sendAccessEmail('approved', record, uid, transport)
      );
    } finally {
      transport?.close();
    }
    return { approvalRequired, approved: approved.length };
  }
);

// Último paso para eliminar la cuenta: la borra de Auth y después sus datos, su solicitud de acceso, su marca de
// administración, sus mensajes, sus dispositivos y alarmas de las notificaciones push, sus funciones extra y su conexión
// con Google Calendar (la lista negra por email se conserva). Borrar la solicitud sin borrar la cuenta
// dejaría a una cuenta rechazada o retirada volver a entrar o a pedir acceso al momento, sin decisión de nadie: por
// eso la cuenta va primero y si falla no se borra nada. Pide un inicio de sesión reciente, como Firebase para borrar
// la cuenta desde el navegador.
export const forgetAccess = onUserCall(
  { region: REGION, timeoutSeconds: 300, secrets: calendarKeySecrets },
  async (request) => {
    const auth = requireAuth(request);
    if (!isRecentSignIn(auth.token.auth_time, new Date())) {
      throw fail('failed-precondition', (t) => t.signInAgain);
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
    // La conexión con Google Calendar, al final: se retira el permiso y no queda nada (el calendario «CLAR» se queda en
    // su cuenta de Google). Después de borrar la solicitud de acceso, así una sincronización que acabe tarde no deja nada
    await disconnectCalendar(auth.uid, { forget: true });
    logger.info('Account deleted');
    return { ok: true };
  }
);

// Cierra la sesión en todos los dispositivos: invalida los tokens de renovación de la cuenta
export const revokeSessions = onUserCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await adminAuth().revokeRefreshTokens(auth.uid);
  // Los dispositivos tampoco reciben ya sus alarmas (p. ej. un móvil perdido); cada uno vuelve a registrarse al entrar
  await forgetPushDevices(auth.uid);
  logger.info('Sessions revoked');
  return { ok: true };
});
