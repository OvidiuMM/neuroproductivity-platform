import { adminDb } from './adminApp';

// Las funciones extra de una cuenta (ver features.ts). Va aparte de features.ts para que access.ts lo use sin
// importarlo (features.ts importa de access.ts).
export const featuresDoc = (uid: string) => adminDb().doc(`features/${uid}`);

// Al eliminar la cuenta. Al quedarse sin acceso se borran en la misma transacción que cambia el acceso (access.ts).
export const forgetFeatures = async (uid: string) => {
  await featuresDoc(uid).delete();
};
