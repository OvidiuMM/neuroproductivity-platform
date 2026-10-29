import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXTRA_FEATURES } from '../../src/services/features.ts';
import { RELEASE_NOTES, compareVersions, releaseFor, shouldShowReleaseNotes } from '../../src/services/releaseNotes.ts';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('the version of package.json has its release notes, first, and each change says something', () => {
  assert.equal(RELEASE_NOTES[0].version, version);
  assert.ok(releaseFor(version));
  // De la más reciente a la más antigua, sin repetir
  for (let i = 1; i < RELEASE_NOTES.length; i++)
    assert.ok(compareVersions(RELEASE_NOTES[i - 1].version, RELEASE_NOTES[i].version) > 0);
  for (const release of RELEASE_NOTES) {
    assert.ok(release.month.trim());
    assert.ok(release.changes.length > 0);
    for (const change of release.changes) {
      assert.ok(change.title.trim() && change.text.trim(), release.version);
    }
  }
});

// En inglés, ver releaseNotes.en.test.ts
test('the release notes never announce the extra features', () => {
  for (const release of RELEASE_NOTES) {
    for (const { title, text } of release.changes) {
      const said = `${title} ${text}`;
      assert.doesNotMatch(said, /funci[oó]n(es)? extra|calendario «CLAR»|Google Calendar/i, release.version);
      for (const { label, description } of EXTRA_FEATURES)
        assert.ok(!said.includes(label) && !said.includes(description), release.version);
    }
  }
});

test('the manifest and the splash screen carry the same version', () => {
  assert.equal((JSON.parse(readFileSync('public/manifest.json', 'utf8')) as { version: string }).version, version);
  assert.match(readFileSync('public/splash.svg', 'utf8'), new RegExp(`>v${version.replace(/\./g, '\\.')}<`));
});

test('versions compare by number, not as text', () => {
  assert.ok(compareVersions('0.9.10', '0.9.6') > 0);
  assert.ok(compareVersions('1.0', '0.9.6') > 0);
  assert.equal(compareVersions('0.9.6', '0.9.6'), 0);
  assert.ok(compareVersions('0.9.5', '0.9.6') < 0);
});

test('the notes show once to accounts past the welcome that have not seen this version', () => {
  const show = (fields: Partial<Parameters<typeof shouldShowReleaseNotes>[0]>) =>
    shouldShowReleaseNotes({ current: version, onboarded: true, seenInProfile: undefined, seenHere: null, ...fields });
  assert.equal(show({}), true);
  assert.equal(show({ seenInProfile: '0.9.5' }), true);
  // Ya vistas, en el perfil o en este dispositivo (también si vio las de una versión posterior)
  assert.equal(show({ seenInProfile: version }), false);
  assert.equal(show({ seenHere: version }), false);
  assert.equal(show({ seenInProfile: '99.0' }), false);
  // Una cuenta nueva empieza por la bienvenida
  assert.equal(show({ onboarded: false }), false);
  // Lo guardado sin forma de versión no cuenta
  assert.equal(show({ seenInProfile: 'mucho' }), true);
  // Una versión sin entrada no abre nada
  assert.equal(show({ current: '0.0.1' }), false);
});
