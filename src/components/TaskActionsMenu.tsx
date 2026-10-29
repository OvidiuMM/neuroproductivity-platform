import React, { useEffect, useId, useRef, useState } from 'react';
import { FileDown, MoreHorizontal, Trash2 } from 'lucide-react';
import { TaskItem, TaskStatus } from '../types';
import { buildCalendarEvent, buildIcs, googleCalendarUrl, outlookCalendarUrl } from '../services/calendar';
import { TaskStatusSelect } from './TaskStatusSelect';
import { downloadFile, fileSlug } from '../services/download';
import { messages } from '../i18n/locale';

const m = messages(
  {
    actionsFor: (title: string) => `Acciones de «${title}»`,
    actions: 'Acciones',
    status: 'Estado',
    addToCalendar: 'Añadir al calendario',
    outlookPersonal: 'Outlook.com (cuenta personal)',
    outlookWork: 'Outlook / Microsoft 365 (trabajo)',
    downloadIcs: 'Descargar .ics (Apple y otros)',
    needsDueDate: 'Pon una fecha límite para añadirla al calendario.',
    downloadJsonFor: (title: string) => `Descargar «${title}» (JSON)`,
    downloadJson: 'Descargar (JSON)',
    deleteTask: (title: string) => `Eliminar «${title}»`,
    delete: 'Eliminar',
    // Si el título no deja nombre de archivo
    fileFallback: 'tarea'
  },
  {
    actionsFor: (title) => `Actions for “${title}”`,
    actions: 'Actions',
    status: 'Status',
    addToCalendar: 'Add to calendar',
    outlookPersonal: 'Outlook.com (personal account)',
    outlookWork: 'Outlook / Microsoft 365 (work)',
    downloadIcs: 'Download .ics (Apple and others)',
    needsDueDate: 'Set a due date to add it to your calendar.',
    downloadJsonFor: (title) => `Download “${title}” (JSON)`,
    downloadJson: 'Download (JSON)',
    deleteTask: (title) => `Delete “${title}”`,
    delete: 'Delete',
    fileFallback: 'task'
  }
);

interface TaskActionsMenuProps {
  task: TaskItem;
  onChangeStatus: (status: TaskStatus) => void;
  onDelete: () => void;
  // Espera a otra tarea que sigue abierta
  blocked?: boolean;
  // Descarga la tarea con todos sus datos en JSON
  onDownload?: () => void;
}

// Alto aproximado del panel: si no cabe debajo del botón (p. ej. sobre la barra inferior del móvil), se abre arriba
const PANEL_HEIGHT = 340;

const itemClass =
  'flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50';
const linkClass = 'flex min-h-10 w-full items-center px-3 text-left text-xs text-slate-700 hover:bg-slate-50';

// Acciones de una tarea en un solo botón «⋯»: cambiar el estado, añadir al calendario, descargar y eliminar (editar
// tiene su propio botón en la tarjeta).
// Es un panel desplegable (no un menú ARIA): se recorre con Tab y se cierra con Escape o tocando fuera.
export const TaskActionsMenu: React.FC<TaskActionsMenuProps> = ({
  task,
  onChangeStatus,
  onDelete,
  blocked = false,
  onDownload
}) => {
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
        aria-label={m.actionsFor(task.title)}
        title={m.actions}
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
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600" aria-hidden="true">
              {m.status}
            </span>
            <TaskStatusSelect
              status={task.status}
              taskTitle={task.title}
              blocked={blocked}
              onChange={(status) => act(() => onChangeStatus(status))()}
            />
          </div>

          <div className="border-t border-slate-100 py-1">
            <p id={calendarId} className="px-3 pt-1 pb-0.5 text-[11px] font-semibold text-slate-500">
              {m.addToCalendar}
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
                    {m.outlookPersonal}
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
                    {m.outlookWork}
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className={linkClass}
                    onClick={act(() =>
                      downloadFile(
                        `${fileSlug(task.title, m.fileFallback)}.ics`,
                        buildIcs(event),
                        'text/calendar;charset=utf-8'
                      )
                    )}
                  >
                    {m.downloadIcs}
                  </button>
                </li>
              </ul>
            ) : (
              <p className="px-3 pb-1 text-xs text-slate-600">{m.needsDueDate}</p>
            )}
          </div>

          {onDownload && (
            <button
              type="button"
              onClick={act(onDownload)}
              aria-label={m.downloadJsonFor(task.title)}
              className={`${itemClass} border-t border-slate-100`}
            >
              <FileDown className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              {m.downloadJson}
            </button>
          )}

          <button
            type="button"
            onClick={act(onDelete)}
            aria-label={m.deleteTask(task.title)}
            className={`${itemClass} border-t border-slate-100 text-red-700 hover:bg-red-50`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {m.delete}
          </button>
        </div>
      )}
    </div>
  );
};
