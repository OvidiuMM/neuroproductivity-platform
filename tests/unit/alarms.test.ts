import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TaskItem } from '../../src/types';
import {
  alarmError,
  alarmLabel,
  alarmLateNote,
  alarmMoment,
  alarmSetAtFor,
  alarmUnavailableReason,
  describeAlarm,
  matchPendingAlerts,
  PENDING_ALERT_MS,
  scheduledAlarms
} from '../../src/services/alarms';

const task = (overrides: Partial<TaskItem>): TaskItem => ({
  ...{
    id: 't1',
    userId: 'u',
    listContext: 'WORK',
    title: 'Llamar al banco',
    description: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    isSomeday: false,
    observations: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  ...overrides
});

const local = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

test('with a due time, the alarm rings that day before it; older alarms at or after it ring the day before', () => {
  // Antes que la hora límite: el mismo día
  assert.equal(
    local(alarmMoment(task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' }))!),
    '2030-06-15 10:57'
  );
  // Después (solo las de antes de 0.9.7: el formulario ya no deja ponerlas así): la víspera
  assert.equal(
    local(alarmMoment(task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '23:00' }))!),
    '2030-06-14 23:00'
  );
  // A la misma hora: 24 h antes
  assert.equal(
    local(alarmMoment(task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '11:00' }))!),
    '2030-06-14 11:00'
  );
  // Cambio de mes
  assert.equal(
    local(alarmMoment(task({ dueDate: '2030-07-01', dueTime: '08:00', alarmTime: '21:30' }))!),
    '2030-06-30 21:30'
  );
});

test('with only a due date, the alarm rings that day at its time', () => {
  assert.equal(local(alarmMoment(task({ dueDate: '2030-06-15', alarmTime: '20:00' }))!), '2030-06-15 20:00');
  assert.equal(local(alarmMoment(task({ dueDate: '2030-06-15', alarmTime: '08:00' }))!), '2030-06-15 08:00');
  assert.equal(local(alarmMoment(task({ dueDate: '2030-06-15', alarmTime: '23:59' }))!), '2030-06-15 23:59');
});

test('every task needs a due date for an alarm; a repeating one, no longer a due time', () => {
  const recurrence = { frequency: 'WEEKLY' as const, interval: 1, weekdays: [1] };
  assert.equal(
    local(alarmMoment(task({ dueDate: '2030-06-17', recurrence, alarmTime: '08:00' }))!),
    '2030-06-17 08:00'
  );
  assert.equal(alarmUnavailableReason({ dueDate: '2030-06-17', recurrence }), null);
  assert.equal(
    local(alarmMoment(task({ dueDate: '2030-06-17', dueTime: '09:00', recurrence, alarmTime: '08:45' }))!),
    '2030-06-17 08:45'
  );
  assert.equal(alarmMoment(task({ alarmTime: '08:00' })), null);
  assert.match(alarmUnavailableReason({})!, /fecha límite/);
  assert.equal(alarmUnavailableReason({ dueDate: '2030-06-17' }), null);
  // Hora mal formada: sin alarma
  assert.equal(alarmMoment(task({ dueDate: '2030-06-15', alarmTime: '25:00' })), null);
});

test('the form says when it will ring, or that its time has already passed', () => {
  const before = new Date(2030, 5, 10, 12, 0);
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' }), before),
    'Sonará el 15 jun a las 10:57.'
  );
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', alarmTime: '20:00' }), before),
    'Sonará el 15 jun a las 20:00.'
  );
  // Hoy y mañana, con su nombre
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', alarmTime: '20:00' }), new Date(2030, 5, 15, 9, 0)),
    'Sonará hoy a las 20:00.'
  );
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', alarmTime: '20:00' }), new Date(2030, 5, 14, 9, 0)),
    'Sonará mañana a las 20:00.'
  );
  // Las de antes de 0.9.7 que suenan la víspera
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '23:00' }), before),
    'Sonará la víspera, el 14 jun, a las 23:00.'
  );
  // Ya pasó: al guardar no sonará
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', alarmTime: '10:00' }), new Date(2030, 5, 15, 12, 0)),
    'Esa hora ya ha pasado (hoy a las 10:00): no sonará.'
  );
  assert.equal(describeAlarm(task({ dueDate: '2030-06-15' }), before), null);
});

