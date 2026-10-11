import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRecurrence,
  describeRecurrence,
  nextOccurrence,
  nextRecurringTask,
  toRRule,
  upcomingOccurrences
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

  it('creates the next pending task with shifted dates and a reset checklist', () => {
    const next = nextRecurringTask(base, past)!;
    assert.notEqual(next.id, base.id);
    assert.equal(next.status, 'PENDING');
    assert.equal(next.doneAt, undefined);
    assert.equal(next.dueDate, '2026-11-09');
    assert.equal(next.dueTime, '10:00');
    assert.equal(next.startDate, '2026-11-06'); // mismo desfase de 3 días
    assert.equal(next.observations[0].completed, false);
    assert.deepEqual(next.recurrence, base.recurrence);
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
    assert.equal(toRRule(buildRecurrence('WEEKLY', '2026-10-12', { weekdays: [1, 3] }), true), 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE');
    assert.equal(toRRule(buildRecurrence('MONTHLY', '2026-10-15', { until: '2027-06-30' }), false), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15;UNTIL=20270630T235959Z');
  });
});
