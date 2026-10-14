import type { FirebaseOptions } from 'firebase/app';

// Dominios propios conectados a Firebase Hosting
export const CUSTOM_DOMAINS = ['clar.life', 'www.clar.life'];

// Servida desde un dominio propio, el inicio de sesión usa ese mismo dominio (Hosting sirve /__/auth en todos los
// dominios conectados): así el navegador no trata la ventana de Google como de otro sitio ni bloquea su
// almacenamiento. El dominio tiene que estar autorizado en Auth y en el cliente OAuth de Google.
export const withAuthDomain = (config: FirebaseOptions, hostname: string): FirebaseOptions =>
  CUSTOM_DOMAINS.includes(hostname) ? { ...config, authDomain: hostname } : config;
