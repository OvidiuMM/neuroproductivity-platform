import { LANGUAGE_TAG, messages, type Language } from './i18n';

// ALARMAS EN EL SERVIDOR (para avisar con CLAR cerrada): el mismo cálculo que la app (src/services/alarms.ts), pero en
// la zona horaria del dispositivo de la persona en lugar de la del equipo que lo ejecuta. Así el momento coincide al
// milisegundo con el de la app y la notificación lleva la misma etiqueta: si las dos la muestran, se sustituye.

const ALARM_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE_MS = 60_000;

export interface AlarmTask {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  completed?: unknown;
  isSomeday?: unknown;
  dueDate?: unknown;
  dueTime?: unknown;
  alarmTime?: unknown;
  recurrence?: unknown;
  alarmSetAt?: unknown;
}

// Una zona horaria IANA que entiende el entorno (p. ej. «Europe/Madrid»)
export const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

// Diferencia (ms) entre la hora local de la zona y UTC en ese instante
const offsetAt = (instant: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return (
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) -
    Math.floor(instant / 1000) * 1000
  );
};

// El instante de una hora local en la zona, como lo calcula la app. Si la hora existe dos veces (cambio al horario de
// invierno), la primera. Si no existe (salto al de verano), depende:
// - 'earlier' (la alarma, con su corrección): la anterior al salto con el desfase nuevo (las 02:30 que no existen
//   pasan a la 01:30 de antes del salto), para no quedar después del plazo;
// - 'later' (el plazo, como `new Date(y, m, d, h, min)`): con el desfase de antes del salto (pasan a las 03:30).
export const zonedInstant = (date: string, time: string, timeZone: string, gap: 'earlier' | 'later' = 'earlier') => {
  const [y, m, d] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hours, minutes);
  // Los desfases de un día antes y uno después (a ±12 h, las zonas de más de 12 h, como Chatham, quedaban dentro)
  const offsets = [offsetAt(wall - 24 * 60 * MINUTE_MS, timeZone), offsetAt(wall + 24 * 60 * MINUTE_MS, timeZone)];
  const valid = offsets.map((o) => wall - o).filter((instant) => offsetAt(instant, timeZone) === wall - instant);
  if (valid.length) return Math.min(...valid);
  return gap === 'earlier' ? wall - offsets[1] : wall - offsets[0];
};

const previousDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

// Cuándo suena, como en la app (src/services/alarms.ts): el día límite, a su hora (con hora límite, antes de ella),
// también en las tareas que se repiten. Las de antes de 0.9.7 con la alarma a la hora límite o más tarde, la víspera.
export const alarmInstant = (task: AlarmTask, timeZone: string): number | null => {
  const { alarmTime, dueDate, dueTime } = task;
  if (typeof alarmTime !== 'string' || !ALARM_TIME.test(alarmTime)) return null;
  if (typeof dueDate !== 'string' || !DAY.test(dueDate)) return null;
  const hasDueTime = typeof dueTime === 'string' && ALARM_TIME.test(dueTime);
  if (!hasDueTime || alarmTime < dueTime) return zonedInstant(dueDate, alarmTime, timeZone);
  return zonedInstant(previousDay(dueDate), alarmTime, timeZone);
};

// Fin del plazo: a la hora límite o, sin ella, al final del día
export const dueInstant = (task: AlarmTask, timeZone: string): number | null => {
  const { dueDate, dueTime } = task;
  if (typeof dueDate !== 'string' || !DAY.test(dueDate)) return null;
  if (typeof dueTime === 'string' && ALARM_TIME.test(dueTime)) return zonedInstant(dueDate, dueTime, timeZone, 'later');
  return zonedInstant(dueDate, '23:59', timeZone, 'later') + 59_999;
};

const isArchived = (task: AlarmTask) =>
  task.status === 'DONE' || task.status === 'CANCELLED' || (task.status === undefined && task.completed === true);

