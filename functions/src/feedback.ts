import { HttpsError, onCall } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { adminDb } from './adminApp';
import { normalizeEmail } from './accessLogic';
import { adminEmail, appUrl, emailSecrets, REGION, requireAuth, sendEmail } from './access';
import { FEEDBACK_LIMIT, buildFeedbackEmail, parseFeedback, recentSends, type FeedbackTicket } from './feedbackLogic';

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
