import type {
  EmailDraft,
  Goal,
  MeetingGuard,
  Project,
  Recurrence,
  TaskItem,
  TaskObservation,
  WheelArea,
  WheelOfLifeLog
} from '../types';
import type { UserCollection, UserData } from './repository';
import { GOAL_TITLE_MAX, GOAL_WHY_MAX } from './goals';
import { PROJECT_DESCRIPTION_MAX, PROJECT_TITLE_MAX } from './projects';
import { AREA_LABEL_MAX, MAX_VISIBLE_AREAS, isAreaId, visibleAreas } from './wheel';

// IMPORTAR LA DESCARGA DE LA CUENTA («Descargar mis datos (JSON)»). El archivo viene de fuera: cada registro se
// comprueba campo a campo y solo se guardan los campos conocidos, con su tipo y su formato. Lo que ya está en la cuenta
// (mismo id) no se toca: importar dos veces el mismo archivo no cambia nada.

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

// En este orden se escriben: las metas antes que sus proyectos y estos antes que sus tareas
export const IMPORT_ORDER: UserCollection[] = ['goals', 'projects', 'tasks', 'wheelLogs', 'meetings', 'emails'];

export const IMPORT_LABELS: Record<UserCollection, string> = {
  goals: 'Metas',
  projects: 'Proyectos',
  tasks: 'Tareas',
  wheelLogs: 'Evaluaciones de la Rueda',
  meetings: 'Reuniones',
  emails: 'Correos'
};

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

// Identificadores como los que crea la app (task-…, wheel-snapshot-…, area-…): sin barras ni puntos
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Firestore reserva los ids con dos guiones bajos al principio y al final (__x__): con uno así fallaría todo el lote
const id = (value: unknown) =>
  typeof value === 'string' && ID.test(value) && !/^__.*__$/.test(value) ? value : undefined;
const str = (value: unknown, max: number) => (typeof value === 'string' && value.length <= max ? value : undefined);
const text = (value: unknown, max: number) => {
  const s = str(value, max);
  return s?.trim() ? s : undefined;
};
// Un instante en ISO 8601, como los que guarda la app (2026-10-16T08:00:00.000Z); no vale cualquier texto que Date
// sepa leer («1», «2024»)
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const instant = (value: unknown) =>
  typeof value === 'string' && ISO_INSTANT.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
const day = (value: unknown) => (typeof value === 'string' && DAY.test(value) ? value : undefined);
const time = (value: unknown) => (typeof value === 'string' && TIME.test(value) ? value : undefined);
const bool = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const int = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
const oneOf = <T extends string>(value: unknown, values: readonly T[]) =>
  values.includes(value as T) ? (value as T) : undefined;
const list = <T>(value: unknown, item: (v: unknown) => T | undefined, max: number): T[] =>
  Array.isArray(value)
    ? value.slice(0, max).flatMap((v) => {
        const parsed = item(v);
        return parsed === undefined ? [] : [parsed];
      })
    : [];

