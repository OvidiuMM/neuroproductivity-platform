import { createRoot } from 'react-dom/client';
import { Root } from './Root.tsx';
import './index.css';
import { applyA11yPrefs, loadA11yPrefs } from './services/a11yPrefs';
import { registerServiceWorker } from './services/notifications';

// Preferencias de accesibilidad antes del primer render, para que no haya parpadeo
applyA11yPrefs(loadA11yPrefs());

createRoot(document.getElementById('root')!).render(<Root />);

// El service worker, desde la primera visita (también sin iniciar sesión): así la app ya se puede abrir sin conexión.
// Después de cargar, para no quitarle red al arranque
window.addEventListener('load', registerServiceWorker, { once: true });
