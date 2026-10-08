import React, { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  type User
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import App from './App';
import { LoginScreen } from './components/LoginScreen';
import { getFirebase, type FirebaseServices } from './services/firebase';
import { saveUserProfile } from './services/repository';

type AuthState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'signed-out'; services: FirebaseServices }
  | { status: 'signed-in'; services: FirebaseServices; user: User };

const SIGN_IN_ERRORS: Record<string, string> = {
  'auth/network-request-failed': 'No hay conexión. Necesitas internet para iniciar sesión la primera vez.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión.',
  'auth/operation-not-allowed': 'El inicio de sesión con Google no está activado en este proyecto.'
};

const describeSignInError = (error: unknown) =>
  (error instanceof FirebaseError && SIGN_IN_ERRORS[error.code]) || 'No se pudo iniciar sesión. Inténtalo de nuevo.';

// Inicio de sesión obligatorio: la app solo se muestra con una cuenta de Google
export const AuthGate: React.FC = () => {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    getFirebase()
      .then((services) => {
        getRedirectResult(services.auth).catch((e) => setSignInError(describeSignInError(e)));
        unsubscribe = onAuthStateChanged(services.auth, (user) => {
          if (user) {
            saveUserProfile(services.db, user).catch((e) => console.error('Error saving user profile:', e));
            setState({ status: 'signed-in', services, user });
          } else {
            setState({ status: 'signed-out', services });
          }
          setIsSigningIn(false);
        });
      })
      .catch((e) => setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    if (state.status !== 'signed-out') return;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setIsSigningIn(true);
    setSignInError(null);
    try {
      await signInWithPopup(state.services.auth, provider);
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : '';
      // Ventanas emergentes bloqueadas o no admitidas (p. ej. dentro de la APK): inicio de sesión por redirección
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(state.services.auth, provider);
        return;
      }
      setIsSigningIn(false);
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setSignInError(describeSignInError(e));
      }
    }
  };

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500" role="status">
        Cargando…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <p role="alert" className="max-w-md text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4">
          No se pudo iniciar la aplicación: {state.message}
        </p>
      </div>
    );
  }

  if (state.status === 'signed-out') {
    return (
      <LoginScreen onSignIn={handleSignIn} isSigningIn={isSigningIn} error={signInError} version={__APP_VERSION__} />
    );
  }

  return <App key={state.user.uid} user={state.user} services={state.services} />;
};
