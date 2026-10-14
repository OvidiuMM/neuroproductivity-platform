import React, { useRef, useState } from 'react';
import { Archive, Search, Trash2, X } from 'lucide-react';
import { TaskItem, TaskStatus } from '../types';
import { useModalFocus } from '../hooks/useModalFocus';
import { TaskStatusSelect } from './TaskStatusSelect';
import { TaskDates } from './TaskDates';

interface ArchivedTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskItem[]; // solo las tareas archivadas (estado Hecha)
  onChangeStatus: (task: TaskItem, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
}

const doneFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// Tareas hechas de las dos listas; cambiar el estado las devuelve a su lista
export const ArchivedTasksModal: React.FC<ArchivedTasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onChangeStatus,
  onDeleteTask
}) => {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const normalized = query.trim().toLowerCase();
  const visible = [...tasks]
    .sort((a, b) => (b.doneAt ?? b.updatedAt).localeCompare(a.doneAt ?? a.updatedAt))
    .filter((t) => !normalized || `${t.title} ${t.description}`.toLowerCase().includes(normalized));

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tareas archivadas"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Archive className="h-4 w-4 text-indigo-600" />
            Tareas archivadas ({tasks.length})
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
          <p className="text-xs text-slate-600">
            Las tareas marcadas como <strong>Hecha</strong> se guardan aquí. Cambia su estado para devolverlas a su
            lista.
          </p>

          <label className="relative block">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en las tareas archivadas…"
              aria-label="Buscar en las tareas archivadas"
              data-autofocus
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </label>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              {tasks.length === 0
                ? 'Todavía no hay tareas archivadas.'
                : 'Ninguna tarea archivada coincide con la búsqueda.'}
            </p>
          ) : (
            <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {visible.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block text-xs font-bold break-words text-slate-900">{task.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{task.listContext === 'WORK' ? 'Profesional' : 'Personal'}</span>
                      {task.doneAt && <span>· Hecha el {doneFormat.format(new Date(task.doneAt))}</span>}
                      <TaskDates task={task} />
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <TaskStatusSelect
                      status={task.status}
                      taskTitle={task.title}
                      onChange={(s) => onChangeStatus(task, s)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar definitivamente «${task.title}»?`)) onDeleteTask(task.id);
                      }}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                      title="Eliminar tarea"
                      aria-label={`Eliminar «${task.title}»`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
