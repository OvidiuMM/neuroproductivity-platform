import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import App from './App';
import { AccessRequestScreen } from './components/AccessRequestScreen';
import { requestAccess, subscribeToIsAdmin, subscribeToOwnAccess, syncAccess, type OwnAccessStatus } from './services/access';
import { signOutAndClearCache, type FirebaseServices } from './services/firebase';
import { saveUserProfile } from './services/repository';

interface AccessGateProps {
  user: User;
  services: FirebaseServices;
}

const REQUEST_ERRORS: Record<string, string> = {
  'functions/resource-exhausted': 'Podrás volver a pedir acceso más adelante.',
  'functions/failed-precondition': 'Tu cuenta de Google no tiene un email con el que avisarte.'
};

// La app solo se abre con el acceso aprobado por la administración. El estado llega en vivo desde
// access/{uid}: al aprobarlo, retirarlo o rechazarlo la pantalla cambia sin recargar.
export const AccessGate: React.FC<AccessGateProps> = ({ user, services }) => {
  const [status, setStatus] = useState<OwnAccessStatus>('unknown');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  // Respuesta del servidor por si el documento aún no ha llegado (o no existe y la caché no lo sabe)
  const [checkedStatus, setCheckedStatus] = useState<OwnAccessStatus>('unknown');
  const effectiveStatus = status === 'unknown' ? checkedStatus : status;
  const isApproved = effectiveStatus === 'approved';

  useEffect(() => subscribeToOwnAccess(services.db, user.uid, setStatus), [services.db, user.uid]);
  useEffect(() => subscribeToIsAdmin(services.db, user.uid, setIsAdmin), [services.db, user.uid]);

  // Da de alta a la administración y confirma el estado con el servidor
  const check = useCallback(() => {
    setIsChecking(true);
    syncAccess(services.functions)
      .then((result) => setCheckedStatus(result.status))
      .catch((e) => console.warn('Could not check access:', e))
      .finally(() => setIsChecking(false));
  }, [services.functions]);

  useEffect(check, [check]);

  useEffect(() => {
    if (isApproved) saveUserProfile(services.db, user).catch((e) => console.error('Error saving user profile:', e));
  }, [isApproved, services.db, user]);

  const handleRequest = async (message: string) => {
    try {
      await requestAccess(services.functions, message);
    } catch (e) {
      const known = e instanceof FirebaseError ? REQUEST_ERRORS[e.code] : undefined;
      throw new Error(known ?? 'No se pudo enviar la solicitud. Comprueba la conexión e inténtalo de nuevo.');
    }
  };

  if (isApproved) return <App user={user} services={services} isAdmin={isAdmin} />;

  // Mientras se consulta al servidor no se muestra el formulario (la administración se aprueba en ese paso)
  if (isChecking && (effectiveStatus === 'unknown' || effectiveStatus === 'none')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500" role="status">
        Comprobando tu acceso…
      </div>
    );
  }

  return (
    <AccessRequestScreen
      status={effectiveStatus}
      email={user.email ?? ''}
      onRequest={handleRequest}
      onRetry={check}
      onSignOut={() => signOutAndClearCache(services)}
    />
  );
};
