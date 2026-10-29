import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// La app en inglés: se fija antes de cargar los módulos (el idioma se lee al cargarlos)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { PRIORITY_LABEL, TASK_STATUSES, formatDay, formatTaskDates, statusLabel, validateTaskDates } =
  await import('../../src/services/tasks.ts');
const { ESTIMATE_OPTIONS, formatEstimate } = await import('../../src/services/taskListing.ts');
const { DATE_INPUT_PLACEHOLDER, WEEKDAYS_MONDAY_FIRST } = await import('../../src/services/dateInput.ts');

describe('task texts in English', () => {
  it('names the statuses and priorities', () => {
    assert.deepEqual(
      TASK_STATUSES.map((s) => s.label),
      ['Pending', 'In progress', 'Blocked', 'Done', 'Canceled']
    );
    assert.equal(statusLabel('CANCELLED'), 'Canceled');
    assert.deepEqual(PRIORITY_LABEL, { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' });
  });

  it('formats days day first, with the short month', () => {
    assert.equal(formatDay('2026-10-13'), '13 Oct 2026');
    assert.equal(formatTaskDates({ dueDate: '2026-10-13', dueTime: '09:30' }), 'Due: 13 Oct 2026, 09:30');
    assert.equal(formatTaskDates({ startDate: '2026-10-10', dueDate: '2026-10-13' }), '10 Oct 2026 → 13 Oct 2026');
  });

  it('explains what is wrong with the dates', () => {
    assert.equal(validateTaskDates({ startDate: '2026-10-10' }), 'For a date range, also set the due date.');
    assert.equal(
      validateTaskDates({ startDate: '2026-10-14', dueDate: '2026-10-13' }),
      "The start date can't be after the due date."
    );
  });

  it('names the estimates', () => {
    assert.deepEqual(
      ESTIMATE_OPTIONS.map((o) => o.label),
      ['15 min', '30 min', '1 h', '2 h', 'Half a day (4 h)', '1 day (8 h)', 'More than 1 day']
    );
    assert.equal(formatEstimate(90), '1.5 h');
  });

  it('writes dates as dd/mm/yyyy, with English day names starting on Monday', () => {
    assert.equal(DATE_INPUT_PLACEHOLDER, 'dd/mm/yyyy');
    assert.deepEqual(WEEKDAYS_MONDAY_FIRST.map((d) => d.short).join(''), 'MTWTFSS');
    assert.equal(WEEKDAYS_MONDAY_FIRST[0].name, 'Monday');
    assert.equal(WEEKDAYS_MONDAY_FIRST[6].day, 0);
  });
});
