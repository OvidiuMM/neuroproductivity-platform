// NOTIFICACIONES DEL SISTEMA de las alarmas, mientras CLAR está viva (abierta, también en segundo plano). Se muestran
// desde el service worker (`public/sw.js`): Chrome en Android, también en la app instalada, no las admite de otra
// forma. Safari en el iPhone solo las tiene en apps añadidas a la pantalla de inicio: si no, el aviso sale dentro de
// la app.
export type NotificationState = NotificationPermission | 'unsupported';

export const notificationState = (): NotificationState =>
  typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

// Se avisa a la app al darse el permiso: así registra el dispositivo para las alarmas con CLAR cerrada
export const NOTIFICATIONS_GRANTED_EVENT = 'clar:notifications-granted';
export const requestNotifications = async (): Promise<NotificationState> => {
  if (notificationState() === 'unsupported') return 'unsupported';
  const state = await Notification.requestPermission();
  if (state === 'granted') window.dispatchEvent(new Event(NOTIFICATIONS_GRANTED_EVENT));
  return state;
};

// Registra el service worker (public/sw.js): guarda la app para abrirla sin conexión y muestra las notificaciones. Se
// registra al arrancar (main.tsx) y otra vez al entrar en la app, por si entonces falló; si no se puede, las
// notificaciones salen desde la página
export const registerServiceWorker = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
};

// Muestra la notificación si hay permiso; al pulsarla se abre la tarea (public/sw.js). La etiqueta es la clave de la
// alarma: una misma etiqueta sustituye a la anterior (no se acumulan duplicados).
export const showSystemNotification = (title: string, body: string, tag: string) => {
  if (notificationState() !== 'granted') return;
  void (async () => {
    try {
      // Solo con el service worker ya activo (recién registrado puede estar aún instalándose)
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration?.active) {
        await registration.showNotification(title, {
          body,
          tag,
          icon: '/icon-192.png',
          badge: '/badge-96.png',
          data: { key: tag }
        });
        await rememberShownHere(tag).catch(() => undefined);
        return;
      }
      const notification = new Notification(title, { body, tag, icon: '/icon-192.png' });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Sin service worker ni notificaciones de página (p. ej. Android sin el service worker): queda el aviso de la app
    }
  })();
};

// Las alarmas ya notificadas en este dispositivo, durante dos días (public/sw.js): las que llegaron por push y las que
// mostró la app. Al abrir CLAR, la app no vuelve a notificar una que llegó por push; y si la push llega después de la
// de la app, sale sin sonar
export const PUSH_SHOWN_CACHE = 'clar-push-shown';
const shownUrl = (key: string) => `/__clar/push-shown/${encodeURIComponent(key)}`;
export const wasShownByPush = async (key: string) => {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(PUSH_SHOWN_CACHE);
    return Boolean(await cache.match(shownUrl(key)));
  } catch {
    return false;
  }
};
const rememberShownHere = async (key: string) => {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(PUSH_SHOWN_CACHE);
  await cache.put(shownUrl(key), new Response(String(Date.now())));
};

// Al pulsar la notificación de una alarma con CLAR ya abierta, el service worker pide abrir su tarea
export const OPEN_ALARM_MESSAGE = 'clar:open-alarm';
