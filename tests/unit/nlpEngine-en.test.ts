import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// La app en inglés: se fija antes de cargar los módulos (el idioma se lee al cargarlos)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { inferWheelCategory, tokenizeAndClean } = await import('../../src/services/nlpEngine.ts');

describe('area suggestions in English', () => {
  it('removes English stopwords', () => {
    assert.deepEqual(tokenizeAndClean('Call the DENTIST about your checkup, please'), ['call', 'dentist', 'checkup']);
  });

  it('suggests the area from English words', () => {
    const cases: [string, string, string][] = [
      ['Call the dentist', 'Book a checkup', 'Salud'],
      ['Send the proposal to the client', '', 'Carrera Profesional'],
      ['Pay the mortgage', 'Check the bank account', 'Finanzas'],
      ["Plan dad's birthday dinner", '', 'Familia'],
      ['Buy concert tickets', '', 'Ocio'],
      ['Have coffee with friends', '', 'Relaciones'],
      ['Write in my journal', 'Ten minutes of meditation', 'Espiritualidad']
    ];
    for (const [title, description, area] of cases) {
      const result = inferWheelCategory(title, description);
      assert.equal(result.category, area, title);
      assert.equal(result.isAboveThreshold, true, title);
    }
  });

  it('returns no area when the text has no relevant words', () => {
    const result = inferWheelCategory('xyz', 'qwerty');
    assert.equal(result.category, null);
    assert.equal(result.confidenceScore, 0);
  });
});
