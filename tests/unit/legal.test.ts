import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEGAL_PAGES, OWNER, legalPageFor, legalPath } from '../../src/services/legal';

test('each legal path opens its page, with a trailing slash or in capitals too', () => {
  assert.equal(legalPageFor('/privacidad')?.id, 'privacy');
  assert.equal(legalPageFor('/condiciones/')?.id, 'terms');
  assert.equal(legalPageFor('/Aviso-Legal')?.id, 'notice');
  assert.equal(legalPageFor('/'), undefined);
  assert.equal(legalPageFor('/privacidad/otra'), undefined);
  for (const page of LEGAL_PAGES) assert.equal(legalPath(page.id), page.path);
});

test('the legal texts name their owner and a contact e-mail', () => {
  assert.ok(OWNER.name.trim(), 'Falta el nombre del titular en OWNER (src/services/legal.ts)');
  assert.match(OWNER.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
});
