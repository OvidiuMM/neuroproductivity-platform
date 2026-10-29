import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CELEBRATION_MESSAGES,
  OLD_TASK_DAYS,
  celebrationKind,
  createCelebrations,
  fillMessage,
  pickIndex,
  taskAgeDays,
  type CelebrationKind,
  type CelebrationTrigger
} from '../../src/services/celebrations.ts';
import type { TaskItem, TaskStatus } from '../../src/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-29T10:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

type TaskTrigger = Extract<CelebrationTrigger, { type: 'task' }>;
const taskDone = (overrides: Partial<TaskTrigger['task']> = {}, to: TaskStatus = 'DONE'): TaskTrigger => ({
  type: 'task',
  task: { id: 't1', status: 'PENDING', createdAt: ago(20 * DAY_MS), ...overrides },
  to,
  now: NOW
});

const KINDS: CelebrationKind[] = ['oldTask', 'goal', 'project'];
// Una serie fija de números en [0, 1): las pruebas no dependen del azar
const sequence = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('celebrations: when', () => {
  it('a task is old from 14 days (14 × 24 h) since it was created', () => {
    assert.equal(OLD_TASK_DAYS, 14);
    assert.deepEqual(celebrationKind(taskDone({ createdAt: ago(OLD_TASK_DAYS * DAY_MS) })), {
      kind: 'oldTask',
      days: 14
    });
    assert.equal(celebrationKind(taskDone({ createdAt: ago(OLD_TASK_DAYS * DAY_MS - 1) })), null);
    assert.equal(celebrationKind(taskDone({ createdAt: ago(3 * DAY_MS) })), null);
    assert.deepEqual(celebrationKind(taskDone({ createdAt: ago(100 * DAY_MS + 5 * 3600_000) })), {
      kind: 'oldTask',
      days: 100
    });
    assert.equal(taskAgeDays(ago(23 * DAY_MS + 1), NOW), 23);
  });

  it('only when a task is done from an open status, and never for a recurring one', () => {
    for (const status of ['PENDING', 'IN_PROGRESS', 'BLOCKED'] as const)
      assert.equal(celebrationKind(taskDone({ status }))?.kind, 'oldTask', status);
    // Cancelar, reactivar o cambiar a otro estado abierto no se celebra
    for (const to of ['CANCELLED', 'PENDING', 'IN_PROGRESS', 'BLOCKED'] as const)
      assert.equal(celebrationKind(taskDone({}, to)), null, to);
    // De Cancelada a Hecha (en «Archivadas») o una ya hecha, tampoco
    assert.equal(celebrationKind(taskDone({ status: 'CANCELLED' })), null);
    assert.equal(celebrationKind(taskDone({ status: 'DONE' })), null);
    // Cada repetición se renueva: no cuenta su antigüedad
    const recurrence: TaskItem['recurrence'] = { frequency: 'WEEKLY', interval: 1, weekdays: [1] };
    assert.equal(celebrationKind(taskDone({ recurrence })), null);
  });

  it('never with a creation date that cannot be read or is in the future', () => {
    assert.equal(celebrationKind(taskDone({ createdAt: 'no es una fecha' })), null);
    assert.equal(celebrationKind(taskDone({ createdAt: ago(-30 * DAY_MS) })), null);
    assert.equal(taskAgeDays('', NOW), null);
  });

  it('a goal when achieved while active; a project when finished while active', () => {
    const goal = (status: 'ACTIVE' | 'ACHIEVED' | 'ARCHIVED') => ({ id: 'g1', status });
    assert.deepEqual(celebrationKind({ type: 'goal', goal: goal('ACTIVE'), to: 'ACHIEVED' }), { kind: 'goal' });
    assert.equal(celebrationKind({ type: 'goal', goal: goal('ARCHIVED'), to: 'ACHIEVED' }), null);
    assert.equal(celebrationKind({ type: 'goal', goal: goal('ACTIVE'), to: 'ARCHIVED' }), null);
    assert.equal(celebrationKind({ type: 'goal', goal: goal('ACHIEVED'), to: 'ACTIVE' }), null);

    const project = (status: 'ACTIVE' | 'FINISHED' | 'ARCHIVED') => ({ id: 'p1', status });
    assert.deepEqual(celebrationKind({ type: 'project', project: project('ACTIVE'), to: 'FINISHED' }), {
      kind: 'project'
    });
    assert.equal(celebrationKind({ type: 'project', project: project('ARCHIVED'), to: 'FINISHED' }), null);
    assert.equal(celebrationKind({ type: 'project', project: project('ACTIVE'), to: 'ARCHIVED' }), null);
    assert.equal(celebrationKind({ type: 'project', project: project('FINISHED'), to: 'ACTIVE' }), null);
  });
});

