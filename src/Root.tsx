import { lazy, Suspense } from 'react';
import { legalPageFor } from './services/legal';
import { LoadingScreen } from './components/BrandMark';

const AuthGate = lazy(() => import('./AuthGate.tsx').then(({ AuthGate }) => ({ default: AuthGate })));
const LegalPage = lazy(() => import('./components/LegalPage'));

// Los textos legales (/privacidad, /condiciones, /aviso-legal) se ven sin iniciar sesión; el resto es la app
export const Root = () => {
  const legal = legalPageFor(window.location.pathname);
  // Mientras se descarga la pantalla de entrada o el texto legal, el logo girando
  return (
    <Suspense fallback={<LoadingScreen text="Cargando…" />}>
      {legal ? <LegalPage page={legal.id} /> : <AuthGate />}
    </Suspense>
  );
};
