import React, { useEffect, useRef, useState } from 'react';
import { GOAL_TITLE_MAX, validateGoal } from '../services/goals';
import { useAreas } from '../hooks/useAreas';

// Crear una meta sin salir del formulario de la tarea: nombre y área (lo demás se completa luego en «Metas»). Enter
// la crea y Escape cierra solo esta parte, no el formulario.
export const NewGoalInline: React.FC<{
  defaultArea?: string;
  onCreate: (goal: { title: string; area: string }) => void;
  onCancel: () => void;
}> = ({ defaultArea, onCreate, onCancel }) => {
  const { visible, selectable } = useAreas();
  const [title, setTitle] = useState('');
  const [area, setArea] = useState(defaultArea || visible[0]?.id || '');
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });
  useEffect(() => {
    titleRef.current?.focus();
    // Escape desde cualquier control de aquí cierra solo esta parte: la ventana ignora las teclas ya gestionadas
    const group = groupRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      cancelRef.current();
    };
    group?.addEventListener('keydown', onKeyDown);
    return () => group?.removeEventListener('keydown', onKeyDown);
  }, []);

  const create = () => {
    const problem = validateGoal({ title, area });
    if (problem) return setError(problem);
    onCreate({ title: title.trim(), area });
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-labelledby="task-new-goal-heading"
      className="mt-2 space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3"
    >
      <p id="task-new-goal-heading" className="text-xs font-bold text-slate-800">
        Nueva meta
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            // Enter crea la meta, no envía el formulario de la tarea
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
          maxLength={GOAL_TITLE_MAX}
          aria-label="Nombre de la nueva meta"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'task-new-goal-error' : undefined}
          placeholder="ej. Correr una media maratón"
          className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          aria-label="Área de la nueva meta"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        >
          {selectable(area || undefined).map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p id="task-new-goal-error" role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={create}
          className="min-h-11 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800"
        >
          Crear la meta
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-slate-600">
        Se guarda al crearla, aunque luego no guardes la tarea. El para qué y la fecha objetivo los puedes añadir en
        «Metas».
      </p>
    </div>
  );
};
