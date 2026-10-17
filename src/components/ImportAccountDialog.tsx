import React, { useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import { IMPORT_LABELS, IMPORT_ORDER, type ImportPlan } from '../services/importData';

interface ImportAccountDialogProps {
  plan: ImportPlan;
  onImport: (onProgress: (done: number, total: number) => void) => Promise<void>;
  onClose: () => void;
  // Se abre desde el menú de la cuenta, que ya no existe al cerrarse: adónde vuelve el foco
  returnFocusTo?: () => HTMLElement | null;
}

const formatExportedAt = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

// Vista previa de la importación de «Descargar mis datos (JSON)»: qué entra, qué ya está y qué no es válido. Mientras
// importa no se puede cerrar (lo escrito se quedaría a medias sin aviso).
export const ImportAccountDialog: React.FC<ImportAccountDialogProps> = ({ plan, onImport, onClose, returnFocusTo }) => {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importing = progress !== null && error === null;
  // Falló una importación ya empezada (no un aviso antes de empezar, que deja volver a intentarlo)
  const failed = progress !== null && error !== null;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalFocus(
    true,
    dialogRef,
    () => {
      if (!importing) onClose();
    },
    returnFocusTo
  );

  const rows = IMPORT_ORDER.filter((name) => {
    const { new: fresh, existing, invalid } = plan.counts[name];
    return fresh + existing + invalid > 0;
  });
  const hasWork = plan.total > 0 || plan.addedAreas.length > 0;
  const importLabel =
    plan.total > 0
      ? `Importar ${plan.total} ${plan.total === 1 ? 'elemento' : 'elementos'}`
      : plan.addedAreas.length === 1
        ? 'Añadir el área'
        : 'Añadir las áreas';

  // Sin conexión, las escrituras esperan a que vuelva y el avance se pararía sin decir nada: se explica y se puede
  // cerrar (lo ya enviado se guarda al volver la conexión)
  useEffect(() => {
    if (!importing) return;
    const onOffline = () => {
      setError(
        'Se perdió la conexión. Lo que ya se envió se guardará al volver; después, importa otra vez el archivo para completar el resto: lo que ya entró no se repite.'
      );
      requestAnimationFrame(() => closeRef.current?.focus());
    };
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, [importing]);

  const handleImport = async () => {
    if (importing) return;
    if (!navigator.onLine) {
      setError('Sin conexión no se puede importar. Vuelve a intentarlo cuando tengas conexión.');
      return;
    }
    setError(null);
    setProgress({ done: 0, total: plan.total });
    try {
      await onImport((done, total) => setProgress({ done, total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar.');
      // El botón de importar ya no está: el foco pasa a «Cerrar»
      requestAnimationFrame(() => closeRef.current?.focus());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-account-title"
        aria-describedby="import-account-summary"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <h2 id="import-account-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Upload className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            Importar datos
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <p id="import-account-summary" className="text-xs leading-relaxed text-slate-600">
            {plan.exportedAt ? `Descarga del ${formatExportedAt(plan.exportedAt)}. ` : ''}
            Lo que ya está en tu cuenta no se toca y lo que no es válido se descarta: importar dos veces el mismo
            archivo no duplica nada.
          </p>

          {rows.length > 0 ? (
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Qué hay en el archivo</caption>
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-600">
                  <th scope="col" className="py-1.5 pr-2 font-semibold">
                    Tipo
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                    Nuevos
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                    Ya en tu cuenta
                  </th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-semibold">
                    No válidos
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((name) => {
                  const { new: fresh, existing, invalid } = plan.counts[name];
                  return (
                    <tr key={name} className="border-b border-slate-100 text-slate-800">
                      <th scope="row" className="py-1.5 pr-2 font-medium">
                        {IMPORT_LABELS[name]}
                      </th>
                      <td className="px-2 py-1.5 text-right font-bold">{fresh}</td>
                      <td className="px-2 py-1.5 text-right">{existing}</td>
                      <td className={`py-1.5 pl-2 text-right ${invalid ? 'font-semibold text-red-700' : ''}`}>
                        {invalid}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-slate-600">El archivo no tiene tareas, metas ni otros datos.</p>
          )}

          {plan.addedAreas.length > 0 && (
            <p className="text-xs text-slate-700">
              Se añaden a tu Rueda {plan.addedAreas.length === 1 ? 'el área' : 'las áreas'}{' '}
              {plan.addedAreas.map((a) => `«${a.label}»${a.hidden ? ' (oculta)' : ''}`).join(', ')}.
            </p>
          )}
          {!hasWork && rows.length > 0 && (
            <p className="text-xs font-medium text-slate-700">Ya tienes en tu cuenta todo lo de este archivo.</p>
          )}

          {progress && !error && (
            <div className="space-y-1">
              <p role="status" className="text-xs font-medium text-slate-700">
                Importando… {progress.done} de {progress.total}
              </p>
              <progress
                value={progress.done}
                max={Math.max(progress.total, 1)}
                aria-label="Avance de la importación"
                className="h-2 w-full overflow-hidden rounded-full accent-indigo-600"
              />
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={importing}
              data-autofocus={!hasWork || error ? true : undefined}
              className="min-h-11 rounded-xl px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              {failed || !hasWork ? 'Cerrar' : 'Cancelar'}
            </button>
            {hasWork && !failed && (
              <button
                type="button"
                onClick={handleImport}
                // Sin `disabled`, para que no pierda el foco mientras importa
                aria-disabled={importing}
                data-autofocus
                className="min-h-11 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 aria-disabled:opacity-60"
              >
                {importing ? 'Importando…' : importLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
