// Versión de package.json, inyectada por Vite al compilar (vite.config.ts)
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_USE_FIREBASE_EMULATORS?: string;
}
