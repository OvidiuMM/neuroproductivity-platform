import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTimeInput } from '../../src/services/timeInput.ts';

test('times are read in 24 hours, with or without a separator', () => {
  assert.equal(parseTimeInput('23:00'), '23:00');
  assert.equal(parseTimeInput('9:30'), '09:30');
  assert.equal(parseTimeInput('09.30'), '09:30');
  assert.equal(parseTimeInput('930'), '09:30');
  assert.equal(parseTimeInput('0930'), '09:30');
  assert.equal(parseTimeInput('11h05'), '11:05');
  assert.equal(parseTimeInput(' 00:00 '), '00:00');
  assert.equal(parseTimeInput(''), '');
});

test('half-written or impossible times are not a time yet', () => {
  for (const text of ['11', '11:', '11:5', '24:00', '12:60', '7 pm', '11:00 p. m.', 'abc', '1:2:3']) {
    assert.equal(parseTimeInput(text), null, text);
  }
});
