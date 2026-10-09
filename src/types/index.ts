export type ListContext = 'WORK' | 'PERSONAL';

export type AppTab = 'tasks' | 'wheel' | 'bermudas' | 'requirements' | 'help';

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// Estado manual de la tarea; DONE la archiva (sale de las listas y del Top 10)
export type TaskStatus = 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'DONE';

export type WheelCategory = 
  | 'Salud'
  | 'Carrera Profesional'
  | 'Finanzas'
  | 'Familia'
  | 'Ocio'
  | 'Relaciones'
  | 'Espiritualidad';

export interface TaskObservation {
  id: string;
  type: 'note' | 'link' | 'checklist';
  text: string;
  completed?: boolean;
  url?: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  userId: string;
  listContext: ListContext;
  title: string;
  description: string;
  priority: TaskPriority;
  createdAt: string; // ISO / UTC timestamp
  updatedAt: string;
  observations: TaskObservation[];
  isSomeday: boolean; // "Quizá" / "Algún día"
  wheelCategory?: WheelCategory;
  wheelCategoryConfidence?: number;
  linkedBy?: 'MANUAL' | 'AUTO_TFIDF';
  status: TaskStatus;
  doneAt?: string; // ISO / UTC: cuándo pasó a Hecha (orden del archivo)
  // Fechas opcionales en hora local del dispositivo. Solo fecha límite = plazo; con inicio = intervalo.
  startDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (opcional)
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (opcional; sin hora, el plazo acaba al final del día)
}

export interface WheelOfLifeLog {
  id: string;
  userId: string;
  timestamp: string; // Inmutable UTC Timestamp
  label?: string;
  scores: Record<WheelCategory, number>; // 0 to 10
}

export interface MeetingGuard {
  id: string;
  userId: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  agendaPoints: string[]; // Mínimo 1 punto cerrado obligatorio
  moderatorName: string; // Designación nominal obligatoria
  moderatorEmail: string;
  createdAt: string;
}

export interface EmailDraft {
  id: string;
  userId: string;
  subject: string;
  body: string;
  attachments: { name: string; size: string }[];
  noAttachmentsDeclared: boolean;
  recipients: string[];
  sentAt?: string;
}

export interface UserProfile {
  id: string;
  googleId?: string;
  name: string;
  email?: string;
  photoUrl?: string;
  role: string;
  color: string;
  initials: string;
  authProvider: 'google' | 'local';
  createdAt: string;
  lastLoginAt?: string;
}

export interface FormValidationError {
  field: string;
  message: string;
  ruleCode: string;
  suggestion?: string;
}