const TASK_STATUSES = ['PENDING', 'BLOCKED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

const observation = (raw: unknown): TaskObservation | undefined => {
  if (!isObj(raw)) return undefined;
  const obsId = id(raw.id);
  const type = oneOf(raw.type, ['note', 'link', 'checklist'] as const);
  const body = str(raw.text, 2000);
  const createdAt = instant(raw.createdAt);
  if (!obsId || !type || body === undefined || !createdAt) return undefined;
  return { id: obsId, type, text: body, completed: bool(raw.completed), url: str(raw.url, 2000), createdAt };
};

const recurrence = (raw: unknown): Recurrence | undefined => {
  if (!isObj(raw)) return undefined;
  const frequency = oneOf(raw.frequency, ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const);
  if (!frequency) return undefined;
  const weekdays = [...new Set(list(raw.weekdays, (v) => int(v, 0, 6), 7))];
  return {
    frequency,
    interval: int(raw.interval, 1, 999) ?? 1,
    weekdays: weekdays.length ? weekdays : undefined,
    monthlyMode: oneOf(raw.monthlyMode, ['DAY_OF_MONTH', 'NTH_WEEKDAY', 'LAST_WEEKDAY'] as const),
    monthDay: int(raw.monthDay, 1, 31),
    nth: int(raw.nth, 1, 4),
    weekday: int(raw.weekday, 0, 6),
    until: day(raw.until)
  };
};

const task = (raw: Obj): Omit<TaskItem, 'userId'> | undefined => {
  const taskId = id(raw.id);
  const title = text(raw.title, 300);
  const listContext = oneOf(raw.listContext, ['WORK', 'PERSONAL'] as const);
  const createdAt = instant(raw.createdAt);
  if (!taskId || !title || !listContext || !createdAt) return undefined;
  // Las de antes de la 0.6.0 tienen `completed` en lugar de `status`
  const status = oneOf(raw.status, TASK_STATUSES) ?? (raw.completed === true ? 'DONE' : 'PENDING');
  const confidence = raw.wheelCategoryConfidence;
  return {
    id: taskId,
    listContext,
    title,
    description: str(raw.description, 5000) ?? '',
    priority: oneOf(raw.priority, PRIORITIES) ?? 'MEDIUM',
    createdAt,
    updatedAt: instant(raw.updatedAt) ?? createdAt,
    observations: list(raw.observations, observation, 200),
    isSomeday: bool(raw.isSomeday) ?? false,
    wheelCategory: isAreaId(raw.wheelCategory) ? raw.wheelCategory : undefined,
    wheelCategoryConfidence:
      typeof confidence === 'number' && confidence >= 0 && confidence <= 1 ? confidence : undefined,
    linkedBy: oneOf(raw.linkedBy, ['MANUAL', 'AUTO_TFIDF'] as const),
    status,
    doneAt: instant(raw.doneAt),
    startDate: day(raw.startDate),
    startTime: time(raw.startTime),
    dueDate: day(raw.dueDate),
    dueTime: time(raw.dueTime),
    estimateMinutes: int(raw.estimateMinutes, 1, 100_000),
    recurrence: recurrence(raw.recurrence),
    nextOccurrenceId: id(raw.nextOccurrenceId),
    goalId: id(raw.goalId),
    dependsOn: id(raw.dependsOn),
    projectId: id(raw.projectId),
    alarmTime: time(raw.alarmTime)
  };
};

const goal = (raw: Obj): Omit<Goal, 'userId'> | undefined => {
  const goalId = id(raw.id);
  const title = text(raw.title, GOAL_TITLE_MAX);
  const createdAt = instant(raw.createdAt);
  if (!goalId || !title || !isAreaId(raw.area) || !createdAt) return undefined;
  return {
    id: goalId,
    title,
    area: raw.area,
    why: str(raw.why, GOAL_WHY_MAX),
    targetDate: day(raw.targetDate),
    status: oneOf(raw.status, ['ACTIVE', 'ACHIEVED', 'ARCHIVED'] as const) ?? 'ACTIVE',
    createdAt,
    updatedAt: instant(raw.updatedAt) ?? createdAt
  };
};

const project = (raw: Obj): Omit<Project, 'userId'> | undefined => {
  const projectId = id(raw.id);
  const title = text(raw.title, PROJECT_TITLE_MAX);
  const goalId = id(raw.goalId);
  const endDate = day(raw.endDate);
  const createdAt = instant(raw.createdAt);
  if (!projectId || !title || !goalId || !endDate || !createdAt) return undefined;
  return {
    id: projectId,
    title,
    goalId,
    endDate,
    description: str(raw.description, PROJECT_DESCRIPTION_MAX),
    status: oneOf(raw.status, ['ACTIVE', 'FINISHED', 'ARCHIVED'] as const) ?? 'ACTIVE',
    createdAt,
    updatedAt: instant(raw.updatedAt) ?? createdAt
  };
};

const wheelLog = (raw: Obj): Omit<WheelOfLifeLog, 'userId'> | undefined => {
  const logId = id(raw.id);
  const timestamp = instant(raw.timestamp);
  if (!logId || !timestamp || !isObj(raw.scores)) return undefined;
  const scores = Object.fromEntries(
    Object.entries(raw.scores).filter(([area, score]) => isAreaId(area) && int(score, 0, 10) !== undefined)
  ) as Record<string, number>;
  if (Object.keys(scores).length === 0) return undefined;
  return { id: logId, timestamp, label: str(raw.label, 200), scores };
};

const meeting = (raw: Obj): Omit<MeetingGuard, 'userId'> | undefined => {
  const meetingId = id(raw.id);
  const title = text(raw.title, 300);
  const startTime = instant(raw.startTime);
  const endTime = instant(raw.endTime);
  const createdAt = instant(raw.createdAt);
  if (!meetingId || !title || !startTime || !endTime || !createdAt) return undefined;
  return {
    id: meetingId,
    title,
    startTime,
    endTime,
    agendaPoints: list(raw.agendaPoints, (v) => str(v, 1000), 100),
    moderatorName: str(raw.moderatorName, 300) ?? '',
    moderatorEmail: str(raw.moderatorEmail, 320) ?? '',
    createdAt
  };
};

const attachment = (raw: unknown): EmailDraft['attachments'][number] | undefined => {
  if (!isObj(raw)) return undefined;
  const name = text(raw.name, 300);
  const size = str(raw.size, 40);
  if (!name || size === undefined) return undefined;
  return { name, size, bytes: int(raw.bytes, 0, Number.MAX_SAFE_INTEGER) };
};

const email = (raw: Obj): Omit<EmailDraft, 'userId'> | undefined => {
  const emailId = id(raw.id);
  if (!emailId) return undefined;
  return {
    id: emailId,
    subject: str(raw.subject, 1000) ?? '',
    body: str(raw.body, 50_000) ?? '',
    attachments: list(raw.attachments, attachment, 100),
    noAttachmentsDeclared: bool(raw.noAttachmentsDeclared) ?? false,
    recipients: list(raw.recipients, (v) => text(v, 320), 100),
    sentAt: instant(raw.sentAt),
    status: oneOf(raw.status, ['draft', 'saved'] as const),
    updatedAt: instant(raw.updatedAt)
  };
};

const SANITIZERS: Record<UserCollection, (raw: Obj) => { id: string } | undefined> = {
  tasks: task,
  goals: goal,
  projects: project,
  wheelLogs: wheelLog,
  meetings: meeting,
  emails: email
};

const area = (raw: unknown): WheelArea | undefined => {
  if (!isObj(raw) || !isAreaId(raw.id)) return undefined;
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (!label || label.length > AREA_LABEL_MAX) return undefined;
  return raw.hidden === true ? { id: raw.id, label, hidden: true } : { id: raw.id, label };
};

export interface ParsedImport {
  exportedAt?: string;
  // Sin el userId: se pone el de la cuenta al guardar
  data: UserData;
  invalid: Record<UserCollection, number>;
  areas: WheelArea[];
}

const emptyCounts = () => Object.fromEntries(IMPORT_ORDER.map((name) => [name, 0])) as Record<UserCollection, number>;

// Lee el archivo; si no es una descarga de la cuenta de CLAR, lanza un error con el motivo, para mostrarlo
export const parseAccountExport = (contents: string): ParsedImport => {
  let file: unknown;
  try {
    file = JSON.parse(contents);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!isObj(file) || (file.app !== undefined && file.app !== 'CLAR'))
    throw new Error('Este archivo no es una descarga de CLAR.');
  if (file.type === 'task' || file.type === 'goal' || file.type === 'project')
    throw new Error(
      'Este archivo es la descarga de una sola tarea, meta o proyecto. Aquí se importa la de «Descargar mis datos (JSON)».'
    );
  // Las descargas de antes de la 0.9.5 no llevan tipo: se reconocen por sus listas
  if ((file.type !== undefined && file.type !== 'account') || !IMPORT_ORDER.some((name) => Array.isArray(file[name])))
    throw new Error('Este archivo no es una descarga de «Descargar mis datos (JSON)».');

  const invalid = emptyCounts();
  const data = Object.fromEntries(
    IMPORT_ORDER.map((name) => {
      const raw = Array.isArray(file[name]) ? (file[name] as unknown[]) : [];
      const seen = new Set<string>();
      const valid = raw.flatMap((entry) => {
        const record = isObj(entry) ? SANITIZERS[name](entry) : undefined;
        // Un id repetido en el archivo: vale el primero
        if (!record || seen.has(record.id)) {
          invalid[name]++;
          return [];
        }
        seen.add(record.id);
        return [record];
      });
      return [name, valid];
    })
  ) as unknown as UserData;

  return {
    exportedAt: instant(file.exportedAt),
    data,
    invalid,
    areas: list(file.wheelAreas, area, 100)
  };
};

// Áreas del archivo que faltan en la cuenta, al final. Las que ya están conservan su nombre. Un nombre que ya usa
// otra área se distingue con un número, y pasado el máximo de áreas a la vista las nuevas entran ocultas.
export const mergeAreas = (current: WheelArea[], incoming: WheelArea[]) => {
  const key = (label: string) => label.trim().toLocaleLowerCase('es');
  const merged = [...current];
  const added: WheelArea[] = [];
  const labels = new Set(current.map((a) => key(a.label)));
  let visible = visibleAreas(current).length;
  for (const next of incoming) {
    if (merged.some((a) => a.id === next.id)) continue;
    let label = next.label;
    for (let n = 2; labels.has(key(label)); n++) label = `${next.label.slice(0, AREA_LABEL_MAX - 5).trim()} (${n})`;
    const hidden = next.hidden === true || visible >= MAX_VISIBLE_AREAS;
    if (!hidden) visible++;
    const entry: WheelArea = hidden ? { id: next.id, label, hidden: true } : { id: next.id, label };
    merged.push(entry);
    added.push(entry);
    labels.add(key(label));
  }
  return { merged, added };
};

export interface ImportPlan {
  exportedAt?: string;
  // Lo que se va a escribir: solo lo que aún no está en la cuenta
  data: UserData;
  counts: Record<UserCollection, { new: number; existing: number; invalid: number }>;
  total: number;
  // Las áreas de la cuenta con las del archivo que faltaban (null si no falta ninguna)
  areas: WheelArea[] | null;
  addedAreas: WheelArea[];
}

export const planImport = (
  parsed: ParsedImport,
  existing: Record<UserCollection, Set<string>>,
  currentAreas: WheelArea[]
): ImportPlan => {
  const data = Object.fromEntries(
    IMPORT_ORDER.map((name) => [
      name,
      (parsed.data[name] as { id: string }[]).filter((record) => !existing[name].has(record.id))
    ])
  ) as unknown as UserData;
  const counts = Object.fromEntries(
    IMPORT_ORDER.map((name) => {
      const fresh = data[name].length;
      return [name, { new: fresh, existing: parsed.data[name].length - fresh, invalid: parsed.invalid[name] }];
    })
  ) as ImportPlan['counts'];
  const { merged, added } = mergeAreas(currentAreas, parsed.areas);
  return {
    exportedAt: parsed.exportedAt,
    data,
    counts,
    total: IMPORT_ORDER.reduce((sum, name) => sum + data[name].length, 0),
    areas: added.length ? merged : null,
    addedAreas: added
  };
};
