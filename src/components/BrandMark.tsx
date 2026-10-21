import React from 'react';

// Símbolo de CLAR: una lente enfocada (ver con claridad qué hacer ahora). Colores de marca: fondo pizarra
// #0f172a (slate-900), anillo índigo #818cf8 (indigo-400) y brillo blanco. Mismo dibujo que public/icon.svg.
// `spinning`, mientras algo carga: el brillo da vueltas dentro del anillo, alrededor de su centro (el de la imagen,
// 32,32). Con «menos movimiento» (del sistema o del panel de accesibilidad) se queda quieto.
export const BrandMark: React.FC<{ size?: number; className?: string; spinning?: boolean }> = ({
  size = 36,
  className = '',
  spinning = false
}) => (
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
    <g
      className={
        spinning
          ? 'origin-center transform-view motion-safe:animate-spin motion-safe:[animation-duration:1.8s]'
          : undefined
      }
    >
      <path d="M25 27 A8 8 0 0 1 31 22" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </g>
  </svg>
);

// Pantalla de espera mientras arranca la app: el logo, con el brillo girando, y lo que se está haciendo
export const LoadingScreen: React.FC<{ text: string }> = ({ text }) => (
  <div
    className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-sm text-slate-500"
    role="status"
  >
    <BrandMark size={56} spinning />
    {text}
  </div>
);

export const BRAND_NAME = 'CLAR';
export const BRAND_TAGLINE = 'Decide qué hacer ahora, con claridad';
