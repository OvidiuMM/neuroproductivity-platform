import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { effectivePriority } from '../../src/services/tasks.ts';
import {
  DEFAULT_LIST_PREFS,
  arrangeTasks,
  countActiveFilters,
  formatEstimate,
  parseListPrefs,
  type ListPrefs
} from '../../src/services/taskListing.ts';
import type { TaskItem } from '../../src/types';

const now = new Date(2026, 9, 11, 12, 0); // 11 oct 2026, 12:00 local

const task = (id: string, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id,
  userId: 'uid',
  listContext: 'WORK',
  title: `Llamar ${id}`,
  description: '',
  priority: 'MEDIUM',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...overrides
});

const prefs = (overrides: { sortBy?: ListPrefs['sortBy']; filters?: Partial<ListPrefs['filters']> } = {}): ListPrefs => ({
  sortBy: overrides.sortBy ?? 'priority',
  filters: { ...DEFAULT_LIST_PREFS.filters, ...overrides.filters }
});

describe('effectivePriority', () => {
  it('drops one level when the due date is more than a week away', () => {
    assert.equal(effectivePriority({ priority: 'CRITICAL', dueDate: '2026-11-30' }, now), 'HIGH');
    assert.equal(effectivePriority({ priority: 'HIGH', dueDate: '2026-11-30' }, now), 'MEDIUM');
    assert.equal(effectivePriority({ priority: 'LOW', dueDate: '2026-11-30' }, now), 'LOW');
  });

  it('keeps the priority without a due date or within a week', () => {
    assert.equal(effectivePriority({ priority: 'HIGH' }, now), 'HIGH');
    assert.equal(effectivePriority({ priority: 'HIGH', dueDate: '2026-10-15' }, now), 'HIGH');
    assert.equal(effectivePriority({ priority: 'HIGH', dueDate: '2026-10-01' }, now), 'HIGH');
  });
});

describe('arrangeTasks', () => {
  const tasks = [
    task('far-high', { priority: 'HIGH', dueDate: '2026-12-01', estimateMinutes: 120 }),
    task('soon-medium', { priority: 'MEDIUM', dueDate: '2026-10-13', estimateMinutes: 15, wheelCategory: 'Salud' }),
    task('no-date-high', { priority: 'HIGH', status: 'BLOCKED' }),
    task('overdue-low', { priority: 'LOW', dueDate: '2026-10-05', estimateMinutes: 30, wheelCategory: 'Finanzas' })
  ];
  const ids = (list: TaskItem[]) => list.map((t) => t.id);

  it('sorts by effective priority, then by due date', () => {
    // far-high cuenta como MEDIA; empata con soon-medium, que vence antes
    assert.deepEqual(ids(arrangeTasks(tasks, prefs(), now)), ['no-date-high', 'soon-medium', 'far-high', 'overdue-low']);
  });

  it('sorts by due date and by shortest estimate, leaving missing values last', () => {
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ sortBy: 'deadline' }), now)), ['overdue-low', 'soon-medium', 'far-high', 'no-date-high']);
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ sortBy: 'estimate' }), now)), ['soon-medium', 'overdue-low', 'far-high', 'no-date-high']);
  });

  it('filters by effective priority, estimate, status, deadline and area', () => {
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ filters: { priority: 'MEDIUM' } }), now)), ['soon-medium', 'far-high']);
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ filters: { maxEstimate: 30 } }), now)), ['soon-medium', 'overdue-low']);
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ filters: { status: 'BLOCKED' } }), now)), ['no-date-high']);
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ filters: { deadline: 'OVERDUE' } }), now)), ['overdue-low']);
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ filters: { deadline: 'NEXT_7_DAYS' } }), now)), ['soon-medium']);
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ filters: { deadline: 'NO_DATE' } }), now)), ['no-date-high']);
    assert.deepEqual(ids(arrangeTasks(tasks, prefs({ filters: { category: 'Finanzas' } }), now)), ['overdue-low']);
  });

  it('counts active filters', () => {
    assert.equal(countActiveFilters(DEFAULT_LIST_PREFS.filters), 0);
    assert.equal(countActiveFilters(prefs({ filters: { maxEstimate: 30, deadline: 'OVERDUE' } }).filters), 2);
  });
});

describe('formatEstimate and parseListPrefs', () => {
  it('formats known and custom estimates', () => {
    assert.equal(formatEstimate(30), '30 min');
    assert.equal(formatEstimate(240), 'Medio día (4 h)');
    assert.equal(formatEstimate(90), '1.5 h');
  });

  it('falls back to defaults for missing or invalid stored preferences', () => {
    assert.deepEqual(parseListPrefs(null), DEFAULT_LIST_PREFS);
    assert.deepEqual(parseListPrefs('not json'), DEFAULT_LIST_PREFS);
    assert.equal(parseListPrefs('{"sortBy":"bogus"}').sortBy, 'priority');
    const stored = parseListPrefs('{"sortBy":"estimate","filters":{"maxEstimate":60}}');
    assert.equal(stored.sortBy, 'estimate');
    assert.equal(stored.filters.maxEstimate, 60);
    assert.equal(stored.filters.priority, 'ALL');
  });
});
