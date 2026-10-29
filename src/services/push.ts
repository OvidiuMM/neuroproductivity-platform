import { httpsCallable } from 'firebase/functions';
import { LOCALE, messages } from '../i18n/locale';
import { usingEmulators, type FirebaseServices } from './firebase';
import { PUSH_SHOWN_CACHE } from './notifications';

// NOTIFICACIONES PUSH de las alarmas, para que suenen con CLAR cerrada. Se activan en cada dispositivo («Avisarme
// también con CLAR cerrada», en el menú de la cuenta): el dispositivo se registra con su token de Firebase Cloud
// Messaging, su zona horaria, si quiere ver el nombre de la tarea y su idioma (el de la app en él: el servidor escribe
// las notificaciones en ese idioma), y el servidor (functions/src/push.ts) envía cada alarma a su hora. El service
// worker (public/sw.js) la muestra. Sin la clave pública VAPID en la compilación (VITE_FCM_VAPID_KEY) o con los
// emuladores, no se ofrece: las alarmas siguen avisando con CLAR abierta.
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY?.trim();
// El registro se renueva una vez al día como mucho (FCM cambia el token de vez en cuando; el servidor borra los que no
// se renuevan en 30 días)
const REFRESH_MS = 24 * 60 * 60 * 1000;
// Lo que se espera al servidor al darse de baja (p. ej. al cerrar sesión con mala conexión)
const UNREGISTER_TIMEOUT_MS = 5_000;
const REGISTERED_PREFIX = 'clar_push_registered:';
const registeredKey = (uid: string) => `${REGISTERED_PREFIX}${uid}`;
const enabledKey = (uid: string) => `clar_push_enabled:${uid}`;
const showTitleKey = (uid: string) => `clar_push_show_title:${uid}`;
const timeZoneKey = (uid: string) => `clar_push_time_zone:${uid}`;
const languageKey = (uid: string) => `clar_push_language:${uid}`;
const ENDPOINT_PREFIX = 'clar_push_endpoint:';
const endpointKey = (uid: string) => `${ENDPOINT_PREFIX}${uid}`;
const currentTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const m = messages(
  {
    notReady: 'CLAR aún no está lista en este dispositivo. Ábrela con conexión e inténtalo de nuevo.',
    notSupported: 'Este navegador no permite recibir las alarmas con CLAR cerrada.',
    enableFirst: 'Activa antes las alarmas con CLAR cerrada.',
    testFailed: 'No se pudo enviar ahora. Inténtalo de nuevo en un rato.'
  },
  {
    notReady: "CLAR isn't ready on this device yet. Open it with a connection and try again.",
    notSupported: "This browser can't receive alarms when CLAR is closed.",
    enableFirst: 'First turn on notifications when CLAR is closed.',
    testFailed: "Couldn't send it right now. Try again in a while."
  }
);

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

// Si este dispositivo tiene activadas las alarmas con CLAR cerrada para esta cuenta, y si muestran el nombre de la tarea
export const isPushEnabled = (uid: string) => pushAvailable() && read(enabledKey(uid)) === '1';
export const isPushTitleShown = (uid: string) => read(showTitleKey(uid)) === '1';
// Activadas aquí, pero sin permiso: se quitó después en los ajustes del navegador o del móvil, y no llega ninguna
export const pushPermissionLost = (uid: string) => isPushEnabled(uid) && Notification.permission !== 'granted';

const withTimeout = <T>(promise: Promise<T>, ms: number, message = 'timeout') =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);

// Lo que se espera al service worker: si no llega a instalarse (p. ej. sin conexión), se avisa en vez de esperar siempre
const READY_TIMEOUT_MS = 15_000;
const currentToken = async ({ app }: FirebaseServices) => {
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  const registration = await navigator.serviceWorker.register('/sw.js');
  await withTimeout(navigator.serviceWorker.ready, READY_TIMEOUT_MS, m.notReady);
  return (await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })) || null;
};

// La suscripción push de este navegador, si la tiene: el navegador puede anularla (el iPhone lo hace sin avisar)
const currentEndpoint = async () => {
  const registration = await navigator.serviceWorker?.getRegistration();
  return (await registration?.pushManager?.getSubscription())?.endpoint ?? null;
};

// Corta la suscripción push de este navegador: funciona sin conexión y, desde ese momento, no llega ninguna alarma.
// El servidor borra el token al intentar el siguiente envío (o a los 30 días sin renovarse).
const unsubscribeHere = async () => {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  await subscription?.unsubscribe();
};

