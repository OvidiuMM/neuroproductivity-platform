import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import {
  TaskItem,
  ListContext,
  TaskPriority,
  WheelCategory,
  TaskObservation,
  MonthlyMode,
  RecurrenceFrequency
} from '../types';
import { analyzeImmediateActionSyntax, SyntaxAnalysisResult } from '../services/syntaxAnalyzer';
import { inferWheelCategory, NLPSuggestionResult } from '../services/nlpEngine';
import { formatTaskDates, toLocalDate, validateTaskDates } from '../services/tasks';
import { ESTIMATE_OPTIONS } from '../services/taskListing';
import {
  buildRecurrence,
  describeRecurrence,
  firstOccurrence,
  isLastWeekdayOfMonth,
  nextOccurrence,
  nthOfMonth,
  toDateString
} from '../services/recurrence';

const REPEAT_UNITS: Record<RecurrenceFrequency, string> = {
  DAILY: 'días',
  WEEKLY: 'semanas',
  MONTHLY: 'meses',
  YEARLY: 'años'
};
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ORDINAL_LABELS = ['', '1.er', '2.º', '3.er', '4.º'];
// Semana empezando en lunes; `day` es el número de JavaScript (0 = domingo)
const WEEKDAY_TOGGLES = [
  { day: 1, short: 'L', name: 'Lunes' },
  { day: 2, short: 'M', name: 'Martes' },
  { day: 3, short: 'X', name: 'Miércoles' },
  { day: 4, short: 'J', name: 'Jueves' },
  { day: 5, short: 'V', name: 'Viernes' },
  { day: 6, short: 'S', name: 'Sábado' },
  { day: 0, short: 'D', name: 'Domingo' }
];
import {
  X,
  AlertTriangle,
  Sparkles,
  Check,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ListPlus,
  CalendarClock,
  ChevronDown,
  Repeat
} from 'lucide-react';
import { DateField } from './DateField';

