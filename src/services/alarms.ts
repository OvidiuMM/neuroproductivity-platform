import type { TaskItem } from '../types';
import { dueMoment, isArchived, toLocalDate } from './tasks';
import { toDateString } from './recurrence';
import { LOCALE_TAG, messages } from '../i18n/locale';

const m = messages(
  {
    needsDueDate: 'Pon una fecha límite para poder añadir una alarma.',
    beforeDueTime: (dueTime: string) =>
      `La alarma tiene que ser antes de la hora límite (${dueTime}): cámbiala o quítala.`,
    lateSameDay: (clock: string) => `Era a las ${clock}: CLAR no estaba abierta a esa hora.`,
    lateOtherDay: (day: string, clock: string) => `Era el ${day} a las ${clock}: CLAR no estaba abierta a esa hora.`,
    today: 'hoy',
    tomorrow: 'mañana',
    onDay: (day: string) => `el ${day}`,
    passed: (day: string, clock: string) => `Esa hora ya ha pasado (${day} a las ${clock}): no sonará.`,
    ringsTheEve: (day: string, clock: string) => `Sonará la víspera, ${day}, a las ${clock}.`,
    rings: (day: string, clock: string) => `Sonará ${day} a las ${clock}.`
  },
  {
    needsDueDate: 'Set a due date to add an alarm.',
    beforeDueTime: (dueTime) => `The alarm has to be before the due time (${dueTime}): change it or remove it.`,
    lateSameDay: (clock) => `It was at ${clock}: CLAR wasn't open at that time.`,
    lateOtherDay: (day, clock) => `It was on ${day} at ${clock}: CLAR wasn't open at that time.`,
    today: 'today',
    tomorrow: 'tomorrow',
    onDay: (day) => `on ${day}`,
    passed: (day, clock) => `That time has already passed (${day} at ${clock}): it won't ring.`,
    ringsTheEve: (day, clock) => `It will ring the day before, ${day}, at ${clock}.`,
    rings: (day, clock) => `It will ring ${day} at ${clock}.`
  }
);

// ALARMAS: la tarea guarda solo la hora (HH:mm). El momento en que suena se calcula al leer, en la zona horaria del
// dispositivo, así nunca hay que reescribirla y una repetición nueva la hereda tal cual.
export const ALARM_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type AlarmFields = Pick<TaskItem, 'dueDate' | 'dueTime' | 'recurrence' | 'alarmTime'>;

// Por qué la tarea no puede llevar alarma, o null si puede
export const alarmUnavailableReason = (task: Pick<TaskItem, 'dueDate' | 'dueTime' | 'recurrence'>) =>
  task.dueDate ? null : m.needsDueDate;

// Lo que impide guardar la alarma, o null: con hora límite, tiene que sonar antes de ella
export const alarmError = (task: Pick<TaskItem, 'dueTime' | 'alarmTime'>) =>
  task.dueTime && task.alarmTime && task.alarmTime >= task.dueTime ? m.beforeDueTime(task.dueTime) : null;

// Las de antes de 0.9.7 con la alarma a la hora límite o más tarde suenan la víspera, como entonces (el formulario ya
// no deja ponerlas así: ver alarmError)
const ringsTheEve = (task: AlarmFields) => Boolean(task.dueTime && task.alarmTime && task.alarmTime >= task.dueTime);

// Cuándo suena la alarma, o null si no tiene o no puede tenerla: el día límite, a su hora (con hora límite, antes de
// ella), también en las tareas que se repiten. Primero se elige el día y después se le pone la hora: así un cambio al
// horario de verano no la mueve (las horas se comparan como texto, HH:mm).
export const alarmMoment = (task: AlarmFields): Date | null => {
  if (!task.alarmTime || !ALARM_TIME_PATTERN.test(task.alarmTime) || alarmUnavailableReason(task)) return null;
  if (!ringsTheEve(task)) return alarmInstant(task.dueDate!, task.alarmTime);
  const eve = toLocalDate(task.dueDate!);
  eve.setDate(eve.getDate() - 1);
  return alarmInstant(toDateString(eve), task.alarmTime);
};

// Si la alarma ya había pasado cuando se puso o se cambió (ella o el día de la tarea): no suena, ni aquí ni con CLAR
// cerrada (functions/src/alarmLogic.ts hace lo mismo). Otros cambios de la tarea (el estado, una meta borrada) no la
// tocan: una alarma que pasó con CLAR cerrada avisa al abrirla
const setAfterItsTime = (task: Pick<TaskItem, 'alarmSetAt'>, at: Date) => {
  const set = task.alarmSetAt ? Date.parse(task.alarmSetAt) : NaN;
  return Number.isFinite(set) && at.getTime() <= set;
};

// Una alarma de antes de 0.9.7 (sin alarmSetAt) en una tarea solo con fecha sonaba la víspera: si su hora de ahora
// ya pasó, ya sonó entonces y no se avisa otra vez con retraso
const rangTheEveBefore = (task: Pick<TaskItem, 'alarmSetAt' | 'dueTime'>, at: Date, now: Date) =>
  !task.alarmSetAt && !task.dueTime && at <= now;

// La repetición, sin depender del orden de sus campos (así se compara la de antes con la de ahora)
const sameRecurrence = (a: TaskItem['recurrence'], b: TaskItem['recurrence']) => {
  const sorted = (value: TaskItem['recurrence']) =>
    JSON.stringify(value ? Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y))) : null);
  return sorted(a) === sorted(b);
};

