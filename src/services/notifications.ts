// NOTIFICACIONES DEL SISTEMA, solo con CLAR abierta (sin service worker). Chrome en Android solo las permite desde
// un service worker y Safari en el iPhone solo en apps instaladas: ahí el aviso sale solo dentro de la app.
export type NotificationState = NotificationPermission | 'unsupported';

export const notificationState = (): NotificationState =>
  typeof window !== 'undefined' && 'Notification' in window && !/Android/i.test(navigator.userAgent)
    ? Notification.permission
    : 'unsupported';

export const requestNotifications = async (): Promise<NotificationState> =>
  notificationState() === 'unsupported' ? 'unsupported' : Notification.requestPermission();

// Muestra la notificación si hay permiso; al pulsarla se vuelve a CLAR, donde está el aviso con «Ver tarea». Una
// misma etiqueta sustituye a la anterior (no se acumulan duplicados).
export const showSystemNotification = (title: string, body: string, tag: string) => {
  if (notificationState() !== 'granted') return;
  try {
    const notification = new Notification(title, { body, tag });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Algunos navegadores no permiten crearlas fuera de un service worker: queda el aviso dentro de la app
  }
};
