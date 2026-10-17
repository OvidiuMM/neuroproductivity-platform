import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reauthMethods } from '../../src/services/auth.ts';

test('a Google account confirms with Google, and an email account with its password', () => {
  assert.deepEqual(reauthMethods(['google.com'], 'google.com'), ['google']);
  assert.deepEqual(reauthMethods(['password'], 'password'), ['password']);
});

test('an account with both confirms first with the method of this session, and offers the other', () => {
  // Creada con email y contraseña y después entrando con Google: no se le pide la contraseña
  assert.deepEqual(reauthMethods(['password', 'google.com'], 'google.com'), ['google', 'password']);
  assert.deepEqual(reauthMethods(['google.com', 'password'], 'password'), ['password', 'google']);
  // Mientras no se sabe cómo se entró, primero Google
  assert.deepEqual(reauthMethods(['password', 'google.com'], null), ['google', 'password']);
});

test('without a known provider it falls back to Google', () => {
  assert.deepEqual(reauthMethods([], null), ['google']);
});
