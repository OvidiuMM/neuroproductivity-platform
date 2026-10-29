import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { forgetAccess } from './access';
import { disconnectGoogleCalendar } from './googleCalendar';
import { signOutAndClearCache, type FirebaseServices } from './firebase';
import { deleteAllUserData, exportUserData, readWheelAreas } from './repository';
import { popupsUnreliable } from './platform';
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
// (y se ha escrito), si no con Google. En la app de la pantalla de inicio del iPhone la ventana de Google no vuelve:
// vale haber entrado hace menos de 4 minutos (el servidor pide menos de 5)
const RECENT_SIGN_IN_MS = 4 * 60 * 1000;
const reauthenticate = async (user: User, password?: string) => {
  if (password) return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password));
  if (!popupsUnreliable()) return reauthenticateWithPopup(user, new GoogleAuthProvider());
  if (Date.now() - Date.parse(user.metadata.lastSignInTime ?? '') < RECENT_SIGN_IN_MS) return;
  throw new Error(
    'Para eliminar la cuenta desde la app del iPhone, cierra sesión, vuelve a entrar y elimínala en los 4 minutos siguientes.'
  );
};

// `withCalendar`: la cuenta usa la sincronización con Google Calendar. Entonces se desconecta primero: así borrar las
// tareas no borra sus eventos, que se quedan en Google. Si no se puede, la eliminación sigue (la función la desconecta
// al final; algún evento podría borrarse antes)
export const deleteAccount = async (
  services: FirebaseServices,
  user: User,
  password?: string,
  { withCalendar = false }: { withCalendar?: boolean } = {}
) => {
  await reauthenticate(user, password);
  if (withCalendar) await disconnectGoogleCalendar(services).catch(() => undefined);
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
