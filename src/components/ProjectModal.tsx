import React, { useEffect, useRef, useState } from 'react';
import { FolderKanban, Trash2, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { Goal, Project } from '../types';
import { PROJECT_DESCRIPTION_MAX, PROJECT_TITLE_MAX, validateProject } from '../services/projects';
import { areasInUse } from '../services/wheel';
import { useAreas } from '../hooks/useAreas';
import { DateField } from './DateField';
import { DiscardChangesPrompt } from './DiscardChangesPrompt';

interface ProjectModalProps {
  // Proyecto que se edita, o ninguno para crear uno
  project?: Project;
  // Al crearlo desde una meta, esa meta ya elegida
  initialGoalId?: string;
  goals: Goal[];
  onSave: (project: Project) => void;
  onDelete: (project: Project) => void;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none';
const labelClass = 'mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase';

// Crear o editar un proyecto: nombre, meta, fecha de fin y descripción. Se monta al abrirse.
export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  initialGoalId,
  goals,
  onSave,
  onDelete,
  onClose
}) => {
  const [title, setTitle] = useState(project?.title ?? '');
  const [goalId, setGoalId] = useState(project?.goalId ?? initialGoalId ?? '');
  const [endDate, setEndDate] = useState(project?.endDate ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDelete) confirmRef.current?.focus();
  }, [confirmDelete]);

  // Cambios sin guardar: frente a como se abrió
  const snapshot = JSON.stringify([title, goalId, endDate, description]);
  const [openedSnapshot] = useState(snapshot);
  // Una fecha a medio escribir (o imposible) también es un cambio
  const [dateDraft, setDateDraft] = useState(false);
  const guard = useDiscardGuard(snapshot !== openedSnapshot || dateDraft, onClose);

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, dialogRef, guard.requestClose);

  // Metas que se pueden elegir: las activas, y la ya elegida aunque esté lograda o archivada
  const goalOptions = goals.filter((g) => g.status === 'ACTIVE' || g.id === goalId);
  const { areas, label } = useAreas();
  const error = validateProject({ title, goalId, endDate, description });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    const now = new Date().toISOString();
    onSave({
      id: project?.id ?? `project-${Date.now()}`,
      userId: project?.userId ?? '',
      title: title.trim(),
      goalId,
      endDate,
      description: description.trim() || undefined,
      status: project?.status ?? 'ACTIVE',
      createdAt: project?.createdAt ?? now,
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
        aria-labelledby="project-modal-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div
          inert={guard.confirming}
          className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4"
        >
          <h2 id="project-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FolderKanban className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            {project ? 'Editar el proyecto' : 'Nuevo proyecto'}
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
            Un conjunto de tareas con fecha de fin para avanzar en una meta. Su avance se ve como una batería.
          </p>

          <div>
            <label htmlFor="project-title" className={labelClass}>
              Proyecto <span className="text-red-600">*</span>
            </label>
            <input
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={PROJECT_TITLE_MAX}
              placeholder="ej. Reformar la cocina"
              className={inputClass}
              data-autofocus
            />
          </div>

          <div>
            <label htmlFor="project-goal" className={labelClass}>
              Meta <span className="text-red-600">*</span>
            </label>
            <select
              id="project-goal"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className={`${inputClass} bg-white`}
            >
              <option value="">Elige una meta…</option>
              {goalId && !goals.some((g) => g.id === goalId) && <option value={goalId}>(Meta no disponible)</option>}
              {areasInUse(
                areas,
                goalOptions.map((g) => g.area)
              ).map((area) => (
                <optgroup key={area} label={label(area)}>
                  {goalOptions
                    .filter((g) => g.area === area)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                        {g.status === 'ACHIEVED' ? ' (lograda)' : g.status === 'ARCHIVED' ? ' (archivada)' : ''}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Sus tareas contarán en el avance de esa meta.</p>
          </div>

          <div>
            <span className={labelClass}>
              Fecha de fin <span className="text-red-600">*</span>
            </span>
            <DateField
              label="Fecha de fin"
              value={endDate}
              onChange={setEndDate}
              onDraftChange={setDateDraft}
              inputClassName={inputClass}
            />
          </div>

          <div>
            <label htmlFor="project-description" className={labelClass}>
              Descripción <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
            </label>
            <textarea
              id="project-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={PROJECT_DESCRIPTION_MAX}
              placeholder="Qué tiene que quedar hecho al terminar"
              className={inputClass}
            />
          </div>

          {submitted && error && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            {project ? (
              confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                  <span id="project-delete-note">Sus tareas se quedan en la meta, sin proyecto.</span>
                  <button
                    ref={confirmRef}
                    aria-describedby="project-delete-note"
                    type="button"
                    onClick={() => {
                      onDelete(project);
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
                  Eliminar el proyecto
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
                {project ? 'Guardar los cambios' : 'Crear el proyecto'}
              </button>
            </div>
          </div>
        </form>

        {guard.confirming && (
          <DiscardChangesPrompt
            text={
              project
                ? 'Has cambiado este proyecto y no has guardado los cambios.'
                : 'Has empezado un proyecto nuevo y no lo has guardado.'
            }
            onKeepEditing={guard.keepEditing}
            onDiscard={guard.discard}
          />
        )}
      </div>
    </div>
  );
};
