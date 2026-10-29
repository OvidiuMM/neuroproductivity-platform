import { lazy, Suspense } from 'react';
import { legalPageFor } from './services/legal';
import { LoadingScreen } from './components/BrandMark';
import { messages } from './i18n/locale';

const loading = messages<string>('Cargando…', 'Loading…');

const AuthGate = lazy(() => import('./AuthGate.tsx').then(({ AuthGate }) => ({ default: AuthGate })));
const LegalPage = lazy(() => import('./components/LegalPage'));
const NotFoundPage = lazy(() => import('./components/NotFoundPage'));

// Las direcciones de la app: la raíz (también /index.html); el resto, salvo los textos legales, no existe
const isAppPath = (path: string) => path === '/' || path === '/index.html';

// Los textos legales (/privacidad, /condiciones, /aviso-legal) se ven sin iniciar sesión; la raíz es la app, y una
// dirección que no existe dice que no se encontró
export const Root = () => {
  const path = window.location.pathname;
  const legal = legalPageFor(path);
  // Mientras se descarga la pantalla de entrada o el texto legal, el logo girando
  return (
    <Suspense fallback={<LoadingScreen text={loading} />}>
      {legal ? <LegalPage page={legal.id} /> : isAppPath(path) ? <AuthGate /> : <NotFoundPage />}
    </Suspense>
  );
};
