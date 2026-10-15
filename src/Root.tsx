import { lazy, Suspense } from 'react';
import { legalPageFor } from './services/legal';

const AuthGate = lazy(() => import('./AuthGate.tsx').then(({ AuthGate }) => ({ default: AuthGate })));
const LegalPage = lazy(() => import('./components/LegalPage'));

// Los textos legales (/privacidad, /condiciones, /aviso-legal) se ven sin iniciar sesión; el resto es la app
export const Root = () => {
  const legal = legalPageFor(window.location.pathname);
  return (
    <Suspense fallback={null}>
      {legal ? <LegalPage page={legal.id} /> : <AuthGate />}
    </Suspense>
  );
};
