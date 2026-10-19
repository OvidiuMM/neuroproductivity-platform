import { alarmInstant, isTimeZone, zonedInstant } from './alarmLogic';

// EVENTOS DE GOOGLE CALENDAR a partir de las tareas, para la función extra «Sincronizar con Google Calendar»: las
// mismas reglas que «Añadir al calendario» de la app (src/services/calendar.ts), pero en la zona horaria de la cuenta
// y con el formato de la API de Google Calendar. tests/unit/calendarSync.test.ts compara los dos.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTE_MS = 60_000;
const DEADLINE_EVENT_MS = 30 * MINUTE_MS;
// Con hora de inicio y sin hora límite, el evento dura una hora
const DEFAULT_EVENT_MS = 60 * MINUTE_MS;
// Google admite recordatorios de 0 a 4 semanas antes del inicio
const MAX_REMINDER_MINUTES = 40_320;
// Topes de lo que se envía (la descripción de un evento de Google admite unos 8 KB)
const SUMMARY_MAX = 1_000;
const DESCRIPTION_MAX = 8_000;

export const CALENDAR_SUMMARY = 'CLAR';
// Página a la que vuelve Google con el código (public/oauth/google.html)
export const OAUTH_CALLBACK_PATH = '/oauth/google.html';

// La tarea tal como está en Firestore: sin fiarse de su forma
export interface SyncTask {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  completed?: unknown;
  isSomeday?: unknown;
  startDate?: unknown;
  startTime?: unknown;
  dueDate?: unknown;
  dueTime?: unknown;
  recurrence?: unknown;
  observations?: unknown;
  alarmTime?: unknown;
}

type EventTime = { date: string } | { dateTime: string; timeZone: string };

export interface CalendarEventBody {
  summary: string;
  description: string;
  start: EventTime;
  end: EventTime;
  recurrence?: string[];
  reminders: { useDefault: false; overrides: { method: 'popup'; minutes: number }[] };
  status: 'confirmed';
  source: { title: string; url: string };
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const day = (value: unknown) => (typeof value === 'string' && DAY.test(value) ? value : undefined);
const time = (value: unknown) => (typeof value === 'string' && TIME.test(value) ? value : undefined);
const cap = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

// Id del evento: el de la tarea en hexadecimal (Google solo admite a-v y 0-9, de 5 a 1024 caracteres). Siempre el
// mismo para la misma tarea: así reintentar o volver a conectar no duplica nada. null si el id es demasiado largo.
export const eventIdFor = (taskId: string) => {
  const id = `clar${Buffer.from(taskId, 'utf8').toString('hex')}`;
  return id.length <= 1024 ? id : null;
};

// Las notas de la tarea, una por línea; las de lista, con su casilla (como en la app)
const notesText = (observations: unknown) => {
  if (!Array.isArray(observations)) return '';
  const lines = observations
    .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === 'object')
    .filter((o) => text(o.text).trim() || text(o.url))
    .map((o) => {
      const box = o.type === 'checklist' ? (o.completed === true ? '[x] ' : '[ ] ') : '';
      const url = text(o.url);
      const link = url && url !== text(o.text) ? ` (${url})` : '';
      return `- ${box}${text(o.text).trim()}${link}`;
    });
  return lines.length ? `Notas:\n${lines.join('\n')}` : '';
};

const parseDay = (date: string) => date.split('-').map(Number) as [number, number, number];
const nextDay = (date: string) => {
  const [y, m, d] = parseDay(date);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};
// «16 oct 2026», como formatDay de la app
const formatDay = (date: string) => {
  const [y, m, d] = parseDay(date);
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    Date.UTC(y, m - 1, d)
  );
};

// RRULE (RFC 5545) de la serie, como toRRule de la app (src/services/recurrence.ts). null si la repetición no vale
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const weekdayOf = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6 ? (value as number) : undefined;
const lastDayFallback = (monthDay: number) =>
  `BYMONTHDAY=${Array.from({ length: monthDay - 27 }, (_, i) => 28 + i).join(',')};BYSETPOS=-1`;

export const recurrenceRule = (value: unknown, allDay: boolean, anchorDate: string, timeZone: string) => {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.frequency !== 'string' || !FREQUENCIES.includes(rec.frequency)) return null;
  const interval = Number.isInteger(rec.interval) ? Math.max(1, rec.interval as number) : 1;
  const parts = [`FREQ=${rec.frequency}`, `INTERVAL=${interval}`];
  if (rec.frequency === 'WEEKLY') {
    // La semana empieza en lunes, como en la app
    parts.push('WKST=MO');
    const days = (Array.isArray(rec.weekdays) ? rec.weekdays : [])
      .map(weekdayOf)
      .filter((d): d is number => d !== undefined)
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    if (days.length) parts.push(`BYDAY=${days.map((d) => RRULE_DAYS[d]).join(',')}`);
  }
  if (rec.frequency === 'MONTHLY') {
    const nth =
      Number.isInteger(rec.nth) && (rec.nth as number) >= 1 && (rec.nth as number) <= 4 ? (rec.nth as number) : 1;
    const weekday = RRULE_DAYS[weekdayOf(rec.weekday) ?? 1];
    const monthDay =
      Number.isInteger(rec.monthDay) && (rec.monthDay as number) >= 1 && (rec.monthDay as number) <= 31
        ? (rec.monthDay as number)
        : undefined;
    if (rec.monthlyMode === 'NTH_WEEKDAY') parts.push(`BYDAY=${nth}${weekday}`);
    else if (rec.monthlyMode === 'LAST_WEEKDAY') parts.push(`BYDAY=-1${weekday}`);
    else if (monthDay) parts.push(monthDay > 28 ? lastDayFallback(monthDay) : `BYMONTHDAY=${monthDay}`);
  }
  if (rec.frequency === 'YEARLY' && rec.monthDay === 29 && parseDay(anchorDate)[1] === 2) {
    parts.push(`BYMONTH=2;${lastDayFallback(29)}`);
  }
  const until = day(rec.until);
  if (until) {
    // Con hora: el final del día local de `until`, en UTC
    const stamp = allDay
      ? until.replace(/-/g, '')
      : new Date(zonedInstant(until, '23:59', timeZone, 'later') + 59_000)
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '');
    parts.push(`UNTIL=${stamp}`);
  }
  return `RRULE:${parts.join(';')}`;
};

