import { MonthlyMode, Recurrence, RecurrenceFrequency, TaskItem } from '../types';
import { toLocalDate } from './tasks';

// Fechas locales (YYYY-MM-DD) sin hora: la hora de la tarea se conserva aparte
const pad = (n: number) => String(n).padStart(2, '0');
export const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

// N.º día de la semana del mes (1 = primero). Del 29 en adelante siempre es el 5.º, que no existe todos los meses.
export const nthOfMonth = (d: Date) => Math.ceil(d.getDate() / 7);
export const isLastWeekdayOfMonth = (d: Date) => d.getDate() + 7 > daysInMonth(d.getFullYear(), d.getMonth());

const nthWeekdayOf = (year: number, month: number, weekday: number, nth: number) => {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (nth - 1) * 7);
};

const lastWeekdayOf = (year: number, month: number, weekday: number) => {
  const last = new Date(year, month, daysInMonth(year, month));
  return addDays(last, -((last.getDay() - weekday + 7) % 7));
};

// Lunes de la semana de una fecha (las semanas empiezan en lunes)
const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

// Siguiente fecha después de `from` según la regla (sin comprobar `until` ni el día de hoy)
const stepAfter = (from: Date, rec: Recurrence): Date => {
  const n = Math.max(1, Math.floor(rec.interval || 1));
  switch (rec.frequency) {
    case 'DAILY':
      return addDays(from, n);
    case 'WEEKLY': {
      const days = [...new Set(rec.weekdays?.length ? rec.weekdays : [from.getDay()])];
      const order = (wd: number) => (wd + 6) % 7; // lunes = 0 … domingo = 6
      const laterThisWeek = days.filter((wd) => order(wd) > order(from.getDay())).sort((a, b) => order(a) - order(b));
      if (laterThisWeek.length) return addDays(weekStart(from), order(laterThisWeek[0]));
      const firstDay = Math.min(...days.map(order));
      return addDays(weekStart(from), 7 * n + firstDay);
    }
    case 'MONTHLY': {
      const target = new Date(from.getFullYear(), from.getMonth() + n, 1);
      const [y, m] = [target.getFullYear(), target.getMonth()];
      const mode: MonthlyMode = rec.monthlyMode ?? 'DAY_OF_MONTH';
      if (mode === 'NTH_WEEKDAY') return nthWeekdayOf(y, m, rec.weekday ?? from.getDay(), rec.nth ?? nthOfMonth(from));
      if (mode === 'LAST_WEEKDAY') return lastWeekdayOf(y, m, rec.weekday ?? from.getDay());
      return new Date(y, m, Math.min(rec.monthDay ?? from.getDate(), daysInMonth(y, m)));
    }
    case 'YEARLY': {
      const y = from.getFullYear() + n;
      return new Date(y, from.getMonth(), Math.min(rec.monthDay ?? from.getDate(), daysInMonth(y, from.getMonth())));
    }
  }
};

// Próxima fecha de la tarea tras `dueDate`. Si se completa con retraso, salta hasta la primera fecha que no haya
// pasado (no se crean repeticiones ya vencidas). Devuelve null si supera `until`.
export const nextOccurrence = (dueDate: string, rec: Recurrence, today = new Date()): string | null => {
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = stepAfter(toLocalDate(dueDate), rec);
  for (let guard = 0; next < todayDate && guard < 10_000; guard++) next = stepAfter(next, rec);
  if (rec.until && toDateString(next) > rec.until) return null;
  return toDateString(next);
};

// Próximas N fechas a partir de `dueDate` incluida (para la agenda), dentro de `until`
export const upcomingOccurrences = (dueDate: string, rec: Recurrence, count: number): string[] => {
  const dates = [dueDate];
  let current = toLocalDate(dueDate);
  while (dates.length < count) {
    current = stepAfter(current, rec);
    const value = toDateString(current);
    if (rec.until && value > rec.until) break;
    dates.push(value);
  }
  return dates;
};

// Regla con los anclajes tomados de la fecha límite (día del mes, N.º y día de la semana)
export const buildRecurrence = (
  frequency: RecurrenceFrequency,
  dueDate: string,
  options: { interval?: number; weekdays?: number[]; monthlyMode?: MonthlyMode; until?: string } = {}
): Recurrence => {
  const due = toLocalDate(dueDate);
  const base: Recurrence = { frequency, interval: Math.max(1, Math.floor(options.interval ?? 1)) };
  if (options.until) base.until = options.until;
  if (frequency === 'WEEKLY') return { ...base, weekdays: options.weekdays?.length ? [...options.weekdays].sort() : [due.getDay()] };
  if (frequency === 'MONTHLY') {
    const mode = options.monthlyMode ?? 'DAY_OF_MONTH';
    if (mode === 'NTH_WEEKDAY') return { ...base, monthlyMode: mode, nth: Math.min(4, nthOfMonth(due)), weekday: due.getDay() };
    if (mode === 'LAST_WEEKDAY') return { ...base, monthlyMode: mode, weekday: due.getDay() };
    return { ...base, monthlyMode: mode, monthDay: due.getDate() };
  }
  if (frequency === 'YEARLY') return { ...base, monthDay: due.getDate() };
  return base;
};

