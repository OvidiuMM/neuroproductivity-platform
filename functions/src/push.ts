import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
import { onSchedule } from 'firebase-functions/scheduler';
import * as logger from 'firebase-functions/logger';
import { Timestamp, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore';
import { getMessaging, type BatchResponse, type MulticastMessage } from 'firebase-admin/messaging';
import { adminDb } from './adminApp';
import { REGION, requireAuth } from './access';
import { isTimeZone, notificationText, queuedAlarm, type AlarmTask, type QueuedAlarm } from './alarmLogic';
import { forgetPushDevices } from './pushCleanup';

// NOTIFICACIONES PUSH DE LAS ALARMAS: suenan aunque CLAR esté cerrada, en los dispositivos que las activan.
// - push_devices/{uid} (zona horaria del último dispositivo) y push_devices/{uid}/tokens/{id} (un token de FCM por
//   dispositivo, diez como mucho, con si quiere ver el nombre de la tarea). push_tokens/{id} dice de qué cuenta es cada
//   token y cuándo se renovó: un dispositivo compartido solo recibe las alarmas de la última cuenta registrada en él, y
//   un token sin renovar en 30 días (el dispositivo no ha abierto CLAR) se borra.
// - alarm_queue/{uid}__{taskId}: la próxima alarma de cada tarea, que mantiene al día el trigger de las tareas.
// - alarm_sent/{uid}__{taskId}: la última alarma enviada de cada tarea, para no volver a enviarla.
// - sendDueAlarms, cada minuto, envía las que ya tocan.
// Nada de esto se lee ni se escribe desde la app (firestore.rules no tiene reglas para estas colecciones).

const db = adminDb;
const BATCH_LIMIT = 450;
const SEND_CONCURRENCY = 10;
const MAX_DEVICES = 10;
const STALE_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
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
  clock: alarm.clock,
  taskTitle: alarm.taskTitle,
  body: alarm.body,
  attempts: 0
});

// La alarma que debe estar en la cola para una tarea, o null: ninguna, o la misma que ya se envió. `onlyFuture`: al
// poner al día toda la cuenta, las que ya pasaron no se envían de golpe (la app las avisa al abrirla)
const pendingAlarm = (
  taskId: string,
  task: AlarmTask | undefined,
  timeZone: unknown,
  sentKey: unknown,
  now: number,
  onlyFuture = false
) => {
  const alarm = task && isTimeZone(timeZone) ? queuedAlarm(taskId, task, timeZone, now) : null;
  if (!alarm || alarm.key === sentKey || (onlyFuture && alarm.at <= now)) return null;
  return alarm;
};

