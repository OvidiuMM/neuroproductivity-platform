import React, { useEffect, useRef, useState } from 'react';
import { Target, Trash2, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { Goal, WheelCategory } from '../types';
import { GOAL_TITLE_MAX, GOAL_WHY_MAX, validateGoal } from '../services/goals';
import { WHEEL_CATEGORIES } from '../services/wheel';
import { DateField } from './DateField';
import { DiscardChangesPrompt } from './DiscardChangesPrompt';

interface GoalModalProps {
  // Meta que se edita, o ninguna para crear una
  goal?: Goal;
  // Al crearla desde un área de «Metas», esa área ya elegida
  initialArea?: WheelCategory;
  onSave: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  // Proyectos de la meta: mientras tenga alguno, no se puede eliminar
  projectCount?: number;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none';
const labelClass = 'mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase';

// Crear o editar una meta: nombre, área de la Rueda, para qué y fecha objetivo. Se monta al abrirse.
export const GoalModal: React.FC<GoalModalProps> = ({
  goal,
  initialArea,
  onSave,
  onDelete,
  projectCount = 0,
  onClose
}) => {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [area, setArea] = useState<WheelCategory | ''>(goal?.area ?? initialArea ?? '');
  const [why, setWhy] = useState(goal?.why ?? '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Al pedir confirmación, el foco pasa al botón que confirma (y el lector lee el aviso, que lo describe)
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDelete) confirmRef.current?.focus();
  }, [confirmDelete]);

  // Cambios sin guardar: frente a como se abrió (la ventana se monta al abrirse)
  const snapshot = JSON.stringify([title, area, why, targetDate]);
  const [openedSnapshot] = useState(snapshot);
  // Una fecha a medio escribir (o imposible) también es un cambio
  const [dateDraft, setDateDraft] = useState(false);
  const guard = useDiscardGuard(snapshot !== openedSnapshot || dateDraft, onClose);

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, dialogRef, guard.requestClose);

  const error = validateGoal({ title, area: area || undefined, why, targetDate: targetDate || undefined });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error || !area) return;
    const now = new Date().toISOString();
    onSave({
      id: goal?.id ?? `goal-${Date.now()}`,
      userId: goal?.userId ?? '',
      title: title.trim(),
      area,
      why: why.trim() || undefined,
      targetDate: targetDate || undefined,
      status: goal?.status ?? 'ACTIVE',
      createdAt: goal?.createdAt ?? now,
      updatedAt: now
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-modal-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div
          inert={guard.confirming}
          className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4"
        >
          <h2 id="goal-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Target className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            {goal ? 'Editar la meta' : 'Nueva meta'}
          </h2>
          <button
            type="button"
            onClick={guard.requestClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Con la validación del navegador: una fecha imposible (p. ej. 31/02) bloquea el envío con su mensaje */}
        <form onSubmit={handleSubmit} inert={guard.confirming} className="space-y-4 p-6">
          <p className="text-xs leading-relaxed text-slate-600">
            Una meta concreta dentro de un área de tu Rueda. Vincúlale tareas para ver cómo avanza.
          </p>

          <div>
            <label htmlFor="goal-title" className={labelClass}>
              Meta <span className="text-red-600">*</span>
            </label>
            <input
              id="goal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={GOAL_TITLE_MAX}
              placeholder="ej. Correr una media maratón"
              className={inputClass}
              data-autofocus
            />
          </div>

          <div>
            <label htmlFor="goal-area" className={labelClass}>
              Área de la Rueda <span className="text-red-600">*</span>
            </label>
            <select
              id="goal-area"
              value={area}
              onChange={(e) => setArea(e.target.value as WheelCategory | '')}
              className={`${inputClass} bg-white`}
            >
              <option value="">Elige un área…</option>
              {WHEEL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="goal-why" className={labelClass}>
              ¿Para qué? <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
            </label>
            <textarea
              id="goal-why"
              rows={2}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              maxLength={GOAL_WHY_MAX}
              placeholder="Lo que te importa de conseguirla"
              className={inputClass}
            />
          </div>

          <div>
            <span className={labelClass}>
              Fecha objetivo <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
            </span>
            <DateField
              label="Fecha objetivo"
              value={targetDate}
              onChange={setTargetDate}
              onDraftChange={setDateDraft}
              inputClassName={inputClass}
            />
          </div>

          {submitted && error && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            {goal && projectCount > 0 ? (
              <p className="max-w-xs text-[11px] text-slate-600">
                Tiene {projectCount === 1 ? 'un proyecto' : `${projectCount} proyectos`}: para eliminarla, elimínalos o
                pásalos a otra meta antes.
              </p>
            ) : goal ? (
              confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                  <span id="goal-delete-note">Sus tareas se quedan, sin meta.</span>
                  <button
                    ref={confirmRef}
                    aria-describedby="goal-delete-note"
                    type="button"
                    onClick={() => {
                      onDelete(goal);
                      onClose();
                    }}
                    className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
                  >
                    Eliminar definitivamente
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg px-2 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    No eliminar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Eliminar la meta
                </button>
              )
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={guard.requestClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
              >
                {goal ? 'Guardar los cambios' : 'Crear la meta'}
              </button>
            </div>
          </div>
        </form>

        {guard.confirming && (
          <DiscardChangesPrompt
            text={
              goal
                ? 'Has cambiado esta meta y no has guardado los cambios.'
                : 'Has empezado una meta nueva y no la has guardado.'
            }
            onKeepEditing={guard.keepEditing}
            onDiscard={guard.discard}
          />
        )}
      </div>
    </div>
  );
};
