import React, { useState } from 'react';
import { Goal, TaskItem, ListContext, TaskPriority, TaskStatus, WheelCategory } from '../types';
import { PRIORITY_LABEL, isArchived } from '../services/tasks';
import {
  DEFAULT_LIST_PREFS,
  ESTIMATE_OPTIONS,
  arrangeTasks,
  countActiveFilters,
  type DeadlineFilter,
  type ListFilters,
  type ListPrefs,
  type SortBy
} from '../services/taskListing';
import { useNow } from '../hooks/useNow';
import { PHONE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { TaskCard } from './TaskCard';
import { BottomSheet } from './BottomSheet';
import { Plus, Archive, Layers, ArrowUpDown, CheckCircle2, SlidersHorizontal, X } from 'lucide-react';

const WHEEL_CATEGORIES: WheelCategory[] = [
  'Salud',
  'Carrera Profesional',
  'Finanzas',
  'Familia',
  'Ocio',
  'Relaciones',
  'Espiritualidad'
];
const DEADLINE_FILTERS: { value: DeadlineFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'OVERDUE', label: 'Vencidas' },
  { value: 'NEXT_7_DAYS', label: 'Próximos 7 días' },
  { value: 'WITH_DATE', label: 'Con fecha límite' },
  { value: 'NO_DATE', label: 'Sin fecha límite' }
];
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'priority', label: 'Prioridad (de crítica a baja)' },
  { value: 'deadline', label: 'Fecha límite (más próxima primero)' },
  { value: 'estimate', label: 'Estimación (más cortas primero)' },
  { value: 'date', label: 'Cambiadas hace menos' },
  { value: 'category', label: 'Área de la Rueda (o de la meta)' }
];
const FILTERS_BUTTON_ID = 'list-filters-button';

interface FilterField {
  key: keyof ListFilters;
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

interface TaskListProps {
  tasks: TaskItem[];
  goals: Goal[];
  activeContext: ListContext;
  // Orden y filtros del Top 10: los guarda App, que también los usa para el resumen «Top 10»
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
  goals,
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
  // En el móvil, el orden y los filtros van en una hoja inferior
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  // Al pasar a tableta o escritorio la hoja no se ve: se cierra (y no reaparece al volver al móvil)
  if (isFilterSheetOpen && !isPhone) setIsFilterSheetOpen(false);

  const clearFilters = () => setPrefs((p) => ({ ...p, filters: DEFAULT_LIST_PREFS.filters }));

  // Reloj de la lista: los colores de plazo y la prioridad efectiva cambian solos con el tiempo
  const now = useNow();

  // Filtrado por contexto estricto (Segregación Inquebrantable); las tareas hechas están archivadas
  const contextTasks = tasks.filter((t) => t.listContext === activeContext && !isArchived(t));

  // Separación entre tareas activas y el sumidero cognitivo "Quizá" / "Algún día"
  const activeTasks = contextTasks.filter((t) => !t.isSomeday);
  const somedayTasks = contextTasks.filter((t) => t.isSomeday);

  // Jerarquía Visual: el Top 10 son las 10 primeras tareas tras filtrar y ordenar
  const arrangedTasks = arrangeTasks(activeTasks, prefs, now);
  const hiddenByFilters = activeTasks.length - arrangedTasks.length;
  const top10Tasks = arrangedTasks.slice(0, 10);
  const peripheralTasks = arrangedTasks.slice(10);

