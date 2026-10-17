import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
import { onSchedule } from 'firebase-functions/scheduler';
import * as logger from 'firebase-functions/logger';
import { Timestamp, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './adminApp';
import { REGION, requireAuth } from './access';
import { isTimeZone, queuedAlarm, type AlarmTask, type QueuedAlarm } from './alarmLogic';

// NOTIFICACIONES PUSH DE LAS ALARMAS: suenan aunque CLAR esté cerrada.
// - push_devices/{uid} (zona horaria del último dispositivo) y push_devices/{uid}/tokens/{id} (un token de FCM por
//   dispositivo). Solo los escribe registerPushDevice.
// - alarm_queue/{uid}__{taskId}: la próxima alarma de cada tarea, que mantiene al día el trigger de las tareas.
// - sendDueAlarms, cada minuto, envía las que ya tocan y las quita de la cola.
// Nada de esto se lee ni se escribe desde la app (firestore.rules no tiene reglas para estas colecciones).

const db = adminDb;
const BATCH_LIMIT = 450;
const SEND_CONCURRENCY = 10;
const devicesRef = (uid: string) => db().doc(`push_devices/${uid}`);
const queueRef = (uid: string, taskId: string) => db().doc(`alarm_queue/${uid}__${taskId}`);
const tokenId = (token: string) => createHash('sha256').update(token).digest('hex').slice(0, 40);

const queueDoc = (uid: string, taskId: string, alarm: QueuedAlarm) => ({
  uid,
  taskId,
  at: Timestamp.fromMillis(alarm.at),
  due: Timestamp.fromMillis(alarm.due),
  key: alarm.key,
  title: alarm.title,
  body: alarm.body
});

// Vuelve a poner en la cola las alarmas de todas las tareas de la cuenta (al registrar un dispositivo o cambiar de
// zona horaria): las tareas guardadas antes no pasaron por el trigger con un dispositivo registrado
const requeueAccount = async (uid: string, timeZone: string) => {
  const tasks = await db().collection(`users/${uid}/tasks`).where('alarmTime', '>=', '').get();
  const now = Date.now();
  for (let i = 0; i < tasks.docs.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const task of tasks.docs.slice(i, i + BATCH_LIMIT)) {
      const alarm = queuedAlarm(task.id, task.data(), timeZone, now);
      if (alarm) batch.set(queueRef(uid, task.id), queueDoc(uid, task.id, alarm));
      else batch.delete(queueRef(uid, task.id));
    }
    await batch.commit();
  }
};

// Registra el dispositivo que activó las notificaciones: su token de FCM y su zona horaria
export const registerPushDevice = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const { token, timeZone } = (request.data ?? {}) as { token?: unknown; timeZone?: unknown };
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || !isTimeZone(timeZone)) {
    throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  }
  const access = await db().doc(`access/${auth.uid}`).get();
  if (access.data()?.status !== 'approved') throw new HttpsError('permission-denied', 'Tu cuenta aún no tiene acceso.');

  const updatedAt = new Date().toISOString();
  await Promise.all([
    devicesRef(auth.uid).set({ timeZone, updatedAt }),
    devicesRef(auth.uid).collection('tokens').doc(tokenId(token)).set({ token, timeZone, updatedAt })
  ]);
  await requeueAccount(auth.uid, timeZone);
  logger.info('Push device registered');
  return { ok: true };
});

// Al guardar, borrar o completar una tarea, su alarma en la cola se pone al día (o se quita)
export const queueTaskAlarm = onDocumentWritten(
  { document: 'users/{uid}/tasks/{taskId}', region: REGION },
  async (event) => {
    const { uid, taskId } = event.params;
    const after = event.data?.after.data() as AlarmTask | undefined;
    const before = event.data?.before.data() as AlarmTask | undefined;
    // Sin alarma ni antes ni ahora: nada que hacer (la mayoría de las tareas)
    if (!after?.alarmTime && !before?.alarmTime) return;
    const timeZone: unknown = (await devicesRef(uid).get()).data()?.timeZone;
    const alarm = after && isTimeZone(timeZone) ? queuedAlarm(taskId, after, timeZone, Date.now()) : null;
    if (alarm) await queueRef(uid, taskId).set(queueDoc(uid, taskId, alarm));
    else await queueRef(uid, taskId).delete();
  }
);

const INVALID_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

// Envía una alarma de la cola si nadie lo hizo antes: la quita en una transacción y, si era suya, la envía. Una alarma
// cuyo plazo ya venció no se envía.
const sendQueued = async (ref: DocumentReference, now: number) => {
  const claimed = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;
    tx.delete(ref);
    return snapshot.data() as DocumentData;
  });
  if (!claimed || (claimed.due as Timestamp).toMillis() <= now) return 'skipped';
  const tokens = await devicesRef(claimed.uid as string)
    .collection('tokens')
    .get();
  if (tokens.empty) return 'skipped';
  const ttl = Math.min(24 * 60 * 60, Math.max(60, Math.floor(((claimed.due as Timestamp).toMillis() - now) / 1000)));
  const result = await getMessaging().sendEachForMulticast({
    tokens: tokens.docs.map((d) => d.data().token as string),
    data: { title: String(claimed.title), body: String(claimed.body), tag: String(claimed.key), url: '/' },
    webpush: { headers: { Urgency: 'high', TTL: String(ttl) } }
  });
  // Los tokens que ya no valen (la app se desinstaló o se revocó el permiso) se borran
  await Promise.all(
    result.responses.flatMap((response, i) =>
      !response.success && INVALID_TOKEN.has(response.error?.code ?? '') ? [tokens.docs[i].ref.delete()] : []
    )
  );
  return result.successCount > 0 ? 'sent' : 'failed';
};

export const sendDueAlarms = onSchedule(
  { schedule: 'every 1 minutes', region: REGION, timeoutSeconds: 120, retryCount: 0 },
  async () => {
    const now = Date.now();
    const due = await db()
      .collection('alarm_queue')
      .where('at', '<=', Timestamp.fromMillis(now))
      .orderBy('at')
      .limit(200)
      .get();
    const outcomes: string[] = [];
    for (let i = 0; i < due.docs.length; i += SEND_CONCURRENCY) {
      outcomes.push(
        ...(await Promise.all(
          due.docs.slice(i, i + SEND_CONCURRENCY).map((d) => sendQueued(d.ref, now).catch(() => 'failed'))
        ))
      );
    }
    if (outcomes.length) {
      logger.info('Alarms processed', {
        sent: outcomes.filter((o) => o === 'sent').length,
        skipped: outcomes.filter((o) => o === 'skipped').length,
        failed: outcomes.filter((o) => o === 'failed').length
      });
    }
  }
);
