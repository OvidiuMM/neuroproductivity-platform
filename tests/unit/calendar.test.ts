import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCalendarEvent, buildIcs, googleCalendarUrl, outlookCalendarUrl } from '../../src/services/calendar.ts';
import type { TaskItem } from '../../src/types';

const APP = 'https://app.example.com';

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  userId: 'uid',
  listContext: 'WORK',
  title: 'Entregar el informe, versión final; revisar',
  description: 'Enviarlo al equipo',
  priority: 'HIGH',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...overrides
});

describe('buildCalendarEvent', () => {
  it('needs a due date', () => {
    assert.equal(buildCalendarEvent(task(), APP), null);
  });

  it('creates an all-day event when there are no times, spanning the interval', () => {
    const single = buildCalendarEvent(task({ dueDate: '2026-10-15' }), APP)!;
    assert.equal(single.allDay, true);
    assert.deepEqual(single.start, new Date(2026, 9, 15));
    assert.deepEqual(single.end, new Date(2026, 9, 16));

    const interval = buildCalendarEvent(task({ startDate: '2026-10-12', dueDate: '2026-10-15' }), APP)!;
    assert.deepEqual(interval.start, new Date(2026, 9, 12));
    assert.deepEqual(interval.end, new Date(2026, 9, 16));
  });

  it('creates a timed event from the times', () => {
    const deadline = buildCalendarEvent(task({ dueDate: '2026-10-15', dueTime: '15:00' }), APP)!;
    assert.equal(deadline.allDay, false);
    assert.deepEqual(deadline.start, new Date(2026, 9, 15, 15, 0));
    assert.deepEqual(deadline.end, new Date(2026, 9, 15, 15, 30));

    const interval = buildCalendarEvent(
      task({ startDate: '2026-10-15', startTime: '09:00', dueDate: '2026-10-15', dueTime: '11:00' }),
      APP
    )!;
    assert.deepEqual(interval.start, new Date(2026, 9, 15, 9, 0));
    assert.deepEqual(interval.end, new Date(2026, 9, 15, 11, 0));
  });

  it('includes the task description and a link to the app', () => {
    const event = buildCalendarEvent(task({ dueDate: '2026-10-15' }), APP)!;
    assert.equal(event.description, `Enviarlo al equipo\n\nTarea de NeuroProductividad: ${APP}`);
  });
});

describe('calendar links', () => {
  const allDay = buildCalendarEvent(task({ dueDate: '2026-10-15' }), APP)!;
  const timed = buildCalendarEvent(task({ dueDate: '2026-10-15', dueTime: '15:00' }), APP)!;

  it('builds a Google Calendar template link', () => {
    const url = new URL(googleCalendarUrl(allDay));
    assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
    assert.equal(url.searchParams.get('action'), 'TEMPLATE');
    assert.equal(url.searchParams.get('text'), allDay.title);
    assert.equal(url.searchParams.get('dates'), '20261015/20261016');

    const timedDates = new URL(googleCalendarUrl(timed)).searchParams.get('dates')!;
    assert.match(timedDates, /^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
  });

  it('builds Outlook links for personal and work accounts', () => {
    const personal = new URL(outlookCalendarUrl(allDay, 'personal'));
    assert.equal(personal.origin, 'https://outlook.live.com');
    assert.equal(personal.searchParams.get('allday'), 'true');
    assert.equal(personal.searchParams.get('startdt'), '2026-10-15');
    assert.equal(personal.searchParams.get('enddt'), '2026-10-16');

    const work = new URL(outlookCalendarUrl(timed, 'work'));
    assert.equal(work.origin, 'https://outlook.office.com');
    assert.equal(work.searchParams.get('allday'), 'false');
    assert.equal(work.searchParams.get('startdt'), timed.start.toISOString().replace(/\.\d{3}/, ''));
  });
});

describe('buildIcs', () => {
  it('produces a valid all-day VEVENT with escaped text and CRLF lines', () => {
    const ics = buildIcs(buildCalendarEvent(task({ dueDate: '2026-10-15' }), APP)!, new Date(Date.UTC(2026, 9, 9, 10)));

    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.match(ics, /\r\nDTSTART;VALUE=DATE:20261015\r\n/);
    assert.match(ics, /\r\nDTEND;VALUE=DATE:20261016\r\n/);
    assert.match(ics, /\r\nSUMMARY:Entregar el informe\\, versión final\\; revisar\r\n/);
    assert.match(ics, /\r\nDTSTAMP:20261009T100000Z\r\n/);
    assert.match(ics, /UID:task-1@neuroproductividad/);
  });

  it('folds lines longer than 75 octets', () => {
    const long = buildIcs(buildCalendarEvent(task({ dueDate: '2026-10-15', description: 'x'.repeat(200) }), APP)!);
    for (const line of long.split('\r\n')) {
      assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line.length}`);
    }
    assert.match(long, /\r\n x/);
  });
});
