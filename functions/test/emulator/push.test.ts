import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../../src/adminApp';
import { dropStaleTokens, requeueAccount, sendQueued, syncTaskAlarm } from '../../src/push';
import { forgetPushData, forgetPushDevices } from '../../src/pushCleanup';

// Se ejecuta contra el emulador de Firestore (npm run test:push): la cola de alarmas, su envío con un FCM simulado y
// la limpieza. FCM no tiene emulador.
// El proyecto del emulador: firebase-admin lo lee al usarse por primera vez (adminDb), no al importarse
process.env.GCLOUD_PROJECT ??= 'demo-neuroproductivity';

const db = adminDb();
const uid = 'ana';
const MADRID = 'Europe/Madrid';
const MINUTE = 60_000;
// 16 oct 2026, 10:00 en Madrid
const now = Date.parse('2026-10-16T08:00:00.000Z');
const fresh = new Date(now).toISOString();

const clear = async () => {
  for (const name of ['push_devices', 'push_tokens', 'alarm_queue', 'alarm_sent', 'users'])
    await db.recursiveDelete(db.collection(name));
};

const device = async (id: string, { showTitle = false, updatedAt = fresh } = {}) => {
  await db.doc(`push_devices/${uid}`).set({ timeZone: MADRID, updatedAt });
  await db
    .doc(`push_devices/${uid}/tokens/${id}`)
    .set({ token: `token-${id}-0123456789`, timeZone: MADRID, showTitle, updatedAt });
  await db.doc(`push_tokens/${id}`).set({ uid, updatedAt });
};

const task = (id: string, fields: Record<string, unknown>) =>
  db.doc(`users/${uid}/tasks/${id}`).set({ id, title: 'Pagar el alquiler', status: 'PENDING', ...fields });

const queued = async (taskId: string) => (await db.doc(`alarm_queue/${uid}__${taskId}`).get()).data();

// FCM simulado: apunta cada envío y responde con los códigos de error dados (o éxito)
const fakeFcm = (error?: string) => {
  const sent: MulticastMessage[] = [];
  const send = (message: MulticastMessage): Promise<BatchResponse> => {
    sent.push(message);
    const responses = message.tokens.map(() =>
      error ? { success: false, error: { code: error } } : { success: true, messageId: 'm' }
    ) as BatchResponse['responses'];
    const successCount = error ? 0 : message.tokens.length;
    return Promise.resolve({ responses, successCount, failureCount: message.tokens.length - successCount });
  };
  return { sent, send };
};

describe('push alarms', () => {
  beforeEach(clear);
  after(clear);

  it('queues the alarm of a task, not again once sent, and cleans up when the task is deleted', async () => {
    await device('d1');
    await task('t1', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '11:30' });
    await syncTaskAlarm(uid, 't1', now);
    const alarm = await queued('t1');
    assert.equal(alarm?.key, 't1@2026-10-16T09:30:00.000Z');
    assert.equal(alarm?.clock, '11:30');

    await db.doc(`alarm_sent/${uid}__t1`).set({ uid, taskId: 't1', key: alarm?.key });
    await db.doc(`alarm_queue/${uid}__t1`).delete();
    await task('t1', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '11:30', priority: 'HIGH' });
    await syncTaskAlarm(uid, 't1', now);
    assert.equal(await queued('t1'), undefined);

    await db.doc(`users/${uid}/tasks/t1`).delete();
    await syncTaskAlarm(uid, 't1', now);
    assert.equal((await db.doc(`alarm_sent/${uid}__t1`).get()).exists, false);
  });

  it('requeues the whole account without the alarms whose time already passed', async () => {
    await device('d1');
    await task('past', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:00' });
    await task('future', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '11:00' });
    await requeueAccount(uid, MADRID, now);
    assert.equal(await queued('past'), undefined);
    assert.ok(await queued('future'));
  });

  it('sends to each device with or without the task name, and records it as sent', async () => {
    await device('d1');
    await device('d2', { showTitle: true });
    await task('t1', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:30' });
    await syncTaskAlarm(uid, 't1', now - 60 * MINUTE);
    const fcm = fakeFcm();
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now, fcm.send), 'sent');
    assert.deepEqual(fcm.sent.map((m) => m.data?.title).sort(), [
      'Alarma de las 09:30: Pagar el alquiler',
      'Tienes una alarma de CLAR a las 09:30'
    ]);
    assert.equal(await queued('t1'), undefined);
    assert.equal((await db.doc(`alarm_sent/${uid}__t1`).get()).data()?.key, 't1@2026-10-16T07:30:00.000Z');
  });

  it('puts the alarm back with a growing wait after a transient failure', async () => {
    await device('d1');
    await task('t1', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:30' });
    await syncTaskAlarm(uid, 't1', now - 60 * MINUTE);
    const fcm = fakeFcm('messaging/internal-error');
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now, fcm.send), 'failed');
    const retry = await queued('t1');
    assert.equal(retry?.attempts, 1);
    assert.equal((retry?.at as Timestamp).toMillis(), now + MINUTE);
    assert.equal((await db.doc(`alarm_sent/${uid}__t1`).get()).exists, false);
  });

  it('drops invalid and stale tokens, and an account without devices leaves push', async () => {
    await device('d1');
    await task('t1', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:30' });
    await syncTaskAlarm(uid, 't1', now - 60 * MINUTE);
    const fcm = fakeFcm('messaging/mismatched-credential');
    await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now, fcm.send);
    assert.equal((await db.doc(`push_devices/${uid}`).get()).exists, false);
    assert.equal((await db.doc('push_tokens/d1').get()).exists, false);

    // Un dispositivo que lleva más de 30 días sin abrir CLAR no recibe nada y se borra
    await device('old', { updatedAt: new Date(now - 31 * 24 * 60 * MINUTE).toISOString() });
    assert.equal(await dropStaleTokens(now), 1);
    assert.equal((await db.doc(`push_devices/${uid}/tokens/old`).get()).exists, false);
  });

  it('keeps the alarms already sent when the devices go, and forgets them with the account', async () => {
    await device('d1');
    await db.doc(`alarm_sent/${uid}__t1`).set({ uid, taskId: 't1', key: 'k' });
    await forgetPushDevices(uid);
    assert.equal((await db.doc(`push_devices/${uid}`).get()).exists, false);
    assert.equal((await db.doc(`alarm_sent/${uid}__t1`).get()).exists, true);
    await forgetPushData(uid);
    assert.equal((await db.doc(`alarm_sent/${uid}__t1`).get()).exists, false);
  });
});
