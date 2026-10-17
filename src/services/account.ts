import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { forgetAccess } from './access';
import { signOutAndClearCache, type FirebaseServices } from './firebase';
import { deleteAllUserData, exportUserData, readWheelAreas } from './repository';
import { downloadJson } from './download';

// Descarga y borrado de la cuenta. Funcionan también sin acceso aprobado (las reglas dejan leer y borrar
// los propios datos siempre), así una cuenta pendiente o retirada puede llevarse o eliminar lo suyo.

export const downloadAccountData = async ({ db }: FirebaseServices, user: User) => {
  const [data, wheelAreas] = await Promise.all([exportUserData(db, user.uid), readWheelAreas(db, user.uid)]);
  // Con app, versión y tipo, como las descargas de una tarea, una meta o un proyecto: así se reconoce al importarla
  downloadJson(`clar-${new Date().toISOString().slice(0, 10)}.json`, {
    app: 'CLAR',
    version: __APP_VERSION__,
    type: 'account',
    exportedAt: new Date().toISOString(),
    account: { name: user.displayName, email: user.email },
    ...(wheelAreas ? { wheelAreas } : {}),
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
  // La función borra la cuenta y, después, lo que queda en el servidor (la solicitud de acceso y los mensajes)
  await forgetAccess(services.functions);
  await signOutAndClearCache(services);
};

// Cierra la sesión en todos los dispositivos: invalida los tokens de renovación (los demás dispositivos dejan de
// tener acceso en menos de una hora, cuando caduca el token actual) y cierra la sesión en este
export const signOutEverywhere = async (services: FirebaseServices) => {
  await httpsCallable(services.functions, 'revokeSessions')();
  await signOutAndClearCache(services);
};
