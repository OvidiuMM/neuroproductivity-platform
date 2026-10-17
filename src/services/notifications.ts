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

// Registra el service worker de las notificaciones (una vez por carga; si falla, se usan las de la página)
export const registerNotificationWorker = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
};

// Muestra la notificación si hay permiso; al pulsarla se vuelve a CLAR, donde está el aviso con «Ver tarea». Una
// misma etiqueta sustituye a la anterior (no se acumulan duplicados).
export const showSystemNotification = (title: string, body: string, tag: string) => {
  if (notificationState() !== 'granted') return;
  void (async () => {
    try {
      // Solo con el service worker ya activo (recién registrado puede estar aún instalándose)
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration?.active) {
        await registration.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' });
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