describe('celebrations: in a session', () => {
  it('celebrates the same task, goal or project only once (done → «Deshacer» → done again)', () => {
    const celebrationFor = createCelebrations(() => 0);
    assert.ok(celebrationFor(taskDone()));
    assert.equal(celebrationFor(taskDone()), null);
    assert.ok(celebrationFor(taskDone({ id: 't2' })));

    const goal = { type: 'goal', goal: { id: 'g1', status: 'ACTIVE' }, to: 'ACHIEVED' } as const;
    assert.ok(celebrationFor(goal));
    assert.equal(celebrationFor(goal), null);
    // Un proyecto con el mismo id que la meta es otra cosa
    assert.ok(celebrationFor({ type: 'project', project: { id: 'g1', status: 'ACTIVE' }, to: 'FINISHED' }));
  });

  it('what does not qualify is not remembered: it can be celebrated later', () => {
    const celebrationFor = createCelebrations(() => 0);
    assert.equal(celebrationFor(taskDone({}, 'CANCELLED')), null);
    assert.ok(celebrationFor(taskDone()));
  });

  it('never shows the same message twice in a row, per kind', () => {
    // Con el azar siempre a 0 tocaría siempre el primero: alterna entre los dos primeros
    const always = createCelebrations(() => 0);
    const first = always(taskDone({ id: 'a' }))!.message;
    const second = always(taskDone({ id: 'b' }))!.message;
    assert.notEqual(first, second);
    // Cada tipo recuerda el suyo: una meta en medio no cambia lo de las tareas
    assert.ok(always({ type: 'goal', goal: { id: 'g', status: 'ACTIVE' }, to: 'ACHIEVED' }));
    assert.notEqual(always(taskDone({ id: 'c' }))!.message, second);

    const random = sequence([0.12, 0.12, 0.5, 0.5, 0.99, 0.99, 0, 0.73, 0.73, 0.31]);
    const celebrationFor = createCelebrations(random);
    let last = '';
    for (let i = 0; i < 60; i++) {
      const { message } = celebrationFor({ type: 'goal', goal: { id: `g${i}`, status: 'ACTIVE' }, to: 'ACHIEVED' })!;
      assert.notEqual(message, last);
      last = message;
    }
  });

  it('picks evenly among the other messages', () => {
    const steps = Array.from({ length: 40 }, (_, i) => i / 40);
    const seen = new Set(steps.map((r) => pickIndex(5, 2, () => r)));
    assert.deepEqual([...seen].sort(), [0, 1, 3, 4]);
    assert.equal(
      pickIndex(5, undefined, () => 0.99),
      4
    );
    assert.equal(
      pickIndex(1, 0, () => 0.5),
      0
    );
    // Aunque el azar devuelva justo 1, el índice no se sale
    assert.equal(
      pickIndex(3, undefined, () => 1),
      2
    );
  });
});

describe('celebrations: messages', () => {
  it('each kind has at least 12 different, non-empty messages without emoji', () => {
    for (const kind of KINDS) {
      const messages = CELEBRATION_MESSAGES[kind];
      assert.ok(messages.length >= 12, kind);
      assert.equal(new Set(messages).size, messages.length, `${kind}: repetidos`);
      for (const message of messages) {
        assert.ok(message.trim().length > 0 && message === message.trim(), message);
        assert.doesNotMatch(message, /\p{Extended_Pictographic}|️/u, message);
        assert.match(message, /[.!]$/, message);
      }
    }
  });

  it('only task messages carry the days, and the number replaces every placeholder', () => {
    for (const kind of ['goal', 'project'] as const)
      for (const message of CELEBRATION_MESSAGES[kind]) assert.doesNotMatch(message, /[{}]/, message);
    const withDays = CELEBRATION_MESSAGES.oldTask.filter((m) => m.includes('{days}'));
    assert.ok(withDays.length > 0 && withDays.length < CELEBRATION_MESSAGES.oldTask.length);
    for (const message of CELEBRATION_MESSAGES.oldTask) {
      const filled = fillMessage(message, 23);
      assert.doesNotMatch(filled, /[{}]/, message);
      assert.equal(filled.includes('23'), message.includes('{days}'), message);
    }
  });

  it('says how many days the task waited', () => {
    // El primer mensaje lleva los días
    assert.ok(CELEBRATION_MESSAGES.oldTask[0].includes('{days}'));
    const celebrationFor = createCelebrations(() => 0);
    assert.equal(
      celebrationFor(taskDone({ createdAt: ago(23 * DAY_MS) }))?.message,
      fillMessage(CELEBRATION_MESSAGES.oldTask[0], 23)
    );
    assert.match(fillMessage(CELEBRATION_MESSAGES.oldTask[0], 23), /\b23 días\b/);
  });
});
