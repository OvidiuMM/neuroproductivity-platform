import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { TaskItem } from '../types';
import { buildCalendarEvent, buildIcs, googleCalendarUrl, outlookCalendarUrl } from '../services/calendar';

interface AddToCalendarMenuProps {
  task: TaskItem;
}

const downloadIcs = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revocar en el mismo instante cancela la descarga en algunos navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

// Añadir la tarea a Google Calendar, Outlook o cualquier calendario (.ics) sin conectar cuentas
export const AddToCalendarMenu: React.FC<AddToCalendarMenuProps> = ({ task }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const event = buildCalendarEvent(task, window.location.origin);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  if (!event) {
    return (
      <button
        type="button"
        disabled
        className="p-1.5 text-slate-300 rounded-lg cursor-not-allowed"
        title="Pon una fecha límite para añadir la tarea al calendario"
        aria-label="Añadir al calendario (necesita fecha límite)"
      >
        <CalendarPlus className="w-4 h-4" />
      </button>
    );
  }

  const linkClass = 'block w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
        title="Añadir al calendario"
        aria-label="Añadir al calendario"
        aria-expanded={isOpen}
      >
        <CalendarPlus className="w-4 h-4" />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden"
        >
          <a role="menuitem" className={linkClass} href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)}>
            Google Calendar
          </a>
          <a role="menuitem" className={linkClass} href={outlookCalendarUrl(event, 'personal')} target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)}>
            Outlook.com (cuenta personal)
          </a>
          <a role="menuitem" className={linkClass} href={outlookCalendarUrl(event, 'work')} target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)}>
            Outlook / Microsoft 365 (trabajo)
          </a>
          <button
            type="button"
            role="menuitem"
            className={linkClass}
            onClick={() => {
              downloadIcs(`${task.title.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '-') || 'tarea'}.ics`, buildIcs(event));
              setIsOpen(false);
            }}
          >
            Descargar .ics (Apple y otros)
          </button>
        </div>
      )}
    </div>
  );
};
