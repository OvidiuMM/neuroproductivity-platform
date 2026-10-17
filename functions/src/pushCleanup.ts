import { adminDb } from './adminApp';

// Al eliminar la cuenta: sus dispositivos de las notificaciones push y su cola de alarmas (ver push.ts). Va aparte de
// push.ts para que access.ts lo use sin importarlo (push.ts importa de access.ts).
export const forgetPushData = async (uid: string) => {
  const db = adminDb();
  const queued = await db.collection('alarm_queue').where('uid', '==', uid).get();
  await Promise.all([db.recursiveDelete(db.doc(`push_devices/${uid}`)), ...queued.docs.map((d) => d.ref.delete())]);
};
