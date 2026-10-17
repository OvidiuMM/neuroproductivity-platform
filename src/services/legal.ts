// Textos legales: páginas públicas que se ven sin iniciar sesión (Root.tsx elige la página por la ruta)

export type LegalPageId = 'privacy' | 'terms' | 'notice';

export const LEGAL_PAGES: { id: LegalPageId; path: string; title: string }[] = [
  { id: 'privacy', path: '/privacidad', title: 'Política de privacidad' },
  { id: 'terms', path: '/condiciones', title: 'Condiciones de uso' },
  { id: 'notice', path: '/aviso-legal', title: 'Aviso legal' }
];

// La página legal de una ruta («/privacidad», también con barra final o mayúsculas), o undefined
export const legalPageFor = (pathname: string) => {
  const path = pathname.replace(/\/+$/, '').toLowerCase();
  return LEGAL_PAGES.find((page) => page.path === path);
};

export const legalPath = (id: LegalPageId) => LEGAL_PAGES.find((page) => page.id === id)!.path;

// Titular de CLAR: una persona física, sin actividad económica. Sus datos aparecen en los textos legales y una
// prueba unitaria falla mientras falten: no se publica una política de privacidad sin responsable
export const OWNER = {
  name: 'Ovidiu M.',
  email: 'info@clar.life'
};

// Edad mínima para usar CLAR: la que fija el art. 7 de la LOPDGDD para consentir el tratamiento de datos
export const MIN_AGE = 14;

// Fecha de la versión vigente de los textos legales: cámbiala con cada cambio de contenido
export const LEGAL_UPDATED = '17 de octubre de 2026';

// Quién envía los emails de CLAR (encargado del tratamiento)
export const EMAIL_PROVIDER = 'IONOS';
