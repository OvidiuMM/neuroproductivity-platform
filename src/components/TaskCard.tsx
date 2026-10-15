import React from 'react';
import { ArrowDown, Bell, Check, Flame, Lock, Scale, Sparkles, Sprout, Target, Timer, Zap } from 'lucide-react';
import { Goal, TaskItem, TaskPriority, TaskStatus } from '../types';
import {
  DEADLINE_TITLE_CLASS,
  PRIORITY_LABEL,
  TASK_STATUSES,
  effectivePriority,
  getDeadlineState,
  isArchived
} from '../services/tasks';
import { formatEstimate } from '../services/taskListing';
import { alarmMoment, describeAlarm } from '../services/alarms';
import { TaskDates } from './TaskDates';
import { TaskActionsMenu } from './TaskActionsMenu';

// top: Top 10 (elevada, con descripción) · peripheral: posición 11 en adelante (plana) · someday: «Quizá»
type Variant = 'top' | 'peripheral' | 'someday';

interface TaskCardProps {
  task: TaskItem;
  // Meta a la que contribuye (sustituye al área, que es la de la meta)
  goal?: Goal;
  // Tarea abierta a la que espera: hasta que termine, esta no se puede completar
  blocker?: TaskItem;
  now: Date;
  variant: Variant;
  // Posición en la lista activa (1 a 10 en el Top 10; 11 en adelante en el resto)
  position?: number;
  onChangeStatus: (task: TaskItem, status: TaskStatus) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  // Descarga la tarea con todos sus datos en JSON
  onDownload?: (task: TaskItem) => void;
}

const PRIORITY_STYLE: Record<TaskPriority, { className: string; Icon: typeof Flame; iconClass: string }> = {
  CRITICAL: { className: 'border-red-200 bg-red-100 text-red-800', Icon: Flame, iconClass: 'text-red-600' },
  HIGH: { className: 'border-amber-200 bg-amber-100 text-amber-800', Icon: Zap, iconClass: 'text-amber-600' },
  MEDIUM: { className: 'border-blue-200 bg-blue-100 text-blue-800', Icon: Scale, iconClass: 'text-blue-600' },
  LOW: { className: 'border-slate-200 bg-slate-100 text-slate-700', Icon: Sprout, iconClass: 'text-slate-500' }
};

