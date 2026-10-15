import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  areValidRecipients,
  buildMailto,
  formatFileSize,
  isDraft,
  lastSaved,
  parseRecipients
} from '../../src/services/email';

test('recipients are split by commas, semicolons or spaces and must all be addresses', () => {
  assert.deepEqual(parseRecipients(' ana@example.com, luis@example.com;  eva@example.com '), [
    'ana@example.com',
    'luis@example.com',
    'eva@example.com'
  ]);
  assert.equal(areValidRecipients(parseRecipients('ana@example.com luis@example.com')), true);
  assert.equal(areValidRecipients(parseRecipients('ana@example.com luis')), false);
  assert.equal(areValidRecipients([]), false);
});

test('file sizes read like a file browser', () => {
  assert.equal(formatFileSize(820), '820 B');
  assert.equal(formatFileSize(12 * 1024), '12 KB');
  assert.equal(formatFileSize(1.25 * 1024 * 1024), '1,3 MB');
  assert.equal(formatFileSize(350 * 1024 * 1024), '350 MB');
  assert.equal(formatFileSize(2 * 1024 ** 3), '2 GB');
});

test('the mail link carries valid recipients, subject and text with CRLF line breaks', () => {
  assert.equal(
    buildMailto({
      recipients: ['ana@example.com', 'no-es-un-correo', 'luis+cuentas@example.com'],
      subject: 'Balance & previsión',
      body: 'Hola:\nTe adjunto el balance.'
    }),
    'mailto:ana@example.com,luis%2Bcuentas@example.com?subject=Balance%20%26%20previsi%C3%B3n&body=Hola%3A%0D%0ATe%20adjunto%20el%20balance.'
  );
  assert.equal(buildMailto({ recipients: [], subject: '', body: '' }), 'mailto:');
  assert.equal(buildMailto({ recipients: [], subject: 'Solo asunto', body: '  ' }), 'mailto:?subject=Solo%20asunto');
});

test('an e-mail without a status is a saved one, and the last save is the newest date', () => {
  assert.equal(isDraft({ status: 'draft' }), true);
  assert.equal(isDraft({}), false);
  assert.equal(lastSaved({ sentAt: '2026-10-01T10:00:00.000Z' }), '2026-10-01T10:00:00.000Z');
  assert.equal(
    lastSaved({ sentAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z' }),
    '2026-10-02T10:00:00.000Z'
  );
});
