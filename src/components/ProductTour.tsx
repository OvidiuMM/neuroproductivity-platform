import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';

export interface TourStep {
  id: string;
  // Selector del elemento que se resalta. Si hay varios (p. ej. un botón en la cabecera y otro en la barra del
  // móvil), se usa el primero visible; si no hay ninguno visible, el paso se salta.
  target: string;
  title: string;
  body: string;
}

interface ProductTourProps {
  steps: TourStep[];
  // completed: llegó al final · skipped: lo cerró antes
  onFinish: (outcome: 'completed' | 'skipped') => void;
}

const HOLE_PADDING = 6;
const GAP = 12;
const MARGIN = 8;

// Primer elemento visible (con tamaño) que coincide con el selector
const findVisible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) => {
    const { width, height } = el.getBoundingClientRect();
    return width > 0 && height > 0;
  }) ?? null;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Recorrido guiado propio: oscurece la pantalla dejando un hueco sobre el elemento de cada paso y explica qué es en
// un globo. Teclado: flechas para avanzar o volver, Escape para salir; el foco se queda en el globo.
export const ProductTour: React.FC<ProductTourProps> = ({ steps, onFinish }) => {
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);
  const direction = useRef<1 | -1>(1);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const maskId = useId();
  const titleId = useId();
  const bodyId = useId();
  const step = steps[index];
  const isLast = index === steps.length - 1;

  useModalFocus(true, bubbleRef, () => onFinish('skipped'));

  const go = useCallback(
    (delta: 1 | -1) => {
      direction.current = delta;
      if (delta === 1 && index === steps.length - 1) onFinish('completed');
      else setIndex((i) => Math.min(Math.max(i + delta, 0), steps.length - 1));
    },
    [index, steps.length, onFinish]
  );

  // Hueco sobre el elemento del paso; si no está a la vista se salta, en la dirección en que se iba
  const measure = useCallback(() => {
    const target = findVisible(step.target);
    if (!target) {
      setHole(null);
      return false;
    }
    const r = target.getBoundingClientRect();
    const next = {
      top: r.top - HOLE_PADDING,
      left: r.left - HOLE_PADDING,
      width: r.width + 2 * HOLE_PADDING,
      height: r.height + 2 * HOLE_PADDING
    };
    // Solo si ha cambiado: se mide en cada fotograma
    setHole((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next
    );
    return true;
  }, [step.target]);

  useLayoutEffect(() => {
    const target = findVisible(step.target);
    if (!target) {
      const next = index + direction.current;
      if (next < 0 || next >= steps.length) onFinish('completed');
      else setIndex(next);
      return;
    }
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    measure();
    headingRef.current?.focus();
  }, [index, step.target, steps.length, measure, onFinish]);

  // El hueco sigue al elemento aunque se mueva por cualquier motivo (desplazamiento, cambio de tamaño, contenido
  // que llega después): se mide en cada fotograma mientras dure el recorrido
  useEffect(() => {
    let frame = requestAnimationFrame(function follow() {
      measure();
      frame = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frame);
  }, [measure]);

  // Tamaño de la ventana: si cambia (p. ej. solo de alto), el globo se recoloca aunque el elemento no se mueva
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Globo debajo del elemento si cabe; si no, encima; y siempre dentro de la pantalla
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!hole || !el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const below = hole.top + hole.height + GAP;
    const above = hole.top - GAP - h;
    const top =
      below + h <= viewport.height - MARGIN
        ? below
        : above >= MARGIN
          ? above
          : Math.max(MARGIN, viewport.height - h - MARGIN);
    const left = Math.min(
      Math.max(hole.left + hole.width / 2 - w / 2, MARGIN),
      Math.max(MARGIN, viewport.width - w - MARGIN)
    );
    setBubble({ top, left });
  }, [hole, index, viewport]);

  // Flechas: siguiente y anterior (Escape ya lo atiende useModalFocus)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft' && index > 0) go(-1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [go, index]);

  return (
    <div className="fixed inset-0 z-[70]">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {hole && <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(15 23 42 / 0.65)" mask={`url(#${maskId})`} />
      </svg>
      {hole && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-4 ring-indigo-400 motion-safe:transition-all motion-safe:duration-200"
          style={hole}
          data-tour-hole
        />
      )}

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="absolute w-[min(22rem,calc(100vw-1rem))] space-y-3 rounded-2xl bg-white p-4 shadow-2xl motion-safe:transition-[top,left] motion-safe:duration-200"
        // Hasta saber dónde va, transparente (no oculto: así el foco ya puede entrar)
        style={bubble ?? { top: MARGIN, left: MARGIN, opacity: 0 }}
      >
        <p className="text-[11px] font-semibold text-slate-600">
          Recorrido guiado · Paso {index + 1} de {steps.length}
        </p>
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          data-autofocus
          className="text-base font-bold text-slate-900 focus:outline-none"
        >
          {step.title}
        </h2>
        <p id={bodyId} className="text-sm leading-relaxed text-slate-700">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => onFinish('skipped')}
            className="min-h-11 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Salir del recorrido
          </button>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Paso anterior"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => go(1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
            >
              {isLast ? 'Terminar' : 'Siguiente'}
              {!isLast && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
