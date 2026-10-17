import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
import { onSchedule } from 'firebase-functions/scheduler';
import * as logger from 'firebase-functions/logger';
import { Timestamp, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './adminApp';
import { REGION, requireAuth } from './access';
import { isTimeZone, queuedAlarm, type AlarmTask, type QueuedAlarm } from './alarmLogic';
import { forgetPushData } from './pushCleanup';

// NOTIFICACIONES PUSH DE LAS ALARMAS: suenan aunque CLAR esté cerrada, en los dispositivos que las activan.
// - push_devices/{uid} (zona horaria del último dispositivo) y push_devices/{uid}/tokens/{id} (un token de FCM por
//   dispositivo, diez como mucho). push_tokens/{id} dice de qué cuenta es cada token: un dispositivo compartido solo
//   recibe las alarmas de la última cuenta que se registró en él.
// - alarm_queue/{uid}__{taskId}: la próxima alarma de cada tarea, que mantiene al día el trigger de las tareas.
// - alarm_sent/{uid}__{taskId}: la última alarma enviada de cada tarea, para no volver a enviarla al editar la tarea.
// - sendDueAlarms, cada minuto, envía las que ya tocan.
// Nada de esto se lee ni se escribe desde la app (firestore.rules no tiene reglas para estas colecciones).

const db = adminDb;
const BATCH_LIMIT = 450;
const SEND_CONCURRENCY = 10;
const MAX_DEVICES = 10;
const devicesRef = (uid: string) => db().doc(`push_devices/${uid}`);
const tokensRef = (uid: string) => devicesRef(uid).collection('tokens');
const tokenIndexRef = (id: string) => db().doc(`push_tokens/${id}`);
const queueRef = (uid: string, taskId: string) => db().doc(`alarm_queue/${uid}__${taskId}`);
const sentRef = (uid: string, taskId: string) => db().doc(`alarm_sent/${uid}__${taskId}`);
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

// La alarma que debe estar en la cola para una tarea, o null: ninguna, o la misma que ya se envió
const pendingAlarm = (taskId: string, task: AlarmTask | undefined, timeZone: unknown, sentKey: unknown) => {
  const alarm = task && isTimeZone(timeZone) ? queuedAlarm(taskId, task, timeZone, Date.now()) : null;
  return alarm && alarm.key !== sentKey ? alarm : null;
};

// Pone al día la cola de toda la cuenta (al registrar un dispositivo nuevo o cambiar de zona horaria): las tareas
// guardadas antes no pasaron por el trigger con un dispositivo registrado. Solo escribe lo que cambia.
const requeueAccount = async (uid: string, timeZone: string) => {
  const [tasks, queued, sent] = await Promise.all([
    db().collection(`users/${uid}/tasks`).where('alarmTime', '>=', '').get(),
    db().collection('alarm_queue').where('uid', '==', uid).get(),
    db().collection('alarm_sent').where('uid', '==', uid).get()
  ]);
  const queuedKey = new Map(queued.docs.map((d) => [d.data().taskId as string, d.data().key as unknown]));
  const sentKey = new Map(sent.docs.map((d) => [d.data().taskId as string, d.data().key as unknown]));
  const writes: ((batch: WriteBatch) => void)[] = [];
  const withAlarm = new Set<string>();
  for (const task of tasks.docs) {
    const alarm = pendingAlarm(task.id, task.data(), timeZone, sentKey.get(task.id));
    if (!alarm) continue;
    withAlarm.add(task.id);
    if (queuedKey.get(task.id) !== alarm.key)
      writes.push((batch) => batch.set(queueRef(uid, task.id), queueDoc(uid, task.id, alarm)));
  }
  for (const taskId of queuedKey.keys())
    if (!withAlarm.has(taskId)) writes.push((batch) => batch.delete(queueRef(uid, taskId)));
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    writes.slice(i, i + BATCH_LIMIT).forEach((write) => write(batch));
    await batch.commit();
  }
};

const isValidToken = (token: unknown): token is string =>
  typeof token === 'string' && token.length >= 20 && token.length <= 4096 && /^[\w:.-]+$/.test(token);

