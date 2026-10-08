import { TaskItem, WheelOfLifeLog, MeetingGuard, EmailDraft, WheelCategory, UserProfile } from '../types';

const STORAGE_KEYS = {
  USERS: 'neuro_users_v1',
  ACTIVE_USER_ID: 'neuro_active_user_id_v1',
  TASKS: 'neuro_tasks_v1',
  WHEEL_LOGS: 'neuro_wheel_logs_v1',
  MEETINGS: 'neuro_meetings_v1',
  EMAILS: 'neuro_emails_v1',
  ACTIVE_CONTEXT: 'neuro_active_context_v1',
  DEMO_CLEANUP_DONE: 'neuro_demo_cleanup_v1'
};

export const DEFAULT_PROFILE_NAME = 'Mi espacio';

// Perfiles y registros de demostración que versiones anteriores guardaban en localStorage.
// initialize() los elimina de los navegadores que ya los tenían.
const LEGACY_DEMO_USER_IDS = ['user-1', 'user-2', 'user-3'];
const LEGACY_DEMO_RECORD_IDS = new Set([
  'email-1',
  'meet-1',
  'meet-u2-1',
  'task-p-1',
  'task-p-2',
  'task-p-3',
  'task-p-4',
  'task-p-someday-1',
  'task-u2-1',
  'task-u2-2',
  'task-u2-3',
  'task-u2-p1',
  'task-u2-p2',
  'task-w-1',
  'task-w-2',
  'task-w-3',
  'task-w-4',
  'task-w-5',
  'task-w-6',
  'task-w-7',
  'task-w-8',
  'task-w-9',
  'task-w-10',
  'task-w-11',
  'task-w-12',
  'task-w-someday-1',
  'wheel-snapshot-1',
  'wheel-snapshot-2',
  'wheel-snapshot-3',
  'wheel-snapshot-u1-1',
  'wheel-snapshot-u1-2',
  'wheel-snapshot-u1-3',
  'wheel-snapshot-u2-1',
  'wheel-snapshot-u2-2'
]);

const USER_DATA_KEYS = [STORAGE_KEYS.TASKS, STORAGE_KEYS.WHEEL_LOGS, STORAGE_KEYS.MEETINGS, STORAGE_KEYS.EMAILS];

type UserOwnedRecord = { id: string; userId: string };

const readList = <T>(key: string): T[] | null => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export class StorageService {
  // ARRANQUE: limpia datos de demostración heredados y garantiza un perfil activo
  static initialize(): UserProfile {
    this.removeLegacyDemoData();

    const users = this.getUsers();
    if (users.length === 0) {
      return this.createUser({ name: DEFAULT_PROFILE_NAME, role: '', authProvider: 'local' });
    }
    if (!users.some((u) => u.id === this.getActiveUserId())) {
      this.setActiveUserId(users[0].id);
    }
    return this.getActiveUser() ?? users[0];
  }

  private static removeLegacyDemoData(): void {
    try {
      if (localStorage.getItem(STORAGE_KEYS.DEMO_CLEANUP_DONE)) return;

      const users = readList<UserProfile>(STORAGE_KEYS.USERS);
      if (users) {
        const kept = users.filter((u) => !LEGACY_DEMO_USER_IDS.includes(u.id));
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(kept));
      }
      const activeBefore = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
      const wasInDemoProfile = LEGACY_DEMO_USER_IDS.includes(activeBefore ?? '');
      if (wasInDemoProfile) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
      }

      // Lo que la persona creó dentro de un perfil de demostración pasa a un perfil propio en lugar de perderse
      let heirId: string | null = null;
      for (const key of USER_DATA_KEYS) {
        const records = readList<UserOwnedRecord>(key);
        if (!records) continue;
        const kept = records
          .filter((r) => !LEGACY_DEMO_RECORD_IDS.has(r.id))
          .map((r) => {
            if (!LEGACY_DEMO_USER_IDS.includes(r.userId)) return r;
            heirId ??= this.createUser({ name: DEFAULT_PROFILE_NAME, role: '', authProvider: 'local' }).id;
            return { ...r, userId: heirId };
          });
        localStorage.setItem(key, JSON.stringify(kept));
      }
      // createUser activa el perfil heredero; si la persona ya estaba en un perfil propio, se queda en él
      if (heirId && activeBefore && !wasInDemoProfile) {
        this.setActiveUserId(activeBefore);
      }

      localStorage.setItem(STORAGE_KEYS.DEMO_CLEANUP_DONE, new Date().toISOString());
    } catch (e) {
      console.error('Error removing legacy demo data:', e);
    }
  }

  // GESTIÓN DE PERFILES LOCALES (solo en este navegador, sin autenticación)
  static getUsers(): UserProfile[] {
    return readList<UserProfile>(STORAGE_KEYS.USERS) ?? [];
  }

  static getActiveUserId(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || '';
    } catch {
      return '';
    }
  }

  static getActiveUser(): UserProfile | null {
    const users = this.getUsers();
    const activeId = this.getActiveUserId();
    return users.find((u) => u.id === activeId) ?? users[0] ?? null;
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
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  // Elimina el perfil y todos sus datos de este navegador
  static deleteUser(userId: string): boolean {
    const users = this.getUsers();
    if (users.length <= 1) return false; // Evitar borrar el último usuario
    const filtered = users.filter((u) => u.id !== userId);
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
      for (const key of USER_DATA_KEYS) {
        const records = readList<UserOwnedRecord>(key);
        if (records) {
          localStorage.setItem(key, JSON.stringify(records.filter((r) => r.userId !== userId)));
        }
      }
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
    return readList<TaskItem>(STORAGE_KEYS.TASKS) ?? [];
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
    return readList<WheelOfLifeLog>(STORAGE_KEYS.WHEEL_LOGS) ?? [];
  }

  // Un perfil sin evaluaciones está en su primer arranque: la app abre la Rueda con todo a 0
  static getWheelLogs(userId?: string): WheelOfLifeLog[] {
    const targetUserId = userId || this.getActiveUserId();
    return this.getAllRawWheelLogs().filter((l) => l.userId === targetUserId);
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
    return readList<MeetingGuard>(STORAGE_KEYS.MEETINGS) ?? [];
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
    return readList<EmailDraft>(STORAGE_KEYS.EMAILS) ?? [];
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
