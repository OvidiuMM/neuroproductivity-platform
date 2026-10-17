// Service worker de CLAR: solo para las notificaciones de las alarmas (Chrome en Android, también dentro de la app
// instalada, solo las muestra desde un service worker), también las que llegan por push con CLAR cerrada. No
// intercepta peticiones ni guarda nada en caché: la app se sigue cargando de la red como siempre.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
