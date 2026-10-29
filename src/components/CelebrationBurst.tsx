import React from 'react';

// Piezas del confeti: destino (rem, desde el origen; y negativa = hacia arriba), giro final, retraso (s) y forma y
// color de la marca (índigo y violeta). Siempre las mismas: la animación es breve y no hace falta azar
const PIECES: { x: number; y: number; r: number; delay: number; className: string }[] = [
  { x: -7.5, y: -3.5, r: 220, delay: 0, className: 'h-1 w-2.5 rounded-[1px] bg-indigo-400' },
  { x: -5.5, y: -5.5, r: -160, delay: 0.05, className: 'size-1.5 rounded-full bg-violet-400' },
  { x: -4, y: -7, r: 300, delay: 0.02, className: 'h-1 w-2.5 rounded-[1px] bg-violet-500' },
  { x: -2.5, y: -5, r: -240, delay: 0.08, className: 'h-2.5 w-1 rounded-[1px] bg-indigo-300' },
  { x: -1, y: -8, r: 180, delay: 0, className: 'size-1.5 rounded-full bg-indigo-500' },
  { x: 0.5, y: -6, r: -320, delay: 0.04, className: 'h-1 w-2.5 rounded-[1px] bg-violet-300' },
  { x: 1.5, y: -7.5, r: 260, delay: 0.1, className: 'h-2.5 w-1 rounded-[1px] bg-indigo-600' },
  { x: 3.5, y: -5.5, r: -200, delay: 0.03, className: 'size-1.5 rounded-full bg-violet-500' },
  { x: 4.5, y: -7, r: 340, delay: 0.06, className: 'h-1 w-2.5 rounded-[1px] bg-indigo-400' },
  { x: 6.5, y: -4.5, r: -280, delay: 0.01, className: 'h-2.5 w-1 rounded-[1px] bg-violet-400' },
  { x: 7.5, y: -3, r: 200, delay: 0.09, className: 'size-1.5 rounded-full bg-indigo-300' },
  { x: -5, y: -2.5, r: -300, delay: 0.12, className: 'size-1.5 rounded-full bg-violet-300' },
  { x: 3, y: -3.5, r: 240, delay: 0.12, className: 'h-1 w-2.5 rounded-[1px] bg-indigo-500' },
  { x: -0.5, y: -4, r: -220, delay: 0.14, className: 'size-1.5 rounded-full bg-violet-600' },
  { x: 8, y: -5.5, r: 280, delay: 0.07, className: 'h-1 w-2.5 rounded-[1px] bg-indigo-500' },
  { x: -8, y: -5, r: -260, delay: 0.11, className: 'h-2.5 w-1 rounded-[1px] bg-violet-500' }
];

// Confeti de una celebración: sale de detrás del aviso (queda debajo de él) y dura unos 2 s. Solo decora: oculto a los
// lectores de pantalla, no recibe el puntero y, con «menos movimiento», no se ve (index.css)
export const CelebrationBurst: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed bottom-[calc(10.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 size-0 md:right-44 md:bottom-11 md:left-auto"
  >
    {PIECES.map(({ x, y, r, delay, className }, i) => (
      <span
        key={i}
        className={`celebration-piece ${className}`}
        style={
          {
            '--piece-x': `${x}rem`,
            '--piece-y': `${y}rem`,
            '--piece-r': `${r}deg`,
            '--piece-delay': `${delay}s`
          } as React.CSSProperties
        }
      />
    ))}
  </div>
);
