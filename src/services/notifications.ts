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

// Si la notificación push de una alarma ya se mostró en este dispositivo (el service worker lo apunta, public/sw.js):
// entonces, al abrir CLAR, la app no la vuelve a avisar con otra notificación
export const wasShownByPush = async (key: string) => {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open('clar-push-shown');
    return Boolean(await cache.match(`/__clar/push-shown/${encodeURIComponent(key)}`));
  } catch {
    return false;
  }
};

// Al pulsar la notificación de una alarma con CLAR ya abierta, el service worker pide abrir su tarea
export const OPEN_ALARM_MESSAGE = 'clar:open-alarm';
