import { HttpsError, onCall } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { adminDb } from './adminApp';
import { REGION, adminEmail, removeStaleAdminMarkers, requireAuth } from './access';
import { isAdminToken, type AccessRecord } from './accessLogic';
import { parseFeatureList, type FeatureId } from './featuresLogic';

// FUNCIONES EXTRA de cada cuenta, en features/{uid} ({ granted, updatedAt }): solo las escribe este servidor y las
// leen la propia cuenta y la administración. La administración no tiene documento: tiene todas y las enciende o apaga
// en su perfil (users/{uid}.featurePrefs). Al perder el acceso o eliminar la cuenta se borran (featuresCleanup.ts).

// Guarda las funciones de una cuenta, en la misma transacción que comprueba que sigue con acceso: si la
// administración se lo retira entretanto, la transacción se repite y no guarda nada.
export const saveGrantedFeatures = (uid: string, granted: FeatureId[]) =>
  adminDb().runTransaction(async (tx) => {
    const access = await tx.get(adminDb().doc(`access/${uid}`));
    if ((access.data() as AccessRecord | undefined)?.status !== 'approved') {
      throw new HttpsError('failed-precondition', 'Solo las cuentas con acceso pueden tener funciones extra.');
    }
    tx.set(adminDb().doc(`features/${uid}`), { granted, updatedAt: new Date().toISOString() });
  });

export const setFeatures = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw new HttpsError('permission-denied', 'Solo la administración puede activar funciones extra.');
  }
  const { uid, features } = (request.data ?? {}) as { uid?: unknown; features?: unknown };
  const granted = parseFeatureList(features);
  if (typeof uid !== 'string' || !uid || uid.includes('/') || !granted) {
    throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  }
  if (uid === auth.uid) {
    throw new HttpsError('failed-precondition', 'Tus funciones extra se encienden y apagan desde tu cuenta.');
  }
  await saveGrantedFeatures(uid, granted);
  logger.info('Features set', { count: granted.length });
  return { features: granted };
});
