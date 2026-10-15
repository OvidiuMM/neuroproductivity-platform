import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockerOf,
  createsCycle,
  dependencyCandidates,
  dependentsOf,
  tasksById
} from '../../src/services/dependencies.ts';
import { splitTop10 } from '../../src/services/taskListing.ts';
import { nextRecurringTask } from '../../src/services/recurrence.ts';
import type { TaskItem } from '../../src/types';

const task = (id: string, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id,
  userId: 'uid',
  listContext: 'WORK',
  title: id,
  description: '',
  priority: 'MEDIUM',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...overrides
});

test('a task is blocked while the one it waits for is open, and free once it is done, cancelled or gone', () => {
  const b = task('b', { dependsOn: 'a' });
  assert.equal(blockerOf(b, tasksById([task('a'), b]))?.id, 'a');
  assert.equal(blockerOf(b, tasksById([task('a', { status: 'IN_PROGRESS' }), b]))?.id, 'a');
  assert.equal(blockerOf(b, tasksById([task('a', { status: 'DONE' }), b])), undefined);
  assert.equal(blockerOf(b, tasksById([task('a', { status: 'CANCELLED' }), b])), undefined);
  assert.equal(blockerOf(b, tasksById([b])), undefined);
  assert.equal(blockerOf(task('c'), tasksById([task('a')])), undefined);
});

test('several tasks can wait for the same one, in parallel', () => {
  const tasks = [task('a'), task('b', { dependsOn: 'a' }), task('c', { dependsOn: 'a' }), task('d')];
  assert.deepEqual(
    dependentsOf({ id: 'a' }, tasks).map((t) => t.id),
    ['b', 'c']
  );
  assert.deepEqual(dependentsOf({ id: 'a' }, [task('b', { dependsOn: 'a', status: 'DONE' })]), []);
});

test('a task cannot wait for itself or for one that already waits for it, directly or not', () => {
  // c espera a b, que espera a a
  const tasks = [task('a'), task('b', { dependsOn: 'a' }), task('c', { dependsOn: 'b' }), task('d')];
  const byId = tasksById(tasks);
  assert.equal(createsCycle('a', 'c', byId), true);
  assert.equal(createsCycle('a', 'b', byId), true);
  assert.equal(createsCycle('c', 'a', byId), false);
  assert.equal(createsCycle(undefined, 'a', byId), false);
  assert.deepEqual(
    dependencyCandidates('a', [...tasks, task('e', { status: 'DONE' })]).map((t) => t.id),
    ['d']
  );
  // Una tarea nueva puede esperar a cualquiera abierta
  assert.deepEqual(
    dependencyCandidates(undefined, tasks).map((t) => t.id),
    ['a', 'b', 'c', 'd']
  );
});

test('the Top 10 holds the first ten tasks that can be done now; blocked ones go with the rest', () => {
  const arranged = Array.from({ length: 12 }, (_, i) => task(`t${i}`, { dependsOn: i === 0 ? 'x' : undefined }));
  const { top, rest } = splitTop10(arranged, (t) => t.dependsOn === 'x');
  assert.deepEqual(
    top.map((t) => t.id),
    ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']
  );
  assert.deepEqual(
    rest.map((t) => t.id),
    ['t0', 't11']
  );
});

test('the next repetition of a recurring task does not keep waiting for the previous task', () => {
  const next = nextRecurringTask(
    task('r', { dependsOn: 'a', dueDate: '2030-06-10', recurrence: { frequency: 'DAILY', interval: 1 } }),
    new Date(2030, 5, 10, 9, 0)
  );
  assert.equal(next?.dependsOn, undefined);
});
