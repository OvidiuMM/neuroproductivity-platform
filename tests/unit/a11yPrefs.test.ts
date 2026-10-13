import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classesFor, DEFAULT_A11Y_PREFS, parseA11yPrefs } from '../../src/services/a11yPrefs.ts';

describe('accessibility preferences', () => {
  it('falls back to the defaults for missing, broken or unknown values', () => {
    assert.deepEqual(parseA11yPrefs(null), DEFAULT_A11Y_PREFS);
    assert.deepEqual(parseA11yPrefs('{not json'), DEFAULT_A11Y_PREFS);
    assert.deepEqual(parseA11yPrefs('{"textSize":"huge","highContrast":"yes"}'), DEFAULT_A11Y_PREFS);
  });

  it('reads the saved preferences', () => {
    assert.deepEqual(
      parseA11yPrefs('{"textSize":"xlarge","highContrast":true,"reduceMotion":true,"strongFocus":false}'),
      {
        textSize: 'xlarge',
        highContrast: true,
        reduceMotion: true,
        strongFocus: false
      }
    );
  });

  it('maps each preference to its class on <html>', () => {
    assert.deepEqual(classesFor(DEFAULT_A11Y_PREFS), []);
    assert.deepEqual(classesFor({ textSize: 'large', highContrast: true, reduceMotion: true, strongFocus: true }), [
      'a11y-text-large',
      'a11y-contrast',
      'a11y-reduce-motion',
      'a11y-focus'
    ]);
    assert.deepEqual(classesFor({ ...DEFAULT_A11Y_PREFS, textSize: 'xlarge' }), ['a11y-text-xlarge']);
  });
});
