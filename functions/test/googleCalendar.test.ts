import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import type { CalendarEventBody } from '../src/calendarLogic';
import { GoogleApiError, googleCalendarApi, setRetryDelaysForTests } from '../src/googleCalendar';

// El cliente de la API de Google con un fetch simulado: qué hace con cada respuesta de Google (sin red)
type Reply = { status: number; body?: unknown };
const realFetch = globalThis.fetch;
let replies: Reply[] = [];
let requests: { method: string; url: string }[] = [];

const respond = (...next: Reply[]) => {
  replies = next;
};
const googleError = (reason: string) => ({ error: { errors: [{ reason }] } });
const event = { summary: 'Revisar el contrato' } as CalendarEventBody;

describe('Google API client', () => {
  beforeEach(() => {
    requests = [];
    setRetryDelaysForTests([0, 0, 0]);
    globalThis.fetch = ((url: string, init: RequestInit) => {
      requests.push({ method: init.method ?? 'GET', url });
      const reply = replies.shift() ?? { status: 500 };
      return Promise.resolve(
        new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status })
      );
    }) as typeof fetch;
  });
  after(() => {
    globalThis.fetch = realFetch;
  });

  it('updates an event, or creates it with its id when it does not exist yet', async () => {
    respond({ status: 200, body: {} });
    await googleCalendarApi.putEvent('t', 'cal', 'clar1', event);
    assert.deepEqual(
      requests.map((r) => r.method),
      ['PUT']
    );

    respond({ status: 404, body: googleError('notFound') }, { status: 200, body: {} });
    await googleCalendarApi.putEvent('t', 'cal', 'clar1', event);
    assert.deepEqual(
      requests.slice(1).map((r) => r.method),
      ['PUT', 'POST']
    );
  });

  it('only says the calendar is gone when Google says so about the calendar itself', async () => {
    // El evento no está y crearlo da 404: se pregunta por el calendario, que no existe
    respond({ status: 404 }, { status: 404 }, { status: 404 });
    await assert.rejects(googleCalendarApi.putEvent('t', 'cal', 'clar1', event), { reason: 'calendarMissing' });
    assert.match(requests.at(-1)!.url, /\/calendars\/cal$/);
    // El id ya existe (409) pero no se puede actualizar: el calendario sí existe, es un fallo de ese evento
    respond({ status: 404 }, { status: 409 }, { status: 404 }, { status: 200, body: { id: 'cal' } });
    await assert.rejects(googleCalendarApi.putEvent('t', 'cal', 'clar1', event), (error: GoogleApiError) => {
      assert.equal(error.status, 404);
      assert.notEqual(error.reason, 'calendarMissing');
      return true;
    });
  });

  it('retries rate limits and passing failures with a growing wait, and gives up after a few', async () => {
    respond(
      { status: 429 },
      { status: 403, body: googleError('userRateLimitExceeded') },
      { status: 503 },
      { status: 200, body: {} }
    );
    await googleCalendarApi.putEvent('t', 'cal', 'clar1', event);
    assert.equal(requests.length, 4);
    respond({ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 });
    await assert.rejects(googleCalendarApi.deleteEvent('t', 'cal', 'clar1'), { status: 503 });
    // Un 403 que no es un límite no se reintenta
    requests = [];
    respond({ status: 403, body: googleError('forbidden') });
    await assert.rejects(googleCalendarApi.deleteEvent('t', 'cal', 'clar1'), { status: 403 });
    assert.equal(requests.length, 1);
  });

  it('reuses the previous calendar, creates another only when it is gone, and never on a rate limit', async () => {
    respond({ status: 200, body: { id: 'cal-1' } });
    assert.equal(await googleCalendarApi.ensureCalendar('t', 'Europe/Madrid', 'cal-1'), 'cal-1');
    respond({ status: 404 }, { status: 200, body: { id: 'cal-2' } });
    assert.equal(await googleCalendarApi.ensureCalendar('t', 'Europe/Madrid', 'cal-1'), 'cal-2');
    respond(...Array.from({ length: 4 }, () => ({ status: 403, body: googleError('rateLimitExceeded') })));
    await assert.rejects(googleCalendarApi.ensureCalendar('t', 'Europe/Madrid', 'cal-1'), { status: 403 });
    assert.equal(requests.filter((r) => r.method === 'POST').length, 1);
  });

  it('takes a deleted event or a permission already withdrawn as done, and an expired grant as revoked', async () => {
    respond({ status: 410 });
    await googleCalendarApi.deleteEvent('t', 'cal', 'clar1');
    respond({ status: 400, body: { error: 'invalid_token' } });
    await googleCalendarApi.revoke('token');
    respond({ status: 400, body: { error: 'invalid_grant' } });
    await assert.rejects(googleCalendarApi.refreshAccessToken({ clientId: 'id', clientSecret: 's' }, 'r'), {
      reason: 'revoked'
    });
  });

  it('lists only the events CLAR marked, page by page', async () => {
    respond(
      { status: 200, body: { items: [{ id: 'clar1' }], nextPageToken: 'p2' } },
      { status: 200, body: { items: [{ id: 'clar2' }] } }
    );
    assert.deepEqual(await googleCalendarApi.listEventIds('t', 'cal'), ['clar1', 'clar2']);
    assert.match(requests[0].url, /privateExtendedProperty=clarTask%3D1/);
    assert.match(requests[1].url, /pageToken=p2/);
  });
});
