import React, { useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import type { ReleaseNote } from '../services/releaseNotes';

// Los cambios de una versión, en la ventana de novedades y en la Ayuda
export const ReleaseChanges: React.FC<{ release: ReleaseNote }> = ({ release }) => (
  <ul className="space-y-3">
    {release.changes.map((change) => (
      <li key={change.title} className="space-y-0.5">
        <p className="text-sm font-bold text-slate-900">{change.title}</p>
        <p className="text-sm leading-relaxed text-slate-600">{change.text}</p>
      </li>
    ))}
  </ul>
);

interface ReleaseNotesDialogProps {
  release: ReleaseNote;
  onClose: () => void;
}

// Novedades de la versión: se abren solas una vez al entrar después de una actualización, y al pulsar la versión
export const ReleaseNotesDialog: React.FC<ReleaseNotesDialogProps> = ({ release, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, dialogRef, onClose);
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notes-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <h2 id="release-notes-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            Novedades de la versión {release.version}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-xs text-slate-500">Publicada en {release.month}.</p>
          <ReleaseChanges release={release} />
          <p className="text-xs text-slate-600">Las novedades de cada versión están también en la Ayuda.</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
