import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_APP = '[DEFAULT]';

// Firestore de la app por defecto de firebase-admin. Se busca esa app por su nombre: firebase-functions crea su
// propia app interna (con nombre) para verificar las llamadas, así que «hay alguna app» no implica que exista
// la por defecto (en producción getApps() no está vacío y getFirestore() fallaba con app/no-app).
const ensureDefaultApp = () => {
  if (!getApps().some((app) => app.name === DEFAULT_APP)) initializeApp();
};

export const adminDb = () => {
  ensureDefaultApp();
  return getFirestore();
};

export const adminAuth = () => {
  ensureDefaultApp();
  return getAuth();
};
