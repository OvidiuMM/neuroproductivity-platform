import assert from 'node:assert/strict';
import { test } from 'node:test';
import { injectPrecache, precacheList } from '../../vite-plugins/precache.ts';

// Lo que guarda el service worker para abrir CLAR sin conexión: la app en «/», sus trozos e iconos
test('the precache list has the app at «/», its chunks and icons, without the worker, the Google return or hidden files', () => {
  assert.deepEqual(
    precacheList([
      'index.html',
      'sw.js',
      'manifest.json',
      'icon-192.png',
      'assets/index-abc.js',
      'assets/index-abc.css',
      'assets/index-abc.js.map',
      'oauth/google.html',
      'oauth/google.js',
      '.well-known/x'
    ]),
    ['/', '/assets/index-abc.css', '/assets/index-abc.js', '/icon-192.png', '/manifest.json']
  );
});

test('the list and the version go into the service worker, and a worker without their marks fails the build', () => {
  const source = "const PRECACHE = [];\nconst VERSION = 'dev';\n";
  assert.equal(
    injectPrecache(source, ['/', '/assets/a.js'], 'abc123'),
    'const PRECACHE = ["/","/assets/a.js"];\nconst VERSION = \'abc123\';\n'
  );
  assert.throws(() => injectPrecache('const PRECACHE = [];', ['/'], 'abc'), /public\/sw\.js/);
});
