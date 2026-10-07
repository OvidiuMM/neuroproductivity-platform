import React, { useState, useEffect } from 'react';
import { TaskItem, ListContext, TaskPriority, WheelCategory, TaskObservation } from '../types';
import { analyzeImmediateActionSyntax, SyntaxAnalysisResult } from '../services/syntaxAnalyzer';
import { inferWheelCategory, NLPSuggestionResult } from '../services/nlpEngine';
import { X, AlertTriangle, Sparkles, Check, CheckCircle2, ShieldAlert, ArrowRight, ListPlus } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'completed'>) => void;
  initialContext: ListContext;
  editingTask?: TaskItem | null;
}

const WHEEL_CATEGORIES_LIST: WheelCategory[] = [
  'Salud',
  'Carrera Profesional',
  'Finanzas',
  'Familia',
  'Ocio',
  'Relaciones',
  'Espiritualidad'
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSaveTask,
  initialContext,
  editingTask
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listContext, setListContext] = useState<ListContext>(initialContext);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [isSomeday, setIsSomeday] = useState(false);
  const [wheelCategory, setWheelCategory] = useState<WheelCategory | undefined>();
  const [wheelCategoryConfidence, setWheelCategoryConfidence] = useState<number | undefined>();
  const [linkedBy, setLinkedBy] = useState<'MANUAL' | 'AUTO_TFIDF'>('MANUAL');
  const [observations, setObservations] = useState<TaskObservation[]>([]);
  const [newObsText, setNewObsText] = useState('');

  // Estados de validación en tiempo real
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [syntaxResult, setSyntaxResult] = useState<SyntaxAnalysisResult>({ isValid: false, detectedVerb: null });
  const [nlpResult, setNlpResult] = useState<NLPSuggestionResult | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [overrideSyntaxWarning, setOverrideSyntaxWarning] = useState(false);

  // Inicializar o limpiar al abrir modal
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setListContext(editingTask.listContext);
      setPriority(editingTask.priority);
      setIsSomeday(editingTask.isSomeday);
      setWheelCategory(editingTask.wheelCategory);
      setWheelCategoryConfidence(editingTask.wheelCategoryConfidence);
      setLinkedBy(editingTask.linkedBy || 'MANUAL');
      setObservations(editingTask.observations || []);
      setSyntaxResult(analyzeImmediateActionSyntax(editingTask.title));
      setOverrideSyntaxWarning(true);
    } else {
      setTitle('');
      setDescription('');
      setListContext(initialContext);
      setPriority('MEDIUM');
      setIsSomeday(false);
      setWheelCategory(undefined);
      setWheelCategoryConfidence(undefined);
      setLinkedBy('MANUAL');
      setObservations([]);
      setSyntaxResult({ isValid: false, detectedVerb: null });
      setNlpResult(null);
      setTouched({});
      setOverrideSyntaxWarning(false);
    }
  }, [isOpen, editingTask, initialContext]);

  // Ejecución del Analizador Sintáctico de Acción Inmediata en tiempo real (Módulo 4)
  useEffect(() => {
    if (title.trim()) {
      const result = analyzeImmediateActionSyntax(title);
      setSyntaxResult(result);
    } else {
      setSyntaxResult({ isValid: false, detectedVerb: null, warning: 'El nombre es obligatorio.' });
    }
  }, [title]);

  // Disparador del Motor NLP TF-IDF (Módulo 3) en evento onBlur o cuando hay texto suficiente
  const triggerNLPInference = () => {
    if (!description.trim() && !title.trim()) return;
    setNlpLoading(true);
    // Simulación del microservicio asíncrono (< 350ms según especificación)
    setTimeout(() => {
      const res = inferWheelCategory(title, description);
      setNlpResult(res);
      setNlpLoading(false);
      // Si la confianza es alta y aún no hay categoría manual seleccionada, sugerir
      if (res.category && res.isAboveThreshold && !wheelCategory) {
        // Mantiene en el badge para aceptación de 1-clic
      }
    }, 150);
  };

  const applyNlpSuggestion = (cat: WheelCategory, conf: number) => {
    setWheelCategory(cat);
    setWheelCategoryConfidence(conf);
    setLinkedBy('AUTO_TFIDF');
    setNlpResult(null);
  };

  const applySyntaxSuggestion = (sug: string) => {
    setTitle(sug);
    setOverrideSyntaxWarning(true);
  };

  const handleAddObservation = () => {
    if (!newObsText.trim()) return;
    const newObs: TaskObservation = {
      id: `obs-${Date.now()}`,
      type: 'note',
      text: newObsText.trim(),
      createdAt: new Date().toISOString()
    };
    setObservations([...observations, newObs]);
    setNewObsText('');
  };

  const handleRemoveObservation = (id: string) => {
    setObservations(observations.filter(o => o.id !== id));
  };

  // Reglas de Validación de Entrada (Estricto cumplimiento de especificaciones)
  const isTitleEmpty = !title.trim();
  const isTitleTooLong = title.length > 100;
  const isSyntaxInvalid = !syntaxResult.isValid && !overrideSyntaxWarning;
  const isDescriptionEmpty = !description.trim();

  const isFormValid =
    !isTitleEmpty &&
    !isTitleTooLong &&
    !isSyntaxInvalid &&
    !isDescriptionEmpty &&
    Boolean(listContext) &&
    Boolean(priority);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, description: true });

    if (!isFormValid) {
      return;
    }

    onSaveTask({
      userId: 'user-default',
      listContext,
      title: title.trim(),
      description: description.trim(),
      priority,
      isSomeday,
      wheelCategory,
      wheelCategoryConfidence,
      linkedBy,
      observations
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-indigo-600" />
              {editingTask ? 'Editar Acción Operativa' : 'Captura de Nueva Acción Inmediata'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtro sintáctico prefrontal y enlace cognitivo con la Rueda de la Vida
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* CAMPO 1: Contexto de Lista (Segregación Estricta Módulo 2) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Contexto Excluyente <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setListContext('WORK')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  listContext === 'WORK'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                Esfera Profesional (Trabajo)
              </button>
              <button
                type="button"
                onClick={() => setListContext('PERSONAL')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  listContext === 'PERSONAL'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Esfera Personal (Vida)
              </button>
            </div>
          </div>

          {/* CAMPO 2: Nombre de la Tarea + Analizador Sintáctico de Acción Inmediata (Módulo 4) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Acción Inmediata Siguiente <span className="text-red-500">*</span>
              </label>
              <span className={`text-[11px] font-mono ${title.length > 100 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                {title.length}/100 caracteres
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setOverrideSyntaxWarning(false);
                }}
                onBlur={() => setTouched({ ...touched, title: true })}
                placeholder="ej. Llamar al proveedor para acordar el plazo de entrega"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                  touched.title && (isTitleEmpty || isTitleTooLong || isSyntaxInvalid)
                    ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                    : syntaxResult.isValid
                    ? 'border-emerald-300 focus:ring-emerald-400 bg-emerald-50/10'
                    : 'border-slate-300 focus:ring-indigo-400'
                }`}
              />
              {syntaxResult.isValid && (
                <div className="absolute right-3 top-3 text-emerald-600 flex items-center gap-1 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  <span className="text-[11px]">Verbo físico: {syntaxResult.detectedVerb}</span>
                </div>
              )}
            </div>

            {/* Error por longitud o vacío */}
            {touched.title && isTitleEmpty && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> El nombre de la acción inmediata es obligatorio.
              </p>
            )}
            {isTitleTooLong && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Supera el límite de 100 caracteres recomendado para legibilidad.
              </p>
            )}

            {/* ASISTENTE CONTEXTUAL DEL ANALIZADOR SINTÁCTICO (Módulo 4: Antídoto a Proyectos Amorfos) */}
            {!syntaxResult.isValid && title.trim().length > 0 && !overrideSyntaxWarning && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <p className="font-bold">
                      {syntaxResult.warning || 'Falta un verbo transitivo de acción física motora.'}
                    </p>
                    <p className="text-amber-800">
                      {syntaxResult.assistantQuestion || '¿Cuál es el primer paso físico e indivisible? Convierte la meta en una acción concreta.'}
                    </p>
                    {syntaxResult.suggestion && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => applySyntaxSuggestion(syntaxResult.suggestion!)}
                          className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <span>Usar sugerencia: "{syntaxResult.suggestion}"</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setOverrideSyntaxWarning(true)}
                          className="text-[11px] text-amber-700 hover:underline"
                        >
                          Mantener redacción
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CAMPO 3: Descripción Detallada + Motor NLP TF-IDF (Módulo 3) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Desglose Operativo <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Captura onBlur dispara inferencia NLP TF-IDF
              </span>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                setTouched({ ...touched, description: true });
                triggerNLPInference();
              }}
              placeholder="Detalla el resultado esperado, personas involucradas o requerimientos físicos previos..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                touched.description && isDescriptionEmpty
                  ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />
            {touched.description && isDescriptionEmpty && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> La descripción de la acción física es obligatoria.
              </p>
            )}

            {/* INSIGNIA INTERACTIVA DE PROPUESTA NLP TF-IDF (Módulo 3) */}
            {nlpLoading && (
              <p className="text-[11px] text-indigo-600 mt-1 flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" /> Vectorizando texto y calculando similitud de cosenos...
              </p>
            )}

            {nlpResult && nlpResult.category && nlpResult.isAboveThreshold && (
              <div className="mt-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-2 text-indigo-950">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="font-semibold">Sugerencia NLP TF-IDF:</span>{' '}
                    <span>¿Vincular a <strong>{nlpResult.category}</strong>?</span>
                    <span className="text-[11px] text-indigo-600 ml-1.5 font-mono">
                      ({Math.round(nlpResult.confidenceScore * 100)}% de confianza)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => applyNlpSuggestion(nlpResult.category!, nlpResult.confidenceScore)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  <span>Validar Vínculo</span>
                </button>
              </div>
            )}
          </div>

          {/* FILA: Prioridad Ordinal + Categoría de la Rueda (Enlace Cognitivo) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Prioridad Ordinal */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nivel de Prioridad <span className="text-red-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="CRITICAL">🔥 Crítica (Impacto Prefrontal Máximo)</option>
                <option value="HIGH">⚡ Alta (Ejecución Prioritaria)</option>
                <option value="MEDIUM">⚖️ Media (Operatividad Regular)</option>
                <option value="LOW">🌱 Baja (Baja Demanda Cognitiva)</option>
              </select>
            </div>

            {/* Categoría Rueda de la Vida */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Enlace Estratégico (Rueda de la Vida)
              </label>
              <select
                value={wheelCategory || ''}
                onChange={(e) => {
                  setWheelCategory((e.target.value as WheelCategory) || undefined);
                  setLinkedBy('MANUAL');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">(Sin vinculación específica)</option>
                {WHEEL_CATEGORIES_LIST.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {wheelCategory && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Enlace: <strong>{wheelCategory}</strong> ({linkedBy === 'AUTO_TFIDF' ? 'Inferencia TF-IDF' : 'Manual'})
                </p>
              )}
            </div>
          </div>

          {/* CAMPO 4: Sumidero Cognitivo ("Quizá" / "Algún día" - HU-03) */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isSomeday}
                onChange={(e) => setIsSomeday(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Catalogar como "Quizá" / "Algún día" (Sumidero Cognitivo)
                </span>
                <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                  Externaliza deseos o iniciativas latentes sin urgencia operativa. Desaparece del Top 10 diario para liberar ancho de banda mental, pero permanece indexado en "Opciones Futuras".
                </span>
              </div>
            </label>
          </div>

          {/* CAMPO 5: Observaciones Ricas (JSONB) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Observaciones y Metadatos (JSONB)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newObsText}
                onChange={(e) => setNewObsText(e.target.value)}
                placeholder="Añadir nota, enlace o sub-requisito..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddObservation();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddObservation}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
              >
                Añadir
              </button>
            </div>

            {observations.length > 0 && (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {observations.map((obs) => (
                  <div key={obs.id} className="flex items-center justify-between px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-700">
                    <span className="truncate">{obs.text}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveObservation(obs.id)}
                      className="text-slate-400 hover:text-red-600 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CHECKLIST DE VALIDACIÓN EN TIEMPO REAL ANTES DE ENVIAR */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <span className="font-bold text-slate-700 block mb-1">
              Verificación de Requisitos de Entrada:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {!isTitleEmpty && !isTitleTooLong ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={!isTitleEmpty ? 'text-slate-700' : 'text-slate-400'}>
                  Título ≤ 100 caracteres
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {syntaxResult.isValid || overrideSyntaxWarning ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={syntaxResult.isValid ? 'text-slate-700' : 'text-slate-400'}>
                  Verbo de acción física motora
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {!isDescriptionEmpty ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={!isDescriptionEmpty ? 'text-slate-700' : 'text-slate-400'}>
                  Descripción operacional
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-700">Contexto y Prioridad</span>
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
                isFormValid
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{editingTask ? 'Actualizar Acción' : 'Guardar Acción Operativa'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
