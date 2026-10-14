import { adminDb } from './adminApp';

const db = adminDb;

// Firestore admite como máximo 500 escrituras por lote
const BATCH_LIMIT = 450;

// Al eliminar la cuenta se borran también sus mensajes y su contador de envíos, por lotes y sin límite de cantidad.
// Si algo falla a medias, volver a llamarla termina el trabajo (borra lo que quede).
export const forgetFeedback = async (uid: string) => {
  const tickets = await db().collection('feedback_tickets').where('uid', '==', uid).get();
  const refs = [...tickets.docs.map((ticket) => ticket.ref), db().doc(`feedback_limits/${uid}`)];
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};
