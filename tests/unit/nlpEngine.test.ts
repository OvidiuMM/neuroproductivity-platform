import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferWheelCategory, tokenizeAndClean } from '../../src/services/nlpEngine.ts';

describe('tokenizeAndClean', () => {
  it('normalizes accents and removes Spanish stopwords', () => {
    assert.deepEqual(tokenizeAndClean('Llamar al MÉDICO, por favor'), ['llamar', 'medico', 'favor']);
  });
});

describe('inferWheelCategory', () => {
  it('suggests the health category for health-related terms', () => {
    const result = inferWheelCategory('Llamar al médico', 'Pedir cita para una analítica de salud');

    assert.equal(result.category, 'Salud');
    assert.equal(result.isAboveThreshold, true);
    assert.ok(result.tokensFound.includes('medico'));
  });

  it('returns no category when the text has no relevant terms', () => {
    const result = inferWheelCategory('xyz', 'qwerty');

    assert.equal(result.category, null);
    assert.equal(result.isAboveThreshold, false);
    assert.equal(result.confidenceScore, 0);
  });

  it('provides scores for all seven life areas', () => {
    const result = inferWheelCategory('Revisar el presupuesto del banco', '');

    assert.deepEqual(Object.keys(result.allScores), [
      'Salud',
      'Carrera Profesional',
      'Finanzas',
      'Familia',
      'Ocio',
      'Relaciones',
      'Espiritualidad'
    ]);
  });
});
