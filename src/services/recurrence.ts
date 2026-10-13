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

// Primera fecha de la serie el día `from` o después, con la regla anclada en `from` (inicio de la repetición).
// Devuelve null si cae después de `until`.
export const firstOccurrence = (from: string, rec: Recurrence): string | null => {
  const start = toLocalDate(from);
  const startMatches = rec.frequency !== 'WEEKLY' || !rec.weekdays?.length || rec.weekdays.includes(start.getDay());
  const first = toDateString(startMatches ? start : stepAfter(start, rec));
  return rec.until && first > rec.until ? null : first;
};

// Momento en que vence una fecha de la serie: a la hora límite o, sin hora, al final del día
const deadlineOf = (d: Date, dueTime?: string) => {
  if (!dueTime) return addDays(d, 1);
  const [hh, mm] = dueTime.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
};

// Próxima fecha de la tarea tras `dueDate`. Si se completa con retraso, salta hasta la primera fecha que no haya
// vencido, teniendo en cuenta la hora límite (no se crean repeticiones ya vencidas). Devuelve null si supera `until`.
export const nextOccurrence = (dueDate: string, rec: Recurrence, now = new Date(), dueTime?: string): string | null => {
  let next = stepAfter(toLocalDate(dueDate), rec);
  for (let guard = 0; deadlineOf(next, dueTime) <= now && guard < 10_000; guard++) next = stepAfter(next, rec);
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

// Repeticiones posteriores a `dueDate` entre `from` y `to` (incluidos) y dentro de `until`, para la agenda.
// Se calculan hasta `to` sea cual sea la distancia a la fecha original (con un límite de seguridad de pasos).
export const occurrencesBetween = (dueDate: string, rec: Recurrence, from: string, to: string): string[] => {
  const dates: string[] = [];
  let current = toLocalDate(dueDate);
  for (let guard = 0; guard < 50_000; guard++) {
    current = stepAfter(current, rec);
    const value = toDateString(current);
    if (value > to || (rec.until && value > rec.until)) break;
    if (value >= from) dates.push(value);
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

// Hash cyrb53 (53 bits): identificador estable sin depender del reloj ni de un generador aleatorio
const cyrb53 = (text: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

// Id de la siguiente repetición: depende solo de la tarea, no de la fecha calculada. Si dos pestañas o
// dispositivos la marcan a la vez (aunque calculen fechas distintas, p. ej. a ambos lados de la hora límite),
// escriben el mismo documento en lugar de crear dos repeticiones.
export const successorId = (taskId: string) => `task-r${cyrb53(taskId).toString(36)}`;

// Siguiente tarea de la serie: misma tarea con la nueva fecha (y el inicio desplazado igual), pendiente y sin marcar
export const nextRecurringTask = (task: TaskItem, now = new Date()): TaskItem | null => {
  if (!task.recurrence || !task.dueDate) return null;
  const nextDue = nextOccurrence(task.dueDate, task.recurrence, now, task.dueTime);
  if (!nextDue) return null;
  // Cada repetición vence su propio día: sin fecha de inicio (las tareas de antes de 0.8 podían tenerla)
  const { doneAt: _doneAt, nextOccurrenceId: _nextOccurrenceId, startDate: _startDate, ...rest } = task;
  return {
    ...rest,
    id: successorId(task.id),
    status: 'PENDING',
    dueDate: nextDue,
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

// Días 29–31: la app usa el último día de los meses más cortos; en RRULE eso es «el último de los días 28…N»
const lastDayFallback = (monthDay: number) =>
  `BYMONTHDAY=${Array.from({ length: monthDay - 27 }, (_, i) => 28 + i).join(',')};BYSETPOS=-1`;

// UNTIL con hora: fin del día local de `until`, en UTC (23:59:59 UTC dejaría fuera horas tardías al oeste de UTC)
const untilStamp = (until: string, allDay: boolean) => {
  if (allDay) return until.replace(/-/g, '');
  const [y, m, d] = until.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

// `anchorDate` (la fecha límite) da el mes de las repeticiones anuales: el 29 de febrero pasa al 28 en años no bisiestos
export const toRRule = (rec: Recurrence, allDay: boolean, anchorDate?: string): string => {
  const parts = [`FREQ=${rec.frequency}`, `INTERVAL=${Math.max(1, rec.interval || 1)}`];
  if (rec.frequency === 'WEEKLY') {
    // La semana empieza en lunes, como en la app: decide qué días caen en cada semana cuando el intervalo es > 1
    parts.push('WKST=MO');
    const days = [...(rec.weekdays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    if (days.length) parts.push(`BYDAY=${days.map((d) => RRULE_DAYS[d]).join(',')}`);
  }
  if (rec.frequency === 'MONTHLY') {
    if (rec.monthlyMode === 'NTH_WEEKDAY') parts.push(`BYDAY=${rec.nth ?? 1}${RRULE_DAYS[rec.weekday ?? 1]}`);
    else if (rec.monthlyMode === 'LAST_WEEKDAY') parts.push(`BYDAY=-1${RRULE_DAYS[rec.weekday ?? 1]}`);
    else if (rec.monthDay) parts.push(rec.monthDay > 28 ? lastDayFallback(rec.monthDay) : `BYMONTHDAY=${rec.monthDay}`);
  }
  if (rec.frequency === 'YEARLY' && rec.monthDay === 29 && anchorDate && toLocalDate(anchorDate).getMonth() === 1) {
    parts.push(`BYMONTH=2;${lastDayFallback(29)}`);
  }
  if (rec.until) parts.push(`UNTIL=${untilStamp(rec.until, allDay)}`);
  return `RRULE:${parts.join(';')}`;
};
