import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Las novedades con la app en inglés. El idioma se fija antes de cargar los módulos
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { RELEASE_NOTES, releaseFor } = await import('../../src/services/releaseNotes.ts');
const { EXTRA_FEATURES } = await import('../../src/services/features.ts');

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('every version has its notes in English, with the month in English', () => {
  assert.equal(RELEASE_NOTES[0].version, version);
  assert.ok(releaseFor(version));
  assert.equal(releaseFor('1.1.0')?.month, 'October 2026');
  for (const release of RELEASE_NOTES) {
    assert.match(release.month, /^[A-Z][a-z]+ \d{4}$/, release.version);
    assert.ok(release.changes.length > 0);
    for (const { title, text } of release.changes) {
      assert.ok(title.trim() && text.trim(), release.version);
      // Nada a medio traducir: ni comillas españolas ni letras del español
      assert.doesNotMatch(`${title} ${text}`, /[«»¿¡ñáéíóú]/i, release.version);
    }
  }
});

test('the English release notes never announce the extra features', () => {
  for (const release of RELEASE_NOTES) {
    for (const { title, text } of release.changes) {
      const said = `${title} ${text}`;
      assert.doesNotMatch(said, /extra features?|Google Calendar|“CLAR” calendar/i, release.version);
      for (const { label, description } of EXTRA_FEATURES)
        assert.ok(!said.includes(label) && !said.includes(description), release.version);
    }
  }
});
