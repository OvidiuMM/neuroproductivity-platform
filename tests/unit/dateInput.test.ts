import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addMonthsTo,
  formatDateInput,
  monthGrid,
  parseDateInput,
  weekBoundsOf,
  WEEKDAYS_MONDAY_FIRST
} from '../../src/services/dateInput.ts';

describe('parseDateInput', () => {
  it('reads dd/mm/aaaa and its common variants', () => {
    assert.equal(parseDateInput('12/10/2026'), '2026-10-12');
    assert.equal(parseDateInput('5/3/2027'), '2027-03-05');
    assert.equal(parseDateInput('05-03-27'), '2027-03-05');
    assert.equal(parseDateInput('5.3.2027'), '2027-03-05');
    assert.equal(parseDateInput(' 05 03 2027 '), '2027-03-05');
    assert.equal(parseDateInput('05032027'), '2027-03-05');
  });

  it('accepts ISO dates', () => {
    assert.equal(parseDateInput('2026-10-12'), '2026-10-12');
  });

  it('returns an empty string for an empty field and null for impossible dates', () => {
    assert.equal(parseDateInput('   '), '');
    assert.equal(parseDateInput('31/02/2027'), null);
    assert.equal(parseDateInput('29/02/2027'), null);
    assert.equal(parseDateInput('29/02/2028'), '2028-02-29');
    assert.equal(parseDateInput('12/13/2026'), null);
    assert.equal(parseDateInput('12/10'), null);
    assert.equal(parseDateInput('mañana'), null);
  });
});

describe('formatDateInput', () => {
  it('shows dates as dd/mm/aaaa', () => {
    assert.equal(formatDateInput('2027-03-05'), '05/03/2027');
    assert.equal(formatDateInput(''), '');
  });
});

describe('Monday-first calendar', () => {
  it('lists the weekdays from Monday to Sunday', () => {
    assert.deepEqual(
      WEEKDAYS_MONDAY_FIRST.map((d) => d.short),
      ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    );
  });

  it('places each day of the month in its Monday-first column', () => {
    // Octubre de 2026 empieza en jueves y termina en sábado
    const weeks = monthGrid('2026-10-20');
    assert.equal(weeks.length, 5);
    assert.deepEqual(weeks[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    assert.deepEqual(weeks[4], [
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      null
    ]);
  });

  it('starts on the first cell when the month begins on a Monday', () => {
    // Febrero de 2027 empieza en lunes
    assert.equal(monthGrid('2027-02-10')[0][0], '2027-02-01');
  });

  it('finds the Monday and Sunday of a week, Sunday being its last day', () => {
    assert.deepEqual(weekBoundsOf('2026-10-14'), { monday: '2026-10-12', sunday: '2026-10-18' });
    assert.deepEqual(weekBoundsOf('2026-10-18'), { monday: '2026-10-12', sunday: '2026-10-18' });
  });

  it('moves by months keeping the day, or the last day when it does not exist', () => {
    assert.equal(addMonthsTo('2027-01-31', 1), '2027-02-28');
    assert.equal(addMonthsTo('2026-10-12', -12), '2025-10-12');
  });
});
