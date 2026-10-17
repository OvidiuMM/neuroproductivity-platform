import { httpsCallable } from 'firebase/functions';
import { usingEmulators, type FirebaseServices } from './firebase';

// NOTIFICACIONES PUSH de las alarmas, para que suenen con CLAR cerrada. Se activan en cada dispositivo («Avisarme
// también con CLAR cerrada», en el menú de la cuenta): el dispositivo se registra con su token de Firebase Cloud
// Messaging y su zona horaria, y el servidor (functions/src/push.ts) envía cada alarma a su hora. El service worker
// (public/sw.js) la muestra. Sin la clave pública VAPID en la compilación (VITE_FCM_VAPID_KEY) o con los emuladores,
// no se ofrece: las alarmas siguen avisando con CLAR abierta.
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
// El registro se renueva una vez al día como mucho (FCM cambia el token de vez en cuando)
const REFRESH_MS = 24 * 60 * 60 * 1000;
const REGISTERED_PREFIX = 'clar_push_registered:';
const registeredKey = (uid: string) => `${REGISTERED_PREFIX}${uid}`;
const enabledKey = (uid: string) => `clar_push_enabled:${uid}`;

export const pushAvailable = () =>
  Boolean(VAPID_KEY) &&
  !usingEmulators &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: se vuelve a registrar en la próxima carga
  }
};

// Si este dispositivo tiene activadas las alarmas con CLAR cerrada para esta cuenta
export const isPushEnabled = (uid: string) => pushAvailable() && read(enabledKey(uid)) === '1';

const currentToken = async ({ app }: FirebaseServices) => {
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return (await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })) || null;
};

// Registra este dispositivo si las tiene activadas y hay permiso. `force`: al momento (acaban de activarse)
export const registerPushDevice = async (services: FirebaseServices, uid: string, force = false) => {
  if (!isPushEnabled(uid) || Notification.permission !== 'granted') return false;
  if (!force && Date.now() - Number(read(registeredKey(uid)) ?? 0) < REFRESH_MS) return true;
  const token = await currentToken(services);
  if (!token) return false;
  await httpsCallable(
    services.functions,
    'registerPushDevice'
  )({
    token,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  write(registeredKey(uid), String(Date.now()));
  return true;
};

// Este dispositivo deja de recibir las alarmas de la cuenta: el servidor borra su token y FCM lo anula. Al desactivarlas
// y al cerrar sesión (así un dispositivo compartido no recibe las de una cuenta que ya no está abierta en él).
export const unregisterPushDevice = async (services: FirebaseServices, uid: string) => {
  if (!pushAvailable() || !read(registeredKey(uid))) return;
  write(registeredKey(uid), null);
  if (Notification.permission !== 'granted') return;
  const token = await currentToken(services);
  if (!token) return;
  await httpsCallable(services.functions, 'unregisterPushDevice')({ token });
  const { deleteToken, getMessaging } = await import('firebase/messaging');
  await deleteToken(getMessaging(services.app));
};

export const enablePush = async (services: FirebaseServices, uid: string) => {
  write(enabledKey(uid), '1');
  try {
    if (!(await registerPushDevice(services, uid, true))) throw new Error('unsupported');
  } catch (e) {
    write(enabledKey(uid), null);
    throw e;
  }
};

export const disablePush = async (services: FirebaseServices, uid: string) => {
  write(enabledKey(uid), null);
  await unregisterPushDevice(services, uid);
};

// Sin sesión (también si se cerró desde otro dispositivo con «Cerrar todas las sesiones», que borra los dispositivos
// en el servidor): al volver a entrar, el dispositivo se registra de nuevo al momento
export const forgetPushRegistrations = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(REGISTERED_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nada que hacer
  }
};
