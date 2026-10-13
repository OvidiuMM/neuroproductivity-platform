import React, { useState } from 'react';
import { TaskItem, ListContext, TaskPriority, TaskStatus, WheelCategory } from '../types';
import { DEADLINE_TITLE_CLASS, effectivePriority, getDeadlineState } from '../services/tasks';
import {
  DEFAULT_LIST_PREFS,
  ESTIMATE_OPTIONS,
  arrangeTasks,
  countActiveFilters,
  formatEstimate,
  type DeadlineFilter,
  type ListFilters,
  type ListPrefs,
  type SortBy
} from '../services/taskListing';
import { useNow } from '../hooks/useNow';
import { TaskStatusSelect } from './TaskStatusSelect';
import { TaskDates } from './TaskDates';
import { AddToCalendarMenu, TASK_ACTION_BUTTON } from './AddToCalendarMenu';
import {
  Clock,
  Sparkles,
  Flame,
  Zap,
  Scale,
  Sprout,
  Plus,
  Trash2,
  Edit2,
  Archive,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  SlidersHorizontal,
  Timer,
  ArrowDown
} from 'lucide-react';

const PRIORITY_LABEL: Record<TaskPriority, string> = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const WHEEL_CATEGORIES: WheelCategory[] = ['Salud', 'Carrera Profesional', 'Finanzas', 'Familia', 'Ocio', 'Relaciones', 'Espiritualidad'];
const DEADLINE_FILTERS: { value: DeadlineFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'OVERDUE', label: 'Vencidas' },
  { value: 'NEXT_7_DAYS', label: 'Próximos 7 días' },
  { value: 'WITH_DATE', label: 'Con fecha límite' },
  { value: 'NO_DATE', label: 'Sin fecha límite' }
];

// Estimación de la tarea, en las tres listas (Top 10, posición 11 en adelante y «Quizá»)
const EstimateBadge: React.FC<{ minutes?: number; className?: string }> = ({ minutes, className = '' }) =>
  minutes === undefined ? null : (
    <span className={`flex items-center gap-1 font-semibold ${className}`}>
      <Timer className="w-3 h-3" aria-hidden="true" />
      <span className="sr-only">Estimación:</span>
      {formatEstimate(minutes)}
    </span>
  );

