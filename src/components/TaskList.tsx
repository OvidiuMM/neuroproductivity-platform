import React, { useState } from 'react';
import { TaskItem, ListContext, TaskPriority } from '../types';
import {
  CheckCircle2,
  Circle,
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
  ChevronDown,
  Layers,
  ArrowUpDown
} from 'lucide-react';

interface TaskListProps {
  tasks: TaskItem[];
  activeContext: ListContext;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: TaskItem) => void;
  onOpenNewTask: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  activeContext,
  onToggleComplete,
  onDeleteTask,
  onEditTask,
  onOpenNewTask
}) => {
  const [viewMode, setViewMode] = useState<'active' | 'someday'>('active');
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'category'>('priority');

  // Filtrado por contexto estricto (Segregación Inquebrantable)
  const contextTasks = tasks.filter((t) => t.listContext === activeContext);

  // Separación entre tareas activas y el sumidero cognitivo "Quizá" / "Algún día"
  const activeTasks = contextTasks.filter((t) => !t.isSomeday);
  const somedayTasks = contextTasks.filter((t) => t.isSomeday);

  // Ordenación dinámica multidimensional
  const priorityOrder: Record<TaskPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };

  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    // Si una está completada, enviarla al final
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    if (sortBy === 'priority') {
      const pDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    } else if (sortBy === 'category') {
      const catA = a.wheelCategory || '';
      const catB = b.wheelCategory || '';
      return catA.localeCompare(catB);
    } else {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  // Jerarquía Visual: Separar Top 10 del resto
  const top10Tasks = sortedActiveTasks.slice(0, 10);
  const peripheralTasks = sortedActiveTasks.slice(10);

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

  return (
    <div className="space-y-6">
      
      {/* Barra de control y pestañas del Gestor Dual */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Pestañas: Top 10 Activo vs Opciones Futuras */}
        <div className="flex items-center gap-2">
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
        </div>

        {/* Selector de ordenación multidimensional */}
        {viewMode === 'active' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar por:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="priority">Prioridad Ordinal (Crítica → Baja)</option>
              <option value="date">Última Modificación (Descendente)</option>
              <option value="category">Categoría de la Rueda de la Vida</option>
            </select>
          </div>
        )}
      </div>

      {/* VISTA 1: FLUJO ACTIVO CON JERARQUÍA GESTALT (TOP 10 VS PERIFÉRICO) */}
      {viewMode === 'active' && (
        <div className="space-y-6">

          {/* ZONA 1: TOP 10 OPERATIVO (ALTA ELEVACIÓN, PESO 700, CONTRASTE ELEVADO) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
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

            {top10Tasks.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-3">
                <p className="text-sm font-semibold">No hay acciones operativas activas en esta lista.</p>
                <button
                  onClick={onOpenNewTask}
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
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                      task.completed
                        ? 'bg-slate-50/70 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200/90 shadow-md shadow-slate-900/4 hover:shadow-lg hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Índice 1 al 10 con destacado */}
                      <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>

                      {/* Botón de completar */}
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                        )}
                      </button>

                      {/* Contenido principal con font-weight: 700 y espaciado expandido */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <h4
                            className={`text-sm sm:text-base font-bold text-slate-900 leading-snug tracking-tight ${
                              task.completed ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {task.title}
                          </h4>

                          <div className="flex items-center gap-2 shrink-0">
                            {getPriorityBadge(task.priority)}

                            {task.wheelCategory && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                {task.wheelCategory}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {task.description}
                        </p>

                        {/* Metadatos y Observaciones JSONB */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
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
                            <span className="text-slate-400">
                              · NLP ({Math.round((task.wheelCategoryConfidence || 0.8) * 100)}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Acciones de tarea */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onEditTask(task)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Editar tarea"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-4 h-4" />
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
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Inventario Secundario (Posición 11 en adelante · Campo Periférico)
                </h3>
                <span className="text-[11px] text-slate-400">
                  Tratamiento visual plano y desaturado para mitigar fatiga ocular
                </span>
              </div>

              <div className="space-y-1.5">
                {peripheralTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white text-slate-600 text-xs transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 w-5 text-right shrink-0">
                        {index + 11}.
                      </span>
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className="text-slate-300 hover:text-emerald-600 shrink-0"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <span className={`truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {task.title}
                      </span>
                      {task.wheelCategory && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          · {task.wheelCategory}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {task.priority}
                      </span>
                      <button
                        onClick={() => onEditTask(task)}
                        className="p-1 text-slate-400 hover:text-indigo-600"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-600">{task.description}</p>
                    {task.wheelCategory && (
                      <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1">
                        Área: {task.wheelCategory}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditTask(task)}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
