import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {StorageService} from './services/storage';
import './index.css';

// Antes del primer render: limpia datos de demostración heredados y garantiza un perfil activo
StorageService.initialize();

createRoot(document.getElementById('root')!).render(<App />);
