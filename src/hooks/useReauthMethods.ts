import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { reauthMethods } from '../services/auth';

// Los métodos para confirmar con un inicio de sesión reciente, primero el de la sesión actual (lo dice el token).
// Mientras se lee el token, primero Google si la cuenta lo tiene.
export const useReauthMethods = (user: User) => {
  const [signInProvider, setSignInProvider] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    user
      .getIdTokenResult()
      .then((result) => {
        if (active) setSignInProvider(result.signInProvider);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);
  return reauthMethods(
    user.providerData.map((p) => p.providerId),
    signInProvider
  );
};
