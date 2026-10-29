import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, signOut, type Auth } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  disableNetwork,
  doc,
  enableNetwork,
  getDocFromServer,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  waitForPendingWrites,
  type Firestore
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
// push.ts usa usingEmulators solo dentro de sus funciones: la importación circular no da problemas al cargar
import { unregisterPushDevice } from './push';
import { withAuthDomain } from './authDomain';
import { LOCALE, messages } from '../i18n/locale';

// Se muestran tras «No se pudo iniciar la aplicación:» (AuthGate)
const m = messages(
  {
    configFailed: (status: number) => `No se pudo cargar la configuración de Firebase (${status})`,
    firstTimeOffline: 'no hay conexión. La primera vez, CLAR necesita conexión para abrirse.'
  },
  {
    configFailed: (status) => `couldn't load the Firebase configuration (${status})`,
    firstTimeOffline: "you're offline. The first time, CLAR needs a connection to open."
  }
);

// En desarrollo y en los tests e2e la app habla con los emuladores de Auth, Firestore y Functions (proyecto demo)
export const usingEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

const EMULATOR_CONFIG: FirebaseOptions = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-neuroproductivity.firebaseapp.com',
  projectId: 'demo-neuroproductivity',
  appId: 'demo-app'
};

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

// En producción Firebase Hosting sirve la configuración en /__/firebase/init.json,
// así el ID del proyecto no tiene que estar en el repositorio. Sin conexión la da el service worker (public/sw.js) y,
// si tampoco, la última que llegó, guardada en el dispositivo (no es secreta: la misma para todos)
const CONFIG_KEY = 'clar_firebase_config';

export const loadConfig = async (): Promise<FirebaseOptions> => {
  if (usingEmulators) return EMULATOR_CONFIG;
  try {
    const res = await fetch('/__/firebase/init.json');
    if (!res.ok) throw new Error(m.configFailed(res.status));
    const config = (await res.json()) as FirebaseOptions;
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      // Sin almacenamiento (p. ej. lleno): la próxima vez sin conexión no habrá copia
    }
    return withAuthDomain(config, window.location.hostname);
  } catch (error) {
    const saved = savedConfig();
    if (saved) return withAuthDomain(saved, window.location.hostname);
    throw navigator.onLine === false ? new Error(m.firstTimeOffline) : error;
  }
};

const savedConfig = (): FirebaseOptions | null => {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') as unknown;
    return value && typeof value === 'object' && typeof (value as FirebaseOptions).apiKey === 'string' ? value : null;
  } catch {
    return null;
  }
};

let services: Promise<FirebaseServices> | null = null;

export const getFirebase = (): Promise<FirebaseServices> => {
  services ??= loadConfig().then((config) => {
    const app = initializeApp(config);
    const auth = getAuth(app);
    // Emails de verificación y de recuperación de contraseña en el idioma de la app
    auth.languageCode = LOCALE;
    // Caché persistente: la app funciona sin conexión y sincroniza al volver, también entre pestañas
    const db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    // Misma región que las Cloud Functions (functions/src)
    const functions = getFunctions(app, 'europe-west1');
    // Puertos de firebase.json, distintos de los de por defecto para convivir con otros proyectos de Firebase
    if (usingEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9399', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8281);
      connectFunctionsEmulator(functions, '127.0.0.1', 5021);
    }
    return { app, auth, db, functions };
  });
  return services;
};

const SYNC_TIMEOUT_MS = 15_000;

// Sincronización forzada: reabre la conexión con Firestore (útil si se quedó atascada tras perder la red)
// y espera a que el servidor confirme todas las escrituras pendientes. waitForPendingWrites termina al
// momento si no hay nada pendiente, así que una lectura del servidor confirma además que hay conexión.
// Devuelve false sin conexión o si no lo consigue a tiempo.
export const forceSync = async (db: Firestore, uid: string): Promise<boolean> => {
  await disableNetwork(db);
  await enableNetwork(db);
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), SYNC_TIMEOUT_MS));
  const confirmed = Promise.all([waitForPendingWrites(db), getDocFromServer(doc(db, 'users', uid))]).then(
    () => true,
    () => false
  );
  return Promise.race([confirmed, timeout]);
};

// Al cerrar sesión se borra la copia local de los datos para no dejarlos en un dispositivo compartido, y este
// dispositivo deja de recibir las alarmas de la cuenta
export const signOutAndClearCache = async (services: FirebaseServices) => {
  const { auth, db } = services;
  const uid = auth.currentUser?.uid;
  if (uid)
    await unregisterPushDevice(services, uid).catch((e) => console.warn('Could not stop push notifications:', e));
  await signOut(auth);
  await terminate(db);
  // Falla si hay otras pestañas abiertas con la app; en ese caso la caché se queda hasta que se cierren
  await clearIndexedDbPersistence(db).catch((e) => console.warn('Could not clear Firestore cache:', e));
  window.location.reload();
};
