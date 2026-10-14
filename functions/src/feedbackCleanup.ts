import { adminDb } from './adminApp';

const db = adminDb;

// Al eliminar la cuenta se borran también sus mensajes y su contador de envíos
export const forgetFeedback = async (uid: string) => {
  const tickets = await db().collection('feedback_tickets').where('uid', '==', uid).get();
  const batch = db().batch();
  tickets.docs.forEach((ticket) => batch.delete(ticket.ref));
  batch.delete(db().doc(`feedback_limits/${uid}`));
  await batch.commit();
};
