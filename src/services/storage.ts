import { TaskItem, WheelOfLifeLog, MeetingGuard, EmailDraft, WheelCategory, UserProfile } from '../types';

const STORAGE_KEYS = {
  USERS: 'neuro_users_v1',
  ACTIVE_USER_ID: 'neuro_active_user_id_v1',
  TASKS: 'neuro_tasks_v1',
  WHEEL_LOGS: 'neuro_wheel_logs_v1',
  MEETINGS: 'neuro_meetings_v1',
  EMAILS: 'neuro_emails_v1',
  ACTIVE_CONTEXT: 'neuro_active_context_v1'
};

// Usuarios Semilla Iniciales con Cuentas de Google e Identidad Segura
const INITIAL_USERS: UserProfile[] = [
  {
    id: 'user-1',
    googleId: 'google-sub-10829182',
    name: 'Dr. Jonathan Benito Sipos',
    email: 'jonathan@example.com',
    role: 'Investigador Neurociencia (UAM)',
    color: 'indigo',
    initials: 'JB',
    authProvider: 'google',
    createdAt: '2026-06-01T08:00:00Z',
    lastLoginAt: '2026-10-06T09:00:00Z'
  },
  {
    id: 'user-2',
    googleId: 'google-sub-94827163',
    name: 'Ovidiu M.',
    email: 'ovidiu@example.com',
    role: 'Líder Técnico & Productividad',
    color: 'emerald',
    initials: 'OM',
    authProvider: 'google',
    createdAt: '2026-07-01T09:00:00Z',
    lastLoginAt: '2026-10-07T04:00:00Z'
  },
  {
    id: 'user-3',
    googleId: 'google-sub-55829104',
    name: 'Dra. Elena Ramos',
    email: 'elena.ramos@example.com',
    role: 'Especialista en Medicina Preventiva',
    color: 'amber',
    initials: 'ER',
    authProvider: 'google',
    createdAt: '2026-08-01T10:00:00Z',
    lastLoginAt: '2026-10-05T14:00:00Z'
  }
];

// Semillas de Rueda de la Vida por usuario
const INITIAL_WHEEL_LOGS: WheelOfLifeLog[] = [
  // Dr. Jonathan Benito Sipos
  {
    id: 'wheel-snapshot-u1-1',
    userId: 'user-1',
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
    id: 'wheel-snapshot-u1-2',
    userId: 'user-1',
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
    id: 'wheel-snapshot-u1-3',
    userId: 'user-1',
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
  },
  // Ovidiu M.
  {
    id: 'wheel-snapshot-u2-1',
    userId: 'user-2',
    timestamp: '2026-08-15T10:00:00Z',
    label: 'Evaluación Arquitectura Q3',
    scores: {
      Salud: 6,
      'Carrera Profesional': 9,
      Finanzas: 8,
      Familia: 6,
      Ocio: 4,
      Relaciones: 6,
      Espiritualidad: 5
    }
  },
  {
    id: 'wheel-snapshot-u2-2',
    userId: 'user-2',
    timestamp: '2026-10-06T11:00:00Z',
    label: 'Estado Actual Vigente',
    scores: {
      Salud: 8,
      'Carrera Profesional': 9,
      Finanzas: 8,
      Familia: 7,
      Ocio: 6,
      Relaciones: 7,
      Espiritualidad: 7
    }
  }
];

