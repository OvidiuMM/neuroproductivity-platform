import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TaskItem } from '../../src/types';

// La app en inglés: se fija antes de cargar los módulos (el idioma se lee al cargarlos)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { alarmError, alarmLabel, alarmLateNote, alarmUnavailableReason, describeAlarm } =
  await import('../../src/services/alarms.ts');

type AlarmTask = Pick<TaskItem, 'dueDate' | 'dueTime' | 'recurrence' | 'alarmTime'>;
const NOW = new Date(2026, 9, 14, 10, 0);

describe('alarm texts in English', () => {
  it('asks for a due date before an alarm', () => {
    assert.equal(alarmUnavailableReason({}), 'Set a due date to add an alarm.');
    assert.equal(alarmUnavailableReason({ dueDate: '2026-10-15' }), null);
  });

  it('asks for an alarm before the due time', () => {
    assert.equal(
      alarmError({ dueTime: '10:00', alarmTime: '11:00' }),
      'The alarm has to be before the due time (10:00): change it or remove it.'
    );
  });

  it('labels the card with today, tomorrow or the date', () => {
    assert.equal(alarmLabel(new Date(2026, 9, 14, 17, 0), NOW), 'today 17:00');
    assert.equal(alarmLabel(new Date(2026, 9, 15, 9, 0), NOW), 'tomorrow 09:00');
    assert.equal(alarmLabel(new Date(2026, 9, 20, 10, 57), NOW), '20 Oct 10:57');
  });

  it('says when it will ring, and when that time has already passed', () => {
    const task = (overrides: Partial<AlarmTask>): AlarmTask => ({
      dueDate: '2026-10-14',
      alarmTime: '17:00',
      ...overrides
    });
    assert.equal(describeAlarm(task({}), NOW), 'It will ring today at 17:00.');
    assert.equal(describeAlarm(task({ dueDate: '2026-10-15' }), NOW), 'It will ring tomorrow at 17:00.');
    assert.equal(describeAlarm(task({ dueDate: '2026-10-20' }), NOW), 'It will ring on 20 Oct at 17:00.');
    assert.equal(
      describeAlarm(task({ alarmTime: '09:00' }), NOW),
      "That time has already passed (today at 09:00): it won't ring."
    );
    // Las de antes de 0.9.7, a la hora límite o más tarde, suenan la víspera
    assert.equal(
      describeAlarm(task({ dueDate: '2026-10-20', dueTime: '10:00', alarmTime: '20:00' }), NOW),
      'It will ring the day before, on 19 Oct, at 20:00.'
    );
  });

  it('says when a late alert was due', () => {
    const at = new Date(2026, 9, 14, 9, 0);
    assert.equal(alarmLateNote(at, new Date(2026, 9, 14, 9, 1)), null);
    assert.equal(alarmLateNote(at, NOW), "It was at 09:00: CLAR wasn't open at that time.");
    assert.equal(
      alarmLateNote(at, new Date(2026, 9, 15, 8, 0)),
      "It was on 14 Oct at 09:00: CLAR wasn't open at that time."
    );
  });
});
