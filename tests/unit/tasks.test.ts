import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatTaskDates,
  getDeadlineState,
  normalizeTask,
  validateTaskDates,
  withStatus
} from '../../src/services/tasks.ts';
import type { TaskItem } from '../../src/types';

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  userId: 'uid',
  listContext: 'WORK',
  title: 'Entregar el informe trimestral',
  description: 'Enviarlo al equipo',
  priority: 'HIGH',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...overrides
});

// Fechas locales para que los tests no dependan de la zona horaria de la máquina
const now = new Date(2026, 9, 9, 12, 0); // 9 oct 2026, 12:00 local

describe('normalizeTask', () => {
  it('maps tasks saved before 0.6.0 from completed to status', () => {
    const { status: _status, ...legacy } = task();
    assert.equal(normalizeTask({ ...legacy, completed: true }).status, 'DONE');
    assert.equal(normalizeTask({ ...legacy, completed: false }).status, 'PENDING');
    assert.ok(!('completed' in normalizeTask({ ...legacy, completed: true })));
  });

  it('keeps an explicit status', () => {
    assert.equal(normalizeTask(task({ status: 'BLOCKED' })).status, 'BLOCKED');
  });
});

describe('withStatus', () => {
  it('records when a task is archived and clears it when reactivated', () => {
    const done = withStatus(task(), 'DONE', now);
    assert.equal(done.status, 'DONE');
    assert.equal(done.doneAt, now.toISOString());

    const reactivated = withStatus(done, 'IN_PROGRESS', now);
    assert.equal(reactivated.status, 'IN_PROGRESS');
    assert.equal(reactivated.doneAt, undefined);
  });
});

describe('getDeadlineState', () => {
  it('is none without a due date or once the task is done', () => {
    assert.equal(getDeadlineState(task(), now), 'none');
    assert.equal(getDeadlineState(task({ dueDate: '2026-10-01', status: 'DONE' }), now), 'none');
  });

  it('is overdue after the due moment', () => {
    assert.equal(getDeadlineState(task({ dueDate: '2026-10-08' }), now), 'overdue');
    assert.equal(getDeadlineState(task({ dueDate: '2026-10-09', dueTime: '11:59' }), now), 'overdue');
  });

  it('treats a date without time as due at the end of that day', () => {
    assert.equal(getDeadlineState(task({ dueDate: '2026-10-09' }), now), 'soon');
  });

  it('is soon when less than a week remains, normal otherwise', () => {
    assert.equal(getDeadlineState(task({ dueDate: '2026-10-15' }), now), 'soon');
    assert.equal(getDeadlineState(task({ dueDate: '2026-10-16', dueTime: '11:00' }), now), 'soon');
    assert.equal(getDeadlineState(task({ dueDate: '2026-10-16', dueTime: '12:01' }), now), 'normal');
    assert.equal(getDeadlineState(task({ dueDate: '2026-11-30' }), now), 'normal');
  });
});

describe('formatTaskDates and validateTaskDates', () => {
  it('formats a deadline and an interval', () => {
    assert.equal(formatTaskDates(task()), null);
    assert.match(formatTaskDates(task({ dueDate: '2026-10-15', dueTime: '15:00' }))!, /^Vence: 15 oct 2026, 15:00$/);
    assert.match(formatTaskDates(task({ startDate: '2026-10-12', dueDate: '2026-10-15' }))!, /12 oct 2026 → 15 oct 2026/);
  });

  it('requires a due date for an interval and a start that is not after it', () => {
    assert.equal(validateTaskDates({ dueDate: '2026-10-15' }), null);
    assert.match(validateTaskDates({ startDate: '2026-10-12' })!, /fecha límite/);
    assert.match(validateTaskDates({ startDate: '2026-10-16', dueDate: '2026-10-15' })!, /posterior/);
    assert.equal(validateTaskDates({ startDate: '2026-10-15', startTime: '09:00', dueDate: '2026-10-15', dueTime: '10:00' }), null);
    assert.match(validateTaskDates({ startDate: '2026-10-15', startTime: '11:00', dueDate: '2026-10-15', dueTime: '10:00' })!, /posterior/);
  });
});
