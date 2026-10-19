import { adminDb } from './adminApp';

// Quita las funciones extra de una cuenta (ver features.ts): cuando deja de tener acceso y al eliminarla. Va aparte de
// features.ts para que access.ts lo use sin importarlo (features.ts importa de access.ts).
export const forgetFeatures = async (uid: string) => {
  await adminDb().doc(`features/${uid}`).delete();
};
