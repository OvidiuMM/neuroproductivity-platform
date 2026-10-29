import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TaskItem } from '../../src/types';

// La app en inglés: se fija antes de cargar los módulos (el idioma se lee al cargarlos)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { LINK_DESCRIPTION_MAX, buildCalendarEvent, googleCalendarUrl } = await import('../../src/services/calendar.ts');
const { exportFilename } = await import('../../src/services/exports.ts');
const { dictationErrorMessage } = await import('../../src/services/speech.ts');

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 't1',
  userId: 'u1',
  listContext: 'WORK',
  title: 'Call the supplier',
  description: '',
  priority: 'MEDIUM',
  status: 'PENDING',
  isSomeday: false,
  linkedBy: 'MANUAL',
  observations: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  dueDate: '2026-10-15',
  ...overrides
});

describe('calendar texts in English', () => {
  it('describes the event with the notes, the due date and the link to CLAR', () => {
    const event = buildCalendarEvent(
      task({
        startDate: '2026-10-13',
        startTime: '09:00',
        observations: [{ id: 'o1', type: 'checklist', text: 'Ask for the price', completed: true, createdAt: '' }]
      }),
      'https://clar.example'
    );
    assert.equal(
      event?.description,
      'Notes:\n- [x] Ask for the price\n\nDue date: 15 Oct 2026\n\nCLAR task: https://clar.example'
    );
  });

  it('says the full text is in CLAR when a link cuts the description', () => {
    const event = buildCalendarEvent(task({ description: 'x'.repeat(LINK_DESCRIPTION_MAX + 10) }), 'https://clar');
    const details = new URL(googleCalendarUrl(event!)).searchParams.get('details') ?? '';
    assert.ok(details.endsWith('… (full text in CLAR)'), details.slice(-40));
  });
});

describe('download names in English', () => {
  it('uses English words in the file name', () => {
    const now = new Date(2026, 9, 15);
    assert.equal(exportFilename('tarea', 'Call the supplier', now), 'clar-task-call-the-supplier-2026-10-15.json');
    assert.equal(exportFilename('meta', '', now), 'clar-goal-goal-2026-10-15.json');
    assert.equal(exportFilename('proyecto', 'Web', now), 'clar-project-web-2026-10-15.json');
  });
});

describe('dictation errors in English', () => {
  it('explains each error', () => {
    assert.equal(dictationErrorMessage('not-allowed'), 'To dictate, allow microphone access in your browser.');
    assert.equal(dictationErrorMessage('no-speech'), "Didn't hear anything. Tap the microphone and speak.");
    assert.equal(dictationErrorMessage('aborted'), null);
    assert.equal(dictationErrorMessage('other'), "Couldn't dictate. Try again.");
  });
});
