import React, { useRef, useState } from 'react';
import { FilePen, Trash2, X } from 'lucide-react';
import { TaskDraft } from '../types';
import { useModalFocus } from '../hooks/useModalFocus';
import { LOCALE_TAG, messages } from '../i18n/locale';

const m = messages(
  {
    title: (count: number) => `Borradores de tareas (${count})`,
    close: 'Cerrar',
    intro:
      'Una tarea nueva que cierras sin guardar se queda aquí, tal como estaba. Sigue con ella cuando quieras: al guardarla, pasa a tu lista.',
    deleted: 'Borrador eliminado.',
    undo: 'Deshacer',
    empty: 'No tienes borradores.',
    // Nombre del borrador en las etiquetas de los botones
    named: (title: string) => `«${title}»`,
    untitledName: (saved: string | null) => `sin título${saved ? ` (${saved})` : ''}`,
    untitled: 'Sin título',
    work: 'Profesional',
    personal: 'Personal',
    savedOn: (saved: string) => ` · Guardado el ${saved}`,
    continue: 'Continuar',
    continueDraft: (name: string) => `Continuar ${name}`,
    deleteDraft: (name: string) => `Eliminar el borrador ${name}`
  },
  {
    title: (count) => `Task drafts (${count})`,
    close: 'Close',
    intro:
      'A new task you close without saving stays here, just as it was. Pick it up whenever you like: once you save it, it moves to your list.',
    deleted: 'Draft deleted.',
    undo: 'Undo',
    empty: "You don't have any drafts.",
    named: (title) => `“${title}”`,
    untitledName: (saved) => `untitled${saved ? ` (${saved})` : ''}`,
    untitled: 'Untitled',
    work: 'Work',
    personal: 'Personal',
    savedOn: (saved) => ` · Saved on ${saved}`,
    continue: 'Continue',
    continueDraft: (name) => `Continue ${name}`,
    deleteDraft: (name) => `Delete the draft ${name}`
  }
);

// Id del botón «Borradores» de Listas: el foco vuelve ahí
export const DRAFTS_BUTTON_ID = 'task-drafts-button';

interface TaskDraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: TaskDraft[];
  onContinue: (draft: TaskDraft) => void;
  onDelete: (draft: TaskDraft) => void;
  // «Deshacer» tras eliminar uno desde la lista
  onRestore: (draft: TaskDraft) => void;
}

const savedFormat = new Intl.DateTimeFormat(LOCALE_TAG, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

// Lo que se muestra de un borrador, sin fiarse de su forma (viene de la base de datos)
const titleOf = (draft: TaskDraft) => {
  const title = typeof draft.form?.title === 'string' ? draft.form.title.trim() : '';
  return title || null;
};
const savedOf = (draft: TaskDraft) => {
  const time = Date.parse(draft.updatedAt);
  return Number.isFinite(time) ? savedFormat.format(time) : null;
};

// BORRADORES: las tareas nuevas que se cerraron sin guardar, de la más reciente a la más antigua. «Continuar» abre el
// formulario como estaba; al guardarla como tarea, el borrador desaparece
export const TaskDraftsModal: React.FC<TaskDraftsModalProps> = ({
  isOpen,
  onClose,
  drafts,
  onContinue,
  onDelete,
  onRestore
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // El último eliminado desde aquí, para «Deshacer» sin salir de la lista
  const [removed, setRemoved] = useState<TaskDraft | null>(null);
  const close = () => {
    setRemoved(null);
    onClose();
  };
  useModalFocus(isOpen, dialogRef, close);
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
            {m.title(drafts.length)}
          </h2>
          <button
            ref={closeRef}
            onClick={close}
            aria-label={m.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-xs leading-relaxed text-slate-600">{m.intro}</p>
          {removed && (
            <p
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"
            >
              {m.deleted}
              <button
                type="button"
                onClick={() => {
                  onRestore(removed);
                  setRemoved(null);
                }}
                className="min-h-9 rounded-lg px-2.5 font-bold text-indigo-700 hover:bg-indigo-50"
              >
                {m.undo}
              </button>
            </p>
          )}
          {drafts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              {m.empty}
            </p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((draft) => {
                const title = titleOf(draft);
                const saved = savedOf(draft);
                // Los sin título se distinguen por cuándo se guardaron
                const name = title ? m.named(title) : m.untitledName(saved);
                return (
                  <li
                    key={draft.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-48 flex-1">
                      <p
                        className={`text-sm font-semibold wrap-anywhere ${title ? 'text-slate-900' : 'text-slate-500 italic'}`}
                      >
                        {title ?? m.untitled}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {draft.form?.listContext === 'PERSONAL' ? m.personal : m.work}
                        {saved && m.savedOn(saved)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onContinue(draft)}
                      aria-label={m.continueDraft(name)}
                      className="min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      {m.continue}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(draft);
                        setRemoved(draft);
                        // La fila desaparece: el foco pasa a la ventana (a su botón de cerrar)
                        closeRef.current?.focus();
                      }}
                      aria-label={m.deleteDraft(name)}
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