  const filterFields: FilterField[] = [
    {
      key: 'priority',
      id: 'filter-priority',
      label: 'Prioridad',
      value: prefs.filters.priority,
      options: [
        { value: 'ALL', label: 'Todas' },
        ...(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => ({
          value: p,
          label: PRIORITY_LABEL[p]
        }))
      ]
    },
    {
      key: 'maxEstimate',
      id: 'filter-estimate',
      label: 'Estimación hasta',
      value: String(prefs.filters.maxEstimate),
      options: [
        { value: 'ALL', label: 'Cualquiera' },
        ...ESTIMATE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))
      ]
    },
    {
      key: 'deadline',
      id: 'filter-deadline',
      label: 'Fecha límite',
      value: prefs.filters.deadline,
      options: DEADLINE_FILTERS
    },
    {
      key: 'status',
      id: 'filter-status',
      label: 'Estado',
      value: prefs.filters.status,
      options: [
        { value: 'ALL', label: 'Todos' },
        { value: 'PENDING', label: 'Pendiente' },
        { value: 'IN_PROGRESS', label: 'En progreso' },
        { value: 'BLOCKED', label: 'Bloqueada' }
      ]
    },
    {
      key: 'category',
      id: 'filter-category',
      label: 'Área de la Rueda',
      value: prefs.filters.category,
      options: [{ value: 'ALL', label: 'Todas' }, ...WHEEL_CATEGORIES.map((c) => ({ value: c, label: c }))]
    }
  ];
  // Los valores salen de las opciones de cada campo; la estimación se guarda como número
  const changeFilter = (field: FilterField, value: string) =>
    setPrefs((p) => ({
      ...p,
      filters: {
        ...p.filters,
        [field.key]: field.key === 'maxEstimate' && value !== 'ALL' ? Number(value) : value
      }
    }));
  const activeFilters = filterFields.filter((f) => f.value !== 'ALL');

  const sortSelect = (
    <select
      id="list-sort"
      value={prefs.sortBy}
      onChange={(e) => setPrefs((p) => ({ ...p, sortBy: e.target.value as SortBy }))}
      className="max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const filterSelects = filterFields.map((f) => (
    <div key={f.id} className="space-y-1">
      <label htmlFor={f.id} className="block font-semibold text-slate-600">
        {f.label}
      </label>
      <select
        id={f.id}
        value={f.value}
        onChange={(e) => changeFilter(f, e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
      >
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ));

  const hiddenSummary = (
    <span role="status">
      {hiddenByFilters === 1 ? '1 tarea oculta' : `${hiddenByFilters} tareas ocultas`} por los filtros.
    </span>
  );

  // Cada tarjeta muestra la meta a la que contribuye
  const goalsById = new Map(goals.map((g) => [g.id, g]));
  const goalOf = (task: TaskItem) => (task.goalId ? goalsById.get(task.goalId) : undefined);

  const cardHandlers = {
    onChangeStatus,
    onEdit: onEditTask,
    onDelete: (task: TaskItem) => onDeleteTask(task.id)
  };

  // Botón al final de la lista para añadir otra tarea sin volver arriba
  const addTaskButton = (someday: boolean) => (
    <button
      type="button"
      onClick={() => onOpenNewTask({ someday })}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-xs font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-white hover:text-slate-900"
    >
      <Plus className="h-4 w-4" />
      Añadir tarea
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Barra de control y pestañas del Gestor Dual */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center">
        {/* Pestañas: Top 10 Activo vs Opciones Futuras, y acceso al archivo */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode('active')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              viewMode === 'active'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Activas</span>
            <span className="py-0.2 rounded-full bg-slate-700 px-2 font-mono text-[10px] text-white">
              {activeTasks.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode('someday')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              viewMode === 'someday'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Algún día</span>
            <span className="py-0.2 rounded-full bg-slate-200 px-2 font-mono text-[10px] text-slate-800">
              {somedayTasks.length}
            </span>
          </button>

          <button
            onClick={onOpenArchive}
            className="flex items-center gap-2 rounded-xl border border-emerald-200 px-3.5 py-2 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Archivadas</span>
            <span className="py-0.2 rounded-full bg-emerald-100 px-2 font-mono text-[10px] text-emerald-800">
              {archivedCount}
            </span>
          </button>
        </div>

        {/* Orden y filtros del Top 10: en línea en tableta y escritorio, en una hoja en el móvil */}
        {viewMode === 'active' &&
          (isPhone ? (
            <button
              id={FILTERS_BUTTON_ID}
              data-tour="filters"
              type="button"
              onClick={() => setIsFilterSheetOpen(true)}
              aria-haspopup="dialog"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ${
                activeFilterCount > 0
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Ordenar y filtrar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor="list-sort" className="flex items-center gap-1 text-slate-500">
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                Ordenar por:
              </label>
              {sortSelect}
              <button
                type="button"
                onClick={() => setShowFilters((open) => !open)}
                data-tour="filters"
                aria-expanded={showFilters}
                aria-controls="list-filters"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  activeFilterCount > 0
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          ))}
      </div>

      {/* Filtros activos: cada uno se quita con un toque */}
      {viewMode === 'active' && activeFilters.length > 0 && (
        <ul aria-label="Filtros activos" className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => {
            const text = `${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => changeFilter(f, 'ALL')}
                  aria-label={`Quitar el filtro ${text}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-1 pr-2 pl-3 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                >
                  {text}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* PANEL DE FILTROS DEL TOP 10 (tableta y escritorio) */}
      {viewMode === 'active' && !isPhone && showFilters && (
        <div
          id="list-filters"
          role="group"
          aria-label="Filtros del Top 10"
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-xs sm:grid-cols-2 lg:grid-cols-5"
        >
          {filterSelects}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 sm:col-span-2 lg:col-span-5">
              {hiddenSummary}
              <button
                type="button"
                onClick={clearFilters}
                className="font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Quitar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* HOJA DE ORDEN Y FILTROS (móvil) */}
      <BottomSheet
        isOpen={isPhone && isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Ordenar y filtrar"
        returnFocusTo={() => document.getElementById(FILTERS_BUTTON_ID)}
      >
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="list-sort" className="block font-semibold text-slate-600">
              Ordenar por:
            </label>
            {sortSelect}
          </div>
          <div role="group" aria-label="Filtros del Top 10" className="grid grid-cols-1 gap-3">
            {filterSelects}
          </div>
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
              {hiddenSummary}
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Quitar filtros
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(false)}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"
          >
            {arrangedTasks.length === 1 ? 'Ver 1 tarea' : `Ver ${arrangedTasks.length} tareas`}
          </button>
        </div>
      </BottomSheet>

      {/* VISTA 1: FLUJO ACTIVO CON JERARQUÍA GESTALT (TOP 10 VS PERIFÉRICO) */}
      {viewMode === 'active' && (
        <div className="space-y-6">
          {/* ZONA 1: TOP 10 OPERATIVO (ALTA ELEVACIÓN, PESO 700, CONTRASTE ELEVADO) */}
          <div className="space-y-3" data-tour="top10">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-600" />
                <h3 className="text-xs font-bold tracking-wider text-slate-900 uppercase">Tu Top 10</h3>
              </div>
            </div>

            {top10Tasks.length === 0 && activeTasks.length > 0 ? (
              // Hay tareas, pero los filtros las ocultan todas: no se invita a crear otra
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
                <p className="text-sm font-semibold">
                  Ninguna tarea coincide con los filtros ({hiddenByFilters}{' '}
                  {hiddenByFilters === 1 ? 'oculta' : 'ocultas'}).
                </p>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Mostrar todas las tareas
                </button>
              </div>
            ) : top10Tasks.length === 0 ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                <p className="text-sm font-semibold">No hay tareas en esta lista.</p>
                <button
                  onClick={() => onOpenNewTask()}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4" /> Añadir la primera tarea
                </button>
              </div>
            ) : (
              <ol aria-label="Top 10" className="space-y-2.5">
                {top10Tasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    goal={goalOf(task)}
                    task={task}
                    now={now}
                    variant="top"
                    position={index + 1}
                    {...cardHandlers}
                  />
                ))}
              </ol>
            )}
          </div>

          {/* ZONA 2: TAREAS SECUNDARIAS (ÍNDICE 11 EN ADELANTE: DISEÑO MINIMALISTA, SIN SOMBRAS, BAJO CONTRASTE) */}
          {peripheralTasks.length > 0 && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
                <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  El resto de tareas (de la 11 en adelante)
                </h3>
              </div>

              <ol aria-label="Posición 11 en adelante" className="space-y-1.5">
                {peripheralTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    goal={goalOf(task)}
                    task={task}
                    now={now}
                    variant="peripheral"
                    position={index + 11}
                    {...cardHandlers}
                  />
                ))}
              </ol>
            </div>
          )}

          {top10Tasks.length > 0 && addTaskButton(false)}
        </div>
      )}

      {/* VISTA 2: SUMIDERO COGNITIVO "QUIZÁ" / "ALGÚN DÍA" (HU-03) */}
      {viewMode === 'someday' && (
        <div className="space-y-4">
          <div className="space-y-1 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950">
            <p className="font-bold">Para algún día</p>
            <p className="text-[11px] leading-relaxed text-indigo-800">
              Lo que quieres hacer algún día, sin prisa. No entra en tu Top 10, pero queda aquí para que lo revises
              cuando quieras.
            </p>
          </div>

          {somedayTasks.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              <p className="text-xs font-semibold">No tienes nada guardado para algún día.</p>
            </div>
          ) : (
            <ul aria-label="Algún día" className="space-y-2.5">
              {somedayTasks.map((task) => (
                <TaskCard key={task.id} goal={goalOf(task)} task={task} now={now} variant="someday" {...cardHandlers} />
              ))}
            </ul>
          )}

          {addTaskButton(true)}
        </div>
      )}
    </div>
  );
};
