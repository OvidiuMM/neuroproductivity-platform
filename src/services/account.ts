import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { forgetAccess } from './access';
import { signOutAndClearCache, type FirebaseServices } from './firebase';
import { deleteAllUserData, exportUserData } from './repository';

// Descarga y borrado de la cuenta. Funcionan también sin acceso aprobado (las reglas dejan leer y borrar
// los propios datos siempre), así una cuenta pendiente o retirada puede llevarse o eliminar lo suyo.

const downloadJson = (filename: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revocar en el mismo instante cancela la descarga en algunos navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const downloadAccountData = async ({ db }: FirebaseServices, user: User) => {
  const data = await exportUserData(db, user.uid);
  downloadJson(`clar-${new Date().toISOString().slice(0, 10)}.json`, {
    exportedAt: new Date().toISOString(),
    account: { name: user.displayName, email: user.email },
    ...data
  });
};

// Firebase exige un inicio de sesión reciente para eliminar la cuenta: con la contraseña si la cuenta la tiene
// (y se ha escrito), si no con Google
const reauthenticate = (user: User, password?: string) =>
  password
    ? reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password))
    : reauthenticateWithPopup(user, new GoogleAuthProvider());

export const deleteAccount = async (services: FirebaseServices, user: User, password?: string) => {
  await reauthenticate(user, password);
  await deleteAllUserData(services.db, user.uid);
  // La solicitud de acceso se borra al final, con la sesión aún abierta para llamar a la función
  await forgetAccess(services.functions);
  await deleteUser(user);
  await signOutAndClearCache(services);
};

// Cierra la sesión en todos los dispositivos: invalida los tokens de renovación (los demás dispositivos dejan de
// tener acceso en menos de una hora, cuando caduca el token actual) y cierra la sesión en este
export const signOutEverywhere = async (services: FirebaseServices) => {
  await httpsCallable(services.functions, 'revokeSessions')();
  await signOutAndClearCache(services);
};