// Semillas de Tareas segregadas por usuario
const INITIAL_TASKS: TaskItem[] = [
  // --- Tareas Dr. Jonathan Benito Sipos (user-1) ---
  {
    id: 'task-w-1',
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
    userId: 'user-1',
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
  // Tarea personal user-1
  {
    id: 'task-p-1',
    userId: 'user-1',
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

  // --- Tareas de Ovidiu M. (user-2: Espacio aislado) ---
  {
    id: 'task-u2-1',
    userId: 'user-2',
    listContext: 'WORK',
    title: 'Implementar pipeline CI/CD en GitHub Actions para despliegue automatizado',
    description: 'Configurar workflows de build, test de linting y despliegue continuo hacia Firebase Hosting y Cloud Functions.',
    priority: 'CRITICAL',
    createdAt: '2026-10-07T08:00:00Z',
    updatedAt: '2026-10-07T08:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.95,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-u2-2',
    userId: 'user-2',
    listContext: 'WORK',
    title: 'Auditar latencia P95 menor a 150ms en consultas sobre IndexedDB',
    description: 'Realizar benchmarking sobre índices B-Tree en cliente para verificar respuesta perceptual nula.',
    priority: 'CRITICAL',
    createdAt: '2026-10-07T08:15:00Z',
    updatedAt: '2026-10-07T08:15:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.91,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-u2-3',
    userId: 'user-2',
    listContext: 'WORK',
    title: 'Configurar firebase.json y parámetros de entorno para Cloud Functions',
    description: 'Verificar rewrites de Hosting hacia la API, región europe-west1 y certificados de Digital Asset Links.',
    priority: 'HIGH',
    createdAt: '2026-10-07T08:30:00Z',
    updatedAt: '2026-10-07T08:30:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Carrera Profesional',
    wheelCategoryConfidence: 0.89,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-u2-p1',
    userId: 'user-2',
    listContext: 'PERSONAL',
    title: 'Correr 8 kilómetros por la montaña y realizar estiramientos completos',
    description: 'Entrenamiento aeróbico matutino en ayunas para oxigenación cerebral y regulación dopaminérgica.',
    priority: 'CRITICAL',
    createdAt: '2026-10-07T06:00:00Z',
    updatedAt: '2026-10-07T06:00:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Salud',
    wheelCategoryConfidence: 0.97,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  },
  {
    id: 'task-u2-p2',
    userId: 'user-2',
    listContext: 'PERSONAL',
    title: 'Revisar portafolio de fondos indexados y balance de ahorro trimestral',
    description: 'Calcular rentabilidad acumulada y transferir excedente a fondo de emergencia.',
    priority: 'HIGH',
    createdAt: '2026-10-07T06:30:00Z',
    updatedAt: '2026-10-07T06:30:00Z',
    observations: [],
    isSomeday: false,
    wheelCategory: 'Finanzas',
    wheelCategoryConfidence: 0.94,
    linkedBy: 'AUTO_TFIDF',
    completed: false
  }
];

// Semillas de reuniones
const INITIAL_MEETINGS: MeetingGuard[] = [
  {
    id: 'meet-1',
    userId: 'user-1',
    title: 'Sincronización semanal de arquitectura y neuroproductividad',
    startTime: '2026-10-07T13:00:00Z',
    endTime: '2026-10-07T13:45:00Z',
    agendaPoints: [
      '1. Estado de implementación del motor TF-IDF',
      '2. Revisión de latencia en cliente < 150ms',
      '3. Asignación de tareas críticas del Top 10'
    ],
    moderatorName: 'Dr. Jonathan Benito Sipos',
    moderatorEmail: 'jonathan@example.com',
    createdAt: '2026-10-05T09:00:00Z'
  },
  {
    id: 'meet-u2-1',
    userId: 'user-2',
    title: 'Revisión técnica de despliegue en Firebase Hosting y APK',
    startTime: '2026-10-08T14:00:00Z',
    endTime: '2026-10-08T14:30:00Z',
    agendaPoints: [
      '1. Configuración de Digital Asset Links',
      '2. Certificación de PWA e instalación en Android',
      '3. Rendimiento de sincronización offline'
    ],
    moderatorName: 'Ovidiu M.',
    moderatorEmail: 'ovidiu@example.com',
    createdAt: '2026-10-07T07:00:00Z'
  }
];

const INITIAL_EMAILS: EmailDraft[] = [
  {
    id: 'email-1',
    userId: 'user-1',
    subject: 'Síntesis metodológica: Reestructuración de la fricción cognitiva',
    body: 'Adjunto el informe técnico con las validaciones de los 5 módulos de neuroproductividad. Se han blindado las mañanas y la jerarquía visual del Top 10 está operativa.',
    attachments: [{ name: 'especificacion_tecnica.pdf', size: '2.4 MB' }],
    noAttachmentsDeclared: false,
    recipients: ['equipo@example.com'],
    sentAt: '2026-10-06T08:00:00Z'
  }
];

export class StorageService {
  // GESTIÓN DE USUARIOS
  static getUsers(): UserProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  }

  static getActiveUserId(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || 'user-1';
    } catch {
      return 'user-1';
    }
  }

  static getActiveUser(): UserProfile {
    const users = this.getUsers();
    const activeId = this.getActiveUserId();
    return users.find((u) => u.id === activeId) || users[0] || INITIAL_USERS[0];
  }

  static setActiveUserId(userId: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, userId);
    } catch (e) {
      console.error('Error saving active user id:', e);
    }
  }

  static createUser(user: Omit<UserProfile, 'id' | 'createdAt' | 'initials' | 'color'>): UserProfile {
    const users = this.getUsers();
    const initials = user.name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const colors = ['indigo', 'emerald', 'amber', 'purple', 'sky', 'rose'];
    const color = colors[users.length % colors.length];

    const newUser: UserProfile = {
      ...user,
      id: `user-${Date.now()}`,
      initials: initials || 'US',
      color,
      authProvider: user.authProvider || 'local',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.setActiveUserId(newUser.id);
    } catch (e) {
      console.error('Error creating user:', e);
    }

    return newUser;
  }

  // AUTENTICACIÓN E IDENTIFICACIÓN CON CUENTAS DE GOOGLE
  static signInWithGoogle(googleData: {
    name: string;
    email: string;
    photoUrl?: string;
    role?: string;
  }): UserProfile {
    const users = this.getUsers();
    const normalizedEmail = googleData.email.trim().toLowerCase();
    const existingIndex = users.findIndex((u) => u.email.toLowerCase() === normalizedEmail);

    if (existingIndex !== -1) {
      const existing = users[existingIndex];
      const updated: UserProfile = {
        ...existing,
        name: googleData.name || existing.name,
        photoUrl: googleData.photoUrl || existing.photoUrl,
        role: googleData.role || existing.role,
        authProvider: 'google',
        lastLoginAt: new Date().toISOString()
      };
      users[existingIndex] = updated;
      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        this.setActiveUserId(updated.id);
      } catch (e) {
        console.error('Error updating Google user:', e);
      }
      return updated;
    }

    // Nuevo usuario con cuenta de Google: aprovisionar espacio aislado
    const initials = (googleData.name || googleData.email)
      .split(/[\s.@]+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const colors = ['indigo', 'emerald', 'amber', 'purple', 'sky', 'rose'];
    const color = colors[users.length % colors.length];

    const newUser: UserProfile = {
      id: `user-g-${Date.now()}`,
      googleId: `google-sub-${Math.random().toString(36).substring(2, 10)}`,
      name: googleData.name || googleData.email.split('@')[0],
      email: normalizedEmail,
      photoUrl: googleData.photoUrl,
      role: googleData.role || 'Usuario Google Workspace',
      color,
      initials: initials || 'G',
      authProvider: 'google',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    users.push(newUser);
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.setActiveUserId(newUser.id);
    } catch (e) {
      console.error('Error creating Google user:', e);
    }

    return newUser;
  }

  static deleteUser(userId: string): boolean {
    const users = this.getUsers();
    if (users.length <= 1) return false; // Evitar borrar el último usuario
    const filtered = users.filter((u) => u.id !== userId);
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
      if (this.getActiveUserId() === userId) {
        this.setActiveUserId(filtered[0].id);
      }
      return true;
    } catch (e) {
      console.error('Error deleting user:', e);
      return false;
    }
  }

  // TAREAS (AISLAMIENTO POR USER_ID)
  static getAllRawTasks(): TaskItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  }

  static getTasks(userId?: string): TaskItem[] {
    const targetUserId = userId || this.getActiveUserId();
    const allTasks = this.getAllRawTasks();
    return allTasks.filter((t) => t.userId === targetUserId);
  }

  static saveTasks(tasks: TaskItem[], userId?: string): void {
    const targetUserId = userId || this.getActiveUserId();
    const allTasks = this.getAllRawTasks();
    // Reemplaza las tareas del usuario actual y mantiene intactas las de los demás usuarios
    const otherUsersTasks = allTasks.filter((t) => t.userId !== targetUserId);
    const updated = [...tasks.map((t) => ({ ...t, userId: targetUserId })), ...otherUsersTasks];

    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving tasks:', e);
    }
  }

  // RUEDA DE LA VIDA (APPEND-ONLY POR USER_ID)
  static getAllRawWheelLogs(): WheelOfLifeLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WHEEL_LOGS);
      return data ? JSON.parse(data) : INITIAL_WHEEL_LOGS;
    } catch {
      return INITIAL_WHEEL_LOGS;
    }
  }

  static getWheelLogs(userId?: string): WheelOfLifeLog[] {
    const targetUserId = userId || this.getActiveUserId();
    const allLogs = this.getAllRawWheelLogs();
    const userLogs = allLogs.filter((l) => l.userId === targetUserId);

    if (userLogs.length === 0) {
      // Si el usuario no tiene historial, crear evaluación por defecto inicial
      return [
        {
          id: `wheel-default-${targetUserId}`,
          userId: targetUserId,
          timestamp: new Date().toISOString(),
          label: 'Evaluación inicial',
          scores: {
            Salud: 7,
            'Carrera Profesional': 7,
            Finanzas: 7,
            Familia: 7,
            Ocio: 6,
            Relaciones: 6,
            Espiritualidad: 6
          }
        }
      ];
    }
    return userLogs;
  }

  static appendWheelSnapshot(scores: Record<WheelCategory, number>, label?: string, userId?: string): WheelOfLifeLog {
    const targetUserId = userId || this.getActiveUserId();
    const allLogs = this.getAllRawWheelLogs();

    const newLog: WheelOfLifeLog = {
      id: `wheel-snapshot-${Date.now()}`,
      userId: targetUserId,
      timestamp: new Date().toISOString(),
      label: label || `Evaluación ${new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      scores: { ...scores }
    };

    allLogs.push(newLog);
    try {
      localStorage.setItem(STORAGE_KEYS.WHEEL_LOGS, JSON.stringify(allLogs));
    } catch (e) {
      console.error('Error appending wheel snapshot:', e);
    }
    return newLog;
  }

  // REUNIONES (BLINDAJE BERMUDAS POR USER_ID)
  static getAllRawMeetings(): MeetingGuard[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEETINGS);
      return data ? JSON.parse(data) : INITIAL_MEETINGS;
    } catch {
      return INITIAL_MEETINGS;
    }
  }

  static getMeetings(userId?: string): MeetingGuard[] {
    const targetUserId = userId || this.getActiveUserId();
    return this.getAllRawMeetings().filter((m) => m.userId === targetUserId);
  }

  static saveMeeting(meeting: Omit<MeetingGuard, 'id' | 'createdAt'>, userId?: string): MeetingGuard {
    const targetUserId = userId || this.getActiveUserId();
    const allMeetings = this.getAllRawMeetings();

    const newMeeting: MeetingGuard = {
      ...meeting,
      userId: targetUserId,
      id: `meet-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    allMeetings.unshift(newMeeting);
    try {
      localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(allMeetings));
    } catch (e) {
      console.error('Error saving meeting:', e);
    }
    return newMeeting;
  }

  // CORREOS (POR USER_ID)
  static getAllRawEmails(): EmailDraft[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMAILS);
      return data ? JSON.parse(data) : INITIAL_EMAILS;
    } catch {
      return INITIAL_EMAILS;
    }
  }

  static getEmails(userId?: string): EmailDraft[] {
    const targetUserId = userId || this.getActiveUserId();
    return this.getAllRawEmails().filter((e) => e.userId === targetUserId);
  }

  static saveEmail(email: Omit<EmailDraft, 'id'>, userId?: string): EmailDraft {
    const targetUserId = userId || this.getActiveUserId();
    const allEmails = this.getAllRawEmails();

    const newEmail: EmailDraft = {
      ...email,
      userId: targetUserId,
      id: `email-${Date.now()}`
    };

    allEmails.unshift(newEmail);
    try {
      localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(allEmails));
    } catch (e) {
      console.error('Error saving email:', e);
    }
    return newEmail;
  }
}
