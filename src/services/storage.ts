import { TaskItem, WheelOfLifeLog, MeetingGuard, EmailDraft, WheelCategory } from '../types';

const STORAGE_KEYS = {
  TASKS: 'neuro_tasks_v1',
  WHEEL_LOGS: 'neuro_wheel_logs_v1',
  MEETINGS: 'neuro_meetings_v1',
  EMAILS: 'neuro_emails_v1',
  ACTIVE_CONTEXT: 'neuro_active_context_v1'
};

// Semilla inicial de la Rueda de la Vida (histórico longitudinal para demostrar neuroplasticidad)
const INITIAL_WHEEL_LOGS: WheelOfLifeLog[] = [
  {
    id: 'wheel-snapshot-1',
    userId: 'user-default',
    timestamp: '2026-07-06T10:00:00Z',
    label: 'Hace 90 días (Evaluación inicial)',
    scores: {
      Salud: 4,
      'Carrera Profesional': 8,
      Finanzas: 5,
      Familia: 4,
      Ocio: 3,
      Relaciones: 4,
      Espiritualidad: 3
    }
  },
  {
    id: 'wheel-snapshot-2',
    userId: 'user-default',
    timestamp: '2026-09-06T10:00:00Z',
    label: 'Hace 30 días (Progreso intermedio)',
    scores: {
      Salud: 6,
      'Carrera Profesional': 8,
      Finanzas: 6,
      Familia: 6,
      Ocio: 5,
      Relaciones: 5,
      Espiritualidad: 5
    }
  },
  {
    id: 'wheel-snapshot-3',
    userId: 'user-default',
    timestamp: '2026-10-06T09:00:00Z',
    label: 'Estado Actual Vigente',
    scores: {
      Salud: 7,
      'Carrera Profesional': 9,
      Finanzas: 7,
      Familia: 7,
      Ocio: 6,
      Relaciones: 6,
      Espiritualidad: 6
    }
  }
];

