import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isAndroid,
  isIOS,
  needsHomeScreenForPush,
  popupsUnreliable,
  signedInRecently
} from '../../src/services/platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile Safari';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36';
const info = (userAgent: string, { maxTouchPoints = 0, standalone = false } = {}) => ({
  userAgent,
  maxTouchPoints,
  standalone
});

test('recognises the iPhone, the iPad (which presents itself as a Mac with touch) and Android', () => {
  assert.equal(isIOS(info(IPHONE, { maxTouchPoints: 5 })), true);
  assert.equal(isIOS(info(IPAD, { maxTouchPoints: 5 })), true);
  assert.equal(isIOS(info(IPAD)), false);
  assert.equal(isIOS(info(ANDROID, { maxTouchPoints: 5 })), false);
  assert.equal(isAndroid(info(ANDROID)), true);
  assert.equal(isAndroid(info(IPHONE)), false);
});

test('on the iPhone, alarms need the Home Screen app, and there Google sign-in goes by redirect', () => {
  assert.equal(needsHomeScreenForPush(info(IPHONE)), true);
  assert.equal(needsHomeScreenForPush(info(IPHONE, { standalone: true })), false);
  assert.equal(needsHomeScreenForPush(info(ANDROID)), false);
  assert.equal(popupsUnreliable(info(IPHONE, { standalone: true })), true);
  assert.equal(popupsUnreliable(info(IPHONE)), false);
  assert.equal(popupsUnreliable(info(ANDROID, { standalone: true })), false);
});

// Eliminar la cuenta desde la app del iPhone: vale haber entrado en esta sesión hace menos de 4 minutos, medido con las
// horas del token (las dos del servidor)
test('a sign-in in this session less than 4 minutes ago is recent enough to delete the account', () => {
  const authTime = '2026-10-29T10:00:00.000Z';
  assert.equal(signedInRecently({ authTime, issuedAtTime: '2026-10-29T10:03:59.000Z' }), true);
  assert.equal(signedInRecently({ authTime, issuedAtTime: '2026-10-29T10:04:00.000Z' }), false);
  assert.equal(signedInRecently({ authTime, issuedAtTime: '2026-10-29T11:00:00.000Z' }), false);
  assert.equal(signedInRecently({ authTime: 'no es una fecha', issuedAtTime: '2026-10-29T10:01:00.000Z' }), false);
});
