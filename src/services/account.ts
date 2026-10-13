import { GoogleAuthProvider, deleteUser, reauthenticateWithPopup, type User } from 'firebase/auth';
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

export const deleteAccount = async (services: FirebaseServices, user: User) => {
  // Firebase exige un inicio de sesión reciente para eliminar la cuenta
  await reauthenticateWithPopup(user, new GoogleAuthProvider());
  await deleteAllUserData(services.db, user.uid);
  // La solicitud de acceso se borra al final, con la sesión aún abierta para llamar a la función
  await forgetAccess(services.functions);
  await deleteUser(user);
  await signOutAndClearCache(services);
};

export const DELETE_ACCOUNT_CONFIRMATION =
  'Se eliminarán tu cuenta y todos tus datos (tareas, evaluaciones, reuniones y correos). No se puede deshacer. ¿Continuar?';