// Siguiente tarea de la serie: misma tarea con la nueva fecha (y el inicio desplazado igual), pendiente y sin marcar
export const nextRecurringTask = (task: TaskItem, now = new Date()): TaskItem | null => {
  if (!task.recurrence || !task.dueDate) return null;
  const nextDue = nextOccurrence(task.dueDate, task.recurrence, now);
  if (!nextDue) return null;
  const shiftDays = Math.round((toLocalDate(nextDue).getTime() - toLocalDate(task.dueDate).getTime()) / 86_400_000);
  const { doneAt: _doneAt, nextOccurrenceId: _nextOccurrenceId, ...rest } = task;
  return {
    ...rest,
    id: `task-${now.getTime()}`,
    status: 'PENDING',
    dueDate: nextDue,
    ...(task.startDate ? { startDate: toDateString(addDays(toLocalDate(task.startDate), shiftDays)) } : {}),
    observations: task.observations.map((o) => (o.type === 'checklist' ? { ...o, completed: false } : o)),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
};

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const ORDINALS = ['', '1.er', '2.º', '3.er', '4.º'];
const untilFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const dayMonthFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });

const every = (n: number, one: string, many: string) => (n === 1 ? `Cada ${one}` : `Cada ${n} ${many}`);

// Descripción legible, p. ej. "Cada mes, el 2.º lunes"
export const describeRecurrence = (rec: Recurrence, dueDate?: string): string => {
  const n = Math.max(1, rec.interval || 1);
  const due = dueDate ? toLocalDate(dueDate) : undefined;
  let text: string;
  switch (rec.frequency) {
    case 'DAILY':
      text = every(n, 'día', 'días');
      break;
    case 'WEEKLY': {
      const days = (rec.weekdays?.length ? rec.weekdays : due ? [due.getDay()] : [])
        .slice()
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => WEEKDAY_SHORT[d]);
      text = `${every(n, 'semana', 'semanas')}${days.length ? `: ${days.join(', ')}` : ''}`;
      break;
    }
    case 'MONTHLY': {
      const prefix = every(n, 'mes', 'meses');
      const weekday = WEEKDAY_NAMES[rec.weekday ?? due?.getDay() ?? 1];
      if (rec.monthlyMode === 'NTH_WEEKDAY') text = `${prefix}, el ${ORDINALS[rec.nth ?? 1]} ${weekday}`;
      else if (rec.monthlyMode === 'LAST_WEEKDAY') text = `${prefix}, el último ${weekday}`;
      else text = `${prefix}, el día ${rec.monthDay ?? due?.getDate() ?? 1}`;
      break;
    }
    case 'YEARLY':
      text = `${every(n, 'año', 'años')}${due ? `, el ${dayMonthFormat.format(due)}` : ''}`;
      break;
  }
  return rec.until ? `${text} (hasta el ${untilFormat.format(toLocalDate(rec.until))})` : text;
};

// RRULE (RFC 5545) para exportar la serie al calendario
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const toRRule = (rec: Recurrence, allDay: boolean): string => {
  const parts = [`FREQ=${rec.frequency}`, `INTERVAL=${Math.max(1, rec.interval || 1)}`];
  if (rec.frequency === 'WEEKLY' && rec.weekdays?.length) parts.push(`BYDAY=${rec.weekdays.map((d) => RRULE_DAYS[d]).join(',')}`);
  if (rec.frequency === 'MONTHLY') {
    if (rec.monthlyMode === 'NTH_WEEKDAY') parts.push(`BYDAY=${rec.nth ?? 1}${RRULE_DAYS[rec.weekday ?? 1]}`);
    else if (rec.monthlyMode === 'LAST_WEEKDAY') parts.push(`BYDAY=-1${RRULE_DAYS[rec.weekday ?? 1]}`);
    else if (rec.monthDay) parts.push(`BYMONTHDAY=${rec.monthDay}`);
  }
  if (rec.until) parts.push(`UNTIL=${rec.until.replace(/-/g, '')}${allDay ? '' : 'T235959Z'}`);
  return `RRULE:${parts.join(';')}`;
};
