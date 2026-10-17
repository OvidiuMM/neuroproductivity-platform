import { adminDb } from './adminApp';

// Saca una cuenta de las notificaciones push (ver push.ts). Va aparte de push.ts para que access.ts lo use sin
// importarlo (push.ts importa de access.ts).

// Sus dispositivos, su índice de tokens y su cola de alarmas: al quedarse sin dispositivos, al cerrar todas sus sesiones
// y cuando la administración le quita el acceso. Las alarmas ya enviadas (alarm_sent) se quedan: así, si vuelve a
// activarlas, no se repiten las que ya se avisaron.
export const forgetPushDevices = async (uid: string) => {
  const db = adminDb();
  const [queued, tokens] = await Promise.all([
    db.collection('alarm_queue').where('uid', '==', uid).get(),
    db.collection('push_tokens').where('uid', '==', uid).get()
  ]);
  await Promise.all([
    db.recursiveDelete(db.doc(`push_devices/${uid}`)),
    ...[...queued.docs, ...tokens.docs].map((d) => d.ref.delete())
  ]);
};

// Todo, también las alarmas ya enviadas: al eliminar la cuenta
export const forgetPushData = async (uid: string) => {
  const db = adminDb();
  const sent = await db.collection('alarm_sent').where('uid', '==', uid).get();
  await Promise.all([forgetPushDevices(uid), ...sent.docs.map((d) => d.ref.delete())]);
};