interface TaskListProps {
  tasks: TaskItem[];
  activeContext: ListContext;
  // Orden y filtros del Top 10: los guarda App, que también los usa para el resumen «Top 10 Foco»
  prefs: ListPrefs;
  onPrefsChange: (update: (prefs: ListPrefs) => ListPrefs) => void;
  archivedCount: number;
  onChangeStatus: (task: TaskItem, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: TaskItem) => void;
  onOpenNewTask: (options?: { someday?: boolean }) => void;
  onOpenArchive: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  activeContext,
  prefs,
  onPrefsChange,
  archivedCount,
  onChangeStatus,
  onDeleteTask,
  onEditTask,
  onOpenNewTask,
  onOpenArchive
}) => {
  const [viewMode, setViewMode] = useState<'active' | 'someday'>('active');
  const setPrefs = onPrefsChange;
  const activeFilterCount = countActiveFilters(prefs.filters);
  const [showFilters, setShowFilters] = useState(activeFilterCount > 0);

  const setFilter = <K extends keyof ListFilters>(key: K, value: ListFilters[K]) =>
    setPrefs((p) => ({ ...p, filters: { ...p.filters, [key]: value } }));

  // Reloj de la lista: los colores de plazo y la prioridad efectiva cambian solos con el tiempo
  const now = useNow();

  // Filtrado por contexto estricto (Segregación Inquebrantable); las tareas hechas están archivadas
  const contextTasks = tasks.filter((t) => t.listContext === activeContext && t.status !== 'DONE');

  // Separación entre tareas activas y el sumidero cognitivo "Quizá" / "Algún día"
  const activeTasks = contextTasks.filter((t) => !t.isSomeday);
  const somedayTasks = contextTasks.filter((t) => t.isSomeday);

  // Jerarquía Visual: el Top 10 son las 10 primeras tareas tras filtrar y ordenar
  const arrangedTasks = arrangeTasks(activeTasks, prefs, now);
  const hiddenByFilters = activeTasks.length - arrangedTasks.length;
  const top10Tasks = arrangedTasks.slice(0, 10);
  const peripheralTasks = arrangedTasks.slice(10);

  // El color de plazo sustituye al color base: con las dos clases, el orden del CSS decidiría cuál gana
  const titleColor = (task: TaskItem, base: string) => DEADLINE_TITLE_CLASS[getDeadlineState(task, now)] || base;

  // Etiqueta con la prioridad efectiva; si el plazo lejano la ha bajado, se indica y se da la original
  const priorityBadge = (task: TaskItem) => {
    const effective = effectivePriority(task, now);
    return (
      <span className="inline-flex items-center gap-1">
        {getPriorityBadge(effective)}
        {effective !== task.priority && (
          <span
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500"
            title={`Prioridad original: ${PRIORITY_LABEL[task.priority]}. Cuenta un nivel menos porque la fecha límite está a más de una semana.`}
          >
            <ArrowDown className="w-3 h-3" aria-hidden="true" />
            plazo &gt; 1 semana
            <span className="sr-only">(prioridad original: {PRIORITY_LABEL[task.priority]})</span>
          </span>
        )}
      </span>
    );
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
            <Flame className="w-3 h-3 text-red-600" />
            CRÍTICA
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Zap className="w-3 h-3 text-amber-600" />
            ALTA
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Scale className="w-3 h-3 text-blue-600" />
            MEDIA
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Sprout className="w-3 h-3 text-slate-500" />
            BAJA
          </span>
        );
    }
  };

  // Botón al final de la lista para añadir otra tarea sin volver arriba
  const addTaskButton = (someday: boolean) => (
    <button
      type="button"
      onClick={() => onOpenNewTask({ someday })}
      className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
    >
      <Plus className="w-4 h-4" />
      Añadir tarea
    </button>
  );

  return (
    <div className="space-y-6">

      {/* Barra de control y pestañas del Gestor Dual */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">

        {/* Pestañas: Top 10 Activo vs Opciones Futuras, y acceso al archivo */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode('active')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              viewMode === 'active'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Top 10 Operativo & Flujo Activo</span>
            <span className="text-[10px] bg-slate-700 text-white px-2 py-0.2 rounded-full font-mono">
              {activeTasks.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode('someday')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              viewMode === 'someday'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Opciones Futuras (Quizá)</span>
            <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.2 rounded-full font-mono">
              {somedayTasks.length}
            </span>
          </button>

          <button
            onClick={onOpenArchive}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Archivadas</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-mono">
              {archivedCount}
            </span>
          </button>
        </div>

        {/* Orden y filtros del Top 10 */}
        {viewMode === 'active' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor="list-sort" className="text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar por:
            </label>
            <select
              id="list-sort"
              value={prefs.sortBy}
              onChange={(e) => setPrefs((p) => ({ ...p, sortBy: e.target.value as SortBy }))}
              className="max-w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="priority">Prioridad efectiva (Crítica → Baja)</option>
              <option value="deadline">Fecha límite (más próxima primero)</option>
              <option value="estimate">Estimación (más cortas primero)</option>
              <option value="date">Última Modificación (Descendente)</option>
              <option value="category">Categoría de la Rueda de la Vida</option>
            </select>
            <button
              type="button"
              onClick={() => setShowFilters((open) => !open)}
              aria-expanded={showFilters}
              aria-controls="list-filters"
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                activeFilterCount > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          </div>
        )}
      </div>

      {/* PANEL DE FILTROS DEL TOP 10 */}
      {viewMode === 'active' && showFilters && (
        <div
          id="list-filters"
          role="group"
          aria-label="Filtros del Top 10"
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
        >
          {(
            [
              {
                id: 'filter-priority',
                label: 'Prioridad (efectiva)',
                value: prefs.filters.priority,
                onChange: (v: string) => setFilter('priority', v as ListFilters['priority']),
                options: [{ value: 'ALL', label: 'Todas' }, ...(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))]
              },
              {
                id: 'filter-estimate',
                label: 'Estimación hasta',
                value: String(prefs.filters.maxEstimate),
                onChange: (v: string) => setFilter('maxEstimate', v === 'ALL' ? 'ALL' : Number(v)),
                options: [{ value: 'ALL', label: 'Cualquiera' }, ...ESTIMATE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))]
              },
              {
                id: 'filter-deadline',
                label: 'Fecha límite',
                value: prefs.filters.deadline,
                onChange: (v: string) => setFilter('deadline', v as DeadlineFilter),
                options: DEADLINE_FILTERS
              },
              {
                id: 'filter-status',
                label: 'Estado',
                value: prefs.filters.status,
                onChange: (v: string) => setFilter('status', v as ListFilters['status']),
                options: [
                  { value: 'ALL', label: 'Todos' },
                  { value: 'PENDING', label: 'Pendiente' },
                  { value: 'IN_PROGRESS', label: 'En progreso' },
                  { value: 'BLOCKED', label: 'Bloqueada' }
                ]
              },
              {
                id: 'filter-category',
                label: 'Área de la Rueda',
                value: prefs.filters.category,
                onChange: (v: string) => setFilter('category', v as ListFilters['category']),
                options: [{ value: 'ALL', label: 'Todas' }, ...WHEEL_CATEGORIES.map((c) => ({ value: c, label: c }))]
              }
            ] as { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }[]
          ).map((f) => (
            <div key={f.id} className="space-y-1">
              <label htmlFor={f.id} className="block font-semibold text-slate-600">
                {f.label}
              </label>
              <select
                id={f.id}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {activeFilterCount > 0 && (
            <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center justify-between gap-2 text-slate-600">
              <span role="status">
                {hiddenByFilters === 1 ? '1 tarea oculta' : `${hiddenByFilters} tareas ocultas`} por los filtros.
              </span>
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, filters: DEFAULT_LIST_PREFS.filters }))}
                className="font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Quitar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* VISTA 1: FLUJO ACTIVO CON JERARQUÍA GESTALT (TOP 10 VS PERIFÉRICO) */}
      {viewMode === 'active' && (
        <div className="space-y-6">

          {/* ZONA 1: TOP 10 OPERATIVO (ALTA ELEVACIÓN, PESO 700, CONTRASTE ELEVADO) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Top 10 Operativo (Foco de Atención Prefrontal)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Leyes de Gestalt: Elevación z-index, sombras paralelas y tipografía ampliada
              </span>
            </div>

            {top10Tasks.length === 0 && activeTasks.length > 0 ? (
              // Hay tareas, pero los filtros las ocultan todas: no se invita a crear otra
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-600 space-y-3">
                <p className="text-sm font-semibold">
                  Ninguna tarea coincide con los filtros ({hiddenByFilters} {hiddenByFilters === 1 ? 'oculta' : 'ocultas'}).
                </p>
                <button
                  onClick={() => setPrefs((p) => ({ ...p, filters: DEFAULT_LIST_PREFS.filters }))}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Mostrar todas las tareas
                </button>
              </div>
            ) : top10Tasks.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-3">
                <p className="text-sm font-semibold">No hay acciones operativas activas en esta lista.</p>
                <button
                  onClick={() => onOpenNewTask()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Capturar Primera Acción
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {top10Tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white border-slate-200/90 shadow-md shadow-slate-900/4 hover:shadow-lg hover:border-slate-300"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Índice 1 al 10 con destacado */}
                      <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>

                      {/* Contenido principal con font-weight: 700 y espaciado expandido */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <h4
                            className={`text-sm sm:text-base font-bold leading-snug tracking-tight break-words ${titleColor(task, 'text-slate-900')}`}
                          >
                            {task.title}
                          </h4>

                          <div className="flex flex-wrap items-center gap-2">
                            <TaskStatusSelect
                              status={task.status}
                              taskTitle={task.title}
                              onChange={(status) => onChangeStatus(task, status)}
                            />
                            {priorityBadge(task)}

                            {task.wheelCategory && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                {task.wheelCategory}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed break-words">
                          {task.description}
                        </p>

                        {/* Fechas, metadatos y observaciones JSONB */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-500 font-mono">
                          <TaskDates task={task} now={now} />

                          <EstimateBadge minutes={task.estimateMinutes} className="text-slate-500" />

                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Actualizada: {new Date(task.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {task.observations && task.observations.length > 0 && (
                            <span className="text-indigo-600 font-semibold">
                              · {task.observations.length} notas/checklist
                            </span>
                          )}

                          {task.linkedBy === 'AUTO_TFIDF' && (
                            <span className="text-slate-500">
                              · NLP ({Math.round((task.wheelCategoryConfidence || 0.8) * 100)}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Acciones de tarea */}
                      <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0">
                        <AddToCalendarMenu task={task} />
                        <button
                          onClick={() => onEditTask(task)}
                          className={`${TASK_ACTION_BUTTON} text-slate-600 hover:text-indigo-700 hover:bg-indigo-50`}
                          title="Editar tarea"
                          aria-label={`Editar «${task.title}»`}
                        >
                          <Edit2 className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className={`${TASK_ACTION_BUTTON} text-slate-600 hover:text-red-700 hover:bg-red-50`}
                          title="Eliminar tarea"
                          aria-label={`Eliminar «${task.title}»`}
                        >
                          <Trash2 className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ZONA 2: TAREAS SECUNDARIAS (ÍNDICE 11 EN ADELANTE: DISEÑO MINIMALISTA, SIN SOMBRAS, BAJO CONTRASTE) */}
          {peripheralTasks.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Inventario Secundario (Posición 11 en adelante · Campo Periférico)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Tratamiento visual plano y desaturado para mitigar fatiga ocular
                </span>
              </div>

              <div className="space-y-1.5">
                {peripheralTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white text-slate-600 text-xs transition-colors flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-slate-500 w-5 text-right shrink-0">
                        {index + 11}.
                      </span>
                      <span className={`truncate ${titleColor(task, 'text-slate-700')}`}>
                        {task.title}
                      </span>
                      {task.wheelCategory && (
                        <span className="hidden sm:inline text-[10px] text-slate-500 font-medium shrink-0">
                          · {task.wheelCategory}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-[10px]">
                      <TaskDates task={task} now={now} />
                      <EstimateBadge minutes={task.estimateMinutes} className="text-slate-500" />
                      <TaskStatusSelect
                        size="xs"
                        status={task.status}
                        taskTitle={task.title}
                        onChange={(status) => onChangeStatus(task, status)}
                      />
                      <span className="text-[10px] text-slate-500 uppercase font-mono">
                        {PRIORITY_LABEL[effectivePriority(task, now)]}
                      </span>
                      <AddToCalendarMenu task={task} />
                      <button
                        onClick={() => onEditTask(task)}
                        className={`${TASK_ACTION_BUTTON} text-slate-600 hover:text-indigo-700 hover:bg-indigo-50`}
                        aria-label={`Editar «${task.title}»`}
                      >
                        <Edit2 className="w-5 h-5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className={`${TASK_ACTION_BUTTON} text-slate-600 hover:text-red-700 hover:bg-red-50`}
                        aria-label={`Eliminar «${task.title}»`}
                      >
                        <Trash2 className="w-5 h-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {top10Tasks.length > 0 && addTaskButton(false)}
        </div>
      )}

      {/* VISTA 2: SUMIDERO COGNITIVO "QUIZÁ" / "ALGÚN DÍA" (HU-03) */}
      {viewMode === 'someday' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs text-indigo-950 space-y-1">
            <p className="font-bold">
              Sumidero Cognitivo: Externalización de Deseos e Ideas Latentes
            </p>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              Las tareas catalogadas con la condición "Quizá" son deliberadamente excluidas del algoritmo de ordenación diaria y del Top 10 operativo. Permanecen indexadas aquí para revisiones periódicas, eliminando el estrés por miedo a perder información valiosa sin contaminar la memoria de trabajo prefrontal.
            </p>
          </div>

          {somedayTasks.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              <p className="text-xs font-semibold">No hay proyectos latentes en este sumidero.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {somedayTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-start justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <h4 className={`text-sm font-semibold break-words ${titleColor(task, 'text-slate-900')}`}>
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-600 break-words">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                      {task.wheelCategory && (
                        <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Área: {task.wheelCategory}
                        </span>
                      )}
                      <TaskDates task={task} now={now} />
                      <EstimateBadge minutes={task.estimateMinutes} className="text-slate-500" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TaskStatusSelect
                      status={task.status}
                      taskTitle={task.title}
                      onChange={(status) => onChangeStatus(task, status)}
                    />
                    <AddToCalendarMenu task={task} />
                    <button
                      onClick={() => onEditTask(task)}
                      className={`${TASK_ACTION_BUTTON} text-slate-600 hover:text-indigo-700 hover:bg-indigo-50`}
                      aria-label={`Editar «${task.title}»`}
                    >
                      <Edit2 className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className={`${TASK_ACTION_BUTTON} text-slate-600 hover:text-red-700 hover:bg-red-50`}
                      aria-label={`Eliminar «${task.title}»`}
                    >
                      <Trash2 className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addTaskButton(true)}
        </div>
      )}

    </div>
  );
};
