// Service worker de CLAR: solo para las notificaciones de las alarmas (Chrome en Android, también dentro de la app
// instalada, solo las muestra desde un service worker). No intercepta peticiones ni guarda nada en caché: la app se
// sigue cargando de la red como siempre.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
