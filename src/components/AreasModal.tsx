import React, { useRef, useState } from 'react';
import { Compass, Plus, X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import type { WheelArea } from '../types';
import {
  AREA_LABEL_MAX,
  MAX_VISIBLE_AREAS,
  newAreaId,
  storableAreas,
  validateAreas,
  visibleAreas
} from '../services/wheel';
import { DiscardChangesPrompt } from './DiscardChangesPrompt';
import { messages } from '../i18n/locale';

const m = messages(
  {
    title: 'Áreas de tu Rueda',
    close: 'Cerrar',
    intro: (max: number) =>
      `Cambia el nombre de cualquier área o añade las tuyas. Un área oculta sale de la Rueda y de las listas para elegir, pero conserva sus evaluaciones, sus metas y sus tareas. Entre 3 y ${max} a la vista.`,
    areas: 'Áreas',
    nameOf: (n: number) => `Nombre del área ${n}`,
    namePlaceholder: 'Nombre del área',
    inView: 'A la vista',
    areaN: (n: number) => `área ${n}`,
    removeArea: (n: number) => `Quitar el área ${n}`,
    remove: 'Quitar',
    addArea: 'Añadir un área',
    cancel: 'Cancelar',
    save: 'Guardar las áreas',
    discard: 'Has cambiado las áreas y no has guardado los cambios.'
  },
  {
    title: 'Your Wheel areas',
    close: 'Close',
    intro: (max) =>
      `Rename any area or add your own. A hidden area leaves the Wheel and the lists to choose from, but keeps its assessments, goals and tasks. Between 3 and ${max} in view.`,
    areas: 'Areas',
    nameOf: (n) => `Name of area ${n}`,
    namePlaceholder: 'Area name',
    inView: 'In view',
    areaN: (n) => `area ${n}`,
    removeArea: (n) => `Remove area ${n}`,
    remove: 'Remove',
    addArea: 'Add an area',
    cancel: 'Cancel',
    save: 'Save areas',
    discard: 'You’ve changed the areas and haven’t saved the changes.'
  }
);

interface AreasModalProps {
  areas: WheelArea[];
  onSave: (areas: WheelArea[]) => void;
  onClose: () => void;
}

// Un área en edición: las añadidas aquí se pueden quitar antes de guardar
type DraftArea = WheelArea & { isNew?: boolean };

// Editar las áreas de la Rueda: renombrarlas, ocultarlas (sin perder su historial, sus metas ni sus tareas) y añadir
// las propias. Se monta al abrirse.
export const AreasModal: React.FC<AreasModalProps> = ({ areas, onSave, onClose }) => {
  const [draft, setDraft] = useState<DraftArea[]>(() => areas.map((a) => ({ ...a })));
  const [submitted, setSubmitted] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const clean = (list: DraftArea[]): WheelArea[] =>
    list.map(({ id, label, hidden }) =>
      hidden ? { id, label: label.trim(), hidden: true } : { id, label: label.trim() }
    );
  const snapshot = JSON.stringify(clean(draft));
  const [openedSnapshot] = useState(snapshot);
  const guard = useDiscardGuard(snapshot !== openedSnapshot, onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, dialogRef, guard.requestClose);

  const error = validateAreas(clean(draft));
  const visibleCount = visibleAreas(draft).length;
  const update = (id: string, change: Partial<DraftArea>) =>
    setDraft((list) => list.map((a) => (a.id === id ? { ...a, ...change } : a)));

  const addArea = () => {
    setDraft((list) => [...list, { id: newAreaId(), label: '', isNew: true }]);
    // El foco va al nombre del área nueva
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLInputElement>('li:last-child input[type="text"]')?.focus()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    onSave(storableAreas(clean(draft)));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="areas-modal-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div
          inert={guard.confirming}
          className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4"
        >
          <h2 id="areas-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Compass className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            {m.title}
          </h2>
          <button
            type="button"
            onClick={guard.requestClose}
            aria-label={m.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} inert={guard.confirming} className="space-y-4 p-6">
          <p className="text-xs leading-relaxed text-slate-600">{m.intro(MAX_VISIBLE_AREAS)}</p>

          <ol ref={listRef} aria-label={m.areas} className="space-y-2">
            {draft.map((area, index) => (
              <li key={area.id} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={area.label}
                  onChange={(e) => update(area.id, { label: e.target.value })}
                  maxLength={AREA_LABEL_MAX}
                  aria-label={m.nameOf(index + 1)}
                  placeholder={m.namePlaceholder}
                  className={`min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none ${
                    area.hidden ? 'bg-slate-50 text-slate-500' : ''
                  }`}
                />
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!area.hidden}
                    onChange={(e) => update(area.id, { hidden: !e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  {m.inView}
                  <span className="sr-only">: {area.label || m.areaN(index + 1)}</span>
                </label>
                {area.isNew && (
                  <button
                    type="button"
                    onClick={() => setDraft((list) => list.filter((a) => a.id !== area.id))}
                    aria-label={m.removeArea(index + 1)}
                    className="min-h-11 rounded-xl px-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    {m.remove}
                  </button>
                )}
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={addArea}
            disabled={visibleCount >= MAX_VISIBLE_AREAS}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {m.addArea}
          </button>

          {submitted && error && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={guard.requestClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {m.cancel}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              {m.save}
            </button>
          </div>
        </form>

        {guard.confirming && (
          <DiscardChangesPrompt text={m.discard} onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />
        )}
      </div>
    </div>
  );
};
