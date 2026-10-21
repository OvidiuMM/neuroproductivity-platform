import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { injectPrecache } from '../../vite-plugins/precache.ts';

// public/sw.js en un entorno de service worker simulado: con su lista (como al compilar) o sin ella (en desarrollo)
const ORIGIN = 'https://clar.example';
const source = readFileSync('public/sw.js', 'utf8');

const worker = ({ precache = ['/', '/assets/app.js', '/manifest.json'], online = true } = {}) => {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cached = new Map<string, string>([
    ['/', 'app guardada'],
    ['/assets/app.js', 'código guardado'],
    ['/__/firebase/init.json', 'configuración guardada']
  ]);
  const network: string[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    registration: {}
  };
  const pathOf = (request: string | { url: string }) =>
    new URL(typeof request === 'string' ? request : request.url, ORIGIN).pathname;
  const caches = {
    match: (request: string | { url: string }) =>
      Promise.resolve(cached.has(pathOf(request)) ? new Response(cached.get(pathOf(request))) : undefined),
    open: () =>
      Promise.resolve({
        put: (key: string, response: Response) => response.text().then((body) => void cached.set(key, body))
      }),
    keys: () => Promise.resolve([])
  };
  const fetch = (request: { url: string }) => {
    network.push(pathOf(request));
    return online
      ? Promise.resolve(new Response(`de la red: ${pathOf(request)}`))
      : Promise.reject(new TypeError('Failed to fetch'));
  };
  const code = precache.length ? injectPrecache(source, precache, 'v1') : source;
  runInNewContext(code, { self, caches, fetch, URL, Response, Request, Promise, setTimeout, Error });
  // Lo que responde a una petición, o null si la deja pasar a la red
  const respond = async (path: string, { mode = 'cors', method = 'GET' } = {}) => {
    const answer: { response?: Promise<Response> } = {};
    listeners.fetch?.({
      request: { url: new URL(path, ORIGIN).href, mode, method },
      respondWith: (response: Promise<Response>) => (answer.response = response)
    });
    return answer.response ? (await answer.response).text() : null;
  };
  return { listeners, respond, network, cached };
};

test('offline, any page of the app opens the saved copy, and its files come from the copy', async () => {
  const sw = worker({ online: false });
  assert.equal(await sw.respond('/', { mode: 'navigate' }), 'app guardada');
  assert.equal(await sw.respond('/?source=pwa', { mode: 'navigate' }), 'app guardada');
  assert.equal(await sw.respond('/privacidad', { mode: 'navigate' }), 'app guardada');
  assert.equal(await sw.respond('/assets/app.js'), 'código guardado');
  assert.equal(await sw.respond('/__/firebase/init.json'), 'configuración guardada');
});

test('online, pages and the configuration come from the network (the configuration is saved); files, from the copy', async () => {
  const sw = worker();
  assert.equal(await sw.respond('/', { mode: 'navigate' }), 'de la red: /');
  assert.equal(await sw.respond('/__/firebase/init.json'), 'de la red: /__/firebase/init.json');
  assert.equal(sw.cached.get('/__/firebase/init.json'), 'de la red: /__/firebase/init.json');
  assert.equal(await sw.respond('/assets/app.js'), 'código guardado');
  assert.deepEqual(sw.network, ['/', '/__/firebase/init.json']);
});

test('the Google sign-in, other sites and writes always go to the network', async () => {
  const sw = worker();
  assert.equal(await sw.respond('/__/auth/handler', { mode: 'navigate' }), null);
  assert.equal(await sw.respond('/oauth/google.html', { mode: 'navigate' }), null);
  assert.equal(await sw.respond('https://apis.google.com/js/api.js'), null);
  assert.equal(await sw.respond('/manifest.json', { method: 'HEAD' }), null);
});

test('in development (no list) the worker does not even listen to requests', () => {
  assert.equal(worker({ precache: [] }).listeners.fetch, undefined);
  assert.ok(worker().listeners.fetch);
  assert.ok(worker({ precache: [] }).listeners.push);
});
