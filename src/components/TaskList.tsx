import React, { useState } from 'react';
import { Goal, TaskItem, ListContext, TaskPriority, TaskStatus } from '../types';
import { PRIORITY_LABEL, isArchived, statusLabel } from '../services/tasks';
import { blockerOf, tasksById } from '../services/dependencies';
import {
  DEFAULT_LIST_PREFS,
  ESTIMATE_OPTIONS,
  arrangeTasks,
  splitTop10,
  countActiveFilters,
  type DeadlineFilter,
  type ListFilters,
  type ListPrefs,
  type SortBy
} from '../services/taskListing';
import { useNow } from '../hooks/useNow';
import { useAreas } from '../hooks/useAreas';
import { PHONE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { TaskCard } from './TaskCard';
import { BottomSheet } from './BottomSheet';
import { DRAFTS_BUTTON_ID } from './TaskDraftsModal';
import { Plus, Archive, Layers, ArrowUpDown, CheckCircle2, FilePen, SlidersHorizontal, X } from 'lucide-react';
import { messages } from '../i18n/locale';

const m = messages(
  {
    deadlineFilters: {
      ALL: 'Todas',
      OVERDUE: 'Vencidas',
      NEXT_7_DAYS: 'Próximos 7 días',
      WITH_DATE: 'Con fecha límite',
      NO_DATE: 'Sin fecha límite'
    } satisfies Record<DeadlineFilter, string>,
    sortOptions: {
      priority: 'Prioridad (de crítica a baja)',
      deadline: 'Fecha límite (más próxima primero)',
      estimate: 'Estimación (más cortas primero)',
      date: 'Cambiadas hace menos',
      category: 'Área de la Rueda (o de la meta)'
    } satisfies Record<SortBy, string>,
    priority: 'Prioridad',
    allFeminine: 'Todas',
    allMasculine: 'Todos',
    estimateUpTo: 'Estimación hasta',
    any: 'Cualquiera',
    dueDate: 'Fecha límite',
    status: 'Estado',
    wheelArea: 'Área de la Rueda',
    hiddenByFilters: (count: number) =>
      `${count === 1 ? '1 tarea oculta' : `${count} tareas ocultas`} por los filtros.`,
    addTask: 'Añadir tarea',
    active: 'Activas',
    someday: 'Algún día',
    archived: 'Archivadas',
    drafts: 'Borradores',
    sortAndFilter: 'Ordenar y filtrar',
    sortBy: 'Ordenar por:',
    filters: 'Filtros',
    activeFilters: 'Filtros activos',
    removeFilter: (text: string) => `Quitar el filtro ${text}`,
    top10Filters: 'Filtros del Top 10',
    clearFilters: 'Quitar filtros',
    showTasks: (count: number) => (count === 1 ? 'Ver 1 tarea' : `Ver ${count} tareas`),
    yourTop10: 'Tu Top 10',
    allBlocked: 'Todas las tareas de esta lista esperan a otra. Las tienes debajo.',
    noneMatch: (hidden: number) =>
      `Ninguna tarea coincide con los filtros (${hidden} ${hidden === 1 ? 'oculta' : 'ocultas'}).`,
    showAll: 'Mostrar todas las tareas',
    emptyList: 'No hay tareas en esta lista.',
    addFirst: 'Añadir la primera tarea',
    rest: (from: number) => `El resto de tareas (de la ${from} en adelante)`,
    restList: (from: number) => `Posición ${from} en adelante`,
    forSomeday: 'Para algún día',
    somedayIntro:
      'Lo que quieres hacer algún día, sin prisa. No entra en tu Top 10, pero queda aquí para que lo revises cuando quieras.',
    somedayEmpty: 'No tienes nada guardado para algún día.'
  },
  {
    deadlineFilters: {
      ALL: 'All',
      OVERDUE: 'Overdue',
      NEXT_7_DAYS: 'Next 7 days',
      WITH_DATE: 'With a due date',
      NO_DATE: 'No due date'
    },
    sortOptions: {
      priority: 'Priority (critical to low)',
      deadline: 'Due date (soonest first)',
      estimate: 'Estimate (shortest first)',
      date: 'Recently changed',
      category: "Wheel area (or the goal's)"
    },
    priority: 'Priority',
    allFeminine: 'All',
    allMasculine: 'All',
    estimateUpTo: 'Estimate up to',
    any: 'Any',
    dueDate: 'Due date',
    status: 'Status',
    wheelArea: 'Wheel area',
    hiddenByFilters: (count) => `${count === 1 ? '1 task' : `${count} tasks`} hidden by the filters.`,
    addTask: 'Add task',
    active: 'Active',
    someday: 'Someday',
    archived: 'Archived',
    drafts: 'Drafts',
    sortAndFilter: 'Sort and filter',
    sortBy: 'Sort by:',
    filters: 'Filters',
    activeFilters: 'Active filters',
    removeFilter: (text) => `Remove the filter ${text}`,
    top10Filters: 'Top 10 filters',
    clearFilters: 'Clear filters',
    showTasks: (count) => (count === 1 ? 'Show 1 task' : `Show ${count} tasks`),
    yourTop10: 'Your Top 10',
    allBlocked: "Every task in this list is waiting for another one. You'll find them below.",
    noneMatch: (hidden) => `No tasks match the filters (${hidden} hidden).`,
    showAll: 'Show all tasks',
    emptyList: 'There are no tasks in this list.',
    addFirst: 'Add the first task',
    rest: (from) => `The rest of your tasks (from number ${from} on)`,
    restList: (from) => `Position ${from} onward`,
    forSomeday: 'For someday',
    somedayIntro:
      "Things you'd like to do someday, with no rush. They don't go into your Top 10, but they stay here for you to review whenever you like.",
    somedayEmpty: "You haven't saved anything for someday."
  }
);

const DEADLINE_FILTERS: { value: DeadlineFilter; label: string }[] = (
  ['ALL', 'OVERDUE', 'NEXT_7_DAYS', 'WITH_DATE', 'NO_DATE'] as const
).map((value) => ({ value, label: m.deadlineFilters[value] }));
const SORT_OPTIONS: { value: SortBy; label: string }[] = (
  ['priority', 'deadline', 'estimate', 'date', 'category'] as const
).map((value) => ({ value, label: m.sortOptions[value] }));
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
  // Borradores de tareas (las nuevas que se cerraron sin guardar): su botón sale si hay alguno
  draftsCount: number;
  onOpenDrafts: () => void;
  onChangeStatus: (task: TaskItem, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: TaskItem) => void;
  onDownloadTask: (task: TaskItem) => void;
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
  draftsCount,
  onOpenDrafts,
  onChangeStatus,
  onDeleteTask,
  onEditTask,
  onDownloadTask,
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

  // Las activas y las de «Algún día», que no entran en el Top 10
  const activeTasks = contextTasks.filter((t) => !t.isSomeday);
  const somedayTasks = contextTasks.filter((t) => t.isSomeday);

  // Jerarquía Visual: el Top 10 son las 10 primeras tareas tras filtrar y ordenar
  // (sin las bloqueadas: esperan a otra tarea y van con el resto)
  const byId = tasksById(tasks);
  const blockerFor = (task: TaskItem) => blockerOf(task, byId);
  const { label: areaName, selectable: selectableAreas } = useAreas();
  const arrangedTasks = arrangeTasks(activeTasks, prefs, now, areaName);
  const hiddenByFilters = activeTasks.length - arrangedTasks.length;
  const { top: top10Tasks, rest: peripheralTasks } = splitTop10(arrangedTasks, (task) => Boolean(blockerFor(task)));

  const filterFields: FilterField[] = [
    {
      key: 'priority',
      id: 'filter-priority',
      label: m.priority,
      value: prefs.filters.priority,
      options: [
        { value: 'ALL', label: m.allFeminine },
        ...(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => ({
          value: p,
          label: PRIORITY_LABEL[p]
        }))
      ]
    },
    {
      key: 'maxEstimate',
      id: 'filter-estimate',
      label: m.estimateUpTo,
      value: String(prefs.filters.maxEstimate),
      options: [
        { value: 'ALL', label: m.any },
        ...ESTIMATE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))
      ]
    },
    {
      key: 'deadline',
      id: 'filter-deadline',
      label: m.dueDate,
      value: prefs.filters.deadline,
      options: DEADLINE_FILTERS
    },
    {
      key: 'status',
      id: 'filter-status',
      label: m.status,
      value: prefs.filters.status,
      options: [
        { value: 'ALL', label: m.allMasculine },
        ...(['PENDING', 'IN_PROGRESS', 'BLOCKED'] as const).map((status) => ({
          value: status,
          label: statusLabel(status)
        }))
      ]
    },
    {
      key: 'category',
      id: 'filter-category',
      label: m.wheelArea,
      value: prefs.filters.category,
      options: [
        { value: 'ALL', label: m.allFeminine },
        ...selectableAreas(prefs.filters.category === 'ALL' ? undefined : prefs.filters.category).map((a) => ({
          value: a.id,
          label: a.label
        }))
      ]
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

  const hiddenSummary = <span role="status">{m.hiddenByFilters(hiddenByFilters)}</span>;

  // Cada tarjeta muestra la meta a la que contribuye
  const goalsById = new Map(goals.map((g) => [g.id, g]));
  const goalOf = (task: TaskItem) => (task.goalId ? goalsById.get(task.goalId) : undefined);

  const cardHandlers = {
    onChangeStatus,
    onEdit: onEditTask,
    onDelete: (task: TaskItem) => onDeleteTask(task.id),
    onDownload: onDownloadTask
  };

  // Botón al final de la lista para añadir otra tarea sin volver arriba
  const addTaskButton = (someday: boolean) => (
    <button
      type="button"
      onClick={() => onOpenNewTask({ someday })}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-xs font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-white hover:text-slate-900"
    >
      <Plus className="h-4 w-4" />
      {m.addTask}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Barra de control y pestañas del Gestor Dual */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center">
        {/* Pestañas: Top 10 y «Algún día», y acceso al archivo */}
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
            <span>{m.active}</span>
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
            <span>{m.someday}</span>
            <span className="py-0.2 rounded-full bg-slate-200 px-2 font-mono text-[10px] text-slate-800">
              {somedayTasks.length}
            </span>
          </button>

          <button
            onClick={onOpenArchive}
            className="flex items-center gap-2 rounded-xl border border-emerald-200 px-3.5 py-2 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{m.archived}</span>
            <span className="py-0.2 rounded-full bg-emerald-100 px-2 font-mono text-[10px] text-emerald-800">
              {archivedCount}
            </span>
          </button>

          {draftsCount > 0 && (
            <button
              id={DRAFTS_BUTTON_ID}
              onClick={onOpenDrafts}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 px-3.5 py-2 text-xs font-bold text-indigo-700 transition-all hover:bg-indigo-50"
            >
              <FilePen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{m.drafts}</span>
              <span className="py-0.2 rounded-full bg-indigo-100 px-2 font-mono text-[10px] text-indigo-800">
                {draftsCount}
              </span>
            </button>
          )}
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
              {m.sortAndFilter}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor="list-sort" className="flex items-center gap-1 text-slate-500">
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                {m.sortBy}
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
                {m.filters}
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          ))}
      </div>

      {/* Filtros activos: cada uno se quita con un toque */}
      {viewMode === 'active' && activeFilters.length > 0 && (
        <ul aria-label={m.activeFilters} className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => {
            const text = `${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => changeFilter(f, 'ALL')}
                  aria-label={m.removeFilter(text)}
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
          aria-label={m.top10Filters}
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
                {m.clearFilters}
              </button>
            </div>
          )}
        </div>
      )}

      {/* HOJA DE ORDEN Y FILTROS (móvil) */}
      <BottomSheet
        isOpen={isPhone && isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title={m.sortAndFilter}
        returnFocusTo={() => document.getElementById(FILTERS_BUTTON_ID)}
      >
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="list-sort" className="block font-semibold text-slate-600">
              {m.sortBy}
            </label>
            {sortSelect}
          </div>
          <div role="group" aria-label={m.top10Filters} className="grid grid-cols-1 gap-3">
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
                {m.clearFilters}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(false)}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"
          >
            {m.showTasks(arrangedTasks.length)}
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
                <h3 className="text-xs font-bold tracking-wider text-slate-900 uppercase">{m.yourTop10}</h3>
              </div>
            </div>

            {top10Tasks.length === 0 && arrangedTasks.length > 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-600">
                {m.allBlocked}
              </p>
            ) : top10Tasks.length === 0 && activeTasks.length > 0 ? (
              // Hay tareas, pero los filtros las ocultan todas: no se invita a crear otra
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
                <p className="text-sm font-semibold">{m.noneMatch(hiddenByFilters)}</p>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> {m.showAll}
                </button>
              </div>
            ) : top10Tasks.length === 0 ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                <p className="text-sm font-semibold">{m.emptyList}</p>
                <button
                  onClick={() => onOpenNewTask()}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4" /> {m.addFirst}
                </button>
              </div>
            ) : (
              <ol aria-label="Top 10" className="space-y-2.5">
                {top10Tasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    goal={goalOf(task)}
                    blocker={blockerFor(task)}
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
                  {m.rest(top10Tasks.length + 1)}
                </h3>
              </div>

              <ol aria-label={m.restList(top10Tasks.length + 1)} className="space-y-1.5">
                {peripheralTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    goal={goalOf(task)}
                    blocker={blockerFor(task)}
                    task={task}
                    now={now}
                    variant="peripheral"
                    position={index + top10Tasks.length + 1}
                    {...cardHandlers}
                  />
                ))}
              </ol>
            </div>
          )}

          {top10Tasks.length > 0 && addTaskButton(false)}
        </div>
      )}

      {/* VISTA 2: «ALGÚN DÍA» */}
      {viewMode === 'someday' && (
        <div className="space-y-4">
          <div className="space-y-1 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950">
            <p className="font-bold">{m.forSomeday}</p>
            <p className="text-[11px] leading-relaxed text-indigo-800">{m.somedayIntro}</p>
          </div>

          {somedayTasks.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              <p className="text-xs font-semibold">{m.somedayEmpty}</p>
            </div>
          ) : (
            <ul aria-label={m.someday} className="space-y-2.5">
              {somedayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  goal={goalOf(task)}
                  blocker={blockerFor(task)}
                  task={task}
                  now={now}
                  variant="someday"
                  {...cardHandlers}
                />
              ))}
            </ul>
          )}

          {addTaskButton(true)}
        </div>
      )}
    </div>
  );
};