test('with a due time, the form only takes an alarm before it', () => {
  assert.equal(alarmError({ dueTime: '11:00', alarmTime: '10:59' }), null);
  assert.match(alarmError({ dueTime: '11:00', alarmTime: '11:00' })!, /antes de la hora límite \(11:00\)/);
  assert.match(alarmError({ dueTime: '11:00', alarmTime: '23:00' })!, /antes de la hora límite/);
  assert.equal(alarmError({ alarmTime: '23:00' }), null);
  assert.equal(alarmError({ dueTime: '11:00' }), null);
});

test('a late alarm still warns after other changes to the task; one set after its time does not', () => {
  const now = new Date(2030, 5, 15, 10, 0);
  const missed = { dueDate: '2030-06-15', dueTime: '12:00', alarmTime: '09:00' };
  // Puesta el día antes; después se cambió el estado (o se borró su meta): avisa al abrir
  const edited = task({
    ...missed,
    alarmSetAt: new Date(2030, 5, 14, 18, 0).toISOString(),
    updatedAt: new Date(2030, 5, 15, 9, 30).toISOString(),
    status: 'IN_PROGRESS'
  });
  assert.equal(scheduledAlarms([edited], now).length, 1);
});

test('an alarm from before 0.9.7 on a date-only task that already rang the day before is not repeated late', () => {
  const now = new Date(2030, 5, 15, 13, 0);
  // Sin alarmSetAt, solo con fecha, alarma a las 12:00 de hoy: con la regla de antes sonó ayer a las 12:00
  assert.equal(scheduledAlarms([task({ dueDate: '2030-06-15', alarmTime: '12:00' })], now).length, 0);
  // La de más tarde, sí; y una puesta ya con esta versión avisa con retraso
  assert.equal(scheduledAlarms([task({ dueDate: '2030-06-15', alarmTime: '18:00' })], now).length, 1);
  const recent = task({
    dueDate: '2030-06-15',
    alarmTime: '12:00',
    alarmSetAt: new Date(2030, 5, 15, 9, 0).toISOString()
  });
  assert.equal(scheduledAlarms([recent], now).length, 1);
});

test('the alarm is marked as set when it, the day or the repetition changes, not with other edits', () => {
  const now = '2030-06-15T08:00:00.000Z';
  const before = {
    dueDate: '2030-06-15',
    dueTime: '12:00',
    alarmTime: '09:00',
    alarmSetAt: '2030-06-14T18:00:00.000Z'
  };
  assert.equal(alarmSetAtFor(null, before, now), now);
  assert.equal(alarmSetAtFor(before, { ...before }, now), before.alarmSetAt);
  assert.equal(alarmSetAtFor(before, { ...before, alarmTime: '10:00' }, now), now);
  assert.equal(alarmSetAtFor(before, { ...before, dueDate: '2030-06-16' }, now), now);
  assert.equal(alarmSetAtFor(before, { ...before, dueTime: '13:00' }, now), now);
  assert.equal(alarmSetAtFor(before, { ...before, recurrence: { frequency: 'DAILY', interval: 1 } }, now), now);
  assert.equal(alarmSetAtFor(before, { ...before, alarmTime: undefined }, now), undefined);
  // La misma repetición con sus campos en otro orden no es un cambio
  const monthly = {
    ...before,
    recurrence: { frequency: 'MONTHLY' as const, interval: 1, monthlyMode: 'DAY_OF_MONTH' as const, monthDay: 15 }
  };
  const reordered = {
    ...before,
    recurrence: { monthDay: 15, monthlyMode: 'DAY_OF_MONTH' as const, interval: 1, frequency: 'MONTHLY' as const }
  };
  assert.equal(alarmSetAtFor(monthly, reordered, now), before.alarmSetAt);
});

