import {createRoot} from 'react-dom/client';
import {AuthGate} from './AuthGate.tsx';
import './index.css';
import { applyA11yPrefs, loadA11yPrefs } from './services/a11yPrefs';

// Preferencias de accesibilidad antes del primer render, para que no haya parpadeo
applyA11yPrefs(loadA11yPrefs());

createRoot(document.getElementById('root')!).render(<AuthGate />);
