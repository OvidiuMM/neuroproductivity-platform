import { toDateString } from './recurrence';
import { toLocalDate } from './tasks';

// Días de la semana empezando en lunes (`day` sigue a Date.getDay(): 0 = domingo)
export const WEEKDAYS_MONDAY_FIRST = [
  { day: 1, short: 'L', name: 'lunes' },
  { day: 2, short: 'M', name: 'martes' },
  { day: 3, short: 'X', name: 'miércoles' },
  { day: 4, short: 'J', name: 'jueves' },
  { day: 5, short: 'V', name: 'viernes' },
  { day: 6, short: 'S', name: 'sábado' },
  { day: 0, short: 'D', name: 'domingo' }
] as const;

export const DATE_INPUT_PLACEHOLDER = 'dd/mm/aaaa';

// YYYY-MM-DD → dd/mm/aaaa
export const formatDateInput = (date: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

const validDate = (year: number, month: number, day: number): string | null => {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? toDateString(date) : null;
};

// Texto escrito → YYYY-MM-DD. Acepta dd/mm/aaaa (también con guiones, puntos o espacios, día y mes de una
// cifra y año de dos), ddmmaaaa y el formato ISO. Devuelve '' si está vacío y null si no es una fecha real.
export const parseDateInput = (text: string): string | null => {
  const value = text.trim();
  if (!value) return '';
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[/.\-\s]+(\d{1,2})[/.\-\s]+(\d{2}|\d{4})$/.exec(value);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return validDate(year, Number(match[2]), Number(match[1]));
  }
  match = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
  return null;
};

export const addDaysTo = (date: string, days: number) => {
  const d = toLocalDate(date);
  return toDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

// Suma meses manteniendo el día; si no existe en el mes de destino usa el último (31 ene + 1 mes = 28 feb)
export const addMonthsTo = (date: string, months: number) => {
  const d = toLocalDate(date);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + months + 1, 0).getDate();
  return toDateString(new Date(d.getFullYear(), d.getMonth() + months, Math.min(d.getDate(), lastDay)));
};

// Lunes y domingo de la semana de `date`
export const weekBoundsOf = (date: string) => {
  const monday = addDaysTo(date, -((toLocalDate(date).getDay() + 6) % 7));
  return { monday, sunday: addDaysTo(monday, 6) };
};

// Semanas del mes de `date`, de lunes a domingo. Los huecos de los meses vecinos son null.
export const monthGrid = (date: string): (string | null)[][] => {
  const d = toLocalDate(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateString(new Date(year, month, i + 1)))
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
};
