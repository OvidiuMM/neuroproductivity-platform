import { adminDb } from './adminApp';

// Saca una cuenta de las notificaciones push (al eliminarla, al cerrar todas sus sesiones o al quedarse sin
// dispositivos): sus dispositivos, su índice de tokens, su cola de alarmas y las ya enviadas (ver push.ts). Va aparte de
// push.ts para que access.ts lo use sin importarlo (push.ts importa de access.ts).
export const forgetPushData = async (uid: string) => {
  const db = adminDb();
  const [queued, sent, tokens] = await Promise.all([
    db.collection('alarm_queue').where('uid', '==', uid).get(),
    db.collection('alarm_sent').where('uid', '==', uid).get(),
    db.collection('push_tokens').where('uid', '==', uid).get()
  ]);
  await Promise.all([
    db.recursiveDelete(db.doc(`push_devices/${uid}`)),
    ...[...queued.docs, ...sent.docs, ...tokens.docs].map((d) => d.ref.delete())
  ]);
};
