import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import { Timestamp } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/https';
import { adminDb } from '../../src/adminApp';
import {
  dropStaleTokens,
  requeueAccount,
  sendQueued,
  sendTestPush,
  syncTaskAlarm,
  testPush,
  tokenId
} from '../../src/push';
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

// Sin `language`, como los registrados antes de 1.2.0 (español)
const device = async (
  id: string,
  {
    showTitle = false,
    updatedAt = fresh,
    language
  }: { showTitle?: boolean; updatedAt?: string; language?: string } = {}
) => {
  await db.doc(`push_devices/${uid}`).set({ timeZone: MADRID, updatedAt });
  await db
    .doc(`push_devices/${uid}/tokens/${id}`)
    .set({ token: `token-${id}-0123456789`, timeZone: MADRID, showTitle, updatedAt, ...(language && { language }) });
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
    // Sin textos: se escriben al enviarla, en el idioma de cada dispositivo
    assert.equal(alarm?.timeZone, MADRID);
    assert.equal(alarm?.hasDueTime, true);
    assert.equal(alarm && 'body' in alarm, false);

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
    // La hora de la alarma (la notificación la muestra) y la dirección que abre su tarea
    assert.equal(fcm.sent[0].data?.at, '2026-10-16T07:30:00.000Z');
    assert.equal(fcm.sent[0].data?.url, `/?alarma=${encodeURIComponent('t1@2026-10-16T07:30:00.000Z')}`);
  });

  it('sends an alarm queued by 1.1.0 (with its text and without time zone) like a new one', async () => {
    await device('d1');
    await task('t1', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:30' });
    await syncTaskAlarm(uid, 't1', now - 60 * MINUTE);
    const fresh = fakeFcm();
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now, fresh.send), 'sent');
    // La misma alarma, como la dejaba 1.1.0 en la cola: con `body` y sin `timeZone` ni `hasDueTime`
    await db.doc(`alarm_sent/${uid}__t1`).delete();
    const at = Date.parse('2026-10-16T07:30:00.000Z');
    await db.doc(`alarm_queue/${uid}__t1`).set({
      uid,
      taskId: 't1',
      at: Timestamp.fromMillis(at),
      due: Timestamp.fromMillis(Date.parse('2026-10-16T10:00:00.000Z')),
      key: 't1@2026-10-16T07:30:00.000Z',
      clock: '09:30',
      taskTitle: 'Pagar el alquiler',
      body: 'Vence hoy a las 12:00',
      attempts: 0
    });
    const old = fakeFcm();
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now, old.send), 'sent');
    assert.deepEqual(old.sent[0].data, fresh.sent[0].data);
  });

  it('writes each notification in the language of its device; one registered before 1.2.0, in Spanish', async () => {
    await device('d1');
    await device('d2', { showTitle: true, language: 'en' });
    await device('d3', { language: 'en' });
    await device('d4', { language: 'es' });
    await task('t1', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:30' });
    await syncTaskAlarm(uid, 't1', now - 60 * MINUTE);
    const fcm = fakeFcm();
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now, fcm.send), 'sent');
    // Un envío por idioma y forma del texto: los dos dispositivos en español sin el nombre van juntos
    const sent = (title: string) => fcm.sent.find((m) => m.data?.title === title);
    assert.deepEqual(fcm.sent.map((m) => m.data?.title).sort(), [
      'Alarm at 09:30: Pagar el alquiler',
      'Tienes una alarma de CLAR a las 09:30',
      'You have a CLAR alarm at 09:30'
    ]);
    assert.equal(sent('Alarm at 09:30: Pagar el alquiler')?.data?.body, 'Due 16 Oct at 12:00');
    assert.equal(sent('You have a CLAR alarm at 09:30')?.data?.body, 'Due 16 Oct at 12:00');
    const spanish = sent('Tienes una alarma de CLAR a las 09:30');
    assert.match(spanish?.data?.body ?? '', /^Vence el 16 oct\.? a las 12:00$/);
    assert.deepEqual([...(spanish?.tokens ?? [])].sort(), ['token-d1-0123456789', 'token-d4-0123456789']);
  });

  it('recomputes a queued alarm when sending: one queued before 0.9.7 for the day before waits for its day', async () => {
    await device('d1');
    // Solo con fecha (el 17) y alarma a las 09:30: antes sonaba la víspera, el 16; ahora, el 17
    await task('t1', { dueDate: '2026-10-17', alarmTime: '09:30' });
    await db.doc(`alarm_queue/${uid}__t1`).set({
      uid,
      taskId: 't1',
      at: Timestamp.fromMillis(Date.parse('2026-10-16T07:30:00.000Z')),
      due: Timestamp.fromMillis(Date.parse('2026-10-17T21:59:59.999Z')),
      key: 't1@2026-10-16T07:30:00.000Z',
      clock: '09:30',
      taskTitle: 'Pagar el alquiler',
      body: 'Vence el 17 oct',
      attempts: 0
    });
    const fcm = fakeFcm();
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now, fcm.send), 'requeued');
    assert.equal(fcm.sent.length, 0);
    assert.equal((await queued('t1'))?.key, 't1@2026-10-17T07:30:00.000Z');
    assert.equal((await db.doc(`alarm_sent/${uid}__t1`).get()).exists, false);

    // Y una que se volvió a poner después de su hora ya no suena: sale de la cola
    await task('t2', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:30' });
    await syncTaskAlarm(uid, 't2', now - 60 * MINUTE);
    await task('t2', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '09:30', alarmSetAt: fresh });
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t2`), now, fcm.send), 'skipped');
    assert.equal(await queued('t2'), undefined);
    assert.equal(fcm.sent.length, 0);
  });

  it('keeps at most 100 alarms in the queue of an account', async () => {
    await device('d1');
    const batch = db.batch();
    for (let i = 0; i < 100; i++)
      batch.set(db.doc(`alarm_queue/${uid}__q${i}`), {
        uid,
        taskId: `q${i}`,
        at: Timestamp.fromMillis(now + MINUTE),
        key: `q${i}`
      });
    await batch.commit();
    await task('t-extra', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '11:30' });
    await syncTaskAlarm(uid, 't-extra', now);
    assert.equal(await queued('t-extra'), undefined);
    // Una que ya estaba en la cola sí se pone al día
    await task('q0', { dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '11:30' });
    await syncTaskAlarm(uid, 'q0', now);
    assert.equal((await queued('q0'))?.key, 'q0@2026-10-16T09:30:00.000Z');
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

    // Al minuto, el reintento es la misma alarma: se envía
    const ok = fakeFcm();
    assert.equal(await sendQueued(db.doc(`alarm_queue/${uid}__t1`), now + MINUTE, ok.send), 'sent');
    assert.equal(ok.sent.length, 1);
    assert.equal((await db.doc(`alarm_sent/${uid}__t1`).get()).data()?.key, 't1@2026-10-16T07:30:00.000Z');
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

  describe('«Probar notificación»', () => {
    const token = 'token-prueba-0123456789';
    const registerThis = async (language?: string) => {
      const id = tokenId(token);
      await db.doc(`push_devices/${uid}`).set({ timeZone: MADRID, updatedAt: fresh });
      await db
        .doc(`push_devices/${uid}/tokens/${id}`)
        .set({ token, timeZone: MADRID, showTitle: false, updatedAt: fresh, ...(language && { language }) });
      await db.doc(`push_tokens/${id}`).set({ uid, updatedAt: fresh });
    };
    beforeEach(() => db.doc(`push_limits/${uid}`).delete());

    it('sends one notice to a registered device of the account, at most five an hour', async () => {
      await registerThis();
      const fcm = fakeFcm();
      for (let i = 0; i < 5; i++) await testPush(uid, token, fcm.send, now + i * MINUTE);
      assert.equal(fcm.sent.length, 5);
      assert.deepEqual(fcm.sent[0].tokens, [token]);
      assert.equal(fcm.sent[0].data?.tag, 'clar-test');
      await assert.rejects(testPush(uid, token, fcm.send, now + 5 * MINUTE), /varias veces/);
      // Una hora después, otra vez
      await testPush(uid, token, fcm.send, now + 61 * MINUTE);
      assert.equal(fcm.sent.length, 6);
    });

    it('writes the notice in the language of the device', async () => {
      await registerThis();
      const fcm = fakeFcm();
      await testPush(uid, token, fcm.send, now);
      assert.equal(fcm.sent[0].data?.body, 'Así te avisará CLAR de tus alarmas, también con la app cerrada.');
      await registerThis('en');
      await testPush(uid, token, fcm.send, now + MINUTE);
      assert.equal(
        fcm.sent[1].data?.body,
        'This is how CLAR will notify you of your alarms, even when the app is closed.'
      );
    });

    it('says why it failed in the language of the account', async () => {
      // Sin acceso aprobado: el error sale en el idioma del perfil (sin él, en español)
      const call = (data: Record<string, unknown> = {}) =>
        sendTestPush.run({ auth: { uid, token: {} }, data: { token, ...data } } as unknown as CallableRequest);
      await assert.rejects(call(), { code: 'permission-denied', message: 'Tu cuenta aún no tiene acceso.' });
      await db.doc(`users/${uid}`).set({ language: 'en' });
      await assert.rejects(call(), { code: 'permission-denied', message: "Your account doesn't have access yet." });
      // El que envía la app con la petición, si lo envía, manda
      await assert.rejects(call({ language: 'es' }), { message: 'Tu cuenta aún no tiene acceso.' });
    });

    it('keeps the registration limit apart from the tests', async () => {
      await registerThis();
      await db.doc(`push_limits/${uid}`).set({ at: [fresh] });
      await testPush(uid, token, fakeFcm().send, now);
      const limits = (await db.doc(`push_limits/${uid}`).get()).data();
      assert.deepEqual(limits?.at, [fresh]);
      assert.equal((limits?.tests as string[]).length, 1);
    });

    it('refuses a device that is not registered in the account', async () => {
      const fcm = fakeFcm();
      await assert.rejects(testPush(uid, token, fcm.send, now), /Activa antes/);
      await registerThis();
      await assert.rejects(testPush('bruno', token, fcm.send, now), /Activa antes/);
      assert.equal(fcm.sent.length, 0);
    });

    it('drops a token that no longer works and says so; the account leaves push with its last device', async () => {
      await registerThis();
      await assert.rejects(
        testPush(uid, token, fakeFcm('messaging/registration-token-not-registered').send, now),
        /ya no recibe avisos/
      );
      assert.equal((await db.doc(`push_tokens/${tokenId(token)}`).get()).exists, false);
      assert.equal((await db.doc(`push_devices/${uid}`).get()).exists, false);
    });
  });
});
