import React, { useRef, useState } from 'react';
import { Accessibility, RotateCcw, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import {
  DEFAULT_A11Y_PREFS,
  loadA11yPrefs,
  saveA11yPrefs,
  type A11yPrefs,
  type TextSize
} from '../services/a11yPrefs';

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TEXT_SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: 'normal', label: 'Normal', sample: 'text-sm' },
  { value: 'large', label: 'Grande', sample: 'text-base' },
  { value: 'xlarge', label: 'Muy grande', sample: 'text-lg' }
];

const SWITCHES: { key: 'highContrast' | 'reduceMotion' | 'strongFocus'; label: string; hint: string }[] = [
  { key: 'highContrast', label: 'Alto contraste', hint: 'Textos y bordes más oscuros, y enlaces subrayados.' },
  {
    key: 'reduceMotion',
    label: 'Reducir animaciones',
    hint: 'Quita transiciones y animaciones. Se aplica también si tu sistema lo pide.'
  },
  { key: 'strongFocus', label: 'Foco muy visible', hint: 'Contorno grueso alrededor del elemento activo al usar el teclado.' }
];

// Panel de accesibilidad: los cambios se aplican al momento y se guardan en este dispositivo
export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<A11yPrefs>(loadA11yPrefs);
  useModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const update = (next: A11yPrefs) => {
    setPrefs(next);
    saveA11yPrefs(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center p-4 sm:p-8 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a11y-panel-title"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md my-auto overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <h2 id="a11y-panel-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Accessibility className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            Accesibilidad
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-700">Tamaño del texto</legend>
            <div className="grid grid-cols-3 gap-2">
              {TEXT_SIZES.map(({ value, label, sample }) => (
                <label
                  key={value}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                    prefs.textSize === value ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
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
                  <span className={`${sample} font-bold leading-none`} aria-hidden="true">
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
                  className={`relative shrink-0 mt-0.5 w-11 h-6 rounded-full border-2 ${
                    prefs[key] ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-200 border-slate-500'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      prefs[key] ? 'translate-x-5 left-0.5' : 'translate-x-0 left-0.5 border border-slate-500'
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-600">Se guarda en este dispositivo.</p>
            <button
              type="button"
              onClick={() => update(DEFAULT_A11Y_PREFS)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restablecer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Botón con su propio panel, para las pantallas sin la app (inicio de sesión y solicitud de acceso)
export const AccessibilityButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline ${className}`}
      >
        <Accessibility className="w-3.5 h-3.5" aria-hidden="true" />
        Accesibilidad
      </button>
      <AccessibilityPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