export interface QueuedAlarm {
  at: number;
  due: number;
  // Igual que en la app: `${id}@${momento ISO}`. Es la etiqueta de la notificación
  key: string;
  // Hora de la alarma (HH:mm, en la zona del dispositivo; igual en los dos idiomas), nombre de la tarea y cuándo vence.
  // La notificación solo lleva el nombre en los dispositivos que lo piden (ver notificationText)
  clock: string;
  taskTitle: string;
  // Lo que hace falta para escribir cuándo vence en el idioma de cada dispositivo (ver alarmBody): la zona en la que se
  // calculó y si el plazo tiene hora
  timeZone: string;
  hasDueTime: boolean;
  // «Vence el …», en el idioma pedido a queuedAlarm
  body: string;
}

const texts = messages(
  {
    withTitle: (clock: string, taskTitle: string) => `Alarma de las ${clock}: ${taskTitle}`,
    withoutTitle: (clock: string) => `Tienes una alarma de CLAR a las ${clock}`,
    due: (day: string) => `Vence el ${day}`,
    dueAt: (day: string, clock: string) => `Vence el ${day} a las ${clock}`,
    test: 'Así te avisará CLAR de tus alarmas, también con la app cerrada.'
  },
  {
    withTitle: (clock, taskTitle) => `Alarm at ${clock}: ${taskTitle}`,
    withoutTitle: (clock) => `You have a CLAR alarm at ${clock}`,
    due: (day) => `Due ${day}`,
    dueAt: (day, clock) => `Due ${day} at ${clock}`,
    test: 'This is how CLAR will notify you of your alarms, even when the app is closed.'
  }
);

// Texto de la notificación: por defecto sin el nombre de la tarea (se ve con el móvil bloqueado y pasa por FCM)
export const notificationText = (
  alarm: Pick<QueuedAlarm, 'clock' | 'taskTitle'>,
  showTitle: boolean,
  language: Language = 'es'
) =>
  showTitle && alarm.taskTitle
    ? texts[language].withTitle(alarm.clock, alarm.taskTitle)
    : texts[language].withoutTitle(alarm.clock);

// El aviso de «Probar notificación»
export const testNotificationBody = (language: Language = 'es') => texts[language].test;

const clock = (instant: number, timeZone: string, language: Language = 'es') =>
  new Intl.DateTimeFormat(LANGUAGE_TAG[language], {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(instant);
const day = (instant: number, timeZone: string, language: Language) =>
  new Intl.DateTimeFormat(LANGUAGE_TAG[language], { timeZone, day: 'numeric', month: 'short' }).format(instant);

// Cuándo vence, en un idioma («Vence el 17 oct a las 11:00»), en la zona en la que se calculó la alarma
export const alarmBody = (alarm: Pick<QueuedAlarm, 'due' | 'timeZone' | 'hasDueTime'>, language: Language = 'es') =>
  alarm.hasDueTime
    ? texts[language].dueAt(day(alarm.due, alarm.timeZone, language), clock(alarm.due, alarm.timeZone, language))
    : texts[language].due(day(alarm.due, alarm.timeZone, language));

// La alarma por avisar de una tarea, o null: sin alarma, archivada, en «Algún día», con el plazo ya vencido o puesta
// (o cambiada) después de su hora: como en la app, no suena. `language`: el de su texto (body)
export const queuedAlarm = (
  taskId: string,
  task: AlarmTask,
  timeZone: string,
  now: number,
  language: Language = 'es'
): QueuedAlarm | null => {
  if (isArchived(task) || task.isSomeday === true) return null;
  const at = alarmInstant(task, timeZone);
  const due = dueInstant(task, timeZone);
  if (at === null || due === null || due <= now) return null;
  const set = typeof task.alarmSetAt === 'string' ? Date.parse(task.alarmSetAt) : NaN;
  if (Number.isFinite(set) && at <= set) return null;
  const hasDueTime = typeof task.dueTime === 'string' && ALARM_TIME.test(task.dueTime);
  // Una de antes de 0.9.7 (sin alarmSetAt) solo con fecha sonaba la víspera: si su hora de ahora ya pasó, ya sonó
  if (task.alarmSetAt === undefined && !hasDueTime && at <= now) return null;
  return {
    at,
    due,
    key: `${taskId}@${new Date(at).toISOString()}`,
    clock: clock(at, timeZone),
    taskTitle: typeof task.title === 'string' ? task.title.slice(0, 200) : '',
    timeZone,
    hasDueTime,
    body: alarmBody({ due, timeZone, hasDueTime }, language)
  };
};