// Pone al día la cola de toda la cuenta (al registrar un dispositivo nuevo o cambiar de zona horaria): las tareas
// guardadas antes no pasaron por el trigger con un dispositivo registrado. Solo escribe lo que cambia.
export const requeueAccount = async (uid: string, timeZone: string, now = Date.now()) => {
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
    const alarm = pendingAlarm(task.id, task.data(), timeZone, sentKey.get(task.id), now, true);
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

// Quita un token de una cuenta (y de su índice); si la cuenta se queda sin dispositivos, sale de push
const dropToken = async (uid: string, id: string) => {
  const index = await tokenIndexRef(id).get();
  await Promise.all([tokensRef(uid).doc(id).delete(), index.data()?.uid === uid ? tokenIndexRef(id).delete() : null]);
  if ((await tokensRef(uid).limit(1).get()).empty) await forgetPushDevices(uid);
};

const isValidToken = (token: unknown): token is string =>
  typeof token === 'string' && token.length >= 20 && token.length <= 4096 && /^[\w:.-]+$/.test(token);

// Registra el dispositivo que activó las alarmas con CLAR cerrada: su token de FCM, su zona horaria y si quiere ver el
// nombre de la tarea en la notificación (por defecto no: se vería con el móvil bloqueado)
export const registerPushDevice = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const { token, timeZone, showTitle } = (request.data ?? {}) as {
    token?: unknown;
    timeZone?: unknown;
    showTitle?: unknown;
  };
  if (!isValidToken(token) || !isTimeZone(timeZone)) throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  const access = await db().doc(`access/${auth.uid}`).get();
  if (access.data()?.status !== 'approved') throw new HttpsError('permission-denied', 'Tu cuenta aún no tiene acceso.');

  const id = tokenId(token);
  const [devices, existing, index] = await Promise.all([
    devicesRef(auth.uid).get(),
    tokensRef(auth.uid).doc(id).get(),
    tokenIndexRef(id).get()
  ]);
  // El mismo dispositivo con otra cuenta antes: deja de recibir sus alarmas (y si era su último, ella sale de push)
  const previousUid = index.data()?.uid as string | undefined;
  if (previousUid && previousUid !== auth.uid) {
    await tokensRef(previousUid).doc(id).delete();
    if ((await tokensRef(previousUid).limit(1).get()).empty) await forgetPushDevices(previousUid);
  }

  const updatedAt = new Date().toISOString();
  await Promise.all([
    devicesRef(auth.uid).set({ timeZone, updatedAt }),
    tokensRef(auth.uid)
      .doc(id)
      .set({ token, timeZone, showTitle: showTitle === true, updatedAt }),
    tokenIndexRef(id).set({ uid: auth.uid, updatedAt })
  ]);
  // Como mucho diez dispositivos por cuenta: los que llevan más tiempo sin registrarse salen
  const all = await tokensRef(auth.uid).orderBy('updatedAt', 'desc').get();
  await Promise.all(all.docs.slice(MAX_DEVICES).flatMap((d) => [d.ref.delete(), tokenIndexRef(d.id).delete()]));
  if (!existing.exists || devices.data()?.timeZone !== timeZone) await requeueAccount(auth.uid, timeZone);
  logger.info('Push device registered', { isNew: !existing.exists });
  return { ok: true };
});

// Al desactivarlas en un dispositivo o cerrar sesión en él: su token se borra
export const unregisterPushDevice = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const { token } = (request.data ?? {}) as { token?: unknown };
  if (!isValidToken(token)) throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  await dropToken(auth.uid, tokenId(token));
  logger.info('Push device unregistered');
  return { ok: true };
});

// Pone al día la alarma de una tarea en la cola. En una transacción, con la tarea tal como está ahora (los eventos del
// trigger pueden llegar desordenados, p. ej. «Hecha» y «Deshacer» seguidos) y la última enviada.
export const syncTaskAlarm = (uid: string, taskId: string, now = Date.now()) =>
  db().runTransaction(async (tx) => {
    const [current, devices, sent] = await Promise.all([
      tx.get(db().doc(`users/${uid}/tasks/${taskId}`)),
      tx.get(devicesRef(uid)),
      tx.get(sentRef(uid, taskId))
    ]);
    const task = current.data() as AlarmTask | undefined;
    const alarm = pendingAlarm(taskId, task, devices.data()?.timeZone, sent.data()?.key, now);
    if (alarm) tx.set(queueRef(uid, taskId), queueDoc(uid, taskId, alarm));
    else tx.delete(queueRef(uid, taskId));
    // Tarea borrada: su última alarma enviada ya no hace falta
    if (!task) tx.delete(sentRef(uid, taskId));
  });

export const queueTaskAlarm = onDocumentWritten(
  { document: 'users/{uid}/tasks/{taskId}', region: REGION },
  async (event) => {
    const after = event.data?.after.data() as AlarmTask | undefined;
    const before = event.data?.before.data() as AlarmTask | undefined;
    // Una tarea sin alarma ni antes ni ahora no tiene nada en la cola (la mayoría). Al borrarla, sí se limpia siempre
    if (after && !after.alarmTime && !before?.alarmTime) return;
    await syncTaskAlarm(event.params.uid, event.params.taskId);
  }
);

// Tokens que ya no valen: la app se desinstaló, se revocó el permiso o no son de este proyecto
const INVALID_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential'
]);

