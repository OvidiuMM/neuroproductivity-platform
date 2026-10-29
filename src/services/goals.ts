import type { Goal, TaskItem, WheelArea, WheelCategory, WheelOfLifeLog } from '../types';
import { DEFAULT_AREAS, visibleAreas } from './wheel';
import { isArchived, isCancelled, isDone } from './tasks';
import { LOCALE_TAG, messages } from '../i18n/locale';

export const GOAL_TITLE_MAX = 100;
export const GOAL_WHY_MAX = 280;

// Progreso de una meta: tareas vinculadas hechas sobre el total. Las canceladas no cuentan en ninguno de los dos
export const goalProgress = (goal: Pick<Goal, 'id'>, tasks: TaskItem[]) => {
  const linked = tasks.filter((t) => t.goalId === goal.id && !isCancelled(t));
  return { done: linked.filter(isDone).length, total: linked.length };
};

// Tareas de una meta que quedan por hacer: primero las que tienen fecha límite, de la más próxima a la más lejana
export const pendingGoalTasks = (goal: Pick<Goal, 'id'>, tasks: TaskItem[]) =>
  tasks
    .filter((t) => t.goalId === goal.id && !isArchived(t))
    .sort(
      (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title, LOCALE_TAG)
    );

// El área de una tarea vinculada es la de su meta: se resuelve al leer, así cambiar el área de una meta no tiene que
// reescribir sus tareas (ni puede dejar alguna atrás). Un vínculo a una meta que ya no existe se ignora.
export const applyGoalAreas = (tasks: TaskItem[], goals: Goal[]) => {
  const areaOf = new Map(goals.map((g) => [g.id, g.area]));
  return tasks.map((task) => {
    const area = task.goalId ? areaOf.get(task.goalId) : undefined;
    return area && area !== task.wheelCategory ? { ...task, wheelCategory: area } : task;
  });
};

// Puntuación de cada área en la última evaluación de la Rueda, o null si aún no hay ninguna
export const latestScores = (logs: WheelOfLifeLog[]): Partial<Record<WheelCategory, number>> | null =>
  logs.reduce<WheelOfLifeLog | null>(
    (latest, log) => (!latest || log.timestamp > latest.timestamp ? log : latest),
    null
  )?.scores ?? null;

// Un área necesita atención con 5 o menos en la última evaluación
export const WEAK_AREA_SCORE = 5;

export interface AreaGoals {
  area: WheelCategory;
  score?: number; // en la última evaluación; sin evaluar, no hay
  goals: Goal[]; // las activas
  weak: boolean;
}

// Áreas con sus metas activas, primero las de menor puntuación (las que más atención necesitan); en empate o sin
// evaluación, en el orden de la Rueda. Son las áreas visibles y, para que ninguna meta activa desaparezca, las ocultas
// (o que ya no existen) que aún tienen alguna.
export const areasWithGoals = (
  goals: Goal[],
  scores: Partial<Record<WheelCategory, number>> | null,
  areas: WheelArea[] = DEFAULT_AREAS
): AreaGoals[] => {
  const active = sortGoals(goals).filter((g) => g.status === 'ACTIVE');
  const order = visibleAreas(areas).map((a) => a.id);
  for (const goal of active) if (!order.includes(goal.area)) order.push(goal.area);
  return order
    .map((area) => {
      const score = scores?.[area];
      return {
        area,
        score,
        goals: active.filter((g) => g.area === area),
        weak: score !== undefined && score <= WEAK_AREA_SCORE
      };
    })
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || order.indexOf(a.area) - order.indexOf(b.area));
};

// Metas activas por área de la Rueda
export const activeGoalsByArea = (goals: Goal[]) =>
  goals
    .filter((g) => g.status === 'ACTIVE')
    .reduce<Partial<Record<WheelCategory, number>>>((acc, g) => ({ ...acc, [g.area]: (acc[g.area] ?? 0) + 1 }), {});

// Palabras con significado: sin tildes, en minúscula y de cuatro letras o más (fuera artículos y nexos)
// Palabras comunes que no cuentan para sugerir una meta, en el idioma de la app
const STOPWORDS = new Set(
  messages(
    ['para', 'como', 'desde', 'hasta', 'sobre', 'entre', 'este', 'esta', 'estos', 'estas'],
    [
      'about',
      'with',
      'from',
      'that',
      'this',
      'these',
      'those',
      'your',
      'have',
      'will',
      'into',
      'over',
      'what',
      'when',
      'than',
      'then',
      'them',
      'they',
      'there',
      'their',
      'some',
      'more',
      'also',
      'just',
      'make',
      'want',
      'need'
    ]
  )
);
const significantWords = (text: string) =>
  new Set(
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );

// Meta activa que más palabras comparte con el título de la tarea (al menos una); en empate, la más reciente
export const suggestGoal = (title: string, goals: Goal[]): Goal | null => {
  const words = significantWords(title);
  if (words.size === 0) return null;
  let best: { goal: Goal; shared: number } | null = null;
  for (const goal of goals) {
    if (goal.status !== 'ACTIVE') continue;
    const shared = [...significantWords(`${goal.title} ${goal.why ?? ''}`)].filter((w) => words.has(w)).length;
    if (shared === 0) continue;
    if (!best || shared > best.shared || (shared === best.shared && goal.updatedAt > best.goal.updatedAt)) {
      best = { goal, shared };
    }
  }
  return best?.goal ?? null;
};

export interface GoalDraft {
  title: string;
  area?: WheelCategory;
  why?: string;
  targetDate?: string;
}

const m = messages(
  {
    noTitle: 'Ponle un nombre a la meta.',
    titleTooLong: `El nombre admite hasta ${GOAL_TITLE_MAX} caracteres.`,
    noArea: 'Elige el área de la Rueda a la que pertenece.',
    whyTooLong: `El «para qué» admite hasta ${GOAL_WHY_MAX} caracteres.`,
    badTargetDate: 'La fecha objetivo no es válida.'
  },
  {
    noTitle: 'Give the goal a name.',
    titleTooLong: `The name can be up to ${GOAL_TITLE_MAX} characters.`,
    noArea: 'Choose the Wheel area it belongs to.',
    whyTooLong: `The “why” can be up to ${GOAL_WHY_MAX} characters.`,
    badTargetDate: 'The target date isn’t valid.'
  }
);

// Lo que impide guardar la meta, o null si está bien
export const validateGoal = ({ title, area, why, targetDate }: GoalDraft): string | null => {
  if (!title.trim()) return m.noTitle;
  if (title.trim().length > GOAL_TITLE_MAX) return m.titleTooLong;
  if (!area) return m.noArea;
  if (why && why.trim().length > GOAL_WHY_MAX) return m.whyTooLong;
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return m.badTargetDate;
  return null;
};

// Activas primero (por fecha objetivo, las que no tienen al final), después logradas y archivadas
const STATUS_ORDER: Record<Goal['status'], number> = { ACTIVE: 0, ACHIEVED: 1, ARCHIVED: 2 };
export const sortGoals = (goals: Goal[]) =>
  [...goals].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') ||
      a.title.localeCompare(b.title, LOCALE_TAG)
  );
