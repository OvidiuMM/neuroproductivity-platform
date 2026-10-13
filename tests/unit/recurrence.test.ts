import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRecurrence,
  describeRecurrence,
  nextOccurrence,
  nextRecurringTask,
  toRRule,
  upcomingOccurrences,
  firstOccurrence
} from '../../src/services/recurrence.ts';
import type { TaskItem } from '../../src/types';

// Fecha de "hoy" fija y anterior a todas las fechas de los tests, para no activar el salto de repeticiones vencidas
const past = new Date(2026, 0, 1);

describe('nextOccurrence', () => {
  it('repeats every N days', () => {
    assert.equal(nextOccurrence('2026-10-12', buildRecurrence('DAILY', '2026-10-12'), past), '2026-10-13');
    assert.equal(nextOccurrence('2026-10-30', buildRecurrence('DAILY', '2026-10-30', { interval: 3 }), past), '2026-11-02');
  });

  it('repeats weekly on the chosen weekdays, every N weeks', () => {
    // Lunes 12 oct 2026; lunes y miércoles
    const monWed = buildRecurrence('WEEKLY', '2026-10-12', { weekdays: [1, 3] });
    assert.equal(nextOccurrence('2026-10-12', monWed, past), '2026-10-14');
    assert.equal(nextOccurrence('2026-10-14', monWed, past), '2026-10-19');
    // Cada 2 semanas, mismos días
    const biweekly = buildRecurrence('WEEKLY', '2026-10-12', { weekdays: [1, 3], interval: 2 });
    assert.equal(nextOccurrence('2026-10-14', biweekly, past), '2026-10-26');
    // Sin días elegidos: el de la fecha límite
    assert.equal(nextOccurrence('2026-10-15', buildRecurrence('WEEKLY', '2026-10-15'), past), '2026-10-22');
  });

  it('repeats on the second Monday of every month', () => {
    // 12 oct 2026 es el 2.º lunes de octubre
    const secondMonday = buildRecurrence('MONTHLY', '2026-10-12', { monthlyMode: 'NTH_WEEKDAY' });
    assert.deepEqual([secondMonday.nth, secondMonday.weekday], [2, 1]);
    assert.equal(nextOccurrence('2026-10-12', secondMonday, past), '2026-11-09');
    assert.deepEqual(upcomingOccurrences('2026-10-12', secondMonday, 4), ['2026-10-12', '2026-11-09', '2026-12-14', '2027-01-11']);
  });

  it('repeats on the last weekday of the month', () => {
    // 30 oct 2026 es el último viernes de octubre
    const lastFriday = buildRecurrence('MONTHLY', '2026-10-30', { monthlyMode: 'LAST_WEEKDAY' });
    assert.deepEqual(upcomingOccurrences('2026-10-30', lastFriday, 3), ['2026-10-30', '2026-11-27', '2026-12-25']);
  });

  it('keeps the day of the month, using the last day in shorter months', () => {
    const day31 = buildRecurrence('MONTHLY', '2027-01-31');
    assert.deepEqual(upcomingOccurrences('2027-01-31', day31, 4), ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('repeats yearly, falling back to 28 February in non-leap years', () => {
    const leapDay = buildRecurrence('YEARLY', '2028-02-29');
    assert.deepEqual(upcomingOccurrences('2028-02-29', leapDay, 3), ['2028-02-29', '2029-02-28', '2030-02-28']);
  });

  it('skips occurrences already in the past when a task is completed late', () => {
    const weekly = buildRecurrence('WEEKLY', '2026-09-07'); // lunes
    assert.equal(nextOccurrence('2026-09-07', weekly, new Date(2026, 9, 10)), '2026-10-12');
  });

  it('stops after the until date', () => {
    const rec = buildRecurrence('MONTHLY', '2026-10-12', { monthlyMode: 'NTH_WEEKDAY', until: '2026-12-01' });
    assert.equal(nextOccurrence('2026-10-12', rec, past), '2026-11-09');
    assert.equal(nextOccurrence('2026-11-09', rec, past), null);
    assert.deepEqual(upcomingOccurrences('2026-10-12', rec, 5), ['2026-10-12', '2026-11-09']);
  });
});

describe('firstOccurrence', () => {
  it('starts the series on the start date, or on the first chosen weekday after it', () => {
    // Martes 13: semanal lunes, miércoles y viernes → miércoles 14
    assert.equal(firstOccurrence('2026-10-13', buildRecurrence('WEEKLY', '2026-10-13', { weekdays: [1, 3, 5] })), '2026-10-14');
    // Sábado 17 sin días restantes esa semana → lunes 19 (cada 2 semanas → lunes 26)
    assert.equal(firstOccurrence('2026-10-17', buildRecurrence('WEEKLY', '2026-10-17', { weekdays: [1, 3] })), '2026-10-19');
    assert.equal(firstOccurrence('2026-10-17', buildRecurrence('WEEKLY', '2026-10-17', { weekdays: [1, 3], interval: 2 })), '2026-10-26');
    // Mensual, diaria y anual se anclan en el propio inicio
    assert.equal(firstOccurrence('2026-10-12', buildRecurrence('MONTHLY', '2026-10-12', { monthlyMode: 'NTH_WEEKDAY' })), '2026-10-12');
    assert.equal(firstOccurrence('2026-10-12', buildRecurrence('DAILY', '2026-10-12')), '2026-10-12');
  });

  it('has no first occurrence when the end of the series comes before it', () => {
    assert.equal(firstOccurrence('2026-10-17', buildRecurrence('WEEKLY', '2026-10-17', { weekdays: [1], until: '2026-10-18' })), null);
  });
});

describe('nextRecurringTask', () => {
  const base: TaskItem = {
    id: 'task-1',
    userId: 'uid',
    listContext: 'WORK',
    title: 'Preparar el informe mensual',
    description: '',
    priority: 'HIGH',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    observations: [{ id: 'o1', type: 'checklist', text: 'Revisar cifras', completed: true, createdAt: '2026-10-01T09:00:00.000Z' }],
    isSomeday: false,
    status: 'DONE',
    doneAt: '2026-10-12T10:00:00.000Z',
    startDate: '2026-10-09',
    dueDate: '2026-10-12',
    dueTime: '10:00',
    recurrence: buildRecurrence('MONTHLY', '2026-10-12', { monthlyMode: 'NTH_WEEKDAY' })
  };

  it('creates the next pending task on its own day, without a start date, and a reset checklist', () => {
    const next = nextRecurringTask(base, past)!;
    assert.notEqual(next.id, base.id);
    assert.equal(next.status, 'PENDING');
    assert.equal(next.doneAt, undefined);
    assert.equal(next.dueDate, '2026-11-09');
    assert.equal(next.dueTime, '10:00');
    assert.equal(next.startDate, undefined); // cada repetición vence su día: no hay intervalo
    assert.equal(next.observations[0].completed, false);
    assert.deepEqual(next.recurrence, base.recurrence);
  });

  it('gives the next occurrence the same id on any device, so two tabs cannot create two', () => {
    const later = new Date(past.getTime() + 60_000);
    assert.equal(nextRecurringTask(base, past)!.id, nextRecurringTask(base, later)!.id);
    assert.notEqual(nextRecurringTask(base, past)!.id, nextRecurringTask({ ...base, id: 'task-2' }, past)!.id);
    assert.match(nextRecurringTask(base, past)!.id, /^task-r[0-9a-z]+$/);
    // Aunque dos dispositivos calculen fechas distintas (a ambos lados de la hora límite), el id es el mismo
    const daily = { ...base, startDate: undefined, dueDate: '2026-10-11', dueTime: '10:00', recurrence: buildRecurrence('DAILY', '2026-10-11') };
    const before = nextRecurringTask(daily, new Date(2026, 9, 12, 8, 0))!;
    const after = nextRecurringTask(daily, new Date(2026, 9, 12, 18, 0))!;
    assert.notEqual(before.dueDate, after.dueDate);
    assert.equal(before.id, after.id);
  });

  it('skips an occurrence whose due time has already passed when completing late', () => {
    const daily = { ...base, startDate: undefined, dueDate: '2026-10-11', dueTime: '10:00', recurrence: buildRecurrence('DAILY', '2026-10-11') };
    // Completada el 12 a las 18:00: la del 12 a las 10:00 ya venció → la siguiente es la del 13
    assert.equal(nextRecurringTask(daily, new Date(2026, 9, 12, 18, 0))!.dueDate, '2026-10-13');
    // Completada el 12 a las 08:00: la del 12 aún no ha vencido
    assert.equal(nextRecurringTask(daily, new Date(2026, 9, 12, 8, 0))!.dueDate, '2026-10-12');
    // Sin hora vence al final del día
    assert.equal(nextRecurringTask({ ...daily, dueTime: undefined }, new Date(2026, 9, 12, 23, 0))!.dueDate, '2026-10-12');
  });

  it('returns null without recurrence, without due date or past the until date', () => {
    assert.equal(nextRecurringTask({ ...base, recurrence: undefined }, past), null);
    assert.equal(nextRecurringTask({ ...base, dueDate: undefined }, past), null);
    assert.equal(nextRecurringTask({ ...base, recurrence: { ...base.recurrence!, until: '2026-10-31' } }, past), null);
  });
});

describe('describeRecurrence and toRRule', () => {
  it('describes the rule in plain Spanish', () => {
    assert.equal(describeRecurrence(buildRecurrence('DAILY', '2026-10-12')), 'Cada día');
    assert.equal(describeRecurrence(buildRecurrence('WEEKLY', '2026-10-12', { weekdays: [3, 1], interval: 2 })), 'Cada 2 semanas: lun, mié');
    assert.equal(describeRecurrence(buildRecurrence('MONTHLY', '2026-10-12', { monthlyMode: 'NTH_WEEKDAY' })), 'Cada mes, el 2.º lunes');
    assert.equal(describeRecurrence(buildRecurrence('MONTHLY', '2026-10-30', { monthlyMode: 'LAST_WEEKDAY' })), 'Cada mes, el último viernes');
    assert.equal(describeRecurrence(buildRecurrence('MONTHLY', '2026-10-15', { interval: 3 })), 'Cada 3 meses, el día 15');
    assert.match(describeRecurrence(buildRecurrence('YEARLY', '2026-10-15'), '2026-10-15'), /^Cada año, el 15 de octubre$/);
    assert.match(describeRecurrence(buildRecurrence('DAILY', '2026-10-12', { until: '2026-12-31' })), /hasta el 31 dic 2026/);
  });

  it('exports an RRULE for calendars', () => {
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-10-12', { monthlyMode: 'NTH_WEEKDAY' }), true), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO');
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-10-30', { monthlyMode: 'LAST_WEEKDAY' }), true), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR');
    assert.equal(toRRule(buildRecurrence('WEEKLY', '2026-10-12', { weekdays: [1, 3] }), true), 'RRULE:FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,WE');
    // Domingo va al final: la semana empieza en lunes
    assert.equal(toRRule(buildRecurrence('WEEKLY', '2026-10-11', { interval: 2, weekdays: [0, 1] }), true), 'RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=MO;BYDAY=MO,SU');
    // UNTIL con hora: fin del día local, expresado en UTC
    const endOfDayUtc = new Date(2027, 5, 30, 23, 59, 59).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-10-15', { until: '2027-06-30' }), false), `RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15;UNTIL=${endOfDayUtc}`);
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-10-15', { until: '2027-06-30' }), true), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15;UNTIL=20270630');
  });

  it('keeps the last-day fallback of days 29–31 and of 29 February in the export', () => {
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-10-31'), true), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-09-30'), true), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30;BYSETPOS=-1');
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-10-28'), true), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28');
    assert.equal(toRRule(buildRecurrence('YEARLY', '2028-02-29'), true, '2028-02-29'), 'RRULE:FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1');
    assert.equal(toRRule(buildRecurrence('YEARLY', '2026-10-29'), true, '2026-10-29'), 'RRULE:FREQ=YEARLY;INTERVAL=1');
  });
});
