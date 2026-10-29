import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADOPT_WINDOW_MS, accountLanguageSync, isLocale } from '../../src/i18n/locale';

const base = { pending: false, stored: null, account: undefined, page: 'es' as const, sinceOpenMs: 1000 };

test('a choice made on this device, or an account without language, is saved to the account', () => {
  assert.deepEqual(accountLanguageSync({ ...base, pending: true, stored: 'en', account: 'es' }), {
    action: 'save',
    language: 'en'
  });
  // Lo guardado ahora en el dispositivo (otra pestaña pudo cambiarlo), no el de esta página
  assert.deepEqual(accountLanguageSync({ ...base, pending: true, stored: 'en', page: 'es' }), {
    action: 'save',
    language: 'en'
  });
  assert.deepEqual(accountLanguageSync({ ...base, account: 'fr' }), { action: 'save', language: 'es' });
});

test('otherwise the account wins: it reloads only right after opening, later it applies next time', () => {
  assert.deepEqual(accountLanguageSync({ ...base, account: 'es' }), { action: 'none' });
  assert.deepEqual(accountLanguageSync({ ...base, account: 'en' }), { action: 'adopt', language: 'en', reload: true });
  assert.deepEqual(accountLanguageSync({ ...base, account: 'en', sinceOpenMs: ADOPT_WINDOW_MS + 1 }), {
    action: 'adopt',
    language: 'en',
    reload: false
  });
});

test('only Spanish and English are languages', () => {
  assert.equal(isLocale('es'), true);
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('fr'), false);
  assert.equal(isLocale(undefined), false);
});
