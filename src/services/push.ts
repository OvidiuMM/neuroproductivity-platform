import { httpsCallable } from 'firebase/functions';
import { usingEmulators, type FirebaseServices } from './firebase';

// NOTIFICACIONES PUSH de las alarmas, para que suenen con CLAR cerrada: el dispositivo se registra con su token de
// Firebase Cloud Messaging y su zona horaria, y el servidor (functions/src/push.ts) envía cada alarma a su hora. El
// service worker (public/sw.js) la muestra. Sin la clave pública VAPID en la compilación (VITE_FCM_VAPID_KEY) o con
// los emuladores, no se usa: las alarmas siguen avisando con CLAR abierta.
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
// El token se renueva una vez al día como mucho (FCM lo cambia de vez en cuando)
const REFRESH_MS = 24 * 60 * 60 * 1000;
const registeredKey = (uid: string) => `clar_push_registered:${uid}`;

export const pushAvailable = () =>
  Boolean(VAPID_KEY) &&
  !usingEmulators &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const readStamp = (uid: string) => {
  try {
    return Number(localStorage.getItem(registeredKey(uid)) ?? 0);
  } catch {
    return 0;
  }
};

// Registra este dispositivo si hay permiso de notificaciones. `force`: al momento (acaba de darse el permiso)
export const registerPushDevice = async ({ app, functions }: FirebaseServices, uid: string, force = false) => {
  if (!pushAvailable() || Notification.permission !== 'granted') return false;
  if (!force && Date.now() - readStamp(uid) < REFRESH_MS) return true;
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return false;
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return false;
  await httpsCallable(
    functions,
    'registerPushDevice'
  )({
    token,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  try {
    localStorage.setItem(registeredKey(uid), String(Date.now()));
  } catch {
    // Sin poder guardarlo, se vuelve a registrar en la próxima carga
  }
  return true;
};

// Al cerrar sesión, el token de este dispositivo deja de valer: así no le llegan las alarmas de una cuenta que ya no
// está abierta en él (el servidor borra los tokens que ya no valen al intentar enviarles)
export const unregisterPushDevice = async ({ app }: FirebaseServices, uid: string) => {
  if (!pushAvailable() || !readStamp(uid)) return;
  try {
    localStorage.removeItem(registeredKey(uid));
  } catch {
    // Nada que hacer
  }
  const { deleteToken, getMessaging, isSupported } = await import('firebase/messaging');
  if (await isSupported()) await deleteToken(getMessaging(app));
};
