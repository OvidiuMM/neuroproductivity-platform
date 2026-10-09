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
export const ArchivedTasksModal: React.FC<ArchivedTasksModalProps> = ({ isOpen, onClose, tasks, onChangeStatus, onDeleteTask }) => {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const normalized = query.trim().toLowerCase();
  const visible = [...tasks]
    .sort((a, b) => (b.doneAt ?? b.updatedAt).localeCompare(a.doneAt ?? a.updatedAt))
    .filter((t) => !normalized || `${t.title} ${t.description}`.toLowerCase().includes(normalized));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tareas archivadas"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Archive className="w-4 h-4 text-indigo-600" />
            Tareas archivadas ({tasks.length})
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Las tareas marcadas como <strong>Hecha</strong> se guardan aquí. Cambia su estado para devolverlas a su lista.
          </p>

          <label className="relative block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en las tareas archivadas…"
              aria-label="Buscar en las tareas archivadas"
              data-autofocus
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </label>

          {visible.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              {tasks.length === 0 ? 'Todavía no hay tareas archivadas.' : 'Ninguna tarea archivada coincide con la búsqueda.'}
            </p>
          ) : (
            <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {visible.map((task) => (
                <li key={task.id} className="p-3 rounded-2xl border border-slate-200 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block text-xs font-bold text-slate-900 break-words">{task.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{task.listContext === 'WORK' ? 'Profesional' : 'Personal'}</span>
                      {task.doneAt && <span>· Hecha el {doneFormat.format(new Date(task.doneAt))}</span>}
                      <TaskDates task={task} />
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TaskStatusSelect status={task.status} taskTitle={task.title} onChange={(s) => onChangeStatus(task, s)} />
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar definitivamente «${task.title}»?`)) onDeleteTask(task.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                      title="Eliminar tarea"
                      aria-label={`Eliminar «${task.title}»`}
                    >
                      <Trash2 className="w-4 h-4" />
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
