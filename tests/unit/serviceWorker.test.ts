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
  // Ventanas de CLAR abiertas (para las notificaciones)
  windows?: string[];
}

const worker = ({
  precache = PRECACHE,
  version = 'v2',
  stored = { 'clar-app-v2': { '/': 'app guardada', '/assets/app.js': 'código guardado' } },
  network = (path: string): Answer => ({ body: `de la red: ${path}` }),
  windows = []
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
          void entries.set(keyOf(request), await response.text()),
        keys: () => Promise.resolve([...entries.keys()].map((key) => ({ url: new URL(key, ORIGIN).href }))),
        match: (request: string | { url: string }) => {
          const body = entries.get(keyOf(request));
          return Promise.resolve(body === undefined ? undefined : new Response(body));
        },
        delete: (request: string | { url: string }) => Promise.resolve(entries.delete(keyOf(request)))
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
  const shown: { title: string; options: NotificationOptions & { timestamp?: number } }[] = [];
  const opened: string[] = [];
  const messages: unknown[] = [];
  const focused: string[] = [];
  const clientWindows = windows.map((url) => ({
    url: new URL(url, ORIGIN).href,
    postMessage: (message: unknown) => void messages.push(message),
    focus: () => Promise.resolve(void focused.push(url))
  }));
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(clientWindows),
      openWindow: (url: string) => Promise.resolve(void opened.push(url))
    },
    registration: {
      showNotification: (title: string, options: NotificationOptions) =>
        Promise.resolve(void shown.push({ title, options }))
    }
  };
  const code = precache.length ? injectPrecache(source, precache, version) : source;
  // En un service worker, una dirección relativa es de su sitio
  class Request {
    url: string;
    constructor(url: string) {
      this.url = new URL(url, ORIGIN).href;
    }
  }
  runInNewContext(code, {
    self,
    caches,
    fetch,
    URL,
    Response,
    Request,
    Promise,
    setTimeout,
    clearTimeout,
    Error,
    Date,
    Number,
    String,
    encodeURIComponent
  });

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
  // Llega un mensaje push o se pulsa una notificación; termina cuando acaba lo que el worker espera (waitUntil)
  const push = (message: unknown) => {
    const done: { promise?: Promise<unknown> } = {};
    listeners.push({
      data: { json: () => message },
      waitUntil: (promise: Promise<unknown>) => (done.promise = promise)
    });
    return done.promise!;
  };
  const click = (data: unknown) => {
    const done: { promise?: Promise<unknown> } = {};
    listeners.notificationclick({
      notification: { data, close: () => undefined },
      waitUntil: (promise: Promise<unknown>) => (done.promise = promise)
    });
    return done.promise!;
  };
  return {
    listeners,
    respond,
    lifecycle,
    requested,
    cached,
    names: () => [...store.keys()],
    push,
    click,
    shown,
    opened,
    messages,
    focused
  };
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

test('an alarm push shows its notification at the alarm time and is remembered so the app does not repeat it', async () => {
  const sw = worker({ precache: [] });
  const key = 't1@2026-10-16T07:30:00.000Z';
  await sw.push({
    data: { title: 'Alarma de las 09:30', body: 'Vence hoy', tag: key, at: '2026-10-16T07:30:00.000Z' }
  });
  assert.equal(sw.shown.length, 1);
  const { title, options } = sw.shown[0];
  assert.equal(title, 'Alarma de las 09:30');
  assert.equal(options.tag, key);
  assert.equal(options.badge, '/badge-96.png');
  assert.equal(options.timestamp, Date.parse('2026-10-16T07:30:00.000Z'));
  // Objetos del entorno del worker: se comparan como JSON
  assert.equal(JSON.stringify(options.data), JSON.stringify({ key }));
  assert.ok(sw.cached('clar-push-shown')[`/__clar/push-shown/${encodeURIComponent(key)}`]);
});

test('a push without an alarm (the test one) is shown but not remembered', async () => {
  const sw = worker({ precache: [] });
  await sw.push({ data: { title: 'CLAR', body: 'Prueba', tag: 'clar-test' } });
  assert.equal(sw.shown.length, 1);
  assert.equal(JSON.stringify(sw.shown[0].options.data), JSON.stringify({ key: null }));
  assert.deepEqual(sw.cached('clar-push-shown'), {});
});

test('alarms remembered more than two days ago are forgotten', async () => {
  const old = String(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const sw = worker({ precache: [], stored: { 'clar-push-shown': { '/__clar/push-shown/viejo%40x': old } } });
  await sw.push({ data: { title: 'A', tag: 't2@2026-10-16T08:00:00.000Z' } });
  assert.deepEqual(Object.keys(sw.cached('clar-push-shown')), [
    `/__clar/push-shown/${encodeURIComponent('t2@2026-10-16T08:00:00.000Z')}`
  ]);
});

test('tapping an alarm opens its task: in a new window, or in the open one with a message', async () => {
  const key = 't1@2026-10-16T07:30:00.000Z';
  const closed = worker({ precache: [] });
  await closed.click({ key });
  assert.deepEqual(closed.opened, [`/?alarma=${encodeURIComponent(key)}`]);

  const open = worker({ precache: [], windows: ['/'] });
  await open.click({ key });
  assert.deepEqual(open.opened, []);
  assert.equal(JSON.stringify(open.messages), JSON.stringify([{ type: 'clar:open-alarm', key }]));
  assert.deepEqual(open.focused, ['/']);

  // Otra notificación (sin alarma) solo vuelve a CLAR
  const other = worker({ precache: [] });
  await other.click(undefined);
  assert.deepEqual(other.opened, ['/']);
});
