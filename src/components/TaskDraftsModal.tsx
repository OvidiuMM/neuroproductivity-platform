import React, { useRef } from 'react';
import { FilePen, Trash2, X } from 'lucide-react';
import { TaskDraft } from '../types';
import { useModalFocus } from '../hooks/useModalFocus';

interface TaskDraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: TaskDraft[];
  onContinue: (draft: TaskDraft) => void;
  onDelete: (draft: TaskDraft) => void;
}

const savedFormat = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

// BORRADORES: las tareas nuevas que se cerraron sin guardar, de la más reciente a la más antigua. «Continuar» abre el
// formulario como estaba; al guardarla como tarea, el borrador desaparece
export const TaskDraftsModal: React.FC<TaskDraftsModalProps> = ({ isOpen, onClose, drafts, onContinue, onDelete }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, dialogRef, onClose);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drafts-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <h2 id="task-drafts-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FilePen className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            Borradores de tareas ({drafts.length})
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-xs leading-relaxed text-slate-600">
            Una tarea nueva que cierras sin guardar se queda aquí, tal como estaba. Sigue con ella cuando quieras: al
            guardarla, pasa a tu lista.
          </p>
          {drafts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No tienes borradores.
            </p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((draft) => {
                const title = draft.form.title.trim() || 'Sin título';
                return (
                  <li
                    key={draft.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold wrap-anywhere ${draft.form.title.trim() ? 'text-slate-900' : 'text-slate-500 italic'}`}
                      >
                        {title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {draft.form.listContext === 'WORK' ? 'Profesional' : 'Personal'} · Guardado el{' '}
                        {savedFormat.format(new Date(draft.updatedAt))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onContinue(draft)}
                      aria-label={`Continuar «${title}»`}
                      className="min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      Continuar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(draft)}
                      aria-label={`Eliminar el borrador «${title}»`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
