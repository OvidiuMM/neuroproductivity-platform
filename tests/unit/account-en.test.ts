import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FirebaseError } from 'firebase/app';

// Textos de la cuenta, el acceso y el contacto en inglés: el idioma se fija antes de cargar los módulos de la app
// (con import dinámico; los estáticos se cargarían antes)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';

const { describeAuthError, MIN_PASSWORD_LENGTH } = await import('../../src/services/auth.ts');
const { IMPORT_LABELS, parseAccountExport } = await import('../../src/services/importData.ts');
const { PartialImportError } = await import('../../src/services/accountImport.ts');
const { FEEDBACK_TYPES, deviceLabel, describeBrowser, describeOs } = await import('../../src/services/feedback.ts');
const { EXTRA_FEATURES } = await import('../../src/services/features.ts');
const { calendarErrorMessage } = await import('../../src/services/googleCalendar.ts');
const { IPHONE_DELETE_HELP } = await import('../../src/services/platform.ts');

test('sign-in errors are in English, with the fallback for unknown ones', () => {
  assert.equal(
    describeAuthError(new FirebaseError('auth/invalid-credential', 'x'), 'fallback'),
    'Wrong email or password.'
  );
  assert.equal(
    describeAuthError(new FirebaseError('auth/weak-password', 'x'), 'fallback'),
    `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
  );
  assert.equal(describeAuthError(new FirebaseError('auth/other', 'x'), 'fallback'), 'fallback');
  assert.equal(describeAuthError(new Error('auth/invalid-credential'), 'fallback'), 'fallback');
});

test('the import preview and its errors are in English, and old files still parse', () => {
  assert.equal(IMPORT_LABELS.tasks, 'Tasks');
  assert.equal(IMPORT_LABELS.wheelLogs, 'Wheel assessments');
  assert.throws(() => parseAccountExport('{nope'), /isn't valid JSON/);
  assert.throws(() => parseAccountExport('[]'), /isn't a CLAR download/);
  assert.throws(
    () => parseAccountExport(JSON.stringify({ app: 'CLAR', type: 'task' })),
    /a single task, goal or project/
  );
  assert.throws(() => parseAccountExport(JSON.stringify({ hello: 'world' })), /“Download my data \(JSON\)”/);
  // Una descarga de antes de la 0.9.5 (sin tipo) se sigue reconociendo por sus listas
  const parsed = parseAccountExport(JSON.stringify({ tasks: [], goals: [] }));
  assert.equal(parsed.data.tasks.length, 0);
});

test('a partial import says how far it got', () => {
  assert.equal(new PartialImportError(0, 5).message, "Couldn't import. Check your connection and try again.");
  assert.match(new PartialImportError(2, 5).message, /^Imported 2 of 5\. Import the file again/);
});

test('contact: message types, unknown system and device classes in English (the stored value stays)', () => {
  assert.deepEqual(
    FEEDBACK_TYPES.map((t) => t.label),
    ['Suggestion', 'Bug or problem', 'General message']
  );
  assert.equal(describeOs('Something else'), 'Unknown');
  assert.equal(describeBrowser('Something else'), 'Unknown');
  assert.equal(deviceLabel('móvil'), 'phone');
  assert.equal(deviceLabel('escritorio'), 'desktop');
  assert.equal(deviceLabel('other'), 'other');
});

test('extra features, Google Calendar errors and the iPhone help are in English', () => {
  assert.equal(EXTRA_FEATURES[0].label, 'Sync with Google Calendar');
  assert.match(EXTRA_FEATURES[0].description, /“CLAR” calendar/);
  assert.match(calendarErrorMessage(new FirebaseError('functions/internal', 'internal'), 'x'), /^Couldn't connect/);
  assert.match(
    calendarErrorMessage(new FirebaseError('functions/deadline-exceeded', 'deadline-exceeded'), 'x'),
    /still in progress/
  );
  // Los mensajes del servidor se muestran tal cual
  assert.equal(calendarErrorMessage(new Error('Server text.'), 'x'), 'Server text.');
  assert.match(IPHONE_DELETE_HELP, /^To delete your account from the iPhone app/);
});
