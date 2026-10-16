import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// package.json es la única fuente de la versión que muestra la app
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      // El SDK de Firebase (Auth, Firestore y Functions) ronda los 670 kB sin comprimir y hace falta para entrar
      chunkSizeWarningLimit: 700,
      rolldownOptions: {
        output: {
          // Las librerías cambian poco entre versiones: en trozos aparte, el navegador las conserva en caché. Las
          // secciones que no se ven al arrancar se cargan al abrirlas (React.lazy en App)
          codeSplitting: {
            groups: [
              { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor', test: /node_modules/ }
            ]
          }
        }
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(version)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    }
  };
});
