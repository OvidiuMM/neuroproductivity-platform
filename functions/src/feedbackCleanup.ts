import { adminDb } from './adminApp';
import { recentSends } from './feedbackLogic';

const db = adminDb;

// Firestore admite como máximo 500 escrituras por lote
const BATCH_LIMIT = 450;

// Al eliminar la cuenta se borran también sus mensajes, por lotes y sin límite de cantidad. El contador de envíos se
// conserva mientras le quede algún envío de la última hora (solo esas horas, sin más datos): si no, borrar la cuenta
// a medias serviría para saltarse el límite de 5 por hora. Si algo falla a medias, volver a llamarla termina el trabajo.
export const forgetFeedback = async (uid: string) => {
  const tickets = await db().collection('feedback_tickets').where('uid', '==', uid).get();
  for (let i = 0; i < tickets.docs.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    tickets.docs.slice(i, i + BATCH_LIMIT).forEach((ticket) => batch.delete(ticket.ref));
    await batch.commit();
  }
  const limitRef = db().doc(`feedback_limits/${uid}`);
  await db().runTransaction(async (tx) => {
    const limit = await tx.get(limitRef);
    if (!limit.exists) return;
    const recent = recentSends((limit.data()?.sent as string[] | undefined) ?? [], new Date());
    if (recent.length > 0) tx.set(limitRef, { sent: recent });
    else tx.delete(limitRef);
  });
};