test('the card says the day and time it will ring', () => {
  const now = new Date(2030, 5, 15, 9, 0);
  assert.equal(alarmLabel(new Date(2030, 5, 15, 17, 0), now), 'hoy 17:00');
  assert.equal(alarmLabel(new Date(2030, 5, 16, 9, 5), now), 'mañana 09:05');
  assert.equal(alarmLabel(new Date(2030, 5, 20, 10, 57), now), '20 jun 10:57');
});

test('scheduled alarms skip done, cancelled, someday and overdue tasks, and come in order', () => {
  const now = new Date(2030, 5, 15, 10, 0);
  const tasks = [
    task({ id: 'later', dueDate: '2030-06-15', dueTime: '18:00', alarmTime: '17:30' }),
    task({ id: 'soon', dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' }),
    // Su alarma ya pasó pero aún no ha vencido: se avisa al abrir la app
    task({ id: 'missed', dueDate: '2030-06-15', dueTime: '12:00', alarmTime: '09:00' }),
    task({ id: 'overdue', dueDate: '2030-06-15', dueTime: '09:30', alarmTime: '09:00' }),
    task({ id: 'done', dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57', status: 'DONE' }),
    task({ id: 'cancelled', dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57', status: 'CANCELLED' }),
    task({ id: 'someday', dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57', isSomeday: true }),
    task({ id: 'none', dueDate: '2030-06-15', dueTime: '11:00' }),
    // La alarma se puso después de su hora: no suena
    task({
      id: 'set-late',
      dueDate: '2030-06-15',
      dueTime: '12:00',
      alarmTime: '09:00',
      alarmSetAt: new Date(2030, 5, 15, 9, 30).toISOString()
    })
  ];
  const alarms = scheduledAlarms(tasks, now);
  assert.deepEqual(
    alarms.map((a) => a.task.id),
    ['missed', 'soon', 'later']
  );
  // La clave cambia si cambia la alarma
  const [first] = scheduledAlarms([task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' })], now);
  const [edited] = scheduledAlarms([task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:50' })], now);
  assert.notEqual(first.key, edited.key);
});

test('an alert from another tab waits for its task, for a few minutes at most', () => {
  const now = new Date(2030, 5, 15, 10, 0);
  const [alarm] = scheduledAlarms([task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '09:58' })], now);
  const pending = new Map([
    [alarm.key, now.getTime() - 1000],
    ['otra@2030-06-15T07:00:00.000Z', now.getTime() - 2000],
    ['vieja@2030-06-15T06:00:00.000Z', now.getTime() - PENDING_ALERT_MS - 1]
  ]);
  // Aún sin la tarea: no sale nada y la vieja se descarta
  const before = matchPendingAlerts(pending, [], now.getTime());
  assert.deepEqual(before.matched, []);
  assert.deepEqual([...before.rest.keys()], [alarm.key, 'otra@2030-06-15T07:00:00.000Z']);
  // Llega la tarea: sale su aviso y deja de esperar
  const after = matchPendingAlerts(before.rest, [alarm], now.getTime());
  assert.deepEqual(after.matched, [alarm]);
  assert.deepEqual([...after.rest.keys()], ['otra@2030-06-15T07:00:00.000Z']);
});

test('an alert that comes late says when the alarm was; on time it says nothing', () => {
  const at = new Date(2030, 5, 15, 11, 0);
  assert.equal(alarmLateNote(at, new Date(2030, 5, 15, 11, 1)), null);
  assert.equal(alarmLateNote(at, new Date(2030, 5, 15, 23, 0)), 'Era a las 11:00: CLAR no estaba abierta a esa hora.');
  assert.equal(
    alarmLateNote(at, new Date(2030, 5, 16, 8, 0)),
    'Era el 15 jun a las 11:00: CLAR no estaba abierta a esa hora.'
  );
});
