import { TaskItem } from '../types';
import { dueMoment, toLocalDate } from './tasks';
import { toRRule } from './recurrence';

// Evento de calendario a partir de las fechas de una tarea. Se exporta con enlaces "añadir evento"
// de cada proveedor o con un archivo .ics: no hace falta conectar ninguna cuenta.
export interface CalendarEvent {
  uid: string;
  title: string;
  description: string;
  allDay: boolean;
  start: Date; // día completo: medianoche local del primer día
  end: Date; // día completo: medianoche local del día siguiente al último (exclusivo)
  rrule?: string; // tareas recurrentes: la serie completa (Google Calendar y .ics; los enlaces de Outlook no lo admiten)
}

const DEADLINE_EVENT_MS = 30 * 60 * 1000;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const buildCalendarEvent = (source: TaskItem, appUrl: string): CalendarEvent | null => {
  if (!source.dueDate) return null;
  // Una tarea repetida no es un intervalo: cada repetición ocupa su día, de la hora de inicio a la límite.
  // Así el evento empieza el mismo día en que se ancla la regla (las de antes de 0.8 podían tener inicio).
  const dueDate = source.dueDate;
  const task = source.recurrence ? { ...source, startDate: source.startTime ? dueDate : undefined } : source;
  const allDay = !task.startTime && !task.dueTime;
  const description = [task.description, `Tarea de CLAR: ${appUrl}`].filter(Boolean).join('\n\n');
  const base = {
    // Dominio del UID sin cambiar (nombre anterior de la app): así reexportar actualiza el mismo evento
    uid: `${task.id}@neuroproductividad`,
    title: task.title,
    description,
    ...(task.recurrence ? { rrule: toRRule(task.recurrence, allDay, dueDate) } : {})
  };

  // Sin horas: evento de día completo (de varios días si la tarea tiene intervalo)
  if (allDay) {
    return {
      ...base,
      allDay: true,
      start: toLocalDate(task.startDate ?? dueDate),
      end: addDays(toLocalDate(dueDate), 1)
    };
  }

  const due = dueMoment(task)!;
  // Solo plazo con hora: evento corto que empieza a la hora límite
  if (!task.startDate) {
    return { ...base, allDay: false, start: due, end: new Date(due.getTime() + DEADLINE_EVENT_MS) };
  }
  return { ...base, allDay: false, start: toLocalDate(task.startDate, task.startTime), end: due };
};

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const localDayIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Las horas se envían en UTC para que cada calendario las muestre en la zona horaria de la persona
const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const utcIso = (d: Date) => d.toISOString().replace(/\.\d{3}/, '');

export const googleCalendarUrl = (event: CalendarEvent) => {
  const dates = event.allDay
    ? `${localDay(event.start)}/${localDay(event.end)}`
    : `${utcStamp(event.start)}/${utcStamp(event.end)}`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates, details: event.description });
  if (event.rrule) params.set('recur', event.rrule);
  return `https://calendar.google.com/calendar/render?${params}`;
};

// Outlook.com (cuentas personales) y Outlook de Microsoft 365 (trabajo o centro de estudios)
export const outlookCalendarUrl = (event: CalendarEvent, account: 'personal' | 'work') => {
  const host = account === 'personal' ? 'https://outlook.live.com' : 'https://outlook.office.com';
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    body: event.description,
    allday: String(event.allDay),
    startdt: event.allDay ? localDayIso(event.start) : utcIso(event.start),
    enddt: event.allDay ? localDayIso(event.end) : utcIso(event.end)
  });
  return `${host}/calendar/0/action/compose?${params}`;
};

const escapeIcsText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// RFC 5545: líneas de 75 octetos como máximo; las continuaciones empiezan por un espacio
const foldIcsLine = (line: string) => {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
};

export const buildIcs = (event: CalendarEvent, now = new Date()) => {
  const timing = event.allDay
    ? [`DTSTART;VALUE=DATE:${localDay(event.start)}`, `DTEND;VALUE=DATE:${localDay(event.end)}`]
    : [`DTSTART:${utcStamp(event.start)}`, `DTEND:${utcStamp(event.end)}`];
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CLAR//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    ...timing,
    ...(event.rrule ? [event.rrule] : []),
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .map(foldIcsLine)
    .join('\r\n')
    .concat('\r\n');
};
