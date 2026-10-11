import { collection, doc, onSnapshot, orderBy, query, type Firestore } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';

// Aprobación de accesos: access/{uid} y admins/{uid} solo los escriben las Cloud Functions (functions/src/access.ts)
export type AccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type DecisionStatus = Exclude<AccessStatus, 'pending'>;
// 'none': sin solicitud; 'unknown': aún no se ha podido consultar al servidor (p. ej. sin conexión)
export type OwnAccessStatus = AccessStatus | 'none' | 'unknown';

export interface AccessRequest {
  uid: string;
  status: AccessStatus;
  email: string;
  name: string;
  photoUrl: string;
  message: string;
  requestedAt: string;
  decidedAt?: string;
}

export const ACCESS_MESSAGE_MAX_LENGTH = 500;

// La caché local responde primero; si no tiene el documento se espera a la respuesta del servidor
export const subscribeToOwnAccess = (db: Firestore, uid: string, onChange: (status: OwnAccessStatus) => void) =>
  onSnapshot(
    doc(db, 'access', uid),
    (snapshot) => {
      if (snapshot.exists()) onChange((snapshot.data() as AccessRequest).status);
      else onChange(snapshot.metadata.fromCache ? 'unknown' : 'none');
    },
    () => onChange('unknown')
  );

export const subscribeToIsAdmin = (db: Firestore, uid: string, onChange: (isAdmin: boolean) => void) =>
  onSnapshot(
    doc(db, 'admins', uid),
    (snapshot) => onChange(snapshot.exists()),
    () => onChange(false)
  );

// Solo para la administración: todas las solicitudes, las más recientes primero
export const subscribeToAccessRequests = (
  db: Firestore,
  onChange: (requests: AccessRequest[]) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    query(collection(db, 'access'), orderBy('requestedAt', 'desc')),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ ...(d.data() as Omit<AccessRequest, 'uid'>), uid: d.id }))),
    onError
  );

export const syncAccess = async (functions: Functions) =>
  (await httpsCallable<void, { status: OwnAccessStatus; isAdmin: boolean }>(functions, 'syncAccess')()).data;

export const requestAccess = async (functions: Functions, message: string) =>
  (await httpsCallable<{ message: string }, { status: AccessStatus }>(functions, 'requestAccess')({ message })).data;

export const setAccess = async (functions: Functions, uid: string, status: DecisionStatus) =>
  (await httpsCallable<{ uid: string; status: DecisionStatus }, { status: DecisionStatus }>(functions, 'setAccess')({ uid, status }))
    .data;

export const forgetAccess = async (functions: Functions) => {
  await httpsCallable(functions, 'forgetAccess')();
};
