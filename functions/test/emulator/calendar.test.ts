import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, beforeEach, describe, it } from 'node:test';
import { adminDb } from '../../src/adminApp';
import { DEMO_ADMIN_EMAIL } from '../../src/accessLogic';
import { disconnectCalendar } from '../../src/calendarCleanup';
import { sealToken } from '../../src/calendarCrypto';
import type { CalendarEventBody } from '../../src/calendarLogic';
import { calendarEntitled, connectCalendar, syncTaskEvent, type CalendarDeps } from '../../src/calendarSync';
import { CALENDAR_SCOPE, GoogleApiError, type GoogleCalendarApi } from '../../src/googleCalendar';

// Se ejecuta contra el emulador de Firestore (npm run test:push): la conexión con Google Calendar, la sincronización de
// cada tarea y la desconexión, con un Google simulado (sin red)
// El proyecto del emulador: firebase-admin lo lee al usarse por primera vez (adminDb), no al importarse
process.env.GCLOUD_PROJECT ??= 'demo-neuroproductivity';

const db = adminDb();
const URL = 'https://clar.example';
const KEY = randomBytes(32);
const MADRID = 'Europe/Madrid';
const UIDS = ['cal-ana', 'cal-bruno', 'cal-admin'];
const request = (code = 'abc') => ({
  code,
  codeVerifier: 'v'.repeat(43),
  redirectUri: `${URL}/oauth/google.html`,
  timeZone: MADRID
});

// Google simulado: guarda los eventos del calendario y apunta cada llamada. `during` deja hacer algo justo antes de que
// Google responda (p. ej. desconectar a mitad de una sincronización)
const fakeGoogle = () => {
  const events = new Map<string, CalendarEventBody>();
  const calls: string[] = [];
  let failure: GoogleApiError | null = null;
  const during: { exchange?: () => Promise<unknown>; put?: () => Promise<unknown>; list?: () => Promise<unknown> } = {};
  const api: GoogleCalendarApi = {
    exchangeCode: async (_client, { code }) => {
      await during.exchange?.();
      return {
        refreshToken: code === 'no-offline' ? null : `refresh-${code}`,
        accessToken: `access-${code}`,
        expiresIn: 3600,
        scope: code === 'no-scope' ? 'openid' : CALENDAR_SCOPE
      };
    },
    refreshAccessToken: () => Promise.resolve({ accessToken: 'access-renewed', expiresIn: 3600 }),
    revoke: (token) => {
      calls.push(`revoke:${token}`);
      return Promise.resolve();
    },
    ensureCalendar: (_token, _timeZone, previousId) => {
      calls.push(`calendar:${previousId ?? 'new'}`);
      return Promise.resolve(previousId ?? 'calendar-1');
    },
    putEvent: async (_token, calendarId, eventId, event) => {
      await during.put?.();
      if (failure) throw failure;
      calls.push(`put:${calendarId}:${eventId}`);
      events.set(eventId, event);
    },
    deleteEvent: (_token, calendarId, eventId) => {
      if (failure) return Promise.reject(failure);
      calls.push(`delete:${calendarId}:${eventId}`);
      events.delete(eventId);
      return Promise.resolve();
    },
    listEventIds: async () => {
      const ids = [...events.keys()];
      await during.list?.();
      return ids;
    }
  };
  const deps: CalendarDeps = {
    api,
    client: () => ({ clientId: 'client-id', clientSecret: 'client-secret' }),
    key: () => KEY,
    revoke: (token) => api.revoke(token),
    appUrl: () => URL
  };
  return { deps, events, calls, during, failWith: (error: GoogleApiError | null) => (failure = error) };
};

const approve = (uid: string) => db.doc(`access/${uid}`).set({ status: 'approved', email: `${uid}@example.com` });
const grant = (uid: string) => db.doc(`features/${uid}`).set({ granted: ['googleCalendar'], updatedAt: 'now' });
const task = (uid: string, id: string, fields: Record<string, unknown>) =>
  db.doc(`users/${uid}/tasks/${id}`).set({ id, title: 'Revisar el contrato', status: 'PENDING', ...fields });
