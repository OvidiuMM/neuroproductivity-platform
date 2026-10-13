import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDaysTo,
  addMonthsTo,
  DATE_INPUT_PLACEHOLDER,
  formatDateInput,
  monthGrid,
  parseDateInput,
  weekBoundsOf,
  WEEKDAYS_MONDAY_FIRST
} from '../services/dateInput';
import { toDateString } from '../services/recurrence';
import { toLocalDate } from '../services/tasks';

interface DateFieldProps {
  // Nombre del campo: nombre accesible del texto (salvo que haya un <label htmlFor={id}> visible) y del calendario
  label: string;
  value: string; // YYYY-MM-DD o ''
  onChange: (value: string) => void;
  id?: string;
  hasVisibleLabel?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

const POPOVER_WIDTH = 288;
const VIEWPORT_MARGIN = 8;
const INVALID_MESSAGE = `Escribe la fecha como ${DATE_INPUT_PLACEHOLDER}`;
const REQUIRED_MESSAGE = 'Elige una fecha';
const monthFormat = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const fullDayFormat = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const GRID_KEYS: Record<string, (date: string, shift: boolean) => string> = {
  ArrowLeft: (d) => addDaysTo(d, -1),
  ArrowRight: (d) => addDaysTo(d, 1),
  ArrowUp: (d) => addDaysTo(d, -7),
  ArrowDown: (d) => addDaysTo(d, 7),
  Home: (d) => weekBoundsOf(d).monday,
  End: (d) => weekBoundsOf(d).sunday,
  PageUp: (d, shift) => addMonthsTo(d, shift ? -12 : -1),
  PageDown: (d, shift) => addMonthsTo(d, shift ? 12 : 1)
};

// Campo de fecha con calendario propio: la semana empieza siempre en lunes y la fecha se escribe dd/mm/aaaa,
// sea cual sea el idioma del navegador (el selector nativo de <input type="date"> no lo permite).
export const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  id,
  hasVisibleLabel = false,
  required = false,
  className = '',
  inputClassName = ''
}) => {
  const generatedId = useId();
  const inputId = id ?? `date-${generatedId}`;
  const dialogId = `${inputId}-calendar`;
  const titleId = `${inputId}-calendar-title`;

  const [text, setText] = useState(() => formatDateInput(value));
  const [open, setOpen] = useState(false);
  const [focusDate, setFocusDate] = useState(value || toDateString(new Date()));
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusGrid = useRef(false);

  const parsed = parseDateInput(text);
  const missing = required && parsed === '';
  const invalid = parsed === null || missing;

  // Cambios desde fuera (sugerencia del analizador, «Hoy», otra tarea): se muestran sin pisar lo que se escribe
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    setText((current) => (parseDateInput(current) === value ? current : formatDateInput(value)));
  }

  // Una fecha imposible (o que falta, si es obligatoria) bloquea el envío del formulario con un mensaje del navegador
  useEffect(() => {
    inputRef.current?.setCustomValidity(parsed === null ? INVALID_MESSAGE : missing ? REQUIRED_MESSAGE : '');
  }, [parsed, missing]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const select = (date: string) => {
    onChange(date);
    setText(formatDateInput(date));
    close(true);
  };

  const toggle = () => {
    if (open) return close(false);
    setFocusDate(value || toDateString(new Date()));
    focusGrid.current = true;
    setOpen(true);
  };

  // Debajo del campo si cabe; si no, encima. Siempre dentro de la ventana.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const field = fieldRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!field || !popover) return;
      const { innerWidth: vw, innerHeight: vh } = window;
      const height = popover.offsetHeight;
      const width = popover.offsetWidth;
      const below = field.bottom + 4;
      const above = field.top - 4 - height;
      const top =
        below + height <= vh - VIEWPORT_MARGIN || above < VIEWPORT_MARGIN
          ? Math.max(VIEWPORT_MARGIN, Math.min(below, vh - height - VIEWPORT_MARGIN))
          : above;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(field.left, vw - width - VIEWPORT_MARGIN));
      setPosition({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Un clic fuera del calendario lo cierra
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Al moverse con el teclado, el foco sigue al día activo
  useEffect(() => {
    if (!open || !focusGrid.current) return;
    focusGrid.current = false;
    popoverRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${focusDate}"]`)?.focus();
  }, [open, focusDate]);

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const move = GRID_KEYS[e.key];
    if (!move) return;
    e.preventDefault();
    focusGrid.current = true;
    setFocusDate((current) => move(current, e.shiftKey));
  };

  // Escape cierra y Tab no sale del calendario; no se propagan para que la ventana de la tarea no reaccione
  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== 'Tab') return;
    e.stopPropagation();
    const items = [...(popoverRef.current?.querySelectorAll<HTMLElement>('button:not([tabindex="-1"])') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = (index + (e.shiftKey ? -1 : 1) + items.length) % items.length;
    e.preventDefault();
    items[next]?.focus();
  };

  const today = toDateString(new Date());
  const weeks = monthGrid(focusDate);

  return (
    <div ref={fieldRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        autoComplete="off"
        placeholder={DATE_INPUT_PLACEHOLDER}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = parseDateInput(e.target.value);
          if (next !== null) onChange(next);
        }}
        onBlur={() => parsed && setText(formatDateInput(parsed))}
        aria-label={hasVisibleLabel ? undefined : label}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        className={`w-full pr-8 ${invalid ? 'border-red-400 bg-red-50/40' : ''} ${inputClassName}`}
      />
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={`Calendario: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          // El calendario gestiona su propio teclado (flechas, Inicio/Fin, Escape)
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            ref={popoverRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={onDialogKeyDown}
            style={{
              top: position.top,
              left: position.left,
              width: Math.min(POPOVER_WIDTH, window.innerWidth - 2 * VIEWPORT_MARGIN)
            }}
            className="fixed z-60 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setFocusDate((d) => addMonthsTo(d, -1))}
                aria-label="Mes anterior"
                className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <h2 id={titleId} aria-live="polite" className="text-sm font-bold text-slate-900 first-letter:uppercase">
                <span className="sr-only">{label}: </span>
                {monthFormat.format(toLocalDate(focusDate))}
              </h2>
              <button
                type="button"
                onClick={() => setFocusDate((d) => addMonthsTo(d, 1))}
                aria-label="Mes siguiente"
                className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <table
              role="grid"
              aria-labelledby={titleId}
              onKeyDown={onGridKeyDown}
              className="w-full table-fixed border-collapse"
            >
              <thead>
                <tr>
                  {WEEKDAYS_MONDAY_FIRST.map(({ short, name }) => (
                    <th key={name} scope="col" className="pb-1 text-[11px] font-bold text-slate-500">
                      <abbr title={name} className="no-underline">
                        {short}
                      </abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week.find(Boolean)}>
                    {week.map((date, i) =>
                      date ? (
                        <td key={date} aria-selected={date === value} className="p-0.5 text-center">
                          <button
                            type="button"
                            data-date={date}
                            tabIndex={date === focusDate ? 0 : -1}
                            onClick={() => select(date)}
                            aria-label={fullDayFormat.format(toLocalDate(date))}
                            aria-current={date === today ? 'date' : undefined}
                            className={`aspect-square w-full rounded-lg text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                              date === value
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : date === today
                                  ? 'border border-indigo-400 text-indigo-700 hover:bg-indigo-50'
                                  : 'text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            {toLocalDate(date).getDate()}
                          </button>
                        </td>
                      ) : (
                        <td key={`empty-${i}`} />
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => select(today)}
                className="rounded-lg px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => select('')}
                className="rounded-lg px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Borrar
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
