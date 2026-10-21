import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCalendarEvent,
  buildIcs,
  buildVtimezone,
  googleCalendarUrl,
  outlookCalendarUrl
} from '../../src/services/calendar.ts';
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

  it('exports a timed series in local time with its time zone, so the weekday and the hour do not move', () => {
    // Los lunes a las 00:30: en UTC sería domingo
    const weekly = task({
      startTime: '00:30',
      dueDate: '2026-10-19',
      dueTime: '01:00',
      recurrence: { frequency: 'WEEKLY', interval: 1, weekdays: [1] }
    });
    const event = buildCalendarEvent(weekly, APP, 'Europe/Madrid')!;
    assert.equal(event.timeZone, 'Europe/Madrid');
    const file = buildIcs(event);
    assert.match(
      file,
      /\r\nDTSTART;TZID=Europe\/Madrid:20261019T003000\r\nDTEND;TZID=Europe\/Madrid:20261019T010000\r\n/
    );
    assert.match(file, /BYDAY=MO/);
    // Con su VTIMEZONE: el paso al horario de verano del 28 de marzo de 2027 a las 02:00 (de +0100 a +0200)
    assert.match(file, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Madrid\r\n/);
    assert.match(
      file,
      /BEGIN:DAYLIGHT\r\nDTSTART:20270328T020000\r\nTZOFFSETFROM:\+0100\r\nTZOFFSETTO:\+0200\r\nEND:DAYLIGHT/
    );
    assert.match(
      file,
      /BEGIN:STANDARD\r\nDTSTART:20261025T030000\r\nTZOFFSETFROM:\+0200\r\nTZOFFSETTO:\+0100\r\nEND:STANDARD/
    );
    assert.ok(file.indexOf('END:VTIMEZONE') < file.indexOf('BEGIN:VEVENT'));
    const google = new URL(googleCalendarUrl(event)).searchParams;
    assert.equal(google.get('dates'), '20261019T003000/20261019T010000');
    assert.equal(google.get('ctz'), 'Europe/Madrid');
    // Las de día completo y las que no se repiten siguen igual
    assert.equal(
      buildCalendarEvent(task({ dueDate: '2026-10-19', recurrence: weekly.recurrence }), APP)!.timeZone,
      undefined
    );
    assert.equal(buildCalendarEvent(task({ dueDate: '2026-10-19', dueTime: '10:00' }), APP)!.timeZone, undefined);
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
    // Solo fecha: ese día a las 20:00, contada desde el final del día límite (4 h antes)
    assert.match(ics({ dueDate: '2030-06-15', alarmTime: '20:00' }), /TRIGGER;RELATED=END:-PT240M/);
  });

  it('counts the alarm of a one-hour event from its start, also when it comes after it', () => {
    // Plazo sin hora el 15: la alarma de las 18:00 suena el 15, 33 h después del inicio del 14 a las 09:00
    const file = ics({ startDate: '2030-06-14', startTime: '09:00', dueDate: '2030-06-15', alarmTime: '18:00' });
    assert.match(file, /DTSTART:\d{8}T\d{6}Z\r\nDTEND:/);
    assert.match(file, /TRIGGER:PT1980M/);
  });

  it('has no alarm without one; a repeating task with only a date carries it on each repetition', () => {
    assert.doesNotMatch(ics({ dueDate: '2030-06-15', dueTime: '11:00' }), /VALARM/);
    const recurrence = { frequency: 'WEEKLY' as const, interval: 1, weekdays: [6] };
    // Cada sábado a las 08:00: 16 h antes del final del día
    assert.match(ics({ dueDate: '2030-06-15', recurrence, alarmTime: '08:00' }), /TRIGGER;RELATED=END:-PT960M/);
  });
});

describe('time zones in the .ics', () => {
  it('describes a zone without changes of time with a single observance', () => {
    const lines = buildVtimezone('Asia/Kolkata', new Date(Date.UTC(2026, 9, 19)));
    assert.deepEqual(lines, [
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Kolkata',
      'BEGIN:STANDARD',
      'DTSTART:20260101T053000',
      'TZOFFSETFROM:+0530',
      'TZOFFSETTO:+0530',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]);
  });

  it('lists ten years of changes of time, two a year in Madrid', () => {
    const lines = buildVtimezone('Europe/Madrid', new Date(Date.UTC(2026, 9, 19)));
    assert.equal(lines.filter((l) => l === 'BEGIN:DAYLIGHT').length, 10);
    assert.equal(lines.filter((l) => l === 'BEGIN:STANDARD').length, 11);
  });

  it('marks the first observance as summer time in the southern hemisphere', () => {
    const lines = buildVtimezone('Australia/Sydney', new Date(Date.UTC(2026, 9, 19)));
    assert.deepEqual(lines.slice(2, 4), ['BEGIN:DAYLIGHT', 'DTSTART:20260101T110000']);
  });

  it('cuts a very long description in the links, but not in the .ics', () => {
    const event = buildCalendarEvent(task({ dueDate: '2026-10-15', description: 'd'.repeat(7600) }), APP)!;
    const details = new URL(googleCalendarUrl(event)).searchParams.get('details')!;
    assert.ok(details.length < 1600);
    assert.match(details, /… \(completa en CLAR\)$/);
    assert.ok(new URL(outlookCalendarUrl(event, 'personal')).searchParams.get('body')!.length < 1600);
    assert.match(buildIcs(event), /d{60}/);
  });

  it('escapes a lone carriage return', () => {
    assert.match(
      buildIcs(buildCalendarEvent(task({ dueDate: '2026-10-15', title: 'Uno\rDos' }), APP)!),
      /SUMMARY:Uno\\nDos/
    );
  });
});