// Cuándo se puso la alarma, al guardar la tarea desde el formulario: ahora, si es nueva o cambian ella, el día, la hora
// límite o la repetición; si no, la de antes
export const alarmSetAtFor = (
  before: Pick<TaskItem, 'alarmTime' | 'dueDate' | 'dueTime' | 'recurrence' | 'alarmSetAt'> | null,
  after: Pick<TaskItem, 'alarmTime' | 'dueDate' | 'dueTime' | 'recurrence'>,
  now: string
) => {
  if (!after.alarmTime) return undefined;
  const changed =
    !before ||
    before.alarmTime !== after.alarmTime ||
    before.dueDate !== after.dueDate ||
    before.dueTime !== after.dueTime ||
    !sameRecurrence(before.recurrence, after.recurrence);
  return changed ? now : before.alarmSetAt;
};

// Hora local de la alarma. Si no existe ese día (el salto al horario de verano, p. ej. las 02:30 del 31 de marzo en
// Madrid), Date la pasa adelante (a las 03:30) y podría caer después del plazo; se toma la anterior, con el desfase
// del horario nuevo (la 01:30 antes del salto): así queda tanto tiempo real antes del plazo como se pidió.
const alarmInstant = (date: string, time: string) => {
  const at = toLocalDate(date, time);
  const [hours, minutes] = time.split(':').map(Number);
  const drift = at.getHours() * 60 + at.getMinutes() - (hours * 60 + minutes);
  return drift > 0 ? new Date(at.getTime() - drift * 60_000) : at;
};

// AVISOS DE OTRA PESTAÑA que llegan antes que la tarea (su copia aún no se ha sincronizado): esperan a que llegue,
// como mucho unos minutos
export const PENDING_ALERT_MS = 10 * 60_000;
export const matchPendingAlerts = (pending: Map<string, number>, alarms: ScheduledAlarm[], now: number) => {
  const matched = alarms.filter((alarm) => pending.has(alarm.key));
  const rest = new Map(
    [...pending].filter(([key, since]) => !matched.some((a) => a.key === key) && now - since < PENDING_ALERT_MS)
  );
  return { matched, rest };
};

const dayFormat = new Intl.DateTimeFormat(LOCALE_TAG, { day: 'numeric', month: 'short' });
const pad = (n: number) => String(n).padStart(2, '0');
export const formatClock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Un aviso que llega más de dos minutos tarde (CLAR estaba cerrada o el equipo dormido a esa hora) dice cuándo era:
// «Era a las 11:00» o, si fue otro día, «Era el 15 oct a las 11:00». A tiempo, null.
export const LATE_ALERT_MS = 2 * 60_000;
export const alarmLateNote = (at: Date, raisedAt: Date) => {
  if (raisedAt.getTime() - at.getTime() <= LATE_ALERT_MS) return null;
  return toDateString(at) === toDateString(raisedAt)
    ? m.lateSameDay(formatClock(at))
    : m.lateOtherDay(dayFormat.format(at), formatClock(at));
};

// «hoy» o «mañana», si la alarma es uno de esos días; si no, null
const nearDay = (at: Date, now: Date) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (toDateString(at) === toDateString(now)) return m.today;
  if (toDateString(at) === toDateString(tomorrow)) return m.tomorrow;
  return null;
};

// El día de la alarma: «hoy», «mañana» o «el 15 oct»
const alarmDay = (at: Date, now: Date) => nearDay(at, now) ?? m.onDay(dayFormat.format(at));

// En la tarjeta, cuándo suena: «hoy 17:00», «mañana 09:00» o «15 oct 10:57»
export const alarmLabel = (at: Date, now: Date) => `${nearDay(at, now) ?? dayFormat.format(at)} ${formatClock(at)}`;

// Cuándo sonará, para el formulario: «Sonará hoy a las 17:00» o «Sonará el 15 oct a las 10:57» (las de antes de
// 0.9.7, «la víspera, el 14 oct, a las 20:00»). Si esa hora ya pasó, al guardar no sonará: se dice
export const describeAlarm = (task: AlarmFields, now = new Date()) => {
  const at = alarmMoment(task);
  if (!at) return null;
  if (at <= now) return m.passed(alarmDay(at, now), formatClock(at));
  return ringsTheEve(task)
    ? m.ringsTheEve(alarmDay(at, now), formatClock(at))
    : m.rings(alarmDay(at, now), formatClock(at));
};

export interface ScheduledAlarm {
  task: TaskItem;
  at: Date;
  due: Date;
  // Cambia si cambia la tarea o su alarma: una alarma editada vuelve a sonar, una ya avisada no
  key: string;
}

// Alarmas por avisar: tareas sin hacer, fuera de «Algún día», cuyo plazo aún no ha vencido. Las que ya pasaron su
// hora (p. ej. con la app cerrada) siguen aquí hasta el vencimiento: se avisan al abrirla, salvo que la tarea se
// guardara después de esa hora. Por orden de hora.
export const scheduledAlarms = (tasks: TaskItem[], now: Date): ScheduledAlarm[] =>
  tasks
    .flatMap((task) => {
      if (isArchived(task) || task.isSomeday) return [];
      const at = alarmMoment(task);
      const due = dueMoment(task);
      if (!at || !due || due <= now || setAfterItsTime(task, at) || rangTheEveBefore(task, at, now)) return [];
      return [{ task, at, due, key: `${task.id}@${at.toISOString()}` }];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
