import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import App from './App';
import { AccessRequestScreen } from './components/AccessRequestScreen';
import { LoadingScreen } from './components/BrandMark';
import { FeedbackDialog } from './components/FeedbackDialog';
import { EmailVerificationScreen } from './components/EmailVerificationScreen';
import { needsEmailVerification } from './services/auth';
import { useReauthMethods } from './hooks/useReauthMethods';
import {
  requestAccess,
  subscribeToIsAdmin,
  subscribeToOwnAccess,
  syncAccess,
  type OwnAccessStatus
} from './services/access';
import { deleteAccount, downloadAccountData } from './services/account';
import { signOutAndClearCache, type FirebaseServices } from './services/firebase';
import { recordTermsAcceptance, saveUserProfile } from './services/repository';
import { LEGAL_UPDATED } from './services/legal';
import { messages } from './i18n/locale';

interface AccessGateProps {
  user: User;
  services: FirebaseServices;
}

const REQUEST_ERRORS: Record<string, string | undefined> = messages(
  {
    'functions/resource-exhausted': 'Podrás volver a pedir acceso más adelante.',
    'functions/failed-precondition': 'Tu cuenta no tiene un email con el que avisarte.',
    'functions/permission-denied': 'Confirma tu email antes de solicitar acceso.'
  },
  {
    'functions/resource-exhausted': 'You can request access again later.',
    'functions/failed-precondition': "Your account doesn't have an email we can notify you at.",
    'functions/permission-denied': 'Confirm your email before you request access.'
  }
);

const m = messages(
  {
    requestFailed: 'No se pudo enviar la solicitud. Comprueba la conexión e inténtalo de nuevo.',
    checking: 'Comprobando tu acceso…'
  },
  {
    requestFailed: "Couldn't send the request. Check your connection and try again.",
    checking: 'Checking your access…'
  }
);

// Si el email ya está confirmado (p. ej. en otra pestaña) pero el token aún no lo dice, que es lo que lee el servidor y
// puede tardar hasta una hora, se renueva antes de preguntar por el acceso
const refreshVerifiedToken = async (user: User) => {
  if (user.emailVerified && (await user.getIdTokenResult()).claims.email_verified !== true) await user.getIdToken(true);
};

// La app solo se abre con el acceso aprobado por la administración. El estado llega en vivo desde
// access/{uid}: al aprobarlo, retirarlo o rechazarlo la pantalla cambia sin recargar.
export const AccessGate: React.FC<AccessGateProps> = ({ user, services }) => {
  const [status, setStatus] = useState<OwnAccessStatus>('unknown');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [emailVerified, setEmailVerified] = useState(() => !needsEmailVerification(user));
  // Respuesta del servidor por si el documento aún no ha llegado (o no existe y la caché no lo sabe)
  const [checkedStatus, setCheckedStatus] = useState<OwnAccessStatus>('unknown');
  // Contacto también sin acceso aprobado (p. ej. para preguntar por la solicitud)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const reauthMethods = useReauthMethods(user);
  const effectiveStatus = status === 'unknown' ? checkedStatus : status;
  const isApproved = effectiveStatus === 'approved';

  useEffect(() => subscribeToOwnAccess(services.db, user.uid, setStatus), [services.db, user.uid]);
  useEffect(() => subscribeToIsAdmin(services.db, user.uid, setIsAdmin), [services.db, user.uid]);

  // Da de alta a la administración y confirma el estado con el servidor
  // (isChecking empieza en true, así que la primera comprobación no necesita marcarlo)
  const confirmWithServer = useCallback(
    () =>
      refreshVerifiedToken(user)
        .then(() => syncAccess(services.functions))
        .then((result) => setCheckedStatus(result.status))
        .catch((e) => console.warn('Could not check access:', e))
        .finally(() => setIsChecking(false)),
    [services.functions, user]
  );
  const check = () => {
    setIsChecking(true);
    void confirmWithServer();
  };

  useEffect(() => {
    void confirmWithServer();
  }, [confirmWithServer]);

  useEffect(() => {
    if (!isApproved) return;
    saveUserProfile(services.db, user)
      .then(() => recordTermsAcceptance(services.db, user.uid, LEGAL_UPDATED))
      .catch((e) => console.error('Error saving user profile:', e));
  }, [isApproved, services.db, user]);

  const handleRequest = async (message: string) => {
    try {
      await requestAccess(services.functions, message);
    } catch (e) {
      const known = e instanceof FirebaseError ? REQUEST_ERRORS[e.code] : undefined;
      throw new Error(known ?? m.requestFailed, { cause: e });
    }
  };

  if (isApproved) return <App user={user} services={services} isAdmin={isAdmin} />;

  // Cuenta con email y contraseña sin confirmar: primero se confirma el email
  if (!emailVerified) {
    return (
      <EmailVerificationScreen
        user={user}
        onVerified={() => {
          setEmailVerified(true);
          check();
        }}
        onSignOut={() => signOutAndClearCache(services)}
      />
    );
  }

  // Mientras se consulta al servidor no se muestra el formulario (la administración se aprueba en ese paso)
  if (isChecking && (effectiveStatus === 'unknown' || effectiveStatus === 'none')) {
    return <LoadingScreen text={m.checking} />;
  }

  return (
    <>
      {/* Con la ventana de contacto abierta, la pantalla de detrás queda inerte */}
      <div className="contents" inert={isFeedbackOpen}>
        <AccessRequestScreen
          status={effectiveStatus}
          email={user.email ?? ''}
          onRequest={handleRequest}
          onRetry={check}
          onSignOut={() => signOutAndClearCache(services)}
          onContact={() => setIsFeedbackOpen(true)}
          onDownloadData={() => downloadAccountData(services, user)}
          onDeleteAccount={(password) => deleteAccount(services, user, password)}
          reauthMethods={reauthMethods}
        />
      </div>
      {isFeedbackOpen && <FeedbackDialog functions={services.functions} onClose={() => setIsFeedbackOpen(false)} />}
    </>
  );
};
