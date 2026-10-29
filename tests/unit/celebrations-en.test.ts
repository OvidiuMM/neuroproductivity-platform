import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CelebrationKind } from '../../src/services/celebrations.ts';

// La app en inglés: se fija antes de cargar los módulos (el idioma se lee al cargarlos)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { CELEBRATION_MESSAGES, createCelebrations, fillMessage } = await import('../../src/services/celebrations.ts');

const KINDS: CelebrationKind[] = ['oldTask', 'goal', 'project'];

describe('celebrations in English', () => {
  it('each kind has 14 different, non-empty English messages without emoji', () => {
    for (const kind of KINDS) {
      const messages = CELEBRATION_MESSAGES[kind];
      assert.equal(messages.length, 14, kind);
      assert.equal(new Set(messages).size, messages.length, `${kind}: repeated`);
      for (const message of messages) {
        assert.ok(message.trim().length > 0 && message === message.trim(), message);
        assert.doesNotMatch(message, /\p{Extended_Pictographic}/u, message);
        // Nada en español (ni tildes ni eñes)
        assert.doesNotMatch(message, /[áéíóúñ¿¡]/i, message);
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
    const celebrate = createCelebrations(() => 0);
    const now = new Date('2026-10-29T10:00:00.000Z');
    const createdAt = new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000).toISOString();
    const result = celebrate({ type: 'task', task: { id: 't1', status: 'PENDING', createdAt }, to: 'DONE', now });
    assert.equal(result?.message, 'It had been on your list for 23 days. Not anymore.');
  });
});
