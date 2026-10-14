import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Goal, TaskItem } from '../../src/types';
import { activeGoalsByArea, goalProgress, sortGoals, suggestGoal, validateGoal } from '../../src/services/goals';

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

test('goal progress counts the linked tasks that are done', () => {
  const tasks = [
    task({ id: 'a', goalId: 'g1', status: 'DONE' }),
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
