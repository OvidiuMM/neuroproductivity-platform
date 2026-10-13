import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
  updateProfile,
  type Auth,
  type User
} from 'firebase/auth';

// Cuentas con email y contraseña (además de Google): alta con verificación del email, acceso y recuperación

export const MIN_PASSWORD_LENGTH = 8;

export const hasPassword = (user: User) => user.providerData.some((p) => p.providerId === 'password');

// Las cuentas con contraseña deben confirmar su email antes de solicitar acceso; las de Google ya vienen verificadas
export const needsEmailVerification = (user: User) => hasPassword(user) && !user.emailVerified;

export const signUpWithEmail = async (auth: Auth, { name, email, password }: { name: string; email: string; password: string }) => {
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) await updateProfile(user, { displayName: name.trim() });
  await sendEmailVerification(user);
  return user;
};

export const signInWithEmail = (auth: Auth, email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

// No se revela si el email tiene cuenta: la respuesta es la misma en los dos casos
export const sendPasswordReset = async (auth: Auth, email: string) => {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    if (!(e instanceof FirebaseError && e.code === 'auth/user-not-found')) throw e;
  }
};

export const resendVerification = (user: User) => sendEmailVerification(user);

// Tras confirmar el email en otra pestaña: se recargan los datos y el token (las Cloud Functions miran email_verified)
export const refreshVerification = async (user: User) => {
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
};

export const changePassword = async (user: User, currentPassword: string, newPassword: string) => {
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', currentPassword));
  await updatePassword(user, newPassword);
};

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'Email o contraseña incorrectos.',
  'auth/invalid-email': 'Ese email no es válido.',
  'auth/missing-password': 'Escribe la contraseña.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Entra o recupera la contraseña.',
  'auth/weak-password': `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento o recupera la contraseña.',
  'auth/network-request-failed': 'No hay conexión. Inténtalo de nuevo cuando vuelvas a tenerla.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a entrar y repite la acción.',
  'auth/operation-not-allowed': 'El acceso con email y contraseña no está activado en este proyecto.'
};

export const describeAuthError = (error: unknown, fallback: string) =>
  (error instanceof FirebaseError && AUTH_ERRORS[error.code]) || fallback;
