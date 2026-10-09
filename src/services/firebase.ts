import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, signOut, type Auth } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore
} from 'firebase/firestore';

// En desarrollo y en los tests e2e la app habla con los emuladores de Auth y Firestore (proyecto demo)
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
}

// En producción Firebase Hosting sirve la configuración en /__/firebase/init.json,
// así el ID del proyecto no tiene que estar en el repositorio.
const loadConfig = async (): Promise<FirebaseOptions> => {
  if (usingEmulators) return EMULATOR_CONFIG;
  const res = await fetch('/__/firebase/init.json');
  if (!res.ok) throw new Error(`No se pudo cargar la configuración de Firebase (${res.status})`);
  return res.json();
};

let services: Promise<FirebaseServices> | null = null;

export const getFirebase = (): Promise<FirebaseServices> => {
  services ??= loadConfig().then((config) => {
    const app = initializeApp(config);
    const auth = getAuth(app);
    // Caché persistente: la app funciona sin conexión y sincroniza al volver, también entre pestañas
    const db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    // Puertos de firebase.json, distintos de los de por defecto para convivir con otros proyectos de Firebase
    if (usingEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9399', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8281);
    }
    return { app, auth, db };
  });
  return services;
};

// Al cerrar sesión se borra la copia local de los datos para no dejarlos en un dispositivo compartido
export const signOutAndClearCache = async ({ auth, db }: FirebaseServices) => {
  await signOut(auth);
  await terminate(db);
  // Falla si hay otras pestañas abiertas con la app; en ese caso la caché se queda hasta que se cierren
  await clearIndexedDbPersistence(db).catch((e) => console.warn('Could not clear Firestore cache:', e));
  window.location.reload();
};
