import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import nodemailer from 'nodemailer';
import {
  canDecide,
  decideRequest,
  DECISIONS,
  DEMO_ADMIN_EMAIL,
  buildEmail,
  isAdminToken,
  normalizeEmail,
  normalizeMessage,
  profileOf,
  type AccessEmail,
  type AccessRecord,
  type DecisionStatus
} from './accessLogic';

const REGION = 'europe-west1';

// En CI se escriben en functions/.env desde los secretos del repositorio; la contraseña va en Secret Manager
const adminEmailParam = defineString('ADMIN_EMAIL', {
  default: '',
  description: 'Email de la cuenta de Google que aprueba los accesos'
});
const gmailUser = defineString('GMAIL_USER', { default: '', description: 'Cuenta de Gmail que envía los avisos' });
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
// En los emuladores no se envían correos; sin el secreto enlazado, el emulador no intenta leerlo de Secret Manager
// (cada intento bloquea la llamada varios segundos)
const emailSecrets = isEmulator ? [] : [gmailAppPassword];

const db = () => {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
};

const isDemoProject = () => (process.env.GCLOUD_PROJECT ?? '').startsWith('demo-');
const adminEmail = () => (isDemoProject() ? DEMO_ADMIN_EMAIL : adminEmailParam.value());
const appUrl = () => `https://${process.env.GCLOUD_PROJECT}.web.app`;

// Avisos por email (Gmail con contraseña de aplicación). En los emuladores no se envía nada. Un fallo del
// correo no deshace la solicitud ni la decisión: queda en los logs, sin datos personales.
const sendAccessEmail = async (kind: AccessEmail, record: AccessRecord, uid: string) => {
  const to = kind === 'new-request' ? adminEmail() : record.email;
  if (isEmulator || !gmailUser.value() || !to) {
    logger.info('Access email skipped', { uid, kind, emulator: isEmulator });
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser.value(), pass: gmailAppPassword.value() }
    });
    const { subject, text } = buildEmail(kind, record, appUrl());
    await transport.sendMail({ from: `NeuroProductividad <${gmailUser.value()}>`, to, subject, text });
    logger.info('Access email sent', { uid, kind });
  } catch (error) {
    logger.error('Access email failed', { uid, kind, code: (error as { code?: string }).code ?? 'unknown' });
  }
};

const requireAuth = (request: CallableRequest) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return request.auth;
};

// Al iniciar sesión: la cuenta de administración se aprueba y se marca como tal; el resto solo consulta su estado
export const syncAccess = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const accessRef = db().doc(`access/${auth.uid}`);
  const adminRef = db().doc(`admins/${auth.uid}`);

  if (isAdminToken(auth.token, adminEmail())) {
    await db().runTransaction(async (tx) => {
      const [access, admin] = await Promise.all([tx.get(accessRef), tx.get(adminRef)]);
      const now = new Date().toISOString();
      if (access.data()?.status !== 'approved') {
        const record: AccessRecord = {
          ...profileOf(auth.token),
          message: '',
          status: 'approved',
          requestedAt: access.data()?.requestedAt ?? now,
          decidedAt: now
        };
        tx.set(accessRef, record);
      }
      if (!admin.exists) tx.set(adminRef, { since: now });
    });
    return { status: 'approved', isAdmin: true };
  }

  // Si cambia el email de administración, la cuenta anterior deja de serlo
  const [access, admin] = await Promise.all([accessRef.get(), adminRef.get()]);
  if (admin.exists) await adminRef.delete();
  return { status: access.exists ? (access.data() as AccessRecord).status : 'none', isAdmin: false };
});

export const requestAccess = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  if (!auth.token.email) throw new HttpsError('failed-precondition', 'Tu cuenta no tiene email.');
  const message = normalizeMessage((request.data as { message?: unknown } | null)?.message);
  const ref = db().doc(`access/${auth.uid}`);

  const created = await db().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const decision = decideRequest(current.data() as AccessRecord | undefined, new Date());
    if (decision.action === 'keep') return { status: decision.status };
    if (decision.action === 'wait') {
      throw new HttpsError('resource-exhausted', 'Podrás volver a pedir acceso más adelante.', { retryAt: decision.retryAt });
    }
    const record: AccessRecord = {
      ...profileOf(auth.token),
      message,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };
    tx.set(ref, record);
    return { status: 'pending' as const, record };
  });

  if ('record' in created && created.record) {
    logger.info('Access requested', { uid: auth.uid, hasMessage: message.length > 0 });
    await sendAccessEmail('new-request', created.record, auth.uid);
  }
  return { status: created.status };
});

export const setAccess = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
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
    return { ...data, status: status as DecisionStatus, decidedAt };
  });
  logger.info('Access decided', { uid, status });
  // La persona recibe un aviso cuando se aprueba su acceso (rechazos y retiradas se ven al entrar)
  if (record.status === 'approved' && normalizeEmail(record.email) !== normalizeEmail(adminEmail())) {
    await sendAccessEmail('approved', record, uid);
  }
  return { status };
});

// Al eliminar la cuenta se borra también la solicitud de acceso
export const forgetAccess = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await Promise.all([db().doc(`access/${auth.uid}`).delete(), db().doc(`admins/${auth.uid}`).delete()]);
  return { ok: true };
});
