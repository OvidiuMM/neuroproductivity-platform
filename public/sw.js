// Service worker de CLAR:
// - Guarda la app (sus archivos y su configuración, sin datos de nadie) para abrirla sin conexión, también la
//   instalada en Android. Tus datos sin conexión los guarda Firestore, aparte.
// - Muestra las notificaciones de las alarmas (Chrome en Android, también dentro de la app instalada, solo las muestra
//   desde un service worker), también las que llegan por push con CLAR cerrada.

// Lo que se guarda: al compilar, vite-plugins/precache.ts pone aquí la app, sus trozos y sus iconos, y una versión
// que cambia con ellos (así cada versión tiene su copia). En desarrollo va vacío y no se guarda nada.
const PRECACHE = [];
const VERSION = 'dev';
const CACHE = `clar-app-${VERSION}`;
const PREFIX = 'clar-app-';
// La configuración de Firebase que sirve Hosting: sin ella la app no arranca (se guarda aparte, si se puede)
const CONFIG = '/__/firebase/init.json';
// Lo que se espera a la red antes de abrir la copia guardada
const NETWORK_TIMEOUT_MS = 4000;

// Una respuesta que vale para guardar: Hosting contesta con la app (HTML, 200) a cualquier archivo que no existe (p. ej.
// si se publica otra versión mientras se instala esta), así que un archivo que no es «/» no puede ser HTML
const isUsable = (url, response) =>
  response.ok &&
  !response.redirected &&
  (url === '/' || !(response.headers.get('content-type') ?? '').startsWith('text/html'));

self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      if (PRECACHE.length) {
        // De la red, sin pasar por la caché del navegador. Si falta algo, no se instala y sigue la versión anterior
        // (se vuelve a intentar al abrir CLAR otra vez)
        const responses = await Promise.all(
          PRECACHE.map(async (url) => {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (!isUsable(url, response)) throw new Error(`No se pudo guardar ${url} (${response.status})`);
            return [url, response];
          })
        );
        const cache = await caches.open(CACHE);
        await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
        const config = await fetch(new Request(CONFIG, { cache: 'reload' })).catch(() => null);
        if (config && isUsable(CONFIG, config)) await cache.put(CONFIG, config);
      }
      await self.skipWaiting();
    })()
  )
);

// Se quedan esta versión y la anterior: una pestaña que sigue abierta con la anterior aún puede cargar sus secciones
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const others = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== CACHE);
      await Promise.all(others.slice(0, -1).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  )
);

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// La red primero (así se ve siempre la versión publicada) y, sin conexión, si tarda o si el servidor falla, la copia
// guardada: `fallback` es la que se usa (la app, para cualquier dirección de la app; la configuración, para la suya). La
// configuración que llega se guarda (si esta versión sigue guardada); la app no, porque sus trozos son los de su copia
const networkFirst = async (request, fallback) => {
  const saved = () => caches.match(fallback, { cacheName: CACHE, ignoreVary: true });
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.status >= 500) return (await saved()) ?? response;
    if (fallback === CONFIG && isUsable(CONFIG, response) && (await caches.has(CACHE))) {
      const cache = await caches.open(CACHE);
      await cache.put(CONFIG, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await saved();
    if (cached) return cached;
    throw error;
  }
};

// Los archivos de la app no cambian de nombre sin cambiar de contenido: lo guardado primero, de esta versión o de la
// anterior (una pestaña abierta con ella), y si no, la red
const cacheFirst = async (request) =>
  (await caches.match(request, { cacheName: CACHE, ignoreVary: true })) ??
  (await caches.match(request, { ignoreVary: true })) ??
  fetch(request);

// En desarrollo (sin lista) no hay ni siquiera escucha: las peticiones no pasan por aquí, como antes de 0.9.7. Y
// siempre van directas a la red las que no son leer algo de CLAR (otros sitios, la entrada con Google)
const onFetch = (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/__/auth/') ||
    url.pathname.startsWith('/.well-known/') ||
    url.pathname.startsWith('/oauth/')
  )
    return;
  if (request.mode === 'navigate') event.respondWith(networkFirst(request, '/'));
  else if (url.pathname === CONFIG) event.respondWith(networkFirst(request, CONFIG));
  else if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname))
    event.respondWith(cacheFirst(request));
};
if (PRECACHE.length) self.addEventListener('fetch', onFetch);

// Notificaciones push de las alarmas (functions/src/push.ts): llegan como mensaje de datos de Firebase Cloud
// Messaging, con el título, el texto y la etiqueta de la alarma. La etiqueta es la misma que usa la app con CLAR
// abierta: si las dos la muestran, una sustituye a la otra.
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }
  const data = message.data || message.notification || message;
  event.waitUntil(
    self.registration.showNotification(data.title || 'CLAR', {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    })
  );
});

// Al pulsar una notificación se vuelve a CLAR: a una ventana ya abierta o, si no hay ninguna, a una nueva
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) return open.focus();
      return self.clients.openWindow('/');
    })()
  );
});
