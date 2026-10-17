import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import {
  Goal,
  Project,
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
import { formatTaskDates, isCancelled, toLocalDate, validateTaskDates } from '../services/tasks';
import { createsCycle, dependencyCandidates, dependentsOf, tasksById } from '../services/dependencies';
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
  Repeat,
  Target,
  Plus
} from 'lucide-react';
import { DateField } from './DateField';
import { NotificationPermission } from './NotificationPermission';
import { DiscardChangesPrompt } from './DiscardChangesPrompt';
import { TimeField } from './TimeField';
import { NewGoalInline } from './NewGoalInline';
import { alarmUnavailableReason, describeAlarm } from '../services/alarms';
import { suggestGoal } from '../services/goals';
import { areasInUse } from '../services/wheel';
import { useAreas } from '../hooks/useAreas';

export type TaskFormData = Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'doneAt'>;

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTask: (task: TaskFormData) => void;
  initialContext: ListContext;
  // Al abrir desde «Algún día», la tarea nueva va a «Algún día»
  initialSomeday?: boolean;
  // Al abrir desde una meta («Añadir tarea»), la tarea nueva ya está vinculada a ella
  initialGoalId?: string;
  // Al abrir desde un proyecto, la tarea nueva ya pertenece a él (y a su meta)
  initialProjectId?: string;
  editingTask?: TaskItem | null;
  // Metas a las que se puede vincular la tarea (el área de la Rueda se hereda de la meta)
  goals: Goal[];
  // Todas las tareas: de cuál puede depender esta y cuáles esperan a ella
  tasks: TaskItem[];
  // Proyectos a los que puede pertenecer (la meta se hereda del proyecto)
  projects: Project[];
  // Guarda una meta creada desde el formulario (sin él, no se ofrece crearla aquí)
  onCreateGoal?: (goal: Goal) => void;
}

// Valores del formulario: los que escribe o elige la persona (lo demás es estado de la interfaz)
interface FormValues {
  title: string;
  projectId: string;
  goalId: string;
  dependsOn: string;
  description: string;
  listContext: ListContext;
  priority: TaskPriority;
  isSomeday: boolean;
  wheelCategory?: WheelCategory;
  wheelCategoryConfidence?: number;
  linkedBy: 'MANUAL' | 'AUTO_TFIDF';
  observations: TaskObservation[];
  newObsText: string;
  startDate: string;
  startTime: string;
  dueDate: string;
  dueTime: string;
  alarmTime: string;
  estimateMinutes?: number;
  repeatFrequency: RecurrenceFrequency | '';
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatMonthlyMode: MonthlyMode;
}