const status = async (uid: string): Promise<{ state?: string; reason?: string; calendarId?: string } | undefined> =>
  (await db.doc(`calendar_status/${uid}`).get()).data();
const linked = async (uid: string) => (await db.doc(`calendar_tokens/${uid}`).get()).exists;

const clear = async () => {
  await Promise.all(
    UIDS.flatMap((uid) => [
      db.recursiveDelete(db.doc(`users/${uid}`)),
      db.doc(`access/${uid}`).delete(),
      db.doc(`features/${uid}`).delete(),
      db.doc(`admins/${uid}`).delete(),
      db.doc(`calendar_tokens/${uid}`).delete(),
      db.doc(`calendar_status/${uid}`).delete()
    ])
  );
};

describe('Google Calendar sync', () => {
  beforeEach(clear);
  after(clear);

  it('connects an account with the feature and uploads its tasks with a date, not the rest', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await task('cal-ana', 't1', { dueDate: '2026-10-16', dueTime: '12:00' });
    await task('cal-ana', 't2', { dueDate: '2026-10-17', isSomeday: true });
    await task('cal-ana', 't3', {});
    assert.deepEqual(await connectCalendar('cal-ana', request(), google.deps), { synced: 1, failed: 0 });
    assert.equal(google.events.size, 1);
    assert.equal([...google.events.values()][0].summary, 'Revisar el contrato');
    assert.equal((await status('cal-ana'))?.state, 'connected');
    // El permiso se guarda cifrado
    const link = (await db.doc('calendar_tokens/cal-ana').get()).data();
    assert.equal(link?.calendarId, 'calendar-1');
    assert.equal(JSON.stringify(link).includes('refresh-abc'), false);
  });

  it('refuses to connect without the feature, or without the calendar or offline permission', async () => {
    const google = fakeGoogle();
    await approve('cal-bruno');
    await assert.rejects(connectCalendar('cal-bruno', request(), google.deps), /no tiene activada/);
    await grant('cal-bruno');
    await assert.rejects(connectCalendar('cal-bruno', request('no-scope'), google.deps), /permiso de Google Calendar/);
    await assert.rejects(connectCalendar('cal-bruno', request('no-offline'), google.deps), /CLAR cerrada/);
    await assert.rejects(
      connectCalendar(
        'cal-bruno',
        { ...request(), redirectUri: 'https://evil.example/oauth/google.html' },
        google.deps
      ),
      /no válida/
    );
    assert.equal(await linked('cal-bruno'), false);
    // Lo que Google llegó a dar se retira
    assert.ok(google.calls.includes('revoke:refresh-no-scope'));
  });

  it('keeps each event up to date with its task, and removes it when the task leaves the calendar', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await connectCalendar('cal-ana', request(), google.deps);
    await task('cal-ana', 't1', { dueDate: '2026-10-16' });
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'saved');
    await task('cal-ana', 't1', { dueDate: '2026-10-16', status: 'DONE' });
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'saved');
    assert.equal([...google.events.values()][0].summary, '✓ Revisar el contrato');
    await task('cal-ana', 't1', { dueDate: '2026-10-16', isSomeday: true });
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'deleted');
    assert.equal(google.events.size, 0);
    await db.doc('users/cal-ana/tasks/t1').delete();
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'deleted');
  });

  it('stops syncing and disconnects as soon as the account loses the feature or its access', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await connectCalendar('cal-ana', request(), google.deps);
    await task('cal-ana', 't1', { dueDate: '2026-10-16' });
    await db.doc('features/cal-ana').delete();
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'not-entitled');
    assert.equal(await linked('cal-ana'), false);
    assert.equal((await status('cal-ana'))?.state, 'disconnected');
    assert.ok(google.calls.includes('revoke:refresh-abc'));

    await grant('cal-ana');
    await connectCalendar('cal-ana', request('again'), google.deps);
    const puts = google.calls.filter((c) => c.startsWith('put:')).length;
    await db.doc('access/cal-ana').set({ status: 'revoked' });
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'not-entitled');
    assert.equal(google.calls.filter((c) => c.startsWith('put:')).length, puts);
  });

  it('counts the admin switch only for the current admin, never for other accounts', async () => {
    await approve('cal-admin');
    await db.doc('users/cal-admin').set({ featurePrefs: { googleCalendar: true } });
    // Sin la marca de administración, encenderlo en el perfil no da nada
    assert.equal(await calendarEntitled('cal-admin'), false);
    await db.doc('admins/cal-admin').set({ email: DEMO_ADMIN_EMAIL, since: 'now' });
    assert.equal(await calendarEntitled('cal-admin'), true);
    await db.doc('users/cal-admin').set({ featurePrefs: { googleCalendar: false } });
    assert.equal(await calendarEntitled('cal-admin'), false);
    // Una marca de otro email (p. ej. tras cambiar la cuenta de administración) no vale
    await db.doc('admins/cal-admin').set({ email: 'antes@example.com', since: 'now' });
    await db.doc('users/cal-admin').set({ featurePrefs: { googleCalendar: true } });
    assert.equal(await calendarEntitled('cal-admin'), false);
  });

  it('asks to reconnect when Google withdraws the permission or the calendar is gone', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await connectCalendar('cal-ana', request(), google.deps);
    await task('cal-ana', 't1', { dueDate: '2026-10-16' });
    google.failWith(new GoogleApiError(400, 'revoked'));
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'reconnect');
    assert.equal(await linked('cal-ana'), false);
    assert.deepEqual(
      { state: (await status('cal-ana'))?.state, reason: (await status('cal-ana'))?.reason },
      { state: 'needsReconnect', reason: 'revoked' }
    );
    // Un permiso que Google ya retiró no se retira otra vez
    assert.equal(google.calls.filter((c) => c.startsWith('revoke:')).length, 0);

    google.failWith(null);
    await connectCalendar('cal-ana', request('again'), google.deps);
    google.failWith(new GoogleApiError(404, 'calendarMissing'));
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'reconnect');
    assert.equal((await status('cal-ana'))?.reason, 'calendarMissing');
    assert.ok(google.calls.includes('revoke:refresh-again'));
  });

  it('disconnects withdrawing the permission, and reconnecting uses the same calendar', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await connectCalendar('cal-ana', request(), google.deps);
    await disconnectCalendar('cal-ana', { deps: google.deps });
    assert.ok(google.calls.includes('revoke:refresh-abc'));
    assert.equal(await linked('cal-ana'), false);
    assert.deepEqual(
      { state: (await status('cal-ana'))?.state, calendarId: (await status('cal-ana'))?.calendarId },
      { state: 'disconnected', calendarId: 'calendar-1' }
    );
    await connectCalendar('cal-ana', request('again'), google.deps);
    assert.ok(google.calls.includes('calendar:calendar-1'));
  });

  it('forgets everything with the account, and a late sync of a deleted account leaves nothing', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await connectCalendar('cal-ana', request(), google.deps);
    await disconnectCalendar('cal-ana', { forget: true, deps: google.deps });
    assert.equal(await status('cal-ana'), undefined);
    assert.equal(await linked('cal-ana'), false);
    // La cuenta ya no existe (sin solicitud de acceso): una desconexión tardía no apunta nada
    await connectCalendar('cal-ana', request(), google.deps);
    await db.doc('access/cal-ana').delete();
    await db.doc('calendar_status/cal-ana').delete();
    await disconnectCalendar('cal-ana', { reason: 'revoked', deps: google.deps });
    assert.equal(await status('cal-ana'), undefined);
  });

  it('a sync that fails after a disconnect does not undo it, nor claim to be connected', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await connectCalendar('cal-ana', request(), google.deps);
    await task('cal-ana', 't1', { dueDate: '2026-10-16' });
    // Se desconecta mientras Google responde; después Google rechaza el permiso, ya retirado
    google.during.put = async () => {
      google.during.put = undefined;
      await disconnectCalendar('cal-ana', { deps: google.deps });
    };
    google.failWith(new GoogleApiError(400, 'revoked'));
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'reconnect');
    assert.equal((await status('cal-ana'))?.state, 'disconnected');

    // Una subida inicial que termina después de desconectar no deja «conectada» sin permiso
    google.failWith(null);
    google.during.put = async () => {
      google.during.put = undefined;
      await disconnectCalendar('cal-ana', { deps: google.deps });
    };
    await assert.rejects(connectCalendar('cal-ana', request('again'), google.deps), /La conexión se cerró/);
    assert.equal(await linked('cal-ana'), false);
    assert.equal((await status('cal-ana'))?.state, 'disconnected');
  });

  it('an account deleted while connecting keeps nothing, and the new permission is withdrawn', async () => {
    const google = fakeGoogle();
    await approve('cal-bruno');
    await grant('cal-bruno');
    google.during.exchange = async () => {
      await db.doc('access/cal-bruno').delete();
      await disconnectCalendar('cal-bruno', { forget: true, deps: google.deps });
    };
    await assert.rejects(connectCalendar('cal-bruno', request(), google.deps), /ya no tiene acceso/);
    assert.equal(await linked('cal-bruno'), false);
    assert.equal(await status('cal-bruno'), undefined);
    assert.ok(google.calls.includes('revoke:refresh-abc'));
  });

  it('reconnecting to the same calendar removes the events of tasks that left it meanwhile', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await task('cal-ana', 't1', { dueDate: '2026-10-16' });
    await task('cal-ana', 't2', { dueDate: '2026-10-17' });
    await connectCalendar('cal-ana', request(), google.deps);
    assert.equal(google.events.size, 2);
    await disconnectCalendar('cal-ana', { deps: google.deps });
    await db.doc('users/cal-ana/tasks/t2').delete();
    await task('cal-ana', 't3', { dueDate: '2026-10-18' });
    assert.deepEqual(await connectCalendar('cal-ana', request('again'), google.deps), { synced: 2, failed: 0 });
    assert.equal(google.events.size, 2);
    assert.ok(google.calls.some((c) => c.startsWith('delete:calendar-1:')));

    // Una tarea que recupera su fecha mientras se sube no pierde su evento
    await disconnectCalendar('cal-ana', { deps: google.deps });
    await task('cal-ana', 't3', { dueDate: '2026-10-18', isSomeday: true });
    google.during.list = () => task('cal-ana', 't3', { dueDate: '2026-10-18' });
    const deletes = google.calls.filter((c) => c.startsWith('delete:')).length;
    await connectCalendar('cal-ana', request('third'), google.deps);
    assert.equal(google.calls.filter((c) => c.startsWith('delete:')).length, deletes);
  });

  it('a misconfigured encryption key is a failure of the installation, not a reason to disconnect', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await task('cal-ana', 't1', { dueDate: '2026-10-16' });
    await db.doc('calendar_tokens/cal-ana').set({
      token: sealToken('refresh-old', KEY, 'cal-ana'),
      calendarId: 'calendar-1',
      timeZone: MADRID,
      connectedAt: '2026-10-02T00:00:00.000Z'
    });
    const broken = {
      ...google.deps,
      key: () => {
        throw new Error('CALENDAR_TOKEN_KEY must be 32 bytes in base64');
      }
    };
    assert.equal(await syncTaskEvent('cal-ana', 't1', broken), 'failed');
    assert.equal(await linked('cal-ana'), true);
  });

  it('a permission that can no longer be read (the key changed) asks to reconnect', async () => {
    const google = fakeGoogle();
    await approve('cal-ana');
    await grant('cal-ana');
    await task('cal-ana', 't1', { dueDate: '2026-10-16' });
    await db.doc('calendar_tokens/cal-ana').set({
      token: sealToken('refresh-old', randomBytes(32), 'cal-ana'),
      calendarId: 'calendar-1',
      timeZone: MADRID,
      connectedAt: '2026-10-01T00:00:00.000Z'
    });
    assert.equal(await syncTaskEvent('cal-ana', 't1', google.deps), 'reconnect');
    assert.deepEqual(
      { state: (await status('cal-ana'))?.state, reason: (await status('cal-ana'))?.reason },
      { state: 'needsReconnect', reason: 'revoked' }
    );
  });
});
