import assert from 'node:assert/strict';
import { test } from 'node:test';

// Cambios de hora en Madrid en 2026: el 29 de marzo a las 02:00 se pasa a las 03:00 y el 25 de octubre a las 03:00
// se vuelve a las 02:00. La zona se fija antes de cargar el módulo.
process.env.TZ = 'Europe/Madrid';
const { buildRecurrence, nextOccurrence, nextRecurringTask } = await import('../../src/services/recurrence');

const daily = buildRecurrence('DAILY', '2026-03-28', { from: 'COMPLETION' });
const weekly = buildRecurrence('WEEKLY', '2026-03-28', { from: 'COMPLETION' });

test('counting from completion, a change of time does not move the next day', () => {
  // Hecha la víspera del cambio, a última hora: al día siguiente (el día de 23 horas)
  assert.equal(nextOccurrence('2026-03-28', daily, new Date(2026, 2, 28, 23, 30)), '2026-03-29');
  // Hecha el día del cambio, después del salto: una semana después, el mismo día de la semana
  assert.equal(nextOccurrence('2026-03-29', weekly, new Date(2026, 2, 29, 3, 30)), '2026-04-05');
  // La hora que se repite al volver al horario de invierno (02:30, dos veces) cuenta como ese día
  assert.equal(nextOccurrence('2026-10-25', daily, new Date(2026, 9, 25, 2, 30)), '2026-10-26');
  // Tres días por encima del cambio de octubre (el día de 25 horas)
  const daily3 = buildRecurrence('DAILY', '2026-10-20', { interval: 3, from: 'COMPLETION' });
  assert.equal(nextOccurrence('2026-10-20', daily3, new Date(2026, 9, 24, 22, 0)), '2026-10-27');
});

test('the next task keeps its due time and alarm across the change', () => {
  const next = nextRecurringTask(
    {
      id: 't',
      userId: 'u',
      listContext: 'PERSONAL',
      title: 'Tomar la medicación',
      description: '',
      priority: 'HIGH',
      status: 'PENDING',
      isSomeday: false,
      observations: [],
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      dueDate: '2026-03-28',
      dueTime: '02:30',
      alarmTime: '02:15',
      recurrence: daily
    },
    new Date(2026, 2, 28, 22, 0)
  )!;
  // El 29 a las 02:30 no existe, pero la tarea guarda la hora tal cual (la alarma lo resuelve al calcular cuándo suena)
  assert.deepEqual([next.dueDate, next.dueTime, next.alarmTime], ['2026-03-29', '02:30', '02:15']);
});
