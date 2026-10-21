import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { injectPrecache } from '../../vite-plugins/precache.ts';

// public/sw.js en un entorno de service worker simulado: con su lista (como al compilar) o sin ella (en desarrollo).
// La caché simulada tiene varias versiones, como la de verdad; la red responde lo que se le diga
const ORIGIN = 'https://clar.example';
const source = readFileSync('public/sw.js', 'utf8');
const PRECACHE = ['/', '/assets/app.js', '/manifest.json'];

type Answer = { body: string; status?: number; type?: string } | 'offline';
const keyOf = (request: string | { url: string }) => {
  const url = new URL(typeof request === 'string' ? request : request.url, ORIGIN);
  return url.pathname + url.search;
};

interface WorkerOptions {
  precache?: string[];
  version?: string;
  // Lo guardado, por versión: { nombre de la caché: { dirección: contenido } }
  stored?: Record<string, Record<string, string>>;
  network?: (path: string) => Answer;
}

const worker = ({
  precache = PRECACHE,
  version = 'v2',
  stored = { 'clar-app-v2': { '/': 'app guardada', '/assets/app.js': 'código guardado' } },
  network = (path: string): Answer => ({ body: `de la red: ${path}` })
}: WorkerOptions = {}) => {
  const listeners: Record<string, (event: unknown) => void> = {};
  const store = new Map(Object.entries(stored).map(([name, entries]) => [name, new Map(Object.entries(entries))]));
  const requested: string[] = [];
  const respondFrom = (body: string) => Promise.resolve(new Response(body));
  const caches = {
    keys: () => Promise.resolve([...store.keys()]),
    has: (name: string) => Promise.resolve(store.has(name)),
    delete: (name: string) => Promise.resolve(store.delete(name)),
    open: (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const entries = store.get(name)!;
      return Promise.resolve({
        put: async (request: string | { url: string }, response: Response) =>
          void entries.set(keyOf(request), await response.text())
      });
    },
    match: (request: string | { url: string }, options: { cacheName?: string } = {}) => {
      const names = options.cacheName ? [options.cacheName] : [...store.keys()];
      for (const name of names) {
        const body = store.get(name)?.get(keyOf(request));
        if (body !== undefined) return respondFrom(body);
      }
      return Promise.resolve(undefined);
    }
  };
  const fetch = (request: string | { url: string }) => {
    const path = keyOf(request);
    requested.push(path);
    const answer = network(path);
    if (answer === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(
      new Response(answer.body, {
        status: answer.status ?? 200,
        headers: { 'content-type': answer.type ?? 'text/plain' }
      })
    );
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    registration: {}
  };
  const code = precache.length ? injectPrecache(source, precache, version) : source;
  // En un service worker, una dirección relativa es de su sitio
  class Request {
    url: string;
    constructor(url: string) {
      this.url = new URL(url, ORIGIN).href;
    }
  }
  runInNewContext(code, { self, caches, fetch, URL, Response, Request, Promise, setTimeout, clearTimeout, Error });

  // Lo que responde a una petición, o null si la deja pasar a la red
  const respond = async (path: string, { mode = 'cors', method = 'GET' } = {}) => {
    const answer: { response?: Promise<Response> } = {};
    listeners.fetch?.({
      request: { url: new URL(path, ORIGIN).href, mode, method },
      respondWith: (response: Promise<Response>) => (answer.response = response)
    });
    return answer.response ? (await answer.response).text() : null;
  };
  const lifecycle = (type: 'install' | 'activate') => {
    const done: { promise?: Promise<unknown> } = {};
    listeners[type]({ waitUntil: (promise: Promise<unknown>) => (done.promise = promise) });
    return done.promise!;
  };
  const cached = (name: string) => Object.fromEntries(store.get(name) ?? []);
  return { listeners, respond, lifecycle, requested, cached, names: () => [...store.keys()] };
};

test('offline, any page of the app opens the saved copy, and its files come from the copy', async () => {
  const sw = worker({
    stored: { 'clar-app-v2': { '/': 'app guardada', '/assets/app.js': 'código', '/__/firebase/init.json': 'config' } },
    network: () => 'offline'
  });
  assert.equal(await sw.respond('/', { mode: 'navigate' }), 'app guardada');
  assert.equal(await sw.respond('/?source=pwa', { mode: 'navigate' }), 'app guardada');
  assert.equal(await sw.respond('/privacidad', { mode: 'navigate' }), 'app guardada');
  assert.equal(await sw.respond('/assets/app.js'), 'código');
  assert.equal(await sw.respond('/__/firebase/init.json'), 'config');
});

test('offline with nothing saved, the page fails as before', async () => {
  const sw = worker({ stored: {}, network: () => 'offline' });
  await assert.rejects(sw.respond('/', { mode: 'navigate' }), /Failed to fetch/);
});

test('online, pages and the configuration come from the network (the configuration is saved); files, from the copy', async () => {
  const sw = worker();
  assert.equal(await sw.respond('/', { mode: 'navigate' }), 'de la red: /');
  assert.equal(await sw.respond('/__/firebase/init.json'), 'de la red: /__/firebase/init.json');
  assert.equal(sw.cached('clar-app-v2')['/__/firebase/init.json'], 'de la red: /__/firebase/init.json');
  assert.equal(await sw.respond('/assets/app.js'), 'código guardado');
  // Con algo detrás de «?», no es el archivo guardado: va a la red
  assert.equal(await sw.respond('/assets/app.js?x=1'), 'de la red: /assets/app.js?x=1');
  assert.deepEqual(sw.requested, ['/', '/__/firebase/init.json', '/assets/app.js?x=1']);
});

test('if the server fails, the saved copy; a configuration that is an error is not saved', async () => {
  const sw = worker({ network: (path) => ({ body: 'error', status: path === '/' ? 503 : 404 }) });
  assert.equal(await sw.respond('/', { mode: 'navigate' }), 'app guardada');
  assert.equal(await sw.respond('/__/firebase/init.json'), 'error');
  assert.equal(sw.cached('clar-app-v2')['/__/firebase/init.json'], undefined);
});

test('the Google sign-in, other sites, the app links file and non-reads always go to the network', async () => {
  const sw = worker();
  assert.equal(await sw.respond('/__/auth/handler', { mode: 'navigate' }), null);
  assert.equal(await sw.respond('/oauth/google.html', { mode: 'navigate' }), null);
  assert.equal(await sw.respond('/.well-known/assetlinks.json'), null);
  assert.equal(await sw.respond('https://apis.google.com/js/api.js'), null);
  assert.equal(await sw.respond('/manifest.json', { method: 'HEAD' }), null);
});

test('installing saves the list and the configuration; a file that comes back as the app (HTML) stops it', async () => {
  const ok = worker({
    stored: {},
    network: (path) => ({ body: `contenido ${path}`, type: path === '/' ? 'text/html' : 'text/javascript' })
  });
  await ok.lifecycle('install');
  assert.deepEqual(Object.keys(ok.cached('clar-app-v2')).sort(), [
    '/',
    '/__/firebase/init.json',
    '/assets/app.js',
    '/manifest.json'
  ]);

  // Otra versión publicada a mitad: Hosting contesta con la app a un trozo que ya no existe
  const broken = worker({
    stored: {},
    network: (path) => ({ body: 'x', type: path === '/assets/app.js' ? 'text/html' : 'text/plain' })
  });
  await assert.rejects(broken.lifecycle('install'), /assets\/app\.js/);
  assert.deepEqual(broken.names(), []);

  // Sin la configuración, se instala igual
  const noConfig = worker({
    stored: {},
    network: (path) => (path === '/__/firebase/init.json' ? 'offline' : { body: 'x' })
  });
  await noConfig.lifecycle('install');
  assert.equal(noConfig.cached('clar-app-v2')['/__/firebase/init.json'], undefined);
});

test('activating keeps this version and the previous one, for a tab still open with it', async () => {
  const sw = worker({
    stored: { 'clar-app-v0': {}, 'clar-app-v1': { '/assets/old.js': 'viejo' }, 'otra-cosa': {}, 'clar-app-v2': {} }
  });
  await sw.lifecycle('activate');
  assert.deepEqual(sw.names().sort(), ['clar-app-v1', 'clar-app-v2', 'otra-cosa']);
  // Un trozo de la versión anterior sigue saliendo de su copia
  assert.equal(await sw.respond('/assets/old.js'), 'viejo');
});

test('in development (no list) the worker does not even listen to requests', () => {
  assert.equal(worker({ precache: [] }).listeners.fetch, undefined);
  assert.ok(worker().listeners.fetch);
  assert.ok(worker({ precache: [] }).listeners.push);
});
