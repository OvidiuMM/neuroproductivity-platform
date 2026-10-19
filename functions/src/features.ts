import { HttpsError, onCall } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { adminDb } from './adminApp';
import { REGION, adminEmail, removeStaleAdminMarkers, requireAuth } from './access';
import { isAdminToken, type AccessRecord } from './accessLogic';
import { featuresDoc } from './featuresCleanup';
import { parseFeatureRequest, type FeatureId } from './featuresLogic';

// FUNCIONES EXTRA de cada cuenta, en features/{uid} ({ granted, updatedAt }; sin funciones, no hay documento): solo
// las escribe este servidor y las leen la propia cuenta y la administración. Se borran al perder el acceso (en la
// misma transacción, en access.ts) y al eliminar la cuenta.
// La administración no tiene documento: tiene todas y las enciende o apaga en su perfil (users/{uid}.featurePrefs).
// Ese campo lo puede escribir cualquier cuenta en su perfil, así que el servidor solo lo tiene en cuenta para la
// cuenta de administración actual (con su marca vigente en admins/{uid}), nunca para las demás.

// Guarda las funciones de una cuenta, en la misma transacción que comprueba que sigue con acceso: si la
// administración se lo retira entretanto, la transacción se repite y no guarda nada.
export const saveGrantedFeatures = (uid: string, granted: FeatureId[]) =>
  adminDb().runTransaction(async (tx) => {
    const access = await tx.get(adminDb().doc(`access/${uid}`));
    if ((access.data() as AccessRecord | undefined)?.status !== 'approved') {
      throw new HttpsError('failed-precondition', 'Solo las cuentas con acceso pueden tener funciones extra.');
    }
    if (granted.length === 0) tx.delete(featuresDoc(uid));
    else tx.set(featuresDoc(uid), { granted, updatedAt: new Date().toISOString() });
  });

export const setFeatures = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw new HttpsError('permission-denied', 'Solo la administración puede activar funciones extra.');
  }
  const parsed = parseFeatureRequest(request.data);
  if (!parsed) throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  if (parsed.uid === auth.uid) {
    throw new HttpsError('permission-denied', 'Tus funciones extra se encienden y apagan desde tu cuenta.');
  }
  await saveGrantedFeatures(parsed.uid, parsed.granted);
  logger.info('Features set', { count: parsed.granted.length });
  return { features: parsed.granted };
});
