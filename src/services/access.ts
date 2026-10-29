import { collection, doc, onSnapshot, orderBy, query, type Firestore } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';
import { LOCALE, type Locale } from '../i18n/locale';

// Aprobación de accesos: access/{uid} y admins/{uid} solo los escriben las Cloud Functions (functions/src/access.ts)
// blocked: lista negra (también su email)
export type AccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'blocked';
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
  // Vuelve a pedir acceso tras un rechazo o una retirada: no entra sola con la aprobación libre
  review?: boolean;
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
  (
    await httpsCallable<{ language: Locale }, { status: OwnAccessStatus; isAdmin: boolean }>(
      functions,
      'syncAccess'
    )({
      language: LOCALE
    })
  ).data;

// Con el idioma de la app: el servidor lo guarda en la solicitud (el email de la aprobación va en ese idioma) y lo usa
// en sus mensajes de error
export const requestAccess = async (functions: Functions, message: string) =>
  (
    await httpsCallable<{ message: string; language: Locale }, { status: AccessStatus }>(
      functions,
      'requestAccess'
    )({ message, language: LOCALE })
  ).data;

export const setAccess = async (functions: Functions, uid: string, status: DecisionStatus) =>
  (
    await httpsCallable<{ uid: string; status: DecisionStatus; language: Locale }, { status: DecisionStatus }>(
      functions,
      'setAccess'
    )({ uid, status, language: LOCALE })
  ).data;

export const forgetAccess = async (functions: Functions) => {
  await httpsCallable<{ language: Locale }>(functions, 'forgetAccess')({ language: LOCALE });
};

// Aprobación de cuentas (solo administración): obligatoria o libre. Sin configuración guardada, es obligatoria.
export const subscribeToApprovalRequired = (
  db: Firestore,
  onChange: (approvalRequired: boolean) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    doc(db, 'settings', 'access'),
    (snapshot) => onChange(snapshot.data()?.approvalRequired !== false),
    onError
  );

export const setAccessMode = async (functions: Functions, approvalRequired: boolean) =>
  (
    await httpsCallable<
      { approvalRequired: boolean; language: Locale },
      { approvalRequired: boolean; approved: number }
    >(
      functions,
      'setAccessMode'
    )({ approvalRequired, language: LOCALE })
  ).data;