// El formulario al abrirse: vacío para una tarea nueva, o con los datos de la que se edita. Las claves van en el mismo
// orden que en el formulario actual, para compararlos.
const formFor = (
  editingTask: TaskItem | null | undefined,
  initialContext: ListContext,
  initialSomeday: boolean,
  initialGoalId: string | undefined,
  initialProjectId: string | undefined
): FormValues =>
  editingTask
    ? {
        title: editingTask.title,
        projectId: editingTask.projectId ?? '',
        goalId: editingTask.goalId ?? '',
        dependsOn: editingTask.dependsOn ?? '',
        description: editingTask.description,
        listContext: editingTask.listContext,
        priority: editingTask.priority,
        isSomeday: editingTask.isSomeday,
        wheelCategory: editingTask.wheelCategory,
        wheelCategoryConfidence: editingTask.wheelCategoryConfidence,
        linkedBy: editingTask.linkedBy || 'MANUAL',
        observations: editingTask.observations || [],
        newObsText: '',
        // Una tarea repetida se edita como serie: desde su repetición actual hasta la fecha límite de la serie
        startDate: (editingTask.recurrence ? editingTask.dueDate : editingTask.startDate) ?? '',
        startTime: editingTask.startTime ?? '',
        dueDate: (editingTask.recurrence ? editingTask.recurrence.until : editingTask.dueDate) ?? '',
        dueTime: editingTask.dueTime ?? '',
        alarmTime: editingTask.alarmTime ?? '',
        estimateMinutes: editingTask.estimateMinutes,
        repeatFrequency: editingTask.recurrence?.frequency ?? '',
        repeatInterval: editingTask.recurrence?.interval ?? 1,
        repeatWeekdays: editingTask.recurrence?.weekdays ?? [],
        repeatMonthlyMode: editingTask.recurrence?.monthlyMode ?? 'DAY_OF_MONTH'
      }
    : {
        title: '',
        projectId: initialProjectId ?? '',
        goalId: initialGoalId ?? '',
        dependsOn: '',
        description: '',
        listContext: initialContext,
        priority: 'MEDIUM',
        isSomeday: initialSomeday,
        wheelCategory: undefined,
        wheelCategoryConfidence: undefined,
        linkedBy: 'MANUAL',
        observations: [],
        newObsText: '',
        startDate: '',
        startTime: '',
        dueDate: '',
        dueTime: '',
        alarmTime: '',
        estimateMinutes: undefined,
        repeatFrequency: '',
        repeatInterval: 1,
        repeatWeekdays: [],
        repeatMonthlyMode: 'DAY_OF_MONTH'
      };

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSaveTask,
  initialContext,
  initialSomeday = false,
  initialGoalId,
  initialProjectId,
  editingTask,
  goals,
  tasks,
  projects,
  onCreateGoal
}) => {
  const [title, setTitle] = useState('');
  // Áreas de la Rueda de la cuenta (con su nombre y las que se pueden elegir)
  const { areas: wheelAreas, label: areaName, selectable: selectableAreas } = useAreas();
  const [projectId, setProjectId] = useState('');
  const [goalId, setGoalId] = useState('');
  // Meta nueva desde el formulario: si está abierta y las creadas aquí (se pueden elegir antes de que lleguen en `goals`)
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [createdGoals, setCreatedGoals] = useState<Goal[]>([]);
  const goalSelectRef = useRef<HTMLSelectElement>(null);
  const newGoalButtonRef = useRef<HTMLButtonElement>(null);
  // La última meta creada aquí: se confirma junto al campo (con la ventana abierta, los avisos de la app esperan)
  const [createdGoalId, setCreatedGoalId] = useState<string | null>(null);
  const [dependsOn, setDependsOn] = useState('');
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
  const [alarmTime, setAlarmTime] = useState('');
  const [estimateMinutes, setEstimateMinutes] = useState<number | undefined>();
  const [repeatFrequency, setRepeatFrequency] = useState<RecurrenceFrequency | ''>('');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatMonthlyMode, setRepeatMonthlyMode] = useState<MonthlyMode>('DAY_OF_MONTH');

  // Estados de validación en tiempo real
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  // Analizador de la acción siguiente, en tiempo real
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
  // «Más opciones» empieza abierto si la tarea ya usa alguno de sus campos (o si es una tarea nueva de «Algún día»)
  const [showMore, setShowMore] = useState(false);

  // Formulario tal como se abre (vacío o con la tarea): con él se sabe si hay cambios sin guardar
  const initialForm = useMemo(
    () => formFor(editingTask, initialContext, initialSomeday, initialGoalId, initialProjectId),
    // isOpen: cada vez que se abre, el formulario vuelve a empezar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, editingTask, initialContext, initialSomeday, initialGoalId, initialProjectId]
  );

  // Inicializar o limpiar al abrir modal
  useEffect(() => {
    nlpRequest.current++; // descarta cualquier sugerencia NLP pendiente del formulario anterior
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el formulario se rellena o limpia al abrirse
    setNlpLoading(false);
    const form = initialForm;
    setTitle(form.title);
    setProjectId(form.projectId);
    setGoalId(form.goalId);
    setDependsOn(form.dependsOn);
    setDescription(form.description);
    setListContext(form.listContext);
    setPriority(form.priority);
    setIsSomeday(form.isSomeday);
    setWheelCategory(form.wheelCategory);
    setWheelCategoryConfidence(form.wheelCategoryConfidence);
    setLinkedBy(form.linkedBy);
    setObservations(form.observations);
    setNewObsText(form.newObsText);
    setStartDate(form.startDate);
    setStartTime(form.startTime);
    setDueDate(form.dueDate);
    setDueTime(form.dueTime);
    setAlarmTime(form.alarmTime);
    setEstimateMinutes(form.estimateMinutes);
    setRepeatFrequency(form.repeatFrequency);
    setRepeatInterval(form.repeatInterval);
    setRepeatWeekdays(form.repeatWeekdays);
    setRepeatMonthlyMode(form.repeatMonthlyMode);
    setNewGoalOpen(false);
    setCreatedGoals([]);
    setCreatedGoalId(null);
    if (editingTask) {
      setShowMore(
        Boolean(
          editingTask.description ||
          editingTask.estimateMinutes ||
          (editingTask.wheelCategory && !editingTask.goalId) ||
          editingTask.startDate ||
          editingTask.recurrence ||
          editingTask.isSomeday ||
          editingTask.dependsOn ||
          editingTask.observations?.length
        )
      );
      setOverrideSyntaxWarning(true);
    } else {
      setShowMore(initialSomeday);
      setNlpResult(null);
      setTouched({});
      setOverrideSyntaxWarning(false);
    }
  }, [initialForm, editingTask, initialSomeday]);

  // CAMBIOS SIN GUARDAR: lo que hay en el formulario frente a como se abrió
  const currentForm: FormValues = {
    title,
    projectId,
    goalId,
    dependsOn,
    description,
    listContext,
    priority,
    isSomeday,
    wheelCategory,
    wheelCategoryConfidence,
    linkedBy,
    observations,
    newObsText,
    startDate,
    startTime,
    dueDate,
    dueTime,
    alarmTime,
    estimateMinutes,
    repeatFrequency,
    repeatInterval,
    repeatWeekdays,
    repeatMonthlyMode
  };
  // Una fecha a medio escribir (o imposible) aún no está en el formulario, pero también es un cambio
  const [dateDrafts, setDateDrafts] = useState<Record<string, boolean>>({});
  const draftOf = (field: string) => (pending: boolean) =>
    setDateDrafts((drafts) => (Boolean(drafts[field]) === pending ? drafts : { ...drafts, [field]: pending }));
  const isDirty =
    isOpen && (JSON.stringify(currentForm) !== JSON.stringify(initialForm) || Object.values(dateDrafts).some(Boolean));
  const guard = useDiscardGuard(isDirty, onClose);

  // Sugerencia de área (TF-IDF, en el navegador) al salir de la descripción, si hay texto
  const triggerNLPInference = () => {
    if (!description.trim() && !title.trim()) return;
    setNlpLoading(true);
    const request = ++nlpRequest.current;
    // Un instante después, para no recalcular mientras se sigue escribiendo
    setTimeout(() => {
      // Si entretanto se guardó o se reinició el formulario, el resultado ya no corresponde a esta tarea
      if (request !== nlpRequest.current) return;
      const res = inferWheelCategory(title, description, wheelAreas);
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

  // METAS: la elegida, las que se pueden elegir (activas, y la ya vinculada aunque esté lograda o archivada) y la
  // sugerida por las palabras del título mientras no haya ninguna elegida
  const knownGoals = useMemo(
    () => [...goals, ...createdGoals.filter((c) => !goals.some((g) => g.id === c.id))],
    [goals, createdGoals]
  );
  const goal = knownGoals.find((g) => g.id === goalId);
  // DEPENDENCIA: tareas a las que puede esperar (sin ciclos), la elegida y las que esperan a esta
  const dependencyOptions = useMemo(() => dependencyCandidates(editingTask?.id, tasks), [editingTask, tasks]);
  const waitingFor = tasks.find((t) => t.id === dependsOn);
  // Se revisa con las tareas de ahora: si entretanto la elegida pasó a esperar a esta (en otra pestaña o dispositivo),
  // guardarla dejaría las dos bloqueadas para siempre
  const dependencyError =
    dependsOn && createsCycle(editingTask?.id, dependsOn, tasksById(tasks))
      ? 'Esa tarea ya espera a esta (directa o indirectamente): elige otra o ninguna.'
      : null;
  const waitingForThis = editingTask ? dependentsOf(editingTask, tasks) : [];
  const goalOptions = knownGoals.filter((g) => g.status === 'ACTIVE' || g.id === goalId);
  const suggestedGoal = useMemo(() => (goalId ? null : suggestGoal(title, knownGoals)), [goalId, title, knownGoals]);
  const linkGoal = (chosen: Goal) => {
    setGoalId(chosen.id);
    setWheelCategory(chosen.area);
    setLinkedBy('MANUAL');
    setNlpResult(null);
  };
  const chooseGoal = (id: string) => {
    const chosen = knownGoals.find((g) => g.id === id);
    if (chosen) linkGoal(chosen);
    else setGoalId(id);
  };
  // La meta se guarda al momento (aunque luego no se guarde la tarea) y queda elegida
  const createGoal = (draft: { title: string; area: string }) => {
    if (!onCreateGoal) return;
    const now = new Date().toISOString();
    const created: Goal = {
      id: `goal-${Date.now()}`,
      userId: '',
      title: draft.title,
      area: draft.area,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    onCreateGoal(created);
    setCreatedGoals((list) => [...list, created]);
    setCreatedGoalId(created.id);
    linkGoal(created);
    setNewGoalOpen(false);
    requestAnimationFrame(() => goalSelectRef.current?.focus());
  };

  // PROYECTO: el elegido y los que se pueden elegir (activos, y el ya elegido aunque esté terminado o archivado). En
  // un proyecto, la meta es la suya
  const project = projects.find((p) => p.id === projectId);
  const projectOptions = projects.filter((p) => p.status === 'ACTIVE' || p.id === projectId);
  const chooseProject = (id: string) => {
    setProjectId(id);
    // En un proyecto la meta es la suya: lo que se escribía para una meta nueva ya no aplica
    setNewGoalOpen(false);
    const chosen = projects.find((p) => p.id === id);
    if (chosen) chooseGoal(chosen.goalId);
  };

  // Validación del formulario
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
  // ALARMA: necesita fecha límite (y hora, si la tarea se repite); si deja de poder tenerla, no se guarda
  const alarmBlocked = alarmUnavailableReason({ ...dates, recurrence });
  const alarmDescription = alarmTime && !alarmBlocked ? describeAlarm({ ...dates, recurrence, alarmTime }) : null;

  const isFormValid =
    !isTitleEmpty &&
    !isTitleTooLong &&
    !isSyntaxInvalid &&
    !datesError &&
    !recurrenceError &&
    !dependencyError &&
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
      // El vínculo se conserva aunque la meta aún no haya llegado (las metas y las tareas cargan por separado). En un
      // proyecto, la meta es la del proyecto
      projectId: projectId || undefined,
      goalId: (project ? project.goalId : goalId) || undefined,
      // Si la tarea a la que esperaba ya no existe, deja de esperar
      dependsOn: (dependsOn && tasks.some((t) => t.id === dependsOn) && dependsOn) || undefined,
      alarmTime: (!alarmBlocked && alarmTime) || undefined,
      wheelCategory: goal ? goal.area : wheelCategory,
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
  useModalFocus(isOpen, dialogRef, guard.requestClose);

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
        <div
          inert={guard.confirming}
          className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4"
        >
          <div>
            <h2 id="task-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ListPlus className="h-5 w-5 text-indigo-600" />
              {editingTask ? 'Editar la tarea' : 'Nueva tarea'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Empieza por un verbo: así sabrás exactamente qué hacer.</p>
          </div>
          <button
            onClick={guard.requestClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} inert={guard.confirming} className="space-y-5 p-6">
          {/* CAMPO 1: lista (Profesional o Personal) */}
          <div>
            <p
              id="task-context-label"
              className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
            >
              Lista <span className="text-red-500">*</span>
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
                Profesional
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
                Personal
              </button>
            </div>
          </div>

          {/* CAMPO 2: nombre de la tarea, con el analizador de la acción siguiente */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="task-title" className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                Tarea <span className="text-red-500">*</span>
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
            </div>
            {/* Debajo del campo y no encima: con títulos largos o texto ampliado taparía lo escrito */}
            {syntaxResult.isValid && syntaxResult.detectedVerb && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Verbo físico: {syntaxResult.detectedVerb}
              </p>
            )}

            {/* Error por longitud o vacío */}
            {touched.title && isTitleEmpty && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Escribe la tarea.
              </p>
            )}
            {isTitleTooLong && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Supera el límite de 100 caracteres recomendado para
                legibilidad.
              </p>
            )}

            {/* ASISTENTE DEL ANALIZADOR: convierte un tema abstracto en una acción concreta */}
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
                        '¿Cuál es el primer paso? Conviértelo en algo que puedas hacer ya.'}
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

          {/* PROYECTO: al que pertenece la tarea (solo si hay proyectos); fija la meta */}
          {projectOptions.length > 0 && (
            <div>
              <label
                htmlFor="task-project"
                className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                Proyecto <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
              </label>
              <select
                id="task-project"
                value={projectId}
                onChange={(e) => chooseProject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              >
                <option value="">(Sin proyecto)</option>
                {projectId && !project && <option value={projectId}>(Proyecto no disponible ahora)</option>}
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.status === 'FINISHED' ? ' (terminado)' : p.status === 'ARCHIVED' ? ' (archivado)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* META: a qué meta contribuye la tarea; si aún no está, se puede crear aquí */}
          <div>
            {goalOptions.length > 0 ? (
              <>
                <label
                  htmlFor="task-goal"
                  className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
                >
                  Meta <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
                </label>
                <select
                  ref={goalSelectRef}
                  id="task-goal"
                  value={goalId}
                  disabled={Boolean(project)}
                  onChange={(e) => chooseGoal(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                >
                  <option value="">(Sin meta)</option>
                  {goalId && !goal && <option value={goalId}>(Meta no disponible ahora)</option>}
                  {areasInUse(
                    wheelAreas,
                    goalOptions.map((g) => g.area)
                  ).map((area) => (
                    <optgroup key={area} label={areaName(area)}>
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
                {project ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    La del proyecto «{project.title}»: para cambiarla, cambia el proyecto o quítalo.
                  </p>
                ) : (
                  goal && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Área de la Rueda: {areaName(goal.area)} (la de la meta).
                    </p>
                  )
                )}
                {suggestedGoal && !project && (
                  <button
                    type="button"
                    onClick={() => chooseGoal(suggestedGoal.id)}
                    className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-left text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                  >
                    <Target className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Vincular a «{suggestedGoal.title}»
                  </button>
                )}
              </>
            ) : (
              <p className="text-[11px] text-slate-500">
                <Target className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-indigo-500" aria-hidden="true" />
                {onCreateGoal
                  ? 'Aún no tienes metas. Vincula la tarea a una para ver cómo avanza.'
                  : 'Puedes vincular la tarea a una meta cuando la crees en «Metas».'}
              </p>
            )}
            {onCreateGoal &&
              !project &&
              (newGoalOpen ? (
                <NewGoalInline
                  defaultArea={wheelCategory}
                  onCreate={createGoal}
                  onCancel={() => {
                    setNewGoalOpen(false);
                    requestAnimationFrame(() => newGoalButtonRef.current?.focus());
                  }}
                />
              ) : (
                <button
                  ref={newGoalButtonRef}
                  type="button"
                  onClick={() => setNewGoalOpen(true)}
                  className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Nueva meta
                </button>
              ))}
            {/* Siempre presente, para que el lector de pantalla anuncie la confirmación */}
            <p role="status" className="text-[11px] font-medium text-emerald-700">
              {createdGoalId && goal?.id === createdGoalId
                ? `Meta «${goal.title}» creada y vinculada a esta tarea.`
                : ''}
            </p>
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
                onDraftChange={draftOf('dueDate')}
                className="min-w-0 flex-1"
                inputClassName="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <TimeField
                label="Hora límite"
                value={dueTime}
                onChange={setDueTime}
                onDraftChange={draftOf('dueTime')}
                disabled={!dueDate && !isRepeating}
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

          {/* ALARMA: aviso antes del plazo, mientras CLAR está abierta */}
          <div>
            <label
              htmlFor="task-alarm"
              className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
            >
              Alarma <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
            </label>
            <div className="flex items-center gap-2">
              <TimeField
                id="task-alarm"
                label="Alarma"
                hasVisibleLabel
                value={alarmBlocked ? '' : alarmTime}
                onChange={setAlarmTime}
                onDraftChange={draftOf('alarmTime')}
                disabled={Boolean(alarmBlocked)}
                aria-describedby="task-alarm-help"
                className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              />
              {alarmTime && !alarmBlocked && (
                <button
                  type="button"
                  onClick={() => setAlarmTime('')}
                  aria-label="Quitar la alarma"
                  className="min-h-9 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  Quitar
                </button>
              )}
            </div>
            <p id="task-alarm-help" className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {alarmBlocked ??
                alarmDescription ??
                'Una hora dentro de las 24 h anteriores al plazo; sin hora límite, suena la víspera.'}{' '}
              Suena mientras CLAR esté abierta: en el ordenador, también en segundo plano; en el móvil, mientras esté a
              la vista. Con CLAR cerrada o el móvil bloqueado, el aviso sale al abrirla: para no perderla, añade la
              tarea al calendario (.ics), que lleva la alarma.
            </p>
            {alarmDescription && <NotificationPermission />}
          </div>

          {/* Prioridad: a la vista, cuenta para el orden del Top 10 */}
          <div>
            <label
              htmlFor="task-priority"
              className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
            >
              Prioridad <span className="text-red-500">*</span>
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            >
              <option value="CRITICAL">🔥 Crítica</option>
              <option value="HIGH">⚡ Alta</option>
              <option value="MEDIUM">⚖️ Media</option>
              <option value="LOW">🌱 Baja</option>
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
                  descripción, estimación, área, dependencia, inicio, repetición, «Algún día» y notas
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${showMore ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            <div id="task-more-options" hidden={!showMore} className="space-y-5 border-t border-slate-100 p-3.5">
              {/* CAMPO 3: descripción, con la sugerencia de área */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="task-description"
                    className="text-xs font-bold tracking-wider text-slate-600 uppercase"
                  >
                    Descripción{' '}
                    <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
                  </label>
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

                {/* SUGERENCIA DE ÁREA */}
                {nlpLoading && (
                  <p className="mt-1 flex animate-pulse items-center gap-1 text-[11px] text-indigo-600">
                    <Sparkles className="h-3.5 w-3.5" /> Buscando el área de tu Rueda…
                  </p>
                )}

                {!goal && nlpResult && nlpResult.category && nlpResult.isAboveThreshold && (
                  <div className="animate-in fade-in mt-2 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-indigo-950">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <div>
                        <span className="font-semibold">Sugerencia:</span>{' '}
                        <span>
                          ¿Vincular a <strong>{areaName(nlpResult.category)}</strong>?
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
                      <span>Usar esta área</span>
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
                    Área de la Rueda
                  </label>
                  <select
                    id="task-category"
                    value={(goal ? goal.area : wheelCategory) || ''}
                    disabled={Boolean(goal)}
                    onChange={(e) => {
                      setWheelCategory(e.target.value || undefined);
                      setLinkedBy('MANUAL');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  >
                    <option value="">(Sin área)</option>
                    {selectableAreas(goal ? goal.area : wheelCategory).map(({ id, label: name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {goal ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      La de su meta, «{goal.title}»: para cambiarla, cambia la meta o quítala.
                    </p>
                  ) : (
                    wheelCategory && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Área: <strong>{areaName(wheelCategory)}</strong> (
                        {linkedBy === 'AUTO_TFIDF' ? 'sugerida' : 'elegida por ti'})
                      </p>
                    )
                  )}
                </div>
              </div>

              {/* DEPENDENCIA: la tarea a la que espera esta (una sola); mientras siga abierta, esta queda bloqueada */}
              <div>
                <label
                  htmlFor="task-depends-on"
                  className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
                >
                  Empieza después de{' '}
                  <span className="font-normal tracking-normal text-slate-500 normal-case">(opcional)</span>
                </label>
                <select
                  id="task-depends-on"
                  value={dependsOn}
                  onChange={(e) => setDependsOn(e.target.value)}
                  aria-describedby="task-depends-on-help"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                >
                  <option value="">(No espera a ninguna tarea)</option>
                  {dependsOn && !dependencyOptions.some((t) => t.id === dependsOn) && (
                    <option value={dependsOn}>
                      {!waitingFor
                        ? '(Tarea eliminada)'
                        : dependencyError
                          ? `${waitingFor.title} (espera a esta tarea)`
                          : `${waitingFor.title} (${isCancelled(waitingFor) ? 'cancelada' : 'hecha'})`}
                    </option>
                  )}
                  {(['WORK', 'PERSONAL'] as const)
                    .filter((list) => dependencyOptions.some((t) => t.listContext === list))
                    .map((list) => (
                      <optgroup key={list} label={list === 'WORK' ? 'Profesional' : 'Personal'}>
                        {dependencyOptions
                          .filter((t) => t.listContext === list)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                </select>
                <p id="task-depends-on-help" className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Mientras esa tarea no esté hecha o cancelada, esta queda bloqueada: no entra en el Top 10 ni se puede
                  marcar como hecha o en progreso. Varias tareas pueden esperar a la misma.
                </p>
                {dependencyError && (
                  <p role="alert" className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {dependencyError}
                  </p>
                )}
                {waitingForThis.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-600">
                    Esperan a esta tarea: {waitingForThis.map((t) => `«${t.title}»`).join(', ')}.
                  </p>
                )}
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
                        onDraftChange={draftOf('startDate')}
                        className="min-w-0 flex-1"
                        inputClassName="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <TimeField
                        label="Hora de inicio"
                        value={startTime}
                        onChange={setStartTime}
                        onDraftChange={draftOf('startTime')}
                        disabled={!startDate && !isRepeating}
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

              {/* CAMPO 4: «Algún día» */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSomeday}
                    onChange={(e) => setIsSomeday(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Guardar para algún día</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                      No entrará en tu Top 10; la encontrarás en «Algún día».
                    </span>
                  </div>
                </label>
              </div>

              {/* CAMPO 5: notas, enlaces y listas de comprobación (observations) */}
              <div>
                <label
                  htmlFor="task-note"
                  className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase"
                >
                  Notas
                </label>
                <div className="mb-2 flex gap-2">
                  <input
                    id="task-note"
                    type="text"
                    value={newObsText}
                    onChange={(e) => setNewObsText(e.target.value)}
                    placeholder="Añade una nota o un enlace…"
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
          {!showMore && (datesError || recurrenceError || dependencyError) && (
            <p role="alert" className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {datesError ?? recurrenceError ?? dependencyError} (en «Más opciones»)
            </p>
          )}

          {/* CHECKLIST DE VALIDACIÓN EN TIEMPO REAL ANTES DE ENVIAR */}
          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="mb-1 block font-bold text-slate-700">Antes de guardar:</span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {!isTitleEmpty && !isTitleTooLong ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={!isTitleEmpty ? 'text-slate-700' : 'text-slate-500'}>Hasta 100 caracteres</span>
              </div>

              <div className="flex items-center gap-1.5">
                {syntaxResult.isValid || overrideSyntaxWarning ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={syntaxResult.isValid ? 'text-slate-700' : 'text-slate-500'}>
                  Empieza por un verbo de acción
                </span>
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={guard.requestClose}
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
              <span>{editingTask ? 'Guardar los cambios' : 'Guardar la tarea'}</span>
            </button>
          </div>
        </form>

        {guard.confirming && (
          <DiscardChangesPrompt
            text={
              editingTask
                ? 'Has cambiado esta tarea y no has guardado los cambios.'
                : 'Has empezado una tarea nueva y no la has guardado.'
            }
            onKeepEditing={guard.keepEditing}
            onDiscard={guard.discard}
          />
        )}
      </div>
    </div>
  );
};
