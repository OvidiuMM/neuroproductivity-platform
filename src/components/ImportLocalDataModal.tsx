import React, { useState } from 'react';
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
export const ImportLocalDataModal: React.FC<ImportLocalDataModalProps> = ({ profiles, onImport, onDiscard, onLater }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-label="Importar datos de este navegador"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600" />
            Importar datos de este navegador
          </h2>
          <button
            onClick={onLater}
            aria-label="Decidir más tarde"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Este navegador tiene datos de la versión anterior, que los guardaba solo aquí. Elige qué perfiles quieres pasar a tu cuenta. Al importar se borran todos los datos locales de este navegador, también los de los perfiles que no marques.
          </p>

          <div className="space-y-2">
            {profiles.map((p) => (
              <label
                key={p.id}
                className="p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 flex items-start gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300"
                />
                <span>
                  <span className="block text-xs font-bold text-slate-900">{p.name}</span>
                  <span className="block text-[11px] text-slate-500">{describeCounts(p.counts)}</span>
                </span>
              </label>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isImporting}
              className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-60"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={onLater}
              disabled={isImporting}
              className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-60"
            >
              Más tarde
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting || selected.size === 0}
              className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl shadow-xs"
            >
              {isImporting ? 'Importando…' : 'Importar a mi cuenta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
