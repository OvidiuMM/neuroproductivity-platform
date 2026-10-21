// Service worker de CLAR:
// - Guarda la app (sus archivos y su configuración, sin datos de nadie) para abrirla sin conexión, también la
//   instalada en Android. Tus datos sin conexión los guarda Firestore, aparte.
// - Muestra las notificaciones de las alarmas (Chrome en Android, también dentro de la app instalada, solo las muestra
//   desde un service worker), también las que llegan por push con CLAR cerrada.

// Lo que se guarda: al compilar, vite.config.ts pone aquí la app, sus trozos y sus iconos, y una versión que cambia
// con ellos (así cada versión tiene su copia y la anterior se borra). En desarrollo va vacío y no se guarda nada.
const PRECACHE = [];
const VERSION = 'dev';
const CACHE = `clar-app-${VERSION}`;
// La configuración de Firebase que sirve Hosting: sin ella la app no arranca
const CONFIG = '/__/firebase/init.json';
// Lo que se espera a la red antes de abrir la copia guardada
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      if (PRECACHE.length) {
        const cache = await caches.open(CACHE);
        // De la red, sin pasar por la caché del navegador. Si falta algo, no se instala y sigue la versión anterior
        await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
        await cache.add(new Request(CONFIG, { cache: 'reload' })).catch(() => undefined);
      }
      await self.skipWaiting();
    })()
  )
);

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('clar-app-') && name !== CACHE).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  )
);

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

// La red primero (así se ve siempre la versión publicada) y, sin conexión o si tarda, la copia guardada: `fallback` es
// la que se usa (la app, para cualquier dirección de la app; la configuración, para la suya). La configuración que llega
// se guarda; la app no, porque sus trozos son los de la copia de esta versión
const networkFirst = async (request, fallback) => {
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (fallback === CONFIG && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(CONFIG, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(fallback, { cacheName: CACHE, ignoreVary: true });
    if (cached) return cached;
    throw error;
  }
};

// Los archivos de la app no cambian de nombre sin cambiar de contenido: lo guardado primero
const cacheFirst = async (request) =>
  (await caches.match(request, { cacheName: CACHE, ignoreVary: true })) ?? fetch(request);

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
