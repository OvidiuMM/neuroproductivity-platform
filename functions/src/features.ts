import * as logger from 'firebase-functions/logger';
import { adminDb } from './adminApp';
import { REGION, adminEmail, removeStaleAdminMarkers } from './access';
import { isAdminToken, type AccessRecord } from './accessLogic';
import { invalidRequest, onUserCall, requireAuth, userErrors } from './callable';
import { featuresDoc } from './featuresCleanup';
import { parseFeatureRequest, type FeatureId } from './featuresLogic';
import { messages } from './i18n';

const fail = userErrors(
  messages(
    {
      noAccess: 'Solo las cuentas con acceso pueden tener funciones extra.',
      adminOnly: 'Solo la administración puede activar funciones extra.',
      own: 'Tus funciones extra se encienden y apagan desde tu cuenta.'
    },
    {
      noAccess: 'Only accounts with access can have extra features.',
      adminOnly: 'Only the admin can turn on extra features.',
      own: 'Your extra features are turned on and off from your account.'
    }
  )
);

// FUNCIONES EXTRA de cada cuenta, en features/{uid} ({ granted, updatedAt }; sin funciones, no hay documento): solo
// las escribe este servidor y las leen la propia cuenta y la administración. Se borran al perder el acceso (en la
// misma transacción, en access.ts) y al eliminar la cuenta.
// La administración no tiene documento: tiene todas y las enciende o apaga en su perfil (users/{uid}.featurePrefs).
// Ese campo lo puede escribir cualquier cuenta en su perfil: el servidor solo debe tenerlo en cuenta para la cuenta de
// administración actual (con su marca vigente en admins/{uid}), nunca para las demás.

// Guarda las funciones de una cuenta, en la misma transacción que comprueba que sigue con acceso: si la
// administración se lo retira entretanto, la transacción se repite y no guarda nada.
export const saveGrantedFeatures = (uid: string, granted: FeatureId[]) =>
  adminDb().runTransaction(async (tx) => {
    const access = await tx.get(adminDb().doc(`access/${uid}`));
    if ((access.data() as AccessRecord | undefined)?.status !== 'approved') {
      throw fail('failed-precondition', (t) => t.noAccess);
    }
    if (granted.length === 0) tx.delete(featuresDoc(uid));
    else tx.set(featuresDoc(uid), { granted, updatedAt: new Date().toISOString() });
  });

export const setFeatures = onUserCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  await removeStaleAdminMarkers();
  if (!isAdminToken(auth.token, adminEmail())) {
    throw fail('permission-denied', (t) => t.adminOnly);
  }
  const parsed = parseFeatureRequest(request.data);
  if (!parsed) throw invalidRequest();
  if (parsed.uid === auth.uid) {
    throw fail('permission-denied', (t) => t.own);
  }
  await saveGrantedFeatures(parsed.uid, parsed.granted);
  logger.info('Features set', { count: parsed.granted.length });
  return { features: parsed.granted };
});