// Semilla inicial de tareas con Top 10 y tareas secundarias para probar la jerarquía visual Gestalt
const INITIAL_TASKS: TaskItem[] = [
  // --- Tareas Profesionales (Top 10 operativo) ---
  {
    id: 'task-w-1',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Revisar la hoja de cálculo de balance contable y previsión de gastos',
    description: 'Conciliar extractos bancarios del último mes y cuadrar los centros de coste antes del comité financiero.',
    priority: 'CRITICAL',
    createdAt: '2026-10-06T07:15:00Z',
    updatedAt: '2026-10-06T08:30:00Z',
    observations: [
      { id: 'obs-1', type: 'note', text: 'Documento ubicado en carpeta compartida /Finanzas/Q4', createdAt: '2026-10-06T07:15:00Z' }
    ],
    isSomeday: false,
    wheelCategory: 'Finanzas',
    wheelCategoryConfidence: 0.94,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-2',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Redactar propuesta técnica de migración a arquitectura offline-first',
    description: 'Detallar especificaciones de IndexedDB, multiEntry y colas de sincronización para el equipo de desarrollo.',
    priority: 'CRITICAL',
    createdAt: '2026-10-06T07:30:00Z',
    updatedAt: '2026-10-06T08:10:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.88,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-3',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Auditar código del analizador sintáctico de verbos de acción física',
    description: 'Verificar que intercepta entradas amorfas y orienta hacia el primer paso motor físico indivisible.',
    priority: 'HIGH',
    createdAt: '2026-10-06T07:45:00Z',
    updatedAt: '2026-10-06T07:45:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.85,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-4',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Programar validaciones estrictas del blindaje de reuniones matutinas',
    description: 'Implementar regla inquebrantable de bloqueo heurístico para convocatorias antes de las 12:00 h.',
    priority: 'HIGH',
    createdAt: '2026-10-05T14:00:00Z',
    updatedAt: '2026-10-06T07:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.82,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-5',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Configurar índices B-Tree en PostgreSQL para consultas multiEntry',
    description: 'Aplicar índice parcial sobre tareas activas omitiendo las catalogadas como Quizá / Algún día.',
    priority: 'HIGH',
    createdAt: '2026-10-05T11:00:00Z',
    updatedAt: '2026-10-05T16:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.86,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-6',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Diseñar interfaz de redacción inversa de correo electrónico',
    description: 'Bloquear campo de destinatarios hasta que el cuerpo y adjuntos hayan sido plenamente completados.',
    priority: 'MEDIUM',
    createdAt: '2026-10-04T09:00:00Z',
    updatedAt: '2026-10-05T12:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.79,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-7',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Contactar al proveedor cloud para formalizar SLA del 99.99%',
    description: 'Enviar términos del contrato de clústeres multi-zona y redundancia de bases de datos.',
    priority: 'MEDIUM',
    createdAt: '2026-10-04T10:00:00Z',
    updatedAt: '2026-10-04T10:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Finanzas',
    wheelCategoryConfidence: 0.71,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-8',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Verificar contraste WCAG 2.1 AA en estilos de la jerarquía Top 10',
    description: 'Ejecutar auditoría en Lighthouse para garantizar contraste de 4.5:1 en texto y 3:1 en encabezados.',
    priority: 'MEDIUM',
    createdAt: '2026-10-03T16:00:00Z',
    updatedAt: '2026-10-03T16:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.76,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-9',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Presentar demo interactiva de la Rueda de la Vida al equipo clínico',
    description: 'Demostrar interacción táctil directa sobre el gráfico polar SVG y registro append-only.',
    priority: 'LOW',
    createdAt: '2026-10-03T11:00:00Z',
    updatedAt: '2026-10-03T11:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.75,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-10',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Limpiar ramas deprecadas del repositorio git y actualizar dependencias',
    description: 'Ejecutar git prune y verificar que la compilación pase sin advertencias en Node 22.',
    priority: 'LOW',
    createdAt: '2026-10-02T15:00:00Z',
    updatedAt: '2026-10-02T15:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.70,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  // --- Tareas Profesionales secundarias (Índice 11 en adelante: bajo contraste y minimalista) ---
  {
    id: 'task-w-11',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Actualizar firmas de correo del departamento de operaciones',
    description: 'Estandarizar aviso legal y tipografía corporativa en las firmas.',
    priority: 'LOW',
    createdAt: '2026-09-28T09:00:00Z',
    updatedAt: '2026-09-28T09:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.65,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-w-12',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Archivar facturas electrónicas de suministros de oficina del trimestre pasado',
    description: 'Clasificar PDFs en Google Drive según centro de costes.',
    priority: 'LOW',
    createdAt: '2026-09-25T14:00:00Z',
    updatedAt: '2026-09-25T14:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Finanzas',
    wheelCategoryConfidence: 0.81,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  // --- Tareas Profesionales en Sumidero Cognitivo (Quizá / Algún día) ---
  {
    id: 'task-w-someday-1',
    userId: 'user-default',
    listContext: 'WORK',
    title: 'Evaluar viabilidad de certificación internacional en Neurociencia Aplicada',
    description: 'Revisar programas de posgrado y presupuestos para el próximo año.',
    priority: 'LOW',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    observations: [],
    isSomeday: true,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.78,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },

  // --- Tareas Personales ---
  {
    id: 'task-p-1',
    userId: 'user-default',
    listContext: 'PERSONAL',
    title: 'Planificar dieta y entrenamiento de fuerza con fisioterapeuta',
    description: 'Programar 3 sesiones semanales de 45 minutos y ajustar ingesta calórica proteica para soporte neuromuscular.',
    priority: 'CRITICAL',
    createdAt: '2026-10-06T06:30:00Z',
    updatedAt: '2026-10-06T06:30:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Salud',
    wheelCategoryConfidence: 0.96,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-p-2',
    userId: 'user-default',
    listContext: 'PERSONAL',
    title: 'Comprar billetes de tren para visita familiar de fin de semana',
    description: 'Coordinar horarios de llegada con mis padres y reservar billetes de ida y vuelta.',
    priority: 'HIGH',
    createdAt: '2026-10-05T18:00:00Z',
    updatedAt: '2026-10-05T18:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Familia',
    wheelCategoryConfidence: 0.91,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-p-3',
    userId: 'user-default',
    listContext: 'PERSONAL',
    title: 'Revisar cuotas del seguro de salud y comparar con pólizas del mercado',
    description: 'Comprobar cobertura dental y hospitalaria antes de la renovación anual.',
    priority: 'HIGH',
    createdAt: '2026-10-04T12:00:00Z',
    updatedAt: '2026-10-04T12:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Finanzas',
    wheelCategoryConfidence: 0.89,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-p-4',
    userId: 'user-default',
    listContext: 'PERSONAL',
    title: 'Realizar 20 minutos de meditación mindfulness y respiración diafragmática',
    description: 'Sesión matutina en silencio antes de encender dispositivos electrónicos.',
    priority: 'MEDIUM',
    createdAt: '2026-10-04T07:00:00Z',
    updatedAt: '2026-10-04T07:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Espiritualidad',
    wheelCategoryConfidence: 0.93,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-p-someday-1',
    userId: 'user-default',
    listContext: 'PERSONAL',
    title: 'Aprender tocar guitarra española y tomar clases los sábados',
    description: 'Proyecto musical para disfrute de ocio en un futuro semestre.',
    priority: 'LOW',
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
    observations: [],
    isSomeday: true,
    wheelCategory: 'Ocio',
    wheelCategoryConfidence: 0.85,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  }
];

// Semilla inicial de reuniones blindadas (Módulo 5)
const INITIAL_MEETINGS: MeetingGuard[] = [
  {
    id: 'meet-1',
    userId: 'user-default',
    title: 'Sincronización semanal de arquitectura y sprints técnicos',
    startTime: '2026-10-07T13:00:00Z', // 13:00 h (Hora valle permitida)
    endTime: '2026-10-07T13:45:00Z',
    agendaPoints: [
      '1. Estado de implementación del motor TF-IDF',
      '2. Revisión de latencia en cliente < 150ms',
      '3. Asignación de tareas críticas del Top 10'
    ],
    moderatorName: 'Dr. Jonathan Benito Sipos',
    moderatorEmail: 'jonathan@uam.es',
    createdAt: '2026-10-05T09:00:00Z'
  }
];

// Semilla inicial de correos con redacción inversa (Módulo 5)
const INITIAL_EMAILS: EmailDraft[] = [
  {
    id: 'email-1',
    userId: 'user-default',
    subject: 'Síntesis metodológica: Reestructuración de la fricción cognitiva',
    body: 'Adjunto el informe técnico con las validaciones de los 5 módulos de neuroproductividad. Se han blindado las mañanas y la jerarquía visual del Top 10 está operativa.',
    attachments: [{ name: 'especificacion_tecnica.pdf', size: '2.4 MB' }],
    noAttachmentsDeclared: false,
    recipients: ['equipo@neuroproductividad.org'],
    sentAt: '2026-10-06T08:00:00Z'
  }
];

export class StorageService {
  static getTasks(): TaskItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  }

  static saveTasks(tasks: TaskItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error saving tasks to localStorage:', e);
    }
  }

  static getWheelLogs(): WheelOfLifeLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WHEEL_LOGS);
      return data ? JSON.parse(data) : INITIAL_WHEEL_LOGS;
    } catch {
      return INITIAL_WHEEL_LOGS;
    }
  }

  // Modelo Append-Only: NUNCA sobreescribe, siempre agrega un nuevo snapshot
  static appendWheelSnapshot(scores: Record<WheelCategory, number>, label?: string): WheelOfLifeLog {
    const logs = this.getWheelLogs();
    const newLog: WheelOfLifeLog = {
      id: `wheel-snapshot-${Date.now()}`,
      userId: 'user-default',
      timestamp: new Date().toISOString(),
      label: label || `Evaluación ${new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      scores: { ...scores }
    };
    logs.push(newLog);
    try {
      localStorage.setItem(STORAGE_KEYS.WHEEL_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Error appending wheel snapshot:', e);
    }
    return newLog;
  }

  static getMeetings(): MeetingGuard[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEETINGS);
      return data ? JSON.parse(data) : INITIAL_MEETINGS;
    } catch {
      return INITIAL_MEETINGS;
    }
  }

  static saveMeeting(meeting: Omit<MeetingGuard, 'id' | 'createdAt'>): MeetingGuard {
    const list = this.getMeetings();
    const newMeeting: MeetingGuard = {
      ...meeting,
      id: `meet-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    list.unshift(newMeeting);
    try {
      localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving meeting:', e);
    }
    return newMeeting;
  }

  static getEmails(): EmailDraft[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMAILS);
      return data ? JSON.parse(data) : INITIAL_EMAILS;
    } catch {
      return INITIAL_EMAILS;
    }
  }

  static saveEmail(email: Omit<EmailDraft, 'id'>): EmailDraft {
    const list = this.getEmails();
    const newEmail: EmailDraft = {
      ...email,
      id: `email-${Date.now()}`
    };
    list.unshift(newEmail);
    try {
      localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving email:', e);
    }
    return newEmail;
  }
}
