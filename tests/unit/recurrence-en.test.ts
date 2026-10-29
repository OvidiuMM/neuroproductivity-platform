import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Recurrence } from '../../src/types';

// La app en inglés: se fija antes de cargar los módulos (el idioma se lee al cargarlos)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { afterDoneText, buildRecurrence, describeRecurrence, everyPeriod, monthlyDayText, repeatUnit } =
  await import('../../src/services/recurrence.ts');

describe('recurrence texts in English', () => {
  it('names the unit in singular or plural', () => {
    assert.equal(repeatUnit('DAILY', 1), 'day');
    assert.equal(repeatUnit('DAILY', 3), 'days');
    assert.equal(repeatUnit('WEEKLY', 2), 'weeks');
    assert.equal(repeatUnit('MONTHLY', 1), 'month');
    assert.equal(repeatUnit('YEARLY', 5), 'years');
  });

  it('says every period, with the number only when it is not 1', () => {
    assert.equal(everyPeriod(1, 'DAILY'), 'Every day');
    assert.equal(everyPeriod(3, 'DAILY'), 'Every 3 days');
    assert.equal(everyPeriod(2, 'WEEKLY'), 'Every 2 weeks');
    assert.equal(everyPeriod(1, 'YEARLY'), 'Every year');
  });

  it('describes weekly repeats with short English day names, Monday first', () => {
    const rec: Recurrence = { frequency: 'WEEKLY', interval: 1, weekdays: [0, 3, 1] };
    assert.equal(describeRecurrence(rec), 'Every week: Mon, Wed, Sun');
  });

  it('describes the day of the month with English ordinals', () => {
    assert.equal(describeRecurrence(buildRecurrence('MONTHLY', '2026-10-15')), 'Every month, on the 15th');
    assert.equal(monthlyDayText('DAY_OF_MONTH', 1, 0, 1), 'on the 1st');
    assert.equal(monthlyDayText('DAY_OF_MONTH', 2, 0, 1), 'on the 2nd');
    assert.equal(monthlyDayText('DAY_OF_MONTH', 3, 0, 1), 'on the 3rd');
    assert.equal(monthlyDayText('DAY_OF_MONTH', 11, 0, 1), 'on the 11th');
    assert.equal(monthlyDayText('DAY_OF_MONTH', 22, 0, 1), 'on the 22nd');
    assert.equal(monthlyDayText('DAY_OF_MONTH', 31, 0, 1), 'on the 31st');
  });

  it('describes the nth and the last weekday of the month', () => {
    // 12 oct 2026 es el 2.º lunes; 26 oct 2026, el último
    const nth = buildRecurrence('MONTHLY', '2026-10-12', { monthlyMode: 'NTH_WEEKDAY' });
    assert.equal(describeRecurrence(nth), 'Every month, on the 2nd Monday');
    const last = buildRecurrence('MONTHLY', '2026-10-26', { interval: 2, monthlyMode: 'LAST_WEEKDAY' });
    assert.equal(describeRecurrence(last), 'Every 2 months, on the last Monday');
  });

  it('describes yearly repeats with the day and month', () => {
    assert.equal(
      describeRecurrence(buildRecurrence('YEARLY', '2026-10-15'), '2026-10-15'),
      'Every year, on 15 October'
    );
  });

  it('describes repeats counted from completion and the end of the series', () => {
    assert.equal(afterDoneText(1, 'DAILY'), '1 day after you do it');
    const rec = buildRecurrence('WEEKLY', '2026-10-15', { interval: 2, from: 'COMPLETION', until: '2026-12-31' });
    assert.equal(describeRecurrence(rec), '2 weeks after you do it (until 31 Dec 2026)');
  });
});
