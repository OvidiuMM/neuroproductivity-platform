import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TaskItem } from '../../src/types';
import {
  alarmMoment,
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

test('with a due time, the alarm rings within the 24 hours before', () => {
  // Antes que la hora límite: el mismo día
  assert.equal(
    local(alarmMoment(task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' }))!),
    '2030-06-15 10:57'
  );
  // Después: la víspera
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

test('with only a due date, the alarm rings the day before', () => {
  assert.equal(local(alarmMoment(task({ dueDate: '2030-06-15', alarmTime: '20:00' }))!), '2030-06-14 20:00');
  assert.equal(local(alarmMoment(task({ dueDate: '2030-06-15', alarmTime: '08:00' }))!), '2030-06-14 08:00');
});

test('a repeating task needs a due time, and every task needs a due date', () => {
  const recurrence = { frequency: 'WEEKLY' as const, interval: 1, weekdays: [1] };
  assert.equal(alarmMoment(task({ dueDate: '2030-06-17', recurrence, alarmTime: '08:00' })), null);
  assert.match(alarmUnavailableReason({ dueDate: '2030-06-17', recurrence })!, /hora límite/);
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

test('the form says when it will ring', () => {
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' })),
    'Sonará el 15 jun a las 10:57.'
  );
  assert.equal(
    describeAlarm(task({ dueDate: '2030-06-15', alarmTime: '20:00' })),
    'Sonará la víspera, el 14 jun, a las 20:00.'
  );
  assert.equal(describeAlarm(task({ dueDate: '2030-06-15' })), null);
});

test('scheduled alarms skip done, someday and overdue tasks, and come in order', () => {
  const now = new Date(2030, 5, 15, 10, 0);
  const tasks = [
    task({ id: 'later', dueDate: '2030-06-15', dueTime: '18:00', alarmTime: '17:30' }),
    task({ id: 'soon', dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57' }),
    // Su alarma ya pasó pero aún no ha vencido: se avisa al abrir la app
    task({ id: 'missed', dueDate: '2030-06-15', dueTime: '12:00', alarmTime: '09:00' }),
    task({ id: 'overdue', dueDate: '2030-06-15', dueTime: '09:30', alarmTime: '09:00' }),
    task({ id: 'done', dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57', status: 'DONE' }),
    task({ id: 'someday', dueDate: '2030-06-15', dueTime: '11:00', alarmTime: '10:57', isSomeday: true }),
    task({ id: 'none', dueDate: '2030-06-15', dueTime: '11:00' })
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