// Registra el dispositivo que activó las notificaciones con CLAR cerrada: su token de FCM y su zona horaria
export const registerPushDevice = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const { token, timeZone } = (request.data ?? {}) as { token?: unknown; timeZone?: unknown };
  if (!isValidToken(token) || !isTimeZone(timeZone)) throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  const access = await db().doc(`access/${auth.uid}`).get();
  if (access.data()?.status !== 'approved') throw new HttpsError('permission-denied', 'Tu cuenta aún no tiene acceso.');

  const id = tokenId(token);
  const [devices, existing, index] = await Promise.all([
    devicesRef(auth.uid).get(),
    tokensRef(auth.uid).doc(id).get(),
    tokenIndexRef(id).get()
  ]);
  // El mismo dispositivo con otra cuenta antes: deja de recibir las alarmas de aquella
  const previousUid = index.data()?.uid as string | undefined;
  if (previousUid && previousUid !== auth.uid) await tokensRef(previousUid).doc(id).delete();

  const updatedAt = new Date().toISOString();
  await Promise.all([
    devicesRef(auth.uid).set({ timeZone, updatedAt }),
    tokensRef(auth.uid).doc(id).set({ token, timeZone, updatedAt }),
    tokenIndexRef(id).set({ uid: auth.uid, updatedAt })
  ]);
  // Como mucho diez dispositivos por cuenta: los que llevan más tiempo sin registrarse salen
  const all = await tokensRef(auth.uid).orderBy('updatedAt', 'desc').get();
  await Promise.all(all.docs.slice(MAX_DEVICES).flatMap((d) => [d.ref.delete(), tokenIndexRef(d.id).delete()]));
  if (!existing.exists || devices.data()?.timeZone !== timeZone) await requeueAccount(auth.uid, timeZone);
  logger.info('Push device registered', { isNew: !existing.exists });
  return { ok: true };
});

// Al desactivarlas en un dispositivo o cerrar sesión en él: su token se borra. Sin dispositivos, la cuenta sale de push.
export const unregisterPushDevice = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const { token } = (request.data ?? {}) as { token?: unknown };
  if (!isValidToken(token)) throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  const id = tokenId(token);
  const index = await tokenIndexRef(id).get();
  await Promise.all([
    tokensRef(auth.uid).doc(id).delete(),
    index.data()?.uid === auth.uid ? tokenIndexRef(id).delete() : null
  ]);
  if ((await tokensRef(auth.uid).limit(1).get()).empty) await forgetPushData(auth.uid);
  logger.info('Push device unregistered');
  return { ok: true };
});

// Al guardar, borrar o completar una tarea, su alarma en la cola se pone al día (o se quita). Se lee la tarea tal como
// está ahora, no la del evento: los eventos pueden llegar desordenados (p. ej. «Hecha» y «Deshacer» seguidos).
export const queueTaskAlarm = onDocumentWritten(
  { document: 'users/{uid}/tasks/{taskId}', region: REGION },
  async (event) => {
    const { uid, taskId } = event.params;
    const after = event.data?.after.data() as AlarmTask | undefined;
    const before = event.data?.before.data() as AlarmTask | undefined;
    // Sin alarma ni antes ni ahora: nada que hacer (la mayoría de las tareas)
    if (!after?.alarmTime && !before?.alarmTime) return;
    const [current, devices, sent] = await Promise.all([
      db().doc(`users/${uid}/tasks/${taskId}`).get(),
      devicesRef(uid).get(),
      sentRef(uid, taskId).get()
    ]);
    const task = current.data() as AlarmTask | undefined;
    const alarm = pendingAlarm(taskId, task, devices.data()?.timeZone, sent.data()?.key);
    if (alarm) await queueRef(uid, taskId).set(queueDoc(uid, taskId, alarm));
    else await queueRef(uid, taskId).delete();
    if (!task) await sentRef(uid, taskId).delete();
  }
);

const INVALID_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

// Envía una alarma de la cola. La toma en una transacción, comprobando que sigue tocando (si la tarea cambió entretanto,
// la nueva alarma espera a su hora), y apunta que se envió. Una alarma cuyo plazo ya venció no se envía. Si ningún
// dispositivo la recibe por un fallo pasajero, vuelve a la cola para el minuto siguiente.
const sendQueued = async (ref: DocumentReference, now: number) => {
  const claimed = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data || (data.at as Timestamp).toMillis() > now) return null;
    tx.delete(ref);
    tx.set(sentRef(data.uid as string, data.taskId as string), {
      uid: data.uid as string,
      taskId: data.taskId as string,
      key: data.key as string,
      sentAt: Timestamp.fromMillis(now)
    });
    return data;
  });
  if (!claimed || (claimed.due as Timestamp).toMillis() <= now) return 'skipped';
  const tokens = await tokensRef(claimed.uid as string).get();
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
      !response.success && INVALID_TOKEN.has(response.error?.code ?? '')
        ? [tokens.docs[i].ref.delete(), tokenIndexRef(tokens.docs[i].id).delete()]
        : []
    )
  );
  if (result.successCount > 0) return 'sent';
  const codes = [...new Set(result.responses.map((r) => r.error?.code ?? 'unknown'))];
  logger.warn('Alarm push failed', { codes });
  if (codes.some((code) => !INVALID_TOKEN.has(code))) {
    // Si entretanto la tarea puso otra alarma, se queda la nueva
    await ref.create(claimed).catch(() => undefined);
    await sentRef(claimed.uid as string, claimed.taskId as string).delete();
  }
  return 'failed';
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
          due.docs.slice(i, i + SEND_CONCURRENCY).map((d) =>
            sendQueued(d.ref, now).catch((e: unknown) => {
              logger.error('Alarm push error', { code: (e as { code?: string }).code ?? 'unknown' });
              return 'failed';
            })
          )
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
