import { HttpsError, onCall } from 'firebase-functions/https';
import { onSchedule } from 'firebase-functions/scheduler';
import * as logger from 'firebase-functions/logger';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './adminApp';
import { isAdminToken, normalizeEmail } from './accessLogic';
import {
  adminEmail,
  appUrl,
  emailSecrets,
  isEmulator,
  REGION,
  removeStaleAdminMarkers,
  requireAuth,
  sendEmail
} from './access';
import {
  FEEDBACK_LIMIT,
  buildFeedbackDigestEmail,
  buildFeedbackEmail,
  noticeDue,
  buildReplyEmail,
  parseFeedback,
  parseReply,
  recentSends,
  replyState,
  type FeedbackReply,
  type FeedbackTicket
} from './feedbackLogic';

const db = adminDb;
// Cuándo se avisó por última vez a la administración y cuántos mensajes esperan al resumen (solo lo usa el servidor)
const NOTICE_DOC = 'feedback_notice/state';
const FLUSH_SLACK_MS = 60 * 1000;

// Contacto: guarda el mensaje (feedback_tickets, solo lo lee la administración) y avisa por email. Funciona también
// con una cuenta pendiente de aprobación, pero exige el email confirmado para poder responder. Como mucho 5 por hora.
export const submitFeedback = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  if (!auth.token.email || auth.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Confirma tu email para poder escribirnos.');
  }
  const input = parseFeedback(request.data);
  if (!input) throw new HttpsError('invalid-argument', 'Revisa el tipo, el asunto y la descripción.');

  const now = new Date();
  const ticketRef = db().collection('feedback_tickets').doc();
  const limitRef = db().doc(`feedback_limits/${auth.uid}`);
  const noticeRef = db().doc(NOTICE_DOC);
  const ticket: FeedbackTicket = {
    ...input,
    uid: auth.uid,
    email: normalizeEmail(auth.token.email),
    name: typeof auth.token.name === 'string' ? auth.token.name.slice(0, 200) : '',
    status: 'new',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  await db().runTransaction(async (tx) => {
    const limit = await tx.get(limitRef);
    const sent = recentSends((limit.data()?.sent as string[] | undefined) ?? [], now);
    if (sent.length >= FEEDBACK_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        'Has enviado varios mensajes seguidos. Inténtalo de nuevo en un rato.'
      );
    }
    tx.set(limitRef, { sent: [...sent, now.toISOString()] });
    tx.set(ticketRef, ticket);
  });

  // El aviso, aparte y sin que un fallo afecte al mensaje, que ya está guardado (y se ve en «Administración»): un
  // documento para todas las cuentas, que no debe hacer fallar los envíos si llegan muchos a la vez. Uno cada 15
  // minutos como mucho: si hubo uno hace menos, este va en el resumen siguiente; si toca, lleva también los que
  // esperaban
  const notice = await db()
    .runTransaction(async (tx) => {
      const state = (await tx.get(noticeRef)).data();
      if (!noticeDue(state?.lastSentAt, now)) {
        tx.set(noticeRef, { pending: FieldValue.increment(1) }, { merge: true });
        return null;
      }
      tx.set(noticeRef, { lastSentAt: now.toISOString(), pending: 0 });
      return { earlier: Math.max(0, Number(state?.pending ?? 0)) };
    })
    .catch((error: unknown) => {
      logger.error('Feedback notice not updated', { error: error instanceof Error ? error.message : String(error) });
      return null;
    });

  logger.info('Feedback received', { type: input.type, hasContext: Boolean(input.context), notifyNow: !!notice });
  if (notice) await sendEmail('feedback', adminEmail(), buildFeedbackEmail(ticket, appUrl(), notice.earlier));
  return { id: ticketRef.id };
});

// Avisos de mensajes pendientes (ver noticeDue): cada 15 minutos, uno con cuántos llegaron desde el último aviso
export const flushFeedbackNotices = onSchedule(
  { schedule: 'every 15 minutes', region: REGION, secrets: emailSecrets, retryCount: 0 },
  async () => {
    const now = new Date();
    const ref = db().doc(NOTICE_DOC);
    const count = await db().runTransaction(async (tx) => {
      const notice = (await tx.get(ref)).data();
      const pending = Number(notice?.pending ?? 0);
      // Con un minuto de margen: si no, un aviso de hace casi 15 minutos haría esperar al resumen 15 más
      if (pending <= 0 || !noticeDue(notice?.lastSentAt, now, FLUSH_SLACK_MS)) return 0;
      tx.set(ref, { lastSentAt: now.toISOString(), pending: 0 });
      return pending;
    });
    if (count > 0) await sendEmail('feedback', adminEmail(), buildFeedbackDigestEmail(count, appUrl()));
  }
);

// Respuesta de la administración: se envía por email a quien escribió (si contesta, le llega a la administración) y se
// guarda en el mensaje. En tres pasos, para que una respuesta nunca salga dos veces:
// 1. Se anota que se está enviando (con el id que pone la app y repite en los reintentos). Si ya se envió, se devuelve
//    sin reenviarla; si quedó a medias, no se sabe si salió y no se reenvía.
// 2. Se envía, fuera de cualquier transacción (sus reintentos no la reenvían). Si falla, se quita la anotación.
// 3. Se guarda leyendo el estado del momento: un mensaje nuevo pasa a leído; uno cerrado o reabierto entretanto, no
//    cambia. En los emuladores no se envía nada y se guarda igual, para poder probarlo.
export const replyToFeedback = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw new HttpsError('permission-denied', 'Solo la administración puede responder los mensajes.');
  }
  const reply = parseReply(request.data);
  if (!reply) throw new HttpsError('invalid-argument', 'Escribe la respuesta.');

  const ref = db().doc(`feedback_tickets/${reply.ticketId}`);
  const pending = new FieldPath('pendingReplies', reply.replyId);

  const start = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'El mensaje ya no existe.');
    const ticket = snapshot.data() as FeedbackTicket;
    const state = replyState(ticket, reply.replyId);
    if (state.kind === 'new') tx.update(ref, pending, new Date().toISOString());
    return { ticket, state };
  });
  if (start.state.kind === 'sent') return start.state.reply;
  if (start.state.kind === 'uncertain') {
    throw new HttpsError(
      'aborted',
      'Esta respuesta ya se estaba enviando y no se sabe si salió: para no duplicarla, no se reenvía.'
    );
  }

  const result = await sendEmail(
    'feedback-reply',
    start.ticket.email,
    buildReplyEmail(start.ticket, reply.message, appUrl())
  );
  if (result === 'failed' || (result === 'skipped' && !isEmulator)) {
    // No salió: se quita la anotación para poder reintentarlo
    await ref.update(pending, FieldValue.delete()).catch(() => undefined);
    throw result === 'failed'
      ? new HttpsError('unavailable', 'No se pudo enviar la respuesta. Inténtalo de nuevo.')
      : new HttpsError('failed-precondition', 'El envío de correos no está configurado.');
  }

  const saved: FeedbackReply = { id: reply.replyId, message: reply.message, sentAt: new Date().toISOString() };
  await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    // Si el mensaje se eliminó entretanto (con la cuenta que lo envió), no hay dónde guardarla
    if (!snapshot.exists) return;
    const current = snapshot.data() as FeedbackTicket;
    tx.update(
      ref,
      'replies',
      FieldValue.arrayUnion(saved),
      pending,
      FieldValue.delete(),
      'status',
      current.status === 'new' ? 'read' : current.status,
      'updatedAt',
      saved.sentAt
    );
  });
  logger.info('Feedback replied');
  return saved;
});