export type TaskFormData = Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'doneAt'>;

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTask: (task: TaskFormData) => void;
  initialContext: ListContext;
  // Al abrir desde "Opciones Futuras" la tarea nueva se marca como "Quizá"
  initialSomeday?: boolean;
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
  initialSomeday = false,
  editingTask
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Identificador de la última inferencia NLP: invalida resultados que llegan tras cerrar o reiniciar el formulario
  const nlpRequest = useRef(0);
  const [listContext, setListContext] = useState<ListContext>(initialContext);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [isSomeday, setIsSomeday] = useState(false);
  const [wheelCategory, setWheelCategory] = useState<WheelCategory | undefined>();
  const [wheelCategoryConfidence, setWheelCategoryConfidence] = useState<number | undefined>();
  const [linkedBy, setLinkedBy] = useState<'MANUAL' | 'AUTO_TFIDF'>('MANUAL');
  const [observations, setObservations] = useState<TaskObservation[]>([]);
  const [newObsText, setNewObsText] = useState('');
  // Fechas opcionales (vacías por defecto): solo fecha límite = plazo; con fecha de inicio = intervalo
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [estimateMinutes, setEstimateMinutes] = useState<number | undefined>();
  const [repeatFrequency, setRepeatFrequency] = useState<RecurrenceFrequency | ''>('');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatMonthlyMode, setRepeatMonthlyMode] = useState<MonthlyMode>('DAY_OF_MONTH');

  // Estados de validación en tiempo real
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  // Analizador Sintáctico de Acción Inmediata en tiempo real (Módulo 4)
  const syntaxResult = useMemo<SyntaxAnalysisResult>(
    () =>
      title.trim()
        ? analyzeImmediateActionSyntax(title)
        : { isValid: false, detectedVerb: null, warning: 'El nombre es obligatorio.' },
    [title]
  );
  const [nlpResult, setNlpResult] = useState<NLPSuggestionResult | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [overrideSyntaxWarning, setOverrideSyntaxWarning] = useState(false);
  // «Más opciones» empieza abierto si la tarea ya usa alguno de sus campos (o si es una tarea «Quizá» nueva)
  const [showMore, setShowMore] = useState(false);

  // Inicializar o limpiar al abrir modal
  useEffect(() => {
    nlpRequest.current++; // descarta cualquier sugerencia NLP pendiente del formulario anterior
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el formulario se rellena o limpia al abrirse
    setNlpLoading(false);
    if (editingTask) {
      setShowMore(
        Boolean(
          editingTask.description ||
          editingTask.estimateMinutes ||
          editingTask.wheelCategory ||
          editingTask.startDate ||
          editingTask.recurrence ||
          editingTask.isSomeday ||
          editingTask.observations?.length
        )
      );
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setListContext(editingTask.listContext);
      setPriority(editingTask.priority);
      setIsSomeday(editingTask.isSomeday);
      setWheelCategory(editingTask.wheelCategory);
      setWheelCategoryConfidence(editingTask.wheelCategoryConfidence);
      setLinkedBy(editingTask.linkedBy || 'MANUAL');
      setObservations(editingTask.observations || []);
      // Una tarea repetida se edita como serie: desde su repetición actual hasta la fecha límite de la serie
      setStartDate((editingTask.recurrence ? editingTask.dueDate : editingTask.startDate) ?? '');
      setStartTime(editingTask.startTime ?? '');
      setDueDate((editingTask.recurrence ? editingTask.recurrence.until : editingTask.dueDate) ?? '');
      setDueTime(editingTask.dueTime ?? '');
      setEstimateMinutes(editingTask.estimateMinutes);
      setRepeatFrequency(editingTask.recurrence?.frequency ?? '');
      setRepeatInterval(editingTask.recurrence?.interval ?? 1);
      setRepeatWeekdays(editingTask.recurrence?.weekdays ?? []);
      setRepeatMonthlyMode(editingTask.recurrence?.monthlyMode ?? 'DAY_OF_MONTH');
      setOverrideSyntaxWarning(true);
    } else {
      setShowMore(initialSomeday);
      setTitle('');
      setDescription('');
      setListContext(initialContext);
      setPriority('MEDIUM');
      setIsSomeday(initialSomeday);
      setStartDate('');
      setStartTime('');
      setDueDate('');
      setDueTime('');
      setEstimateMinutes(undefined);
      setRepeatFrequency('');
      setRepeatInterval(1);
      setRepeatWeekdays([]);
      setRepeatMonthlyMode('DAY_OF_MONTH');
      setWheelCategory(undefined);
      setWheelCategoryConfidence(undefined);
      setLinkedBy('MANUAL');
      setObservations([]);
      setNlpResult(null);
      setTouched({});
      setOverrideSyntaxWarning(false);
    }
  }, [isOpen, editingTask, initialContext, initialSomeday]);

  // Disparador del Motor NLP TF-IDF (Módulo 3) en evento onBlur o cuando hay texto suficiente
  const triggerNLPInference = () => {
    if (!description.trim() && !title.trim()) return;
    setNlpLoading(true);
    const request = ++nlpRequest.current;
    // Simulación del microservicio asíncrono (< 350ms según especificación)
    setTimeout(() => {
      // Si entretanto se guardó o se reinició el formulario, el resultado ya no corresponde a esta tarea
      if (request !== nlpRequest.current) return;
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
    setObservations(observations.filter((o) => o.id !== id));
  };

  // Reglas de Validación de Entrada (Estricto cumplimiento de especificaciones)
  const isTitleEmpty = !title.trim();
  const isTitleTooLong = title.length > 100;
  const isSyntaxInvalid = !syntaxResult.isValid && !overrideSyntaxWarning;
  // REPETICIÓN: las fechas delimitan la serie. «Inicio» es desde cuándo se repite (hoy si se deja vacío) y la
  // fecha límite es la última fecha posible (la «fecha hasta» de la serie: un solo valor). Cada repetición vence
  // su propio día, con la hora límite; ninguna se pinta como un intervalo.
  const isRepeating = Boolean(repeatFrequency);
  const seriesStart = startDate || toDateString(new Date());
  const anchor = toLocalDate(seriesStart);
  // Los anclajes de la regla (día del mes, N.º día de la semana) salen del inicio de la serie. Al editar una
  // repetición que cayó en el último día de un mes más corto (p. ej. el 28 de febrero de una serie del día 31),
  // se conserva el día de la serie mientras no se cambie el inicio ni la frecuencia.
  const storedRecurrence = editingTask?.recurrence;
  const keepsStoredDay = Boolean(
    storedRecurrence?.monthDay &&
    editingTask?.dueDate &&
    startDate === editingTask.dueDate &&
    repeatFrequency === storedRecurrence.frequency
  );
  const anchorDay = keepsStoredDay ? storedRecurrence!.monthDay! : anchor.getDate();
  const monthlyOptions: { mode: MonthlyMode; label: string }[] = [
    { mode: 'DAY_OF_MONTH', label: `El día ${anchorDay}` },
    ...(nthOfMonth(anchor) <= 4
      ? [
          {
            mode: 'NTH_WEEKDAY' as const,
            label: `El ${ORDINAL_LABELS[nthOfMonth(anchor)]} ${WEEKDAY_NAMES[anchor.getDay()]}`
          }
        ]
      : []),
    ...(isLastWeekdayOfMonth(anchor)
      ? [{ mode: 'LAST_WEEKDAY' as const, label: `El último ${WEEKDAY_NAMES[anchor.getDay()]}` }]
      : [])
  ];
  // Si al cambiar la fecha el modo elegido deja de existir (p. ej. ya no es el último lunes), se usa el día del mes
  const effectiveMonthlyMode = monthlyOptions.some((o) => o.mode === repeatMonthlyMode)
    ? repeatMonthlyMode
    : 'DAY_OF_MONTH';
  // Semanal: mientras no se elijan días, se repite el mismo día de la semana que el inicio (y sigue al inicio si cambia)
  const weekdays = repeatWeekdays.length ? repeatWeekdays : [anchor.getDay()];
  const built = repeatFrequency
    ? buildRecurrence(repeatFrequency, seriesStart, {
        interval: repeatInterval,
        weekdays,
        monthlyMode: effectiveMonthlyMode,
        until: dueDate || undefined
      })
    : undefined;
  const recurrence = built?.monthDay !== undefined ? { ...built, monthDay: anchorDay } : built;
  const firstRepetition = recurrence ? firstOccurrence(seriesStart, recurrence) : null;
  const nextRepetition =
    recurrence && firstRepetition ? nextOccurrence(firstRepetition, recurrence, toLocalDate(firstRepetition)) : null;
  const recurrenceError = !isRepeating
    ? null
    : dueDate && dueDate < seriesStart
      ? 'La fecha límite (fin de la repetición) no puede ser anterior al inicio.'
      : !firstRepetition
        ? 'No hay ninguna repetición entre el inicio y la fecha límite.'
        : startTime && dueTime && startTime > dueTime
          ? 'La hora de inicio no puede ser posterior a la hora límite.'
          : null;

  // Fechas que se guardan. Una hora sin fecha no tiene sentido y se descarta; en una tarea repetida, la fecha
  // límite guardada es la de la repetición actual (el fin de la serie va en la regla).
  const dates = isRepeating
    ? { startTime: startTime || undefined, dueDate: firstRepetition ?? undefined, dueTime: dueTime || undefined }
    : {
        startDate: startDate || undefined,
        startTime: (startDate && startTime) || undefined,
        dueDate: dueDate || undefined,
        dueTime: (dueDate && dueTime) || undefined
      };
  const datesError = isRepeating ? null : validateTaskDates(dates);

  const isFormValid =
    !isTitleEmpty &&
    !isTitleTooLong &&
    !isSyntaxInvalid &&
    !datesError &&
    !recurrenceError &&
    Boolean(listContext) &&
    Boolean(priority);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true });

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
      observations,
      estimateMinutes,
      recurrence,
      ...dates
    });

    onClose();
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div>
            <h2 id="task-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ListPlus className="h-5 w-5 text-indigo-600" />
              {editingTask ? 'Editar Acción Operativa' : 'Captura de Nueva Acción Inmediata'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Filtro sintáctico prefrontal y enlace cognitivo con la Rueda de la Vida
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* CAMPO 1: Contexto de Lista (Segregación Estricta Módulo 2) */}
          <div>
            <p
              id="task-context-label"
              className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
            >
              Contexto Excluyente <span className="text-red-500">*</span>
            </p>
            <div role="group" aria-labelledby="task-context-label" className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setListContext('WORK')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  listContext === 'WORK'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                Esfera Profesional (Trabajo)
              </button>
              <button
                type="button"
                onClick={() => setListContext('PERSONAL')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  listContext === 'PERSONAL'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Esfera Personal (Vida)
              </button>
            </div>
          </div>

          {/* CAMPO 2: Nombre de la Tarea + Analizador Sintáctico de Acción Inmediata (Módulo 4) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="task-title" className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                Acción Inmediata Siguiente <span className="text-red-500">*</span>
              </label>
              <span
                className={`font-mono text-[11px] ${title.length > 100 ? 'font-bold text-red-600' : 'text-slate-500'}`}
              >
                {title.length}/100 caracteres
              </span>
            </div>

            {/* Texto indicativo encima del campo: la acción empieza por un verbo físico */}
            <p id="task-title-hint" className="mb-1.5 text-[11px] text-slate-500">
              <strong className="text-slate-700">Verbo físico:</strong> empieza por una acción concreta que puedas hacer
              ya (Llamar, Enviar, Reservar…).
            </p>

            <div className="relative">
              <input
                id="task-title"
                aria-describedby="task-title-hint"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setOverrideSyntaxWarning(false);
                }}
                onBlur={() => setTouched({ ...touched, title: true })}
                placeholder="ej. Llamar al proveedor para acordar el plazo de entrega"
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none ${
                  touched.title && (isTitleEmpty || isTitleTooLong || isSyntaxInvalid)
                    ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                    : syntaxResult.isValid
                      ? 'border-emerald-300 bg-emerald-50/10 focus:ring-emerald-400'
                      : 'border-slate-300 focus:ring-indigo-400'
                }`}
              />
              {syntaxResult.isValid && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Check className="h-4 w-4" />
                  <span className="text-[11px]">Verbo físico: {syntaxResult.detectedVerb}</span>
                </div>
              )}
            </div>

            {/* Error por longitud o vacío */}
            {touched.title && isTitleEmpty && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> El nombre de la acción inmediata es obligatorio.
              </p>
            )}
            {isTitleTooLong && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Supera el límite de 100 caracteres recomendado para
                legibilidad.
              </p>
            )}

            {/* ASISTENTE CONTEXTUAL DEL ANALIZADOR SINTÁCTICO (Módulo 4: Antídoto a Proyectos Amorfos) */}
            {!syntaxResult.isValid && title.trim().length > 0 && !overrideSyntaxWarning && (
              <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="flex-1 space-y-1.5">
                    <p className="font-bold">
                      {syntaxResult.warning || 'Falta un verbo transitivo de acción física motora.'}
                    </p>
                    <p className="text-amber-800">
                      {syntaxResult.assistantQuestion ||
                        '¿Cuál es el primer paso físico e indivisible? Convierte la meta en una acción concreta.'}
                    </p>
                    {syntaxResult.suggestion && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => applySyntaxSuggestion(syntaxResult.suggestion!)}
                          className="flex items-center gap-1 rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-amber-800"
                        >
                          <span>Usar sugerencia: "{syntaxResult.suggestion}"</span>
                          <ArrowRight className="h-3 w-3" />
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

          {/* FECHA LÍMITE: a la vista; el inicio y la repetición están en «Más opciones» */}
          <div className="space-y-1.5">
            <span className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase">
              Fecha límite
              {isRepeating && (
                <span className="font-normal tracking-normal text-slate-600 normal-case">
                  {' '}
                  · fin de la repetición (opcional)
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <DateField
                label="Fecha límite"
                value={dueDate}
                onChange={setDueDate}
                className="min-w-0 flex-1"
                inputClassName="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate && !isRepeating}
                aria-label="Hora límite"
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {isRepeating && 'Al repetir, cada repetición vence su propio día, con las horas indicadas. '}
              Sin hora, el plazo termina al final del día. El título se pone{' '}
              <span className="font-semibold text-violet-600">violeta</span> cuando falta menos de una semana y{' '}
              <span className="font-semibold text-red-600">rojo</span> cuando ha vencido.
            </p>
          </div>

          {/* Prioridad: a la vista, cuenta para el orden del Top 10 */}
          <div>
            <label
              htmlFor="task-priority"
              className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
            >
              Nivel de Prioridad <span className="text-red-500">*</span>
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            >
              <option value="CRITICAL">🔥 Crítica (Impacto Prefrontal Máximo)</option>
              <option value="HIGH">⚡ Alta (Ejecución Prioritaria)</option>
              <option value="MEDIUM">⚖️ Media (Operatividad Regular)</option>
              <option value="LOW">🌱 Baja (Baja Demanda Cognitiva)</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Con la fecha límite a más de una semana, cuenta un nivel por debajo.
            </p>
          </div>

          {/* MÁS OPCIONES: lo que no hace falta para capturar la acción */}
          <div className="rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setShowMore((open) => !open)}
              aria-expanded={showMore}
              aria-controls="task-more-options"
              className="flex min-h-11 w-full items-center justify-between gap-2 px-3.5 text-left text-xs font-bold tracking-wider text-slate-700 uppercase"
            >
              <span>
                Más opciones
                <span className="ml-2 font-normal tracking-normal text-slate-500 normal-case">
                  descripción, estimación, área, inicio, repetición, «Quizá» y notas
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${showMore ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            <div id="task-more-options" hidden={!showMore} className="space-y-5 border-t border-slate-100 p-3.5">
              {/* CAMPO 3: Descripción Detallada + Motor NLP TF-IDF (Módulo 3) */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="task-description"
                    className="text-xs font-bold tracking-wider text-slate-600 uppercase"
                  >
                    Desglose Operativo{' '}
                    <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Captura onBlur dispara inferencia NLP TF-IDF</span>
                </div>
                <textarea
                  id="task-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={(e) => {
                    setTouched({ ...touched, description: true });
                    // Si el foco pasa a un botón (Guardar, Cancelar…) no se lanza la sugerencia: el aviso de carga
                    // desplazaría el botón entre que se pulsa y se suelta, y el clic se perdería
                    if ((e.relatedTarget as HTMLElement | null)?.tagName === 'BUTTON') return;
                    triggerNLPInference();
                  }}
                  placeholder="Detalla el resultado esperado, personas involucradas o requerimientos físicos previos..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition-all focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />

                {/* INSIGNIA INTERACTIVA DE PROPUESTA NLP TF-IDF (Módulo 3) */}
                {nlpLoading && (
                  <p className="mt-1 flex animate-pulse items-center gap-1 text-[11px] text-indigo-600">
                    <Sparkles className="h-3.5 w-3.5" /> Vectorizando texto y calculando similitud de cosenos...
                  </p>
                )}

                {nlpResult && nlpResult.category && nlpResult.isAboveThreshold && (
                  <div className="animate-in fade-in mt-2 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-indigo-950">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <div>
                        <span className="font-semibold">Sugerencia NLP TF-IDF:</span>{' '}
                        <span>
                          ¿Vincular a <strong>{nlpResult.category}</strong>?
                        </span>
                        <span className="ml-1.5 font-mono text-[11px] text-indigo-600">
                          ({Math.round(nlpResult.confidenceScore * 100)}% de confianza)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyNlpSuggestion(nlpResult.category!, nlpResult.confidenceScore)}
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                    >
                      <Check className="h-3 w-3" />
                      <span>Validar Vínculo</span>
                    </button>
                  </div>
                )}
              </div>

              {/* FILA: Estimación y Categoría de la Rueda (Enlace Cognitivo) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Estimación: duración prevista */}
                <div>
                  <label
                    htmlFor="task-estimate"
                    className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
                  >
                    Estimación (duración)
                  </label>
                  <select
                    id="task-estimate"
                    value={estimateMinutes ?? ''}
                    onChange={(e) => setEstimateMinutes(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  >
                    <option value="">(Sin estimar)</option>
                    {ESTIMATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoría Rueda de la Vida */}
                <div>
                  <label
                    htmlFor="task-category"
                    className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
                  >
                    Enlace Estratégico (Rueda de la Vida)
                  </label>
                  <select
                    id="task-category"
                    value={wheelCategory || ''}
                    onChange={(e) => {
                      setWheelCategory((e.target.value as WheelCategory) || undefined);
                      setLinkedBy('MANUAL');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  >
                    <option value="">(Sin vinculación específica)</option>
                    {WHEEL_CATEGORIES_LIST.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {wheelCategory && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Enlace: <strong>{wheelCategory}</strong> (
                      {linkedBy === 'AUTO_TFIDF' ? 'Inferencia TF-IDF' : 'Manual'})
                    </p>
                  )}
                </div>
              </div>

              {/* FECHAS OPCIONALES: plazo (solo fecha límite) o intervalo (inicio + fecha límite), con hora opcional */}
              <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3.5">
                <legend className="flex items-center gap-1.5 px-1 text-xs font-bold tracking-wider text-slate-600 uppercase">
                  <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
                  Inicio y repetición (opcional)
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="block text-[11px] font-semibold text-slate-700">
                      {isRepeating ? (
                        <>
                          Inicio de la repetición
                          <span className="font-normal text-slate-600"> (hoy si lo dejas vacío)</span>
                        </>
                      ) : (
                        'Inicio (para un intervalo)'
                      )}
                    </span>
                    <div className="flex gap-2">
                      <DateField
                        label="Fecha de inicio"
                        value={startDate}
                        onChange={setStartDate}
                        className="min-w-0 flex-1"
                        inputClassName="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={!startDate && !isRepeating}
                        aria-label="Hora de inicio"
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
                {datesError && (
                  <p role="alert" className="flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {datesError}
                  </p>
                )}

                {/* REPETICIÓN: al marcarla Hecha se archiva y se crea la siguiente con la nueva fecha */}
                <div className="space-y-3 border-t border-slate-100 pt-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="task-repeat"
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-700"
                      >
                        <Repeat className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                        Repetir
                      </label>
                      <select
                        id="task-repeat"
                        value={repeatFrequency}
                        onChange={(e) => {
                          const value = e.target.value as RecurrenceFrequency | '';
                          // Al dejar de repetir, las fechas vuelven a ser las de una tarea normal: la fecha límite pasa
                          // a ser la primera repetición y desaparece el inicio de la serie (si no, quedaría un intervalo)
                          if (!value && isRepeating) {
                            setDueDate(firstRepetition ?? startDate);
                            setStartDate('');
                          }
                          setRepeatFrequency(value);
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      >
                        <option value="">No se repite</option>
                        <option value="DAILY">Cada día</option>
                        <option value="WEEKLY">Cada semana</option>
                        <option value="MONTHLY">Cada mes</option>
                        <option value="YEARLY">Cada año</option>
                      </select>
                    </div>
                    {repeatFrequency && (
                      <div className="space-y-1">
                        <label
                          htmlFor="task-repeat-interval"
                          className="block text-[11px] font-semibold text-slate-700"
                        >
                          Cada cuántos ({REPEAT_UNITS[repeatFrequency]})
                        </label>
                        <input
                          id="task-repeat-interval"
                          type="number"
                          min={1}
                          max={99}
                          value={repeatInterval}
                          onChange={(e) => setRepeatInterval(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {repeatFrequency === 'WEEKLY' && (
                    <fieldset className="space-y-1">
                      <legend className="text-[11px] font-semibold text-slate-700">Días de la semana</legend>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_TOGGLES.map(({ day, short, name }) => (
                          <label
                            key={day}
                            className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-400 ${
                              weekdays.includes(day)
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 bg-white text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={weekdays.includes(day)}
                              onChange={(e) =>
                                setRepeatWeekdays(
                                  e.target.checked ? [...weekdays, day] : weekdays.filter((d) => d !== day)
                                )
                              }
                              aria-label={name}
                            />
                            {short}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {repeatFrequency === 'MONTHLY' && (
                    <fieldset className="space-y-1">
                      <legend className="text-[11px] font-semibold text-slate-700">Qué día del mes</legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
                        {monthlyOptions.map((option) => (
                          <label key={option.mode} className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              name="task-repeat-monthly"
                              checked={effectiveMonthlyMode === option.mode}
                              onChange={() => setRepeatMonthlyMode(option.mode)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {recurrence && firstRepetition && (
                    <p className="text-[11px] font-medium text-indigo-700" role="status">
                      {describeRecurrence(recurrence, firstRepetition)}
                      {` · Primera: ${formatTaskDates({ dueDate: firstRepetition })?.replace('Vence: ', '')}`}
                      {nextRepetition
                        ? ` · Al completarla, la siguiente vencerá el ${formatTaskDates({ dueDate: nextRepetition })?.replace('Vence: ', '')}`
                        : ' · No habrá más repeticiones'}
                    </p>
                  )}
                  {recurrenceError && (
                    <p role="alert" className="flex items-center gap-1 text-xs font-medium text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {recurrenceError}
                    </p>
                  )}
                </div>
              </fieldset>

              {/* CAMPO 4: Sumidero Cognitivo ("Quizá" / "Algún día" - HU-03) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSomeday}
                    onChange={(e) => setIsSomeday(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">
                      Catalogar como "Quizá" / "Algún día" (Sumidero Cognitivo)
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                      Externaliza deseos o iniciativas latentes sin urgencia operativa. Desaparece del Top 10 diario
                      para liberar ancho de banda mental, pero permanece indexado en "Opciones Futuras".
                    </span>
                  </div>
                </label>
              </div>

              {/* CAMPO 5: Observaciones Ricas (JSONB) */}
              <div>
                <label
                  htmlFor="task-note"
                  className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
                >
                  Observaciones y Metadatos (JSONB)
                </label>
                <div className="mb-2 flex gap-2">
                  <input
                    id="task-note"
                    type="text"
                    value={newObsText}
                    onChange={(e) => setNewObsText(e.target.value)}
                    placeholder="Añadir nota, enlace o sub-requisito..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
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
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Añadir
                  </button>
                </div>

                {observations.length > 0 && (
                  <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1">
                    {observations.map((obs) => (
                      <div
                        key={obs.id}
                        className="flex items-center justify-between rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                      >
                        <span className="truncate">{obs.text}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveObservation(obs.id)}
                          className="ml-2 text-slate-500 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Con «Más opciones» plegado, sus errores se ven igualmente */}
          {!showMore && (datesError || recurrenceError) && (
            <p role="alert" className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {datesError ?? recurrenceError} (en «Más opciones»)
            </p>
          )}

          {/* CHECKLIST DE VALIDACIÓN EN TIEMPO REAL ANTES DE ENVIAR */}
          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="mb-1 block font-bold text-slate-700">Verificación de Requisitos de Entrada:</span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {!isTitleEmpty && !isTitleTooLong ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={!isTitleEmpty ? 'text-slate-700' : 'text-slate-500'}>Título ≤ 100 caracteres</span>
              </div>

              <div className="flex items-center gap-1.5">
                {syntaxResult.isValid || overrideSyntaxWarning ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={syntaxResult.isValid ? 'text-slate-700' : 'text-slate-500'}>
                  Verbo de acción física motora
                </span>
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm transition-all ${
                isFormValid
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>{editingTask ? 'Actualizar Acción' : 'Guardar Acción Operativa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
