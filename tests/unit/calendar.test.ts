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
    assert.equal(event.description, `Enviarlo al equipo\n\nTarea de CLAR: ${APP}`);
  });

  it('lasts one hour when there is a start time but no due time', () => {
    const sameDay = buildCalendarEvent(
      task({ startDate: '2026-10-15', startTime: '09:30', dueDate: '2026-10-15' }),
      APP
    )!;
    assert.equal(sameDay.allDay, false);
    assert.deepEqual(sameDay.start, new Date(2026, 9, 15, 9, 30));
    assert.deepEqual(sameDay.end, new Date(2026, 9, 15, 10, 30));
    assert.doesNotMatch(sameDay.description, /Fecha límite/);
    // Si la fecha límite es otro día, el evento no llega a ella: la descripción la dice
    const later = buildCalendarEvent(
      task({ startDate: '2026-10-15', startTime: '09:30', dueDate: '2026-10-17' }),
      APP
    )!;
    assert.deepEqual(later.end, new Date(2026, 9, 15, 10, 30));
    assert.match(later.description, /Fecha límite: .*17.*oct/);
  });

  it('lists the task notes in the description, with checklist boxes and links', () => {
    const createdAt = '2026-10-01T09:00:00.000Z';
    const event = buildCalendarEvent(
      task({
        dueDate: '2026-10-15',
        observations: [
          { id: 'obs-1', type: 'note', text: 'Llevar la memoria USB', createdAt },
          { id: 'obs-2', type: 'checklist', text: 'Revisar las cifras', completed: true, createdAt },
          { id: 'obs-3', type: 'checklist', text: 'Pedir la firma', createdAt },
          { id: 'obs-4', type: 'link', text: 'Plantilla', url: 'https://example.com/plantilla', createdAt },
          { id: 'obs-5', type: 'note', text: '   ', createdAt }
        ]
      }),
      APP
    )!;
    assert.equal(
      event.description,
      [
        'Enviarlo al equipo',
        'Notas:\n- Llevar la memoria USB\n- [x] Revisar las cifras\n- [ ] Pedir la firma\n- Plantilla (https://example.com/plantilla)',
        `Tarea de CLAR: ${APP}`
      ].join('\n\n')
    );
    assert.match(googleCalendarUrl(event), /details=.*Notas%3A/);
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

describe('recurring tasks in calendars', () => {
  const recurring = task({
    dueDate: '2026-10-12',
    recurrence: { frequency: 'MONTHLY', interval: 1, monthlyMode: 'NTH_WEEKDAY', nth: 2, weekday: 1 }
  });

  it('adds the series to the Google Calendar link and the .ics file', () => {
    const event = buildCalendarEvent(recurring, APP)!;
    assert.equal(event.rrule, 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO');
    assert.equal(
      new URL(googleCalendarUrl(event)).searchParams.get('recur'),
      'RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO'
    );
    assert.match(buildIcs(event), /\r\nRRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO\r\n/);
  });

  it('exports each repetition on its own day, with the series, even if an old task kept a start date', () => {
    // Las tareas repetidas de antes de 0.8 podían tener inicio: ya no se exportan como intervalo
    const event = buildCalendarEvent({ ...recurring, startDate: '2026-10-09' }, APP)!;
    assert.equal(event.rrule, 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO');
    assert.equal(event.allDay, true);
    assert.equal(event.start.getDate(), 12);
    // Con horas, el evento va de la hora de inicio a la límite del mismo día
    const timed = buildCalendarEvent({ ...recurring, startTime: '09:00', dueTime: '10:00' }, APP)!;
    assert.equal(timed.start.getHours(), 9);
    assert.equal(timed.end.getHours(), 10);
    assert.equal(timed.start.getDate(), 12);
  });

  it('has no series for one-off tasks', () => {
    const event = buildCalendarEvent(task({ dueDate: '2026-10-12' }), APP)!;
    assert.equal(event.rrule, undefined);
    assert.equal(new URL(googleCalendarUrl(event)).searchParams.get('recur'), null);
    assert.doesNotMatch(buildIcs(event), /RRULE/);
  });
});

describe('alarms in calendars', () => {
  const ics = (overrides: Partial<TaskItem>) => buildIcs(buildCalendarEvent(task(overrides), APP)!);

  it('counts a timed deadline alarm from the start of the event', () => {
    const file = ics({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' });
    assert.match(file, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:.+\r\nTRIGGER:-PT3M\r\nEND:VALARM\r\nEND:VEVENT/);
  });

  it('counts an interval or all-day alarm from the end of the event', () => {
    // Intervalo: el final es la hora límite; la alarma de las 23:00 es la víspera (12 h antes)
    const interval = ics({
      startDate: '2030-06-14',
      startTime: '09:00',
      dueDate: '2030-06-15',
      dueTime: '11:00',
      alarmTime: '23:00'
    });
    assert.match(interval, /TRIGGER;RELATED=END:-PT720M/);
    // Solo fecha: la víspera a las 20:00, contada desde el final del día límite (28 h antes)
    assert.match(ics({ dueDate: '2030-06-15', alarmTime: '20:00' }), /TRIGGER;RELATED=END:-PT1680M/);
  });

  it('counts the alarm of a one-hour event from its start, also when it comes after it', () => {
    // Plazo sin hora el 15: la alarma de las 18:00 es la víspera, 9 h después del inicio del 14 a las 09:00
    const file = ics({ startDate: '2030-06-14', startTime: '09:00', dueDate: '2030-06-15', alarmTime: '18:00' });
    assert.match(file, /DTSTART:\d{8}T\d{6}Z\r\nDTEND:/);
    assert.match(file, /TRIGGER:PT540M/);
  });

  it('has no alarm without one, or when the task cannot have it', () => {
    assert.doesNotMatch(ics({ dueDate: '2030-06-15', dueTime: '11:00' }), /VALARM/);
    const recurrence = { frequency: 'WEEKLY' as const, interval: 1, weekdays: [6] };
    assert.doesNotMatch(ics({ dueDate: '2030-06-15', recurrence, alarmTime: '08:00' }), /VALARM/);
  });
});
