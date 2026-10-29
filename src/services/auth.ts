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
import { messages } from '../i18n/locale';

// Cuentas con email y contraseña (además de Google): alta con verificación del email, acceso y recuperación

export const MIN_PASSWORD_LENGTH = 8;

export const hasPassword = (user: User) => user.providerData.some((p) => p.providerId === 'password');

// Cómo confirmar una acción delicada (eliminar la cuenta) con un inicio de sesión reciente: con los métodos de la
// cuenta, primero el de la sesión actual. Una cuenta creada con email y contraseña a la que después se entró con Google
// tiene los dos: si se entró con Google, no se le pide la contraseña (puede no recordarla).
export type ReauthMethod = 'google' | 'password';
export const reauthMethods = (providerIds: string[], signInProvider?: string | null): ReauthMethod[] => {
  const methods: ReauthMethod[] = [];
  if (providerIds.includes('google.com')) methods.push('google');
  if (providerIds.includes('password')) methods.push('password');
  if (methods.length === 0) return ['google'];
  const current = signInProvider === 'password' ? 'password' : signInProvider === 'google.com' ? 'google' : null;
  return current && methods.includes(current) ? [current, ...methods.filter((m) => m !== current)] : methods;
};

// Las cuentas con contraseña deben confirmar su email antes de solicitar acceso; las de Google ya vienen verificadas
export const needsEmailVerification = (user: User) => hasPassword(user) && !user.emailVerified;

export const signUpWithEmail = async (
  auth: Auth,
  { name, email, password }: { name: string; email: string; password: string }
) => {
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

const m = messages(
  {
    wrongCredentials: 'Email o contraseña incorrectos.',
    invalidEmail: 'Ese email no es válido.',
    missingPassword: 'Escribe la contraseña.',
    emailInUse: 'Ya hay una cuenta con ese email. Entra o recupera la contraseña.',
    weakPassword: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    tooManyRequests: 'Demasiados intentos. Espera un momento o recupera la contraseña.',
    offline: 'No hay conexión. Inténtalo de nuevo cuando vuelvas a tenerla.',
    recentLogin: 'Por seguridad, vuelve a entrar y repite la acción.',
    popupClosed: 'Se cerró la ventana de Google sin confirmar. Vuelve a intentarlo.',
    popupBlocked:
      'El navegador bloqueó la ventana de Google: permite las ventanas emergentes de CLAR y vuelve a intentarlo.',
    userMismatch: 'Esa no es la cuenta de Google con la que has entrado: elige la misma para confirmar.',
    notAllowed: 'El acceso con email y contraseña no está activado en este proyecto.'
  },
  {
    wrongCredentials: 'Wrong email or password.',
    invalidEmail: "That email isn't valid.",
    missingPassword: 'Enter your password.',
    emailInUse: 'There is already an account with that email. Sign in or reset your password.',
    weakPassword: `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    tooManyRequests: 'Too many attempts. Wait a moment or reset your password.',
    offline: "You're offline. Try again when you're back online.",
    recentLogin: 'For security, sign in again and repeat the action.',
    popupClosed: 'The Google window was closed before you confirmed. Try again.',
    popupBlocked: 'Your browser blocked the Google window: allow pop-ups for CLAR and try again.',
    userMismatch: "That isn't the Google account you signed in with: choose the same one to confirm.",
    notAllowed: "Email and password sign-in isn't enabled in this project."
  }
);

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': m.wrongCredentials,
  'auth/wrong-password': m.wrongCredentials,
  'auth/user-not-found': m.wrongCredentials,
  'auth/invalid-email': m.invalidEmail,
  'auth/missing-password': m.missingPassword,
  'auth/email-already-in-use': m.emailInUse,
  'auth/weak-password': m.weakPassword,
  'auth/too-many-requests': m.tooManyRequests,
  'auth/network-request-failed': m.offline,
  'auth/requires-recent-login': m.recentLogin,
  // Confirmar con Google (p. ej. al eliminar la cuenta)
  'auth/popup-closed-by-user': m.popupClosed,
  'auth/cancelled-popup-request': m.popupClosed,
  'auth/popup-blocked': m.popupBlocked,
  'auth/user-mismatch': m.userMismatch,
  'auth/operation-not-allowed': m.notAllowed
};

export const describeAuthError = (error: unknown, fallback: string) =>
  (error instanceof FirebaseError && AUTH_ERRORS[error.code]) || fallback;
