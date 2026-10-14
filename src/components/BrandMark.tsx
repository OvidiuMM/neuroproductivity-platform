import React from 'react';

// Símbolo de CLAR: una lente enfocada (ver con claridad qué hacer ahora). Colores de marca: fondo pizarra
// #0f172a (slate-900), anillo índigo #818cf8 (indigo-400) y brillo blanco. Mismo dibujo que public/icon.svg.
export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    aria-hidden="true"
    focusable="false"
    className={`shrink-0 ${className}`}
  >
    <rect width="64" height="64" rx="16" fill="#0f172a" />
    <circle cx="32" cy="32" r="15" fill="none" stroke="#818cf8" strokeWidth="6" />
    <path d="M25 27 A8 8 0 0 1 31 22" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const BRAND_NAME = 'CLAR';
export const BRAND_TAGLINE = 'Decide qué hacer ahora, con claridad';