// Registra este dispositivo si las tiene activadas y hay permiso. `force`: al momento (acaban de activarse o de
// cambiar). También al momento si cambió la zona horaria del dispositivo (p. ej. de viaje), su idioma (o se registró
// antes de 1.2.0, sin él) o si su suscripción push ya no es la registrada (se perdió o cambió): se comprueba cada vez
// que se abre CLAR.
export const registerPushDevice = async (services: FirebaseServices, uid: string, force = false) => {
  if (!isPushEnabled(uid) || Notification.permission !== 'granted') return false;
  const sameZone = read(timeZoneKey(uid)) === currentTimeZone();
  const sameLanguage = read(languageKey(uid)) === LOCALE;
  const sameSubscription = (await currentEndpoint().catch(() => null)) === read(endpointKey(uid));
  if (
    !force &&
    sameZone &&
    sameLanguage &&
    sameSubscription &&
    Date.now() - Number(read(registeredKey(uid)) ?? 0) < REFRESH_MS
  )
    return true;
  const token = await currentToken(services);
  if (!token) return false;
  await httpsCallable(
    services.functions,
    'registerPushDevice'
  )({
    token,
    timeZone: currentTimeZone(),
    showTitle: isPushTitleShown(uid),
    language: LOCALE
  });
  write(registeredKey(uid), String(Date.now()));
  write(timeZoneKey(uid), currentTimeZone());
  write(languageKey(uid), LOCALE);
  write(endpointKey(uid), await currentEndpoint().catch(() => null));
  return true;
};

// Este dispositivo deja de recibir las alarmas de la cuenta: al desactivarlas y al cerrar sesión (así un dispositivo
// compartido no recibe las de una cuenta que ya no está abierta en él). Primero se corta la suscripción aquí, que no
// necesita conexión; después se pide al servidor que borre el token, sin esperar más de unos segundos.
export const unregisterPushDevice = async (services: FirebaseServices, uid: string) => {
  if (!pushAvailable() || !read(registeredKey(uid))) return;
  write(registeredKey(uid), null);
  write(timeZoneKey(uid), null);
  write(languageKey(uid), null);
  write(endpointKey(uid), null);
  let token: string | null = null;
  if (Notification.permission === 'granted')
    token = await withTimeout(currentToken(services), UNREGISTER_TIMEOUT_MS).catch(() => null);
  await unsubscribeHere().catch(() => undefined);
  if (!token) return;
  await withTimeout(
    httpsCallable(services.functions, 'unregisterPushDevice')({ token, language: LOCALE }),
    UNREGISTER_TIMEOUT_MS
  ).catch(() => undefined);
};

export const enablePush = async (services: FirebaseServices, uid: string) => {
  write(enabledKey(uid), '1');
  try {
    if (!(await registerPushDevice(services, uid, true))) throw new Error(m.notSupported);
  } catch (e) {
    write(enabledKey(uid), null);
    throw e;
  }
};

export const disablePush = async (services: FirebaseServices, uid: string) => {
  write(enabledKey(uid), null);
  await unregisterPushDevice(services, uid);
};

// «PROBAR NOTIFICACIÓN»: el servidor envía ahora un aviso a este dispositivo, por el mismo camino que las alarmas. Así se
// comprueba que llegan con CLAR cerrada (el aviso tarda unos segundos)
// Antes se vuelve a registrar el dispositivo: el servidor puede haber borrado su token (p. ej. al registrarse otra
// cuenta en él) sin que este dispositivo lo sepa
const TEST_ERRORS = new Set([
  'functions/internal',
  'functions/unavailable',
  'functions/deadline-exceeded',
  'functions/not-found'
]);
export const sendTestPush = async (services: FirebaseServices, uid: string) => {
  if (!(await registerPushDevice(services, uid, true))) throw new Error(m.enableFirst);
  const token = await currentToken(services);
  if (!token) throw new Error(m.notSupported);
  try {
    await httpsCallable(services.functions, 'sendTestPush')({ token, language: LOCALE });
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && TEST_ERRORS.has(code)) throw new Error(m.testFailed, { cause: e });
    throw e;
  }
};

// Mostrar o no el nombre de la tarea en las notificaciones de este dispositivo (se ve con el móvil bloqueado)
export const setPushTitleShown = async (services: FirebaseServices, uid: string, show: boolean) => {
  write(showTitleKey(uid), show ? '1' : null);
  await registerPushDevice(services, uid, true);
};

// Sin sesión (también si se cerró desde otro dispositivo con «Cerrar todas las sesiones», que borra los dispositivos
// en el servidor): este navegador deja de recibir alarmas al momento y, al volver a entrar, se registra de nuevo
export const forgetPushRegistrations = () => {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(REGISTERED_PREFIX) || key.startsWith(ENDPOINT_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nada que hacer
  }
  // Las alarmas que ya llegaron (public/sw.js): en un dispositivo compartido no se quedan para la siguiente cuenta
  if (typeof caches !== 'undefined') void caches.delete(PUSH_SHOWN_CACHE).catch(() => undefined);
  if (pushAvailable()) void unsubscribeHere().catch(() => undefined);
};
