import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyProjectGoals,
  projectDeadline,
  projectProgress,
  sortProjects,
  validateProject
} from '../../src/services/projects.ts';
import type { Project, TaskItem } from '../../src/types';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  userId: 'uid',
  title: 'Reformar la cocina',
  goalId: 'g1',
  endDate: '2026-10-20',
  status: 'ACTIVE',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  ...overrides
});

const task = (id: string, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id,
  userId: 'uid',
  listContext: 'PERSONAL',
  title: id,
  description: '',
  priority: 'MEDIUM',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  projectId: 'p1',
  ...overrides
});

const now = new Date(2026, 9, 15, 12, 0); // jueves 15 oct 2026, 12:00

test('progress counts the done tasks over the total, leaving cancelled ones out', () => {
  const tasks = [
    task('a', { status: 'DONE' }),
    task('b', { status: 'DONE' }),
    task('c'),
    task('d', { status: 'CANCELLED' }),
    task('e', { projectId: 'other', status: 'DONE' })
  ];
  assert.deepEqual(projectProgress({ id: 'p1' }, tasks), { done: 2, total: 3, percent: 67 });
  assert.deepEqual(projectProgress({ id: 'empty' }, tasks), { done: 0, total: 0, percent: 0 });
});

test('a project is out of time once its end date has passed with tasks still open', () => {
  // El día de fin cuenta entero
  assert.equal(projectDeadline(project({ endDate: '2026-10-15' }), [task('a')], now).state, 'soon');
  assert.equal(projectDeadline(project({ endDate: '2026-10-14' }), [task('a')], now).state, 'overdue');
  assert.equal(projectDeadline(project({ endDate: '2026-10-30' }), [task('a')], now).state, 'normal');
  // Sin tareas abiertas no está fuera de plazo: falta marcarlo como terminado
  assert.equal(
    projectDeadline(project({ endDate: '2026-10-14' }), [task('a', { status: 'DONE' })], now).state,
    'ready'
  );
  // Uno terminado o archivado no avisa
  assert.equal(
    projectDeadline(project({ endDate: '2026-10-14', status: 'FINISHED' }), [task('a')], now).state,
    'normal'
  );
  // Sin tareas, nada que avisar todavía
  assert.equal(projectDeadline(project({ endDate: '2026-10-14' }), [], now).state, 'normal');
});

test('open tasks due after the end of the project are pointed out', () => {
  const { lateTasks, open } = projectDeadline(
    project({ endDate: '2026-10-20' }),
    [
      task('late', { dueDate: '2026-10-25' }),
      task('fine', { dueDate: '2026-10-20' }),
      task('done-late', { dueDate: '2026-10-25', status: 'DONE' })
    ],
    now
  );
  assert.deepEqual(
    lateTasks.map((t) => t.id),
    ['late']
  );
  assert.equal(open, 2);
});

test('a task in a project belongs to the project’s goal, and a link to a missing project is ignored', () => {
  const tasks = applyProjectGoals(
    [task('a', { goalId: 'old' }), task('b', { projectId: 'gone', goalId: 'g2' }), task('c', { projectId: undefined })],
    [project({ goalId: 'g1' })]
  );
  assert.deepEqual(
    tasks.map((t) => t.goalId),
    ['g1', 'g2', undefined]
  );
});

test('active projects come first, by end date, then finished and archived ones', () => {
  const sorted = sortProjects([
    project({ id: 'archived', status: 'ARCHIVED' }),
    project({ id: 'later', endDate: '2026-12-01' }),
    project({ id: 'finished', status: 'FINISHED' }),
    project({ id: 'sooner', endDate: '2026-11-01' })
  ]);
  assert.deepEqual(
    sorted.map((p) => p.id),
    ['sooner', 'later', 'finished', 'archived']
  );
});

test('a project needs a name, a goal and an end date', () => {
  assert.equal(validateProject({ title: ' ', goalId: 'g1', endDate: '2026-10-20' }), 'Escribe el nombre del proyecto.');
  assert.equal(validateProject({ title: 'Reforma', endDate: '2026-10-20' }), 'Elige la meta a la que pertenece.');
  assert.equal(validateProject({ title: 'Reforma', goalId: 'g1' }), 'Elige la fecha de fin.');
  assert.match(validateProject({ title: 'x'.repeat(101), goalId: 'g1', endDate: '2026-10-20' })!, /100 caracteres/);
  assert.equal(validateProject({ title: 'Reforma', goalId: 'g1', endDate: '2026-10-20' }), null);
});
