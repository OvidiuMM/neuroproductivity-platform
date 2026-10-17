import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alarmInstant, dueInstant, isTimeZone, notificationText, queuedAlarm, zonedInstant } from '../src/alarmLogic';

const MADRID = 'Europe/Madrid';
const iso = (instant: number | null) => (instant === null ? null : new Date(instant).toISOString());

// Lo que calcula la app en un equipo con esa zona: new Date(y, m, d, h, min) y, si la hora no existe, la anterior al
// salto con el desfase nuevo
const appInstant = (timeZone: string, date: string, time: string) => {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const at = new Date(y, m - 1, d, h, min);
    const drift = at.getHours() * 60 + at.getMinutes() - (h * 60 + min);
    return drift > 0 ? at.getTime() - drift * 60_000 : at.getTime();
  } finally {
    process.env.TZ = previous;
  }
};

describe('zonedInstant', () => {
  it('matches the app in Madrid, New York and Sydney, including the days the clocks change', () => {
    const cases: [string, string, string][] = [
      [MADRID, '2026-10-16', '11:00'],
      [MADRID, '2027-03-28', '02:30'], // no existe: salto al horario de verano
      [MADRID, '2026-10-25', '02:30'], // existe dos veces: vuelta al de invierno
      [MADRID, '2026-12-31', '23:59'],
      ['America/New_York', '2027-03-14', '02:15'],
      ['America/New_York', '2026-11-01', '01:30'],
      ['Australia/Sydney', '2026-10-04', '02:30'],
      ['Asia/Kolkata', '2026-10-16', '09:45'],
      // Desfases de más de 12 h, con cambio de hora
      ['Pacific/Chatham', '2026-04-05', '02:30'],
      ['Pacific/Chatham', '2026-09-27', '02:50'],
      ['Pacific/Auckland', '2026-04-05', '02:30'],
      ['Pacific/Auckland', '2026-09-27', '02:30']
    ];
    for (const [zone, date, time] of cases)
      assert.equal(iso(zonedInstant(date, time, zone)), iso(appInstant(zone, date, time)), `${zone} ${date} ${time}`);
  });
});

// El plazo, como new Date(y, m, d, h, min) en un equipo con esa zona (sin la corrección de la alarma)
const appDue = (timeZone: string, date: string, time: string) => {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    return new Date(y, m - 1, d, h, min).getTime();
  } finally {
    process.env.TZ = previous;
  }
};

describe('dueInstant', () => {
  it('matches the app also when the due time falls in the jump to summer time', () => {
    for (const [zone, date, time] of [
      [MADRID, '2027-03-28', '02:30'],
      [MADRID, '2026-10-25', '02:30'],
      ['America/New_York', '2027-03-14', '02:15'],
      [MADRID, '2026-10-17', '11:00']
    ] as const)
      assert.equal(
        iso(dueInstant({ dueDate: date, dueTime: time }, zone)),
        iso(appDue(zone, date, time)),
        `${zone} ${date}`
      );
  });
});

describe('alarmInstant', () => {
  it('rings the same day before the due time, otherwise the day before', () => {
    assert.equal(
      iso(alarmInstant({ dueDate: '2026-10-17', dueTime: '11:00', alarmTime: '10:57' }, MADRID)),
      '2026-10-17T08:57:00.000Z'
    );
    assert.equal(
      iso(alarmInstant({ dueDate: '2026-10-17', dueTime: '11:00', alarmTime: '11:00' }, MADRID)),
      '2026-10-16T09:00:00.000Z'
    );
    assert.equal(iso(alarmInstant({ dueDate: '2026-10-17', alarmTime: '20:00' }, MADRID)), '2026-10-16T18:00:00.000Z');
  });

  it('has no alarm without a valid time or due date, or on a repeating task without a due time', () => {
    assert.equal(alarmInstant({ dueDate: '2026-10-17', alarmTime: '25:00' }, MADRID), null);
    assert.equal(alarmInstant({ alarmTime: '10:00' }, MADRID), null);
    assert.equal(
      alarmInstant({ dueDate: '2026-10-17', alarmTime: '10:00', recurrence: { frequency: 'DAILY' } }, MADRID),
      null
    );
  });

  it('ends a date-only deadline at the end of the local day', () => {
    assert.equal(iso(dueInstant({ dueDate: '2026-10-17' }, MADRID)), '2026-10-17T21:59:59.999Z');
  });
});

describe('queuedAlarm', () => {
  const now = Date.parse('2026-10-16T08:00:00.000Z');
  const task = {
    title: 'Llamar al banco',
    dueDate: '2026-10-17',
    dueTime: '11:00',
    alarmTime: '10:30',
    status: 'PENDING'
  };

  it('builds the same key as the app, with the title and when it is due', () => {
    const alarm = queuedAlarm('task-1', task, MADRID, now)!;
    assert.equal(alarm.key, 'task-1@2026-10-17T08:30:00.000Z');
    assert.equal(alarm.clock, '10:30');
    assert.equal(alarm.taskTitle, 'Llamar al banco');
    // Por defecto sin el nombre de la tarea; con él, si el dispositivo lo pide
    assert.equal(notificationText(alarm, false), 'Tienes una alarma de CLAR a las 10:30');
    assert.equal(notificationText(alarm, true), 'Alarma de las 10:30: Llamar al banco');
    assert.match(alarm.body, /^Vence el 17 oct\.? a las 11:00$/);
  });

  it('skips archived, «Algún día» and overdue tasks', () => {
    assert.equal(queuedAlarm('t', { ...task, status: 'DONE' }, MADRID, now), null);
    assert.equal(queuedAlarm('t', { ...task, status: undefined, completed: true }, MADRID, now), null);
    assert.equal(queuedAlarm('t', { ...task, isSomeday: true }, MADRID, now), null);
    assert.equal(queuedAlarm('t', task, MADRID, Date.parse('2026-10-17T09:00:00.000Z')), null);
  });

  it('accepts only real time zones', () => {
    assert.equal(isTimeZone(MADRID), true);
    assert.equal(isTimeZone('Mars/Olympus'), false);
    assert.equal(isTimeZone(''), false);
  });
});