const isDone = (task: SyncTask) => task.status === 'DONE' || (task.status === undefined && task.completed === true);

// El evento de una tarea, o null si no va al calendario: sin fecha límite o en «Algún día». Las hechas y las canceladas
// se quedan, con «✓» o «✕» delante. Una serie la lleva la tarea pendiente: al completarla, la app crea la siguiente
// repetición (que continúa la serie) y la hecha queda como un evento suelto.
export const buildTaskEvent = (task: SyncTask, timeZone: string, appUrl: string): CalendarEventBody | null => {
  const dueDate = day(task.dueDate);
  if (!dueDate || task.isSomeday === true || !isTimeZone(timeZone)) return null;
  const closed = isDone(task) ? '✓ ' : task.status === 'CANCELLED' ? '✕ ' : '';
  const dueTime = time(task.dueTime);
  const repeats = Boolean(task.recurrence) && !closed;
  // Una tarea repetida no es un intervalo: cada repetición ocupa su día, de la hora de inicio a la límite
  const startTime = time(task.startTime);
  const startDate = task.recurrence ? (startTime ? dueDate : undefined) : day(task.startDate);
  const allDay = !startTime && !dueTime;
  const oneHour = Boolean(startTime && !dueTime);
  const deadlineNote = oneHour && (startDate ?? dueDate) !== dueDate ? `Fecha límite: ${formatDay(dueDate)}` : '';
  const description = [text(task.description), notesText(task.observations), deadlineNote, `Tarea de CLAR: ${appUrl}`]
    .filter(Boolean)
    .join('\n\n');
  const rule = repeats ? recurrenceRule(task.recurrence, allDay, dueDate, timeZone) : null;

  // Inicio y final, como en la app: las horas locales se pasan a instantes en la zona de la cuenta
  const at = (date: string, clock: string) => zonedInstant(date, clock, timeZone, 'later');
  const span: { start: number; end: number } | { startDate: string; endDate: string } = allDay
    ? { startDate: startDate && startDate < dueDate ? startDate : dueDate, endDate: nextDay(dueDate) }
    : oneHour
      ? { start: at(startDate ?? dueDate, startTime!), end: at(startDate ?? dueDate, startTime!) + DEFAULT_EVENT_MS }
      : !startDate
        ? { start: at(dueDate, dueTime!), end: at(dueDate, dueTime!) + DEADLINE_EVENT_MS }
        : { start: at(startDate, startTime ?? '00:00'), end: at(dueDate, dueTime!) };
  // Un inicio después del plazo (datos incoherentes) haría que Google rechazara el evento: se queda en el plazo
  if ('start' in span && span.end <= span.start) span.start = span.end - DEADLINE_EVENT_MS;

  // La alarma, como recordatorio: Google lo cuenta desde el inicio del evento (si cae después, no se pone)
  const alarm = alarmInstant({ ...task, recurrence: task.recurrence }, timeZone);
  const startInstant = 'start' in span ? span.start : at(span.startDate, '00:00');
  const minutes = alarm === null ? null : Math.round((startInstant - alarm) / MINUTE_MS);
  const reminders =
    minutes !== null && minutes >= 0 && minutes <= MAX_REMINDER_MINUTES ? [{ method: 'popup' as const, minutes }] : [];

  const iso = (instant: number) => new Date(instant).toISOString();
  return {
    summary: cap(`${closed}${text(task.title)}`, SUMMARY_MAX),
    description: cap(description, DESCRIPTION_MAX),
    ...('start' in span
      ? { start: { dateTime: iso(span.start), timeZone }, end: { dateTime: iso(span.end), timeZone } }
      : { start: { date: span.startDate }, end: { date: span.endDate } }),
    ...(rule ? { recurrence: [rule] } : {}),
    reminders: { useDefault: false, overrides: reminders },
    status: 'confirmed',
    source: { title: CALENDAR_SUMMARY, url: appUrl }
  };
};

// Para comparar dos eventos (p. ej. la tarea antes y después de un cambio que no afecta al calendario)
export const sameEvent = (a: CalendarEventBody | null, b: CalendarEventBody | null) =>
  JSON.stringify(a) === JSON.stringify(b);

// Lo que envía la app al conectar: el código de Google, su verificador PKCE, la dirección a la que volvió Google (una de
// las de la app) y la zona horaria del dispositivo. null si algo no vale
export const parseConnectRequest = (data: unknown, allowedOrigins: string[]) => {
  const { code, codeVerifier, redirectUri, timeZone } = (data ?? {}) as Record<string, unknown>;
  if (typeof code !== 'string' || !code || code.length > 2048) return null;
  if (typeof codeVerifier !== 'string' || !/^[\w.~-]{43,128}$/.test(codeVerifier)) return null;
  if (typeof redirectUri !== 'string' || !allowedOrigins.some((o) => redirectUri === `${o}${OAUTH_CALLBACK_PATH}`))
    return null;
  if (!isTimeZone(timeZone)) return null;
  return { code, codeVerifier, redirectUri, timeZone };
};