// Prioridad efectiva; si el plazo lejano la ha bajado, se indica y se da la original
const PriorityBadge: React.FC<{ task: TaskItem; now: Date }> = ({ task, now }) => {
  const effective = effectivePriority(task, now);
  const { className, Icon, iconClass } = PRIORITY_STYLE[effective];
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${className}`}
      >
        <Icon className={`h-3 w-3 ${iconClass}`} aria-hidden="true" />
        {PRIORITY_LABEL[effective].toUpperCase()}
      </span>
      {effective !== task.priority && (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500"
          title={`Prioridad original: ${PRIORITY_LABEL[task.priority]}. Cuenta un nivel menos porque la fecha límite está a más de una semana.`}
        >
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
          plazo &gt; 1 semana
          <span className="sr-only">(prioridad original: {PRIORITY_LABEL[task.priority]})</span>
        </span>
      )}
    </span>
  );
};

// Alarma: la hora, con cuándo suena en el título (sin hacer y con alarma válida)
const AlarmBadge: React.FC<{ task: TaskItem }> = ({ task }) => {
  if (isArchived(task) || !alarmMoment(task)) return null;
  return (
    <span className="inline-flex items-center gap-1" title={describeAlarm(task) ?? undefined}>
      <Bell className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Alarma:</span>
      {task.alarmTime}
    </span>
  );
};

const EstimateBadge: React.FC<{ minutes?: number }> = ({ minutes }) =>
  minutes === undefined ? null : (
    <span className="inline-flex items-center gap-1 font-semibold">
      <Timer className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Estimación:</span>
      {formatEstimate(minutes)}
    </span>
  );

// Estado solo si no es «Pendiente» (el habitual): menos ruido en la tarjeta
const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  if (status === 'PENDING') return null;
  const { label, className } = TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0];
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
};

const CARD_CLASS: Record<Variant, string> = {
  top: 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 transition-shadow hover:shadow-md',
  peripheral: 'rounded-xl border border-slate-100 bg-slate-50/60 transition-colors hover:bg-white',
  someday: 'rounded-2xl border border-slate-200 bg-white'
};

// Tarjeta de tarea: completar de un toque a la izquierda, título y una línea de datos, y las demás acciones en «⋯»
export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  goal,
  blocker,
  now,
  variant,
  position,
  onChangeStatus,
  onEdit,
  onDelete,
  onDownload
}) => {
  // El color de plazo sustituye al color base: con las dos clases, el orden del CSS decidiría cuál gana
  const titleColor = (base: string) => DEADLINE_TITLE_CLASS[getDeadlineState(task, now)] || base;
  const isTop = variant === 'top';

  return (
    <li className={`flex items-start gap-1 p-1 sm:gap-2 sm:p-1.5 ${CARD_CLASS[variant]}`}>
      {blocker ? (
        // Bloqueada: en lugar del círculo para completarla, un candado (lo explica la etiqueta de la tarjeta)
        <span className="flex h-11 w-11 shrink-0 items-center justify-center" title="Bloqueada" aria-hidden="true">
          <Lock className="h-4 w-4 text-amber-700" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onChangeStatus(task, 'DONE')}
          aria-label={`Marcar «${task.title}» como hecha`}
          title="Marcar como hecha"
          className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 transition-colors group-hover:border-emerald-500 group-hover:bg-emerald-50 group-focus-visible:border-emerald-500 group-active:bg-emerald-100">
            <Check
              className="h-3.5 w-3.5 text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            />
          </span>
        </button>
      )}

      <div className="min-w-0 flex-1 space-y-1 py-2.5">
        <div className="flex items-start gap-2">
          {position !== undefined &&
            (isTop ? (
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-900 font-mono text-[10px] font-bold text-white">
                {position}
              </span>
            ) : (
              <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[10px] text-slate-500">{position}.</span>
            ))}
          {variant === 'peripheral' ? (
            <p className={`min-w-0 truncate text-sm ${titleColor('text-slate-700')}`}>{task.title}</p>
          ) : (
            <h4
              className={`min-w-0 text-sm leading-snug break-words ${isTop ? 'font-bold sm:text-base' : 'font-semibold'} ${titleColor('text-slate-900')}`}
            >
              {task.title}
            </h4>
          )}
        </div>

        {variant !== 'peripheral' && task.description && (
          <p className="line-clamp-2 text-xs leading-relaxed break-words text-slate-600">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <TaskDates task={task} now={now} />
          <AlarmBadge task={task} />
          <EstimateBadge minutes={task.estimateMinutes} />
          {variant !== 'someday' && <PriorityBadge task={task} now={now} />}
          {goal ? (
            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
              <Target className="h-3 w-3 text-indigo-500" aria-hidden="true" />
              <span className="sr-only">Meta:</span>
              {goal.title}
            </span>
          ) : (
            task.wheelCategory && (
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                <Sparkles className="h-3 w-3 text-indigo-500" aria-hidden="true" />
                {task.wheelCategory}
              </span>
            )
          )}
          {blocker ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Bloqueada: espera a «{blocker.title}»
            </span>
          ) : (
            <StatusBadge status={task.status} />
          )}
        </div>
      </div>

      <TaskActionsMenu
        task={task}
        onEdit={() => onEdit(task)}
        onChangeStatus={(status) => onChangeStatus(task, status)}
        onDelete={() => onDelete(task)}
        blocked={Boolean(blocker)}
        onDownload={onDownload ? () => onDownload(task) : undefined}
      />
    </li>
  );
};
