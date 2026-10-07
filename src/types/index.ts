export type ListContext = 'WORK' | 'PERSONAL';

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

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
  completed: boolean;
}

export interface WheelOfLifeLog {
  id: string;
  userId: string;
  timestamp: string; // Inmutable UTC Timestamp
  label?: string;
  scores: Record<WheelCategory, number>; // 1 to 10
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

export interface FormValidationError {
  field: string;
  message: string;
  ruleCode: string;
  suggestion?: string;
}
