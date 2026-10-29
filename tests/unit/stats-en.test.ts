// Recomendaciones de Inicio en inglés
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Project, TaskItem, WheelOfLifeLog } from '../../src/types';

const { computeStats, recommendationsFor } = await import('../../src/services/stats.ts');

const now = new Date(2026, 9, 14, 12, 0);
const at = (day: number) => new Date(2026, 9, day, 10, 0).toISOString();
const task = (id: string, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id,
  userId: 'uid',
  listContext: 'WORK',
  title: `Task ${id}`,
  description: '',
  priority: 'MEDIUM',
  createdAt: at(1),
  updatedAt: at(1),
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...overrides
});

test('overdue tasks and an unassessed Wheel are recommended in English', () => {
  const tasks = [
    task('old', { title: 'Pay the insurance', dueDate: '2026-10-05' }),
    task('new', { dueDate: '2026-10-13' })
  ];
  const recs = recommendationsFor(computeStats(tasks, now), tasks, [], now);
  assert.equal(recs[0].text, 'You have 2 overdue tasks. Start with the oldest: “Pay the insurance”.');
  assert.deepEqual(recs[0].action, { label: 'View the agenda', tab: 'agenda' });
  const wheel = recs.find((r) => r.id === 'wheel');
  assert.equal(
    wheel?.text,
    'You haven’t assessed your Wheel of Life yet. It’s the starting point for choosing your goals.'
  );
  assert.deepEqual(wheel?.action, { label: 'Go to the Wheel', tab: 'wheel' });

  const one = [task('only', { title: 'Call Ana', dueDate: '2026-10-05' })];
  assert.equal(
    recommendationsFor(computeStats(one, now), one, [], now)[0].text,
    'You have an overdue task: “Call Ana”. Do it or change its deadline.'
  );
});

test('the weakest area without goals uses its English starting name', () => {
  const log: WheelOfLifeLog = {
    id: 'w1',
    userId: 'u',
    timestamp: new Date(2026, 9, 10).toISOString(),
    scores: { Salud: 7, 'Carrera Profesional': 7, Finanzas: 3, Familia: 7, Ocio: 7, Relaciones: 7, Espiritualidad: 7 }
  };
  const [first] = recommendationsFor(computeStats([], now), [], [log], now, []);
  assert.equal(
    first.text,
    '“Finances” scored 3/10 in your last assessment and has no goals yet. Set a concrete goal and add its first task.'
  );
  assert.deepEqual(first.action, { label: 'Go to Goals', tab: 'goals' });
});

test('a late project, a busy week and restarting are explained in English', () => {
  const project: Project = {
    id: 'kitchen',
    userId: 'uid',
    title: 'Kitchen',
    goalId: 'g1',
    endDate: '2026-10-10',
    status: 'ACTIVE',
    createdAt: at(1),
    updatedAt: at(1)
  };
  const one = [task('t1', { projectId: 'kitchen' })];
  const [late] = recommendationsFor(computeStats(one, now), one, [], now, [], undefined, [project]);
  assert.match(late.text, /^The project “Kitchen” is overdue: it was due to end on .+ and has 1 task left\. /);
  assert.deepEqual(late.action, { label: 'View projects', tab: 'projects' });

  const week = ['a', 'b', 'c', 'd', 'e'].map((id) => task(id, { dueDate: '2026-10-16' }));
  const recs = recommendationsFor(computeStats(week, now), week, [], now);
  assert.equal(
    recs.find((r) => r.id === 'busy-week')?.text,
    '5 tasks are due this week. See if any can wait or move to “Someday”.'
  );
  assert.equal(
    recs.find((r) => r.id === 'restart')?.text,
    'You haven’t completed any tasks this week yet. Pick a short one from your Top 10 and do it today.'
  );
});
