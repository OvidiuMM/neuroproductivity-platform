import React, { useEffect, useId, useRef, useState } from 'react';
import { Edit2, MoreHorizontal, Trash2 } from 'lucide-react';
import { TaskItem, TaskStatus } from '../types';
import { buildCalendarEvent, buildIcs, googleCalendarUrl, outlookCalendarUrl } from '../services/calendar';
import { TaskStatusSelect } from './TaskStatusSelect';

interface TaskActionsMenuProps {
  task: TaskItem;
  onEdit: () => void;
  onChangeStatus: (status: TaskStatus) => void;
  onDelete: () => void;
}

// Alto aproximado del panel: si no cabe debajo del botón (p. ej. sobre la barra inferior del móvil), se abre arriba
const PANEL_HEIGHT = 340;

const downloadIcs = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revocar en el mismo instante cancela la descarga en algunos navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const itemClass =
  'flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50';
const linkClass = 'flex min-h-10 w-full items-center px-3 text-left text-xs text-slate-700 hover:bg-slate-50';

// Acciones de una tarea en un solo botón «⋯»: editar, cambiar el estado, añadir al calendario y eliminar.
// Es un panel desplegable (no un menú ARIA): se recorre con Tab y se cierra con Escape o tocando fuera.
export const TaskActionsMenu: React.FC<TaskActionsMenuProps> = ({ task, onEdit, onChangeStatus, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const calendarId = useId();
  const event = buildCalendarEvent(task, window.location.origin);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const toggle = () => {
    if (!isOpen) {
      const rect = buttonRef.current?.getBoundingClientRect();
      setOpenUp(Boolean(rect && rect.bottom + PANEL_HEIGHT > window.innerHeight && rect.top > PANEL_HEIGHT));
    }
    setIsOpen((open) => !open);
  };

  // Cada acción cierra el panel y deja el foco en «⋯» antes de actuar: si la tarea sigue ahí (cambio de estado) el
  // foco no se pierde, y una ventana que se abra (Editar) lo devolverá a este botón al cerrarse
  const act = (action: () => void) => () => {
    setIsOpen(false);
    buttonRef.current?.focus();
    action();
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`Acciones de «${task.title}»`}
        title="Acciones"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={panelId}
          className={`absolute right-0 z-30 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <button type="button" onClick={act(onEdit)} aria-label={`Editar «${task.title}»`} className={itemClass}>
            <Edit2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Editar
          </button>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600" aria-hidden="true">
              Estado
            </span>
            <TaskStatusSelect
              status={task.status}
              taskTitle={task.title}
              onChange={(status) => act(() => onChangeStatus(status))()}
            />
          </div>

          <div className="border-t border-slate-100 py-1">
            <p id={calendarId} className="px-3 pt-1 pb-0.5 text-[11px] font-semibold text-slate-500">
              Añadir al calendario
            </p>
            {event ? (
              <ul aria-labelledby={calendarId}>
                <li>
                  <a
                    className={linkClass}
                    href={googleCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                  >
                    Google Calendar
                  </a>
                </li>
                <li>
                  <a
                    className={linkClass}
                    href={outlookCalendarUrl(event, 'personal')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                  >
                    Outlook.com (cuenta personal)
                  </a>
                </li>
                <li>
                  <a
                    className={linkClass}
                    href={outlookCalendarUrl(event, 'work')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                  >
                    Outlook / Microsoft 365 (trabajo)
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className={linkClass}
                    onClick={act(() =>
                      downloadIcs(
                        `${task.title.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '-') || 'tarea'}.ics`,
                        buildIcs(event)
                      )
                    )}
                  >
                    Descargar .ics (Apple y otros)
                  </button>
                </li>
              </ul>
            ) : (
              <p className="px-3 pb-1 text-xs text-slate-600">Pon una fecha límite para añadirla al calendario.</p>
            )}
          </div>

          <button
            type="button"
            onClick={act(onDelete)}
            aria-label={`Eliminar «${task.title}»`}
            className={`${itemClass} border-t border-slate-100 text-red-700 hover:bg-red-50`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
};