export type SendMulticast = (message: MulticastMessage) => Promise<BatchResponse>;
const sendWithFcm: SendMulticast = (message) => getMessaging().sendEachForMulticast(message);

// Envía una alarma de la cola. La toma en una transacción, comprobando que sigue tocando (si la tarea cambió entretanto,
// la nueva alarma espera a su hora), y apunta que se envió. Una alarma cuyo plazo ya venció no se envía, ni a un
// dispositivo que lleva 30 días sin abrir CLAR. Si ningún dispositivo la recibe por un fallo pasajero, vuelve a la cola
// con una espera creciente (1, 2, 4, 8 min) y, tras cinco intentos, se deja.
export const sendQueued = async (ref: DocumentReference, now: number, send: SendMulticast = sendWithFcm) => {
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
  const uid = claimed.uid as string;
  const all = await tokensRef(uid).get();
  const stale = all.docs.filter((d) => Date.parse(String(d.data().updatedAt)) < now - STALE_TOKEN_MS);
  await Promise.all(stale.map((d) => dropToken(uid, d.id)));
  const tokens = all.docs.filter((d) => !stale.includes(d));
  if (tokens.length === 0) return 'skipped';

  const ttl = Math.min(24 * 60 * 60, Math.max(60, Math.floor(((claimed.due as Timestamp).toMillis() - now) / 1000)));
  const alarm = { clock: String(claimed.clock), taskTitle: String(claimed.taskTitle) };
  // Un envío por cada forma del texto: con el nombre de la tarea solo a los dispositivos que lo piden
  const groups = [true, false]
    .map((showTitle) => ({ showTitle, docs: tokens.filter((d) => (d.data().showTitle === true) === showTitle) }))
    .filter((group) => group.docs.length > 0);
  const results = await Promise.all(
    groups.map(async ({ showTitle, docs }) => ({
      docs,
      result: await send({
        tokens: docs.map((d) => d.data().token as string),
        data: {
          title: notificationText(alarm, showTitle),
          body: String(claimed.body),
          tag: String(claimed.key),
          url: '/'
        },
        webpush: { headers: { Urgency: 'high', TTL: String(ttl) } }
      })
    }))
  );
  const responses = results.flatMap(({ docs, result }) =>
    result.responses.map((response, i) => ({ response, doc: docs[i] }))
  );
  await Promise.all(
    responses
      .filter(({ response }) => !response.success && INVALID_TOKEN.has(response.error?.code ?? ''))
      .map(({ doc }) => dropToken(uid, doc.id))
  );
  if (responses.some(({ response }) => response.success)) return 'sent';

  const codes = [...new Set(responses.map(({ response }) => response.error?.code ?? 'unknown'))];
  logger.warn('Alarm push failed', { codes });
  const attempts = Number(claimed.attempts ?? 0) + 1;
  if (codes.some((code) => !INVALID_TOKEN.has(code)) && attempts < MAX_ATTEMPTS) {
    // Si entretanto la tarea puso otra alarma, se queda la nueva
    await ref
      .create({ ...claimed, attempts, at: Timestamp.fromMillis(now + 2 ** (attempts - 1) * 60_000) })
      .catch(() => undefined);
    await sentRef(uid, claimed.taskId as string).delete();
  }
  return 'failed';
};

// Tokens que llevan 30 días sin renovarse (el dispositivo no ha abierto CLAR): se borran aunque no tengan alarmas
export const dropStaleTokens = async (now: number) => {
  const stale = await db()
    .collection('push_tokens')
    .where('updatedAt', '<', new Date(now - STALE_TOKEN_MS).toISOString())
    .limit(100)
    .get();
  await Promise.all(stale.docs.map((d) => dropToken(d.data().uid as string, d.id)));
  return stale.size;
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
    const dropped = await dropStaleTokens(now);
    if (outcomes.length || dropped) {
      logger.info('Alarms processed', {
        sent: outcomes.filter((o) => o === 'sent').length,
        skipped: outcomes.filter((o) => o === 'skipped').length,
        failed: outcomes.filter((o) => o === 'failed').length,
        staleTokens: dropped
      });
    }
  }
);
