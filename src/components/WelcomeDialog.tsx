import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, CalendarDays, Compass, ListChecks, Target } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import type { OnboardingOutcome } from '../services/onboarding';
import { BRAND_NAME, BrandMark } from './BrandMark';

interface WelcomeDialogProps {
  // completed: llegó al final · skipped: la cerró antes (con «Saltar» o Escape)
  onFinish: (outcome: OnboardingOutcome) => void;
}

// El método de un vistazo: de lo que te importa (áreas) a lo que haces hoy (Top 10 y Agenda)
const MODEL = [
  { icon: Compass, title: 'Áreas de vida', text: 'Tu Rueda: salud, trabajo, finanzas, familia…' },
  { icon: Target, title: 'Metas', text: 'Lo que quieres conseguir en cada área.' },
  { icon: ListChecks, title: 'Tareas', text: 'Acciones físicas concretas, en Profesional o Personal.' },
  { icon: CalendarDays, title: 'Top 10 y Agenda', text: 'Qué hacer hoy y cuándo.' }
];

const ROUTINE = [
  { title: 'Evalúa tu Rueda', text: 'Puntúa cada área del 0 al 10. Te lleva dos minutos.' },
  {
    title: 'Convierte una meta en acciones',
    text: 'Elige el área que más quieres mejorar, ponle una meta y apunta la primera acción física: «Llamar…», «Enviar…».'
  },
  {
    title: 'Protege tu tiempo',
    text: 'Cada día, el Top 10 te dice qué toca. El Blindaje Bermudas protege tus mañanas de reuniones y correos.'
  }
];

const STEPS = ['Por qué', 'El método', 'Cómo empezar'];

// Bienvenida de la primera vez, en tres pantallas. Se puede saltar en cualquier momento.
export const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isLast = step === STEPS.length - 1;
  useModalFocus(true, dialogRef, () => onFinish('skipped'));

  // Al cambiar de pantalla, el foco va a su título: el lector de pantalla la lee desde el principio
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const headings = [`Te damos la bienvenida a ${BRAND_NAME}`, 'Así funciona', 'Tu rutina en tres pasos'];

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-step"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="space-y-5 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <BrandMark size={36} />
            <p id="welcome-step" className="text-xs font-semibold text-slate-600">
              Paso {step + 1} de {STEPS.length}: {STEPS[step]}
            </p>
          </div>

          <h2
            id="welcome-title"
            ref={headingRef}
            tabIndex={-1}
            data-autofocus
            className="text-xl font-extrabold text-slate-900 focus:outline-none"
          >
            {headings[step]}
          </h2>

          {step === 0 && (
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <p>
                {BRAND_NAME} te ayuda a decidir <strong>qué hacer ahora</strong>, en línea con lo que de verdad te
                importa.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Sacas las tareas de tu cabeza y las conviertes en acciones claras.</li>
                <li>Cada día ves solo lo importante: tu Top 10.</li>
                <li>Cuidas todas las áreas de tu vida, no solo el trabajo.</li>
              </ul>
            </div>
          )}

          {step === 1 && (
            // Diagrama del modelo: una lista ordenada, legible también con lector de pantalla
            <ol aria-label="De tus áreas de vida a lo que haces hoy" className="space-y-1">
              {MODEL.map(({ icon: Icon, title, text }, index) => (
                <li key={title}>
                  <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{title}</p>
                      <p className="text-xs text-slate-600">{text}</p>
                    </div>
                  </div>
                  {index < MODEL.length - 1 && (
                    <ArrowDown className="mx-auto my-0.5 h-4 w-4 text-indigo-400" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          )}

          {step === 2 && (
            <ol className="space-y-3">
              {ROUTINE.map(({ title, text }, index) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{title}</p>
                    <p className="text-xs leading-relaxed text-slate-600">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
            {STEPS.map((name, index) => (
              <span
                key={name}
                className={`h-1.5 rounded-full transition-all ${index === step ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-300'}`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => onFinish('skipped')}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Saltar
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Atrás
                </button>
              )}
              <button
                type="button"
                onClick={() => (isLast ? onFinish('completed') : setStep((s) => s + 1))}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800"
              >
                {isLast ? 'Empezar el recorrido' : 'Siguiente'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
