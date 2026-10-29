import React, { useRef, useState } from 'react';
import { Accessibility, RotateCcw, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import { DEFAULT_A11Y_PREFS, loadA11yPrefs, saveA11yPrefs, type A11yPrefs, type TextSize } from '../services/a11yPrefs';

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Dónde devolver el foco si el elemento que abrió el panel ya no existe
  returnFocusTo?: () => HTMLElement | null;
}

const TEXT_SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: 'normal', label: 'Normal', sample: 'text-sm' },
  { value: 'large', label: 'Grande', sample: 'text-base' },
  { value: 'xlarge', label: 'Muy grande', sample: 'text-lg' }
];

const SWITCHES: {
  key: 'highContrast' | 'reduceMotion' | 'strongFocus' | 'celebrations';
  label: string;
  hint: string;
}[] = [
  { key: 'highContrast', label: 'Alto contraste', hint: 'Textos y bordes más oscuros, y enlaces subrayados.' },
  {
    key: 'reduceMotion',
    label: 'Reducir animaciones',
    hint: 'Quita transiciones y animaciones. Se aplica también si tu sistema lo pide.'
  },
  {
    key: 'strongFocus',
    label: 'Foco muy visible',
    hint: 'Contorno grueso alrededor del elemento activo al usar el teclado.'
  },
  {
    key: 'celebrations',
    label: 'Celebraciones',
    hint: 'Un mensaje y una breve animación al hacer una tarea antigua, lograr una meta o terminar un proyecto.'
  }
];

// Panel de accesibilidad: los cambios se aplican al momento y se guardan en este dispositivo
export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({ isOpen, onClose, returnFocusTo }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<A11yPrefs>(loadA11yPrefs);
  useModalFocus(isOpen, dialogRef, onClose, returnFocusTo);

  if (!isOpen) return null;

  const update = (next: A11yPrefs) => {
    setPrefs(next);
    saveA11yPrefs(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a11y-panel-title"
        className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <h2 id="a11y-panel-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Accessibility className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            Accesibilidad
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold tracking-wider text-slate-700 uppercase">Tamaño del texto</legend>
            <div className="grid grid-cols-3 gap-2">
              {TEXT_SIZES.map(({ value, label, sample }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                    prefs.textSize === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="a11y-text-size"
                    value={value}
                    checked={prefs.textSize === value}
                    onChange={() => update({ ...prefs, textSize: value })}
                    className="sr-only"
                  />
                  <span className={`${sample} leading-none font-bold`} aria-hidden="true">
                    Aa
                  </span>
                  <span className="text-xs font-semibold">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <ul className="space-y-3">
            {SWITCHES.map(({ key, label, hint }) => (
              <li key={key} className="flex items-start justify-between gap-4">
                <div>
                  <label htmlFor={`a11y-${key}`} className="block text-sm font-semibold text-slate-900">
                    {label}
                  </label>
                  <p id={`a11y-${key}-hint`} className="text-xs text-slate-600">
                    {hint}
                  </p>
                </div>
                <button
                  id={`a11y-${key}`}
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  aria-describedby={`a11y-${key}-hint`}
                  onClick={() => update({ ...prefs, [key]: !prefs[key] })}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border-2 ${
                    prefs[key] ? 'border-indigo-600 bg-indigo-600' : 'border-slate-500 bg-slate-200'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      prefs[key] ? 'left-0.5 translate-x-5' : 'left-0.5 translate-x-0 border border-slate-500'
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-600">Se guarda en este dispositivo.</p>
            <button
              type="button"
              onClick={() => update(DEFAULT_A11Y_PREFS)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restablecer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Pantallas sin la app (inicio de sesión y solicitud de acceso): con el panel abierto, el resto de la pantalla
// queda inerte, como con las ventanas de la app. `children` recibe la función que abre el panel.
export const AccessibleScreen: React.FC<{ children: (openPanel: () => void) => React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <div className="contents" inert={isOpen}>
        {children(() => setIsOpen(true))}
      </div>
      <AccessibilityPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export const AccessibilityTrigger: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
  >
    <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
    Accesibilidad
  </button>
);
