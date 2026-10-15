import type { TaskItem } from '../types';
import { dueMoment, isArchived, toLocalDate } from './tasks';
import { toDateString } from './recurrence';

// ALARMAS: la tarea guarda solo la hora (HH:mm). El momento en que suena se calcula al leer, en la zona horaria del
// dispositivo, así nunca hay que reescribirla y una repetición nueva la hereda tal cual.
export const ALARM_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type AlarmFields = Pick<TaskItem, 'dueDate' | 'dueTime' | 'recurrence' | 'alarmTime'>;

// Por qué la tarea no puede llevar alarma, o null si puede
export const alarmUnavailableReason = (task: Pick<TaskItem, 'dueDate' | 'dueTime' | 'recurrence'>) => {
  if (task.recurrence && !task.dueTime) return 'Pon una hora límite para añadir una alarma a una tarea que se repite.';
  if (!task.dueDate) return 'Pon una fecha límite para poder añadir una alarma.';
  return null;
};

// Cuándo suena la alarma, o null si no tiene o no puede tenerla.
// - Con hora límite: a esa hora dentro de las 24 h anteriores. Si es antes que la hora límite, el mismo día; si no,
//   la víspera (a la misma hora que la límite, 24 h antes).
// - Solo con fecha límite: a esa hora de la víspera.
// - Una tarea que se repite necesita hora límite.
// Primero se elige el día y después se le pone la hora: así un cambio al horario de verano en el día límite no
// mueve la alarma de la víspera (las horas se comparan como texto, HH:mm).
export const alarmMoment = (task: AlarmFields): Date | null => {
  if (!task.alarmTime || !ALARM_TIME_PATTERN.test(task.alarmTime) || alarmUnavailableReason(task)) return null;
  if (task.dueTime && task.alarmTime < task.dueTime) return toLocalDate(task.dueDate!, task.alarmTime);
  const eve = toLocalDate(task.dueDate!);
  eve.setDate(eve.getDate() - 1);
  return toLocalDate(toDateString(eve), task.alarmTime);
};

const dayFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const pad = (n: number) => String(n).padStart(2, '0');
export const formatClock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Cuándo sonará, para el formulario: «Sonará el 15 oct a las 10:57» o «Sonará la víspera, el 14 oct, a las 20:00»
export const describeAlarm = (task: AlarmFields) => {
  const at = alarmMoment(task);
  if (!at) return null;
  const sameDay = Boolean(task.dueTime && task.alarmTime! < task.dueTime);
  return sameDay
    ? `Sonará el ${dayFormat.format(at)} a las ${formatClock(at)}.`
    : `Sonará la víspera, el ${dayFormat.format(at)}, a las ${formatClock(at)}.`;
};

export interface ScheduledAlarm {
  task: TaskItem;
  at: Date;
  due: Date;
  // Cambia si cambia la tarea o su alarma: una alarma editada vuelve a sonar, una ya avisada no
  key: string;
}

// Alarmas por avisar: tareas sin hacer, fuera de «Algún día», cuyo plazo aún no ha vencido. Las que ya pasaron su
// hora (p. ej. con la app cerrada) siguen aquí hasta el vencimiento: se avisan al abrirla. Por orden de hora.
export const scheduledAlarms = (tasks: TaskItem[], now: Date): ScheduledAlarm[] =>
  tasks
    .flatMap((task) => {
      if (isArchived(task) || task.isSomeday) return [];
      const at = alarmMoment(task);
      const due = dueMoment(task);
      if (!at || !due || due <= now) return [];
      return [{ task, at, due, key: `${task.id}@${at.toISOString()}` }];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
