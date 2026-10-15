import { HttpsError, onCall } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { FieldValue } from 'firebase-admin/firestore';
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
  buildFeedbackEmail,
  buildReplyEmail,
  parseFeedback,
  parseReply,
  recentSends,
  type FeedbackReply,
  type FeedbackTicket
} from './feedbackLogic';

const db = adminDb;

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

  logger.info('Feedback received', { type: input.type, hasContext: Boolean(input.context) });
  await sendEmail('feedback', adminEmail(), buildFeedbackEmail(ticket, appUrl()));
  return { id: ticketRef.id };
});

// Respuesta de la administración: se envía por email a quien escribió (si contesta, le llega a la administración) y,
// solo si el envío sale, se guarda en el mensaje. Un mensaje nuevo pasa a leído. En los emuladores no se envía nada y
// se guarda igual, para poder probarlo.
export const replyToFeedback = onCall({ region: REGION, secrets: emailSecrets }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw new HttpsError('permission-denied', 'Solo la administración puede responder los mensajes.');
  }
  const reply = parseReply(request.data);
  if (!reply) throw new HttpsError('invalid-argument', 'Escribe la respuesta.');

  const ref = db().doc(`feedback_tickets/${reply.ticketId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'El mensaje ya no existe.');
  const ticket = snapshot.data() as FeedbackTicket;

  const result = await sendEmail('feedback-reply', ticket.email, buildReplyEmail(ticket, reply.message, adminEmail()));
  if (result === 'failed') throw new HttpsError('unavailable', 'No se pudo enviar la respuesta. Inténtalo de nuevo.');
  if (result === 'skipped' && !isEmulator) {
    throw new HttpsError('failed-precondition', 'El envío de correos no está configurado.');
  }

  const saved: FeedbackReply = { message: reply.message, sentAt: new Date().toISOString() };
  await ref.update({
    replies: FieldValue.arrayUnion(saved),
    status: ticket.status === 'new' ? 'read' : ticket.status,
    updatedAt: saved.sentAt
  });
  logger.info('Feedback replied');
  return saved;
});
