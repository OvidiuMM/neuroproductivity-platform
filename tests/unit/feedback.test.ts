import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReply } from '../../functions/src/feedbackLogic';
import {
  REPLY_MAX_LENGTH,
  cleanReply,
  describeBrowser,
  describeDevice,
  describeOs,
  deviceClassFor
} from '../../src/services/feedback';

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0',
  linuxChrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
};

test('the operating system is reported by family and major version only', () => {
  assert.equal(describeOs(UA.androidChrome), 'Android 15');
  assert.equal(describeOs(UA.iphoneSafari), 'iOS 18');
  assert.equal(describeOs(UA.ipadDesktopMode, 5), 'iPadOS');
  assert.equal(describeOs(UA.ipadDesktopMode, 0), 'macOS');
  assert.equal(describeOs(UA.windowsEdge), 'Windows');
  assert.equal(describeOs(UA.linuxChrome), 'Linux');
  assert.equal(describeOs('curl/8.0'), 'Desconocido');
});

test('the browser is reported by family and major version, recognising the ones built on Chrome', () => {
  assert.equal(describeBrowser(UA.androidChrome), 'Chrome 141');
  assert.equal(describeBrowser(UA.iphoneSafari), 'Safari 18');
  assert.equal(describeBrowser(UA.iphoneChrome), 'Chrome 141');
  assert.equal(describeBrowser(UA.windowsEdge), 'Edge 141');
  assert.equal(describeBrowser(UA.macFirefox), 'Firefox 132');
  assert.equal(describeBrowser('curl/8.0'), 'Desconocido');
});

test('the device class comes from the screen width', () => {
  assert.equal(deviceClassFor(375), 'móvil');
  assert.equal(deviceClassFor(800), 'tableta');
  assert.equal(deviceClassFor(1280), 'escritorio');
});

test('the technical context holds no full user agent', () => {
  const context = describeDevice(
    '0.9.0',
    { userAgent: UA.androidChrome, maxTouchPoints: 5, language: 'es-ES', onLine: true },
    390
  );
  assert.deepEqual(context, {
    appVersion: '0.9.0',
    os: 'Android 15',
    browser: 'Chrome 141',
    deviceClass: 'móvil',
    language: 'es-ES',
    online: true
  });
  assert.ok(!JSON.stringify(context).includes('Mozilla'));
});

test('a reply is sent already cleaned exactly as the server stores it', () => {
  // Así la app reconoce si la respuesta que devuelve el servidor es este texto o uno anterior con el mismo id
  for (const text of [
    '  Hola:\r\n\tGracias por avisar.\u0007\u0000  ',
    '\u001b[31mSin colores\u007f',
    'Línea 1\n\nLínea 2 ',
    'a'.repeat(REPLY_MAX_LENGTH + 10)
  ]) {
    assert.equal(cleanReply(text), parseReply({ ticketId: 'ticket', replyId: 'abcdefgh', message: text })?.message);
  }
  assert.equal(cleanReply('  Hola:\r\n\tGracias.\u0007  '), 'Hola:\r\n\tGracias.');
  assert.equal(cleanReply('a'.repeat(REPLY_MAX_LENGTH + 10)).length, REPLY_MAX_LENGTH);
});
