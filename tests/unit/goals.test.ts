import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Goal, TaskItem, WheelOfLifeLog } from '../../src/types';
import {
  activeGoalsByArea,
  applyGoalAreas,
  areasWithGoals,
  goalProgress,
  latestScores,
  pendingGoalTasks,
  sortGoals,
  suggestGoal,
  validateGoal
} from '../../src/services/goals';

const goal = (overrides: Partial<Goal>): Goal => ({
  id: 'g1',
  userId: 'u',
  title: 'Correr una media maratón',
  area: 'Salud',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const task = (overrides: Partial<TaskItem>): TaskItem =>
  ({
    id: 't',
    userId: 'u',
    listContext: 'PERSONAL',
    title: 'Salir a correr',
    description: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    isSomeday: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }) as TaskItem;

test('goal progress counts the linked tasks that are done, leaving cancelled ones out', () => {
  const tasks = [
    task({ id: 'a', goalId: 'g1', status: 'DONE' }),
    task({ id: 'cancelled', goalId: 'g1', status: 'CANCELLED' }),
    task({ id: 'b', goalId: 'g1' }),
    task({ id: 'c', goalId: 'g1', status: 'IN_PROGRESS' }),
    task({ id: 'd', goalId: 'other', status: 'DONE' }),
    task({ id: 'e' })
  ];
  assert.deepEqual(goalProgress({ id: 'g1' }, tasks), { done: 1, total: 3 });
  assert.deepEqual(goalProgress({ id: 'none' }, tasks), { done: 0, total: 0 });
});

test('active goals are counted per area', () => {
  const goals = [
    goal({ id: '1' }),
    goal({ id: '2' }),
    goal({ id: '3', area: 'Finanzas' }),
    goal({ id: '4', status: 'ACHIEVED' }),
    goal({ id: '5', area: 'Ocio', status: 'ARCHIVED' })
  ];
  assert.deepEqual(activeGoalsByArea(goals), { Salud: 2, Finanzas: 1 });
});

test('the suggested goal shares the most meaningful words with the task, ignoring accents and case', () => {
  const goals = [
    goal({ id: 'run', title: 'Correr una media maratón' }),
    goal({ id: 'save', title: 'Ahorrar para la entrada del piso', area: 'Finanzas' }),
    goal({ id: 'old', title: 'Maratón de Valencia', status: 'ARCHIVED' })
  ];
  assert.equal(suggestGoal('Apuntarme a la MARATON de primavera', goals)?.id, 'run');
  assert.equal(suggestGoal('Revisar la entrada del piso con el banco', goals)?.id, 'save');
  // Palabras cortas o nexos no bastan
  assert.equal(suggestGoal('Ir a la de', goals), null);
  assert.equal(suggestGoal('', goals), null);
});

test('when two goals share as many words, the most recently updated wins', () => {
  const goals = [
    goal({ id: 'older', title: 'Leer más libros', updatedAt: '2026-01-01T00:00:00.000Z', area: 'Ocio' }),
    goal({ id: 'newer', title: 'Escribir libros', updatedAt: '2026-03-01T00:00:00.000Z', area: 'Ocio' })
  ];
  assert.equal(suggestGoal('Ordenar los libros', goals)?.id, 'newer');
});

test('a goal needs a name, an area and sensible lengths', () => {
  assert.equal(validateGoal({ title: 'Correr', area: 'Salud' }), null);
  assert.match(validateGoal({ title: '  ', area: 'Salud' })!, /nombre/);
  assert.match(validateGoal({ title: 'Correr' })!, /área/);
  assert.match(validateGoal({ title: 'x'.repeat(101), area: 'Salud' })!, /100/);
  assert.match(validateGoal({ title: 'Correr', area: 'Salud', why: 'x'.repeat(281) })!, /280/);
  assert.match(validateGoal({ title: 'Correr', area: 'Salud', targetDate: '31/12/2026' })!, /fecha/);
});

test('active goals come first, by target date, then achieved and archived', () => {
  const goals = [
    goal({ id: 'archived', status: 'ARCHIVED', targetDate: '2026-01-01' }),
    goal({ id: 'no-date' }),
    goal({ id: 'later', targetDate: '2026-12-31' }),
    goal({ id: 'achieved', status: 'ACHIEVED' }),
    goal({ id: 'sooner', targetDate: '2026-06-30' })
  ];
  assert.deepEqual(
    sortGoals(goals).map((g) => g.id),
    ['sooner', 'later', 'no-date', 'achieved', 'archived']
  );
});

test('a linked task takes its goal’s area when read, and a link to a missing goal is ignored', () => {
  const goals = [goal({ id: 'g1', area: 'Ocio' })];
  const tasks = [
    task({ id: 'linked', goalId: 'g1', wheelCategory: 'Salud' }),
    task({ id: 'dangling', goalId: 'deleted', wheelCategory: 'Finanzas' }),
    task({ id: 'free', wheelCategory: 'Familia' })
  ];
  const result = applyGoalAreas(tasks, goals);
  assert.deepEqual(
    result.map((t) => t.wheelCategory),
    ['Ocio', 'Finanzas', 'Familia']
  );
  // Las que no cambian son las mismas (no se copian)
  assert.equal(result[2], tasks[2]);
});

const scores = (values: Partial<WheelOfLifeLog['scores']>): WheelOfLifeLog['scores'] => ({
  Salud: 7,
  'Carrera Profesional': 7,
  Finanzas: 7,
  Familia: 7,
  Ocio: 7,
  Relaciones: 7,
  Espiritualidad: 7,
  ...values
});

test('the latest Wheel evaluation gives the scores, or none before the first one', () => {
  const log = (id: string, timestamp: string, values: Partial<WheelOfLifeLog['scores']>): WheelOfLifeLog => ({
    id,
    userId: 'u',
    timestamp,
    scores: scores(values)
  });
  assert.equal(latestScores([]), null);
  const logs = [
    log('b', '2026-03-01T00:00:00.000Z', { Salud: 2 }),
    log('c', '2026-02-01T00:00:00.000Z', { Salud: 9 }),
    log('a', '2026-01-01T00:00:00.000Z', { Salud: 5 })
  ];
  assert.equal(latestScores(logs)?.Salud, 2);
});

test('areas come lowest score first, with their active goals, and 5 or less needs attention', () => {
  const goals = [
    goal({ id: 'run', area: 'Salud', title: 'Correr' }),
    goal({ id: 'save', area: 'Finanzas', title: 'Ahorrar' }),
    goal({ id: 'old', area: 'Finanzas', title: 'Viejo', status: 'ARCHIVED' })
  ];
  const areas = areasWithGoals(goals, scores({ Finanzas: 3, Ocio: 5, Salud: 6, Familia: 3 }));
  assert.deepEqual(
    areas.map((a) => a.area),
    // Empates en el orden de la Rueda: Finanzas antes que Familia
    ['Finanzas', 'Familia', 'Ocio', 'Salud', 'Carrera Profesional', 'Relaciones', 'Espiritualidad']
  );
  assert.deepEqual(
    areas.slice(0, 4).map((a) => [a.area, a.score, a.weak, a.goals.map((g) => g.id)]),
    [
      ['Finanzas', 3, true, ['save']],
      ['Familia', 3, true, []],
      ['Ocio', 5, true, []],
      ['Salud', 6, false, ['run']]
    ]
  );
});

test('without an evaluation, areas keep the Wheel order and none is marked as needing attention', () => {
  const areas = areasWithGoals([goal({ area: 'Ocio' })], null);
  assert.deepEqual(
    areas.map((a) => a.area),
    ['Salud', 'Carrera Profesional', 'Finanzas', 'Familia', 'Ocio', 'Relaciones', 'Espiritualidad']
  );
  assert.ok(areas.every((a) => a.score === undefined && !a.weak));
  assert.equal(areas[4].goals.length, 1);
});

test('a goal lists the tasks still to do, those with the nearest due date first', () => {
  const tasks = [
    task({ id: 'done', goalId: 'g1', status: 'DONE', dueDate: '2026-01-01' }),
    task({ id: 'cancelled', goalId: 'g1', status: 'CANCELLED', dueDate: '2026-01-02' }),
    task({ id: 'later', goalId: 'g1', title: 'B', dueDate: '2026-05-01' }),
    task({ id: 'undated', goalId: 'g1', title: 'A' }),
    task({ id: 'soon', goalId: 'g1', title: 'C', dueDate: '2026-04-01', status: 'BLOCKED' }),
    task({ id: 'other', goalId: 'g2' })
  ];
  assert.deepEqual(
    pendingGoalTasks({ id: 'g1' }, tasks).map((t) => t.id),
    ['soon', 'later', 'undated']
  );
});
