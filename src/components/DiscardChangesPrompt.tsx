import React, { useEffect, useRef } from 'react';

// Pregunta antes de cerrar un formulario con cambios sin guardar. Va dentro de la ventana del formulario (que queda
// inerte detrás): el foco empieza en «Seguir editando», la opción que no pierde nada, y al seguir editando vuelve
// adonde estaba.
export const DiscardChangesPrompt: React.FC<{
  text: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}> = ({ text, onKeepEditing, onDiscard }) => {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    keepRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-changes-title"
        aria-describedby="discard-changes-text"
        className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <h3 id="discard-changes-title" className="text-sm font-bold text-slate-900">
          ¿Descartar los cambios?
        </h3>
        <p id="discard-changes-text" className="text-xs leading-relaxed text-slate-700">
          {text}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            ref={keepRef}
            type="button"
            onClick={onKeepEditing}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Seguir editando
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-bold text-white hover:bg-red-800"
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  );
};
