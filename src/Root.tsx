import { lazy, Suspense } from 'react';
import { AuthGate } from './AuthGate.tsx';
import { legalPageFor } from './services/legal';

const LegalPage = lazy(() => import('./components/LegalPage'));

// Los textos legales (/privacidad, /condiciones, /aviso-legal) se ven sin iniciar sesión; el resto es la app
export const Root = () => {
  const legal = legalPageFor(window.location.pathname);
  return legal ? (
    <Suspense fallback={null}>
      <LegalPage page={legal.id} />
    </Suspense>
  ) : (
    <AuthGate />
  );
};
