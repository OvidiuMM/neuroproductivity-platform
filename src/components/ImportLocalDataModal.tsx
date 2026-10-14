import React, { useRef, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { LocalProfileSummary } from '../services/localData';
import { Upload, X } from 'lucide-react';

interface ImportLocalDataModalProps {
  profiles: LocalProfileSummary[];
  onImport: (profileIds: string[]) => Promise<void>;
  onDiscard: () => void;
  onLater: () => void;
}

const describeCounts = ({ tasks, wheelLogs, meetings, emails }: LocalProfileSummary['counts']) =>
  [
    tasks && `${tasks} ${tasks === 1 ? 'tarea' : 'tareas'}`,
    wheelLogs && `${wheelLogs} ${wheelLogs === 1 ? 'evaluación' : 'evaluaciones'}`,
    meetings && `${meetings} ${meetings === 1 ? 'reunión' : 'reuniones'}`,
    emails && `${emails} ${emails === 1 ? 'correo' : 'correos'}`
  ]
    .filter(Boolean)
    .join(', ');

// Primer inicio de sesión en un navegador con datos de la versión sin cuentas: ofrece subirlos a la cuenta
export const ImportLocalDataModal: React.FC<ImportLocalDataModalProps> = ({
  profiles,
  onImport,
  onDiscard,
  onLater
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Solo se monta cuando hay datos que importar; Escape equivale a «Más tarde»
  useModalFocus(true, dialogRef, onLater);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(profiles.map((p) => p.id)));
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    try {
      await onImport([...selected]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron importar los datos.');
      setIsImporting(false);
    }
  };

  const handleDiscard = () => {
    if (window.confirm('Se borrarán de este navegador los datos que no hayas importado. ¿Continuar?')) {
      onDiscard();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Importar datos de este navegador"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Upload className="h-4 w-4 text-indigo-600" />
            Importar datos de este navegador
          </h2>
          <button
            onClick={onLater}
            aria-label="Decidir más tarde"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-xs leading-relaxed text-slate-600">
            Este navegador tiene datos de la versión anterior, que los guardaba solo aquí. Elige qué perfiles quieres
            pasar a tu cuenta. Al importar se borran todos los datos locales de este navegador, también los de los
            perfiles que no marques.
          </p>

          <div className="space-y-2">
            {profiles.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span>
                  <span className="block text-xs font-bold text-slate-900">{p.name}</span>
                  <span className="block text-[11px] text-slate-500">{describeCounts(p.counts)}</span>
                </span>
              </label>
            ))}
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isImporting}
              className="rounded-xl px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={onLater}
              disabled={isImporting}
              className="rounded-xl px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              Más tarde
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting || selected.size === 0}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-60"
            >
              {isImporting ? 'Importando…' : 'Importar a mi cuenta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
