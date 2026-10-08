import { EmailDraft, MeetingGuard, TaskItem, UserProfile, WheelOfLifeLog } from '../types';
import type { UserData } from './repository';

// Datos que versiones anteriores (sin cuentas) guardaban en localStorage.
// Solo se leen para ofrecer importarlos a la cuenta en el primer inicio de sesión.
const KEYS = {
  USERS: 'neuro_users_v1',
  ACTIVE_USER_ID: 'neuro_active_user_id_v1',
  TASKS: 'neuro_tasks_v1',
  WHEEL_LOGS: 'neuro_wheel_logs_v1',
  MEETINGS: 'neuro_meetings_v1',
  EMAILS: 'neuro_emails_v1',
  ACTIVE_CONTEXT: 'neuro_active_context_v1',
  DEMO_CLEANUP_DONE: 'neuro_demo_cleanup_v1'
};

// Perfiles y registros de demostración de versiones anteriores: nunca se importan
const LEGACY_DEMO_USER_IDS = ['user-1', 'user-2', 'user-3'];
const LEGACY_DEMO_RECORD_IDS = new Set([
  'email-1', 'meet-1', 'meet-u2-1',
  'task-p-1', 'task-p-2', 'task-p-3', 'task-p-4', 'task-p-someday-1',
  'task-u2-1', 'task-u2-2', 'task-u2-3', 'task-u2-p1', 'task-u2-p2',
  'task-w-1', 'task-w-2', 'task-w-3', 'task-w-4', 'task-w-5', 'task-w-6', 'task-w-7',
  'task-w-8', 'task-w-9', 'task-w-10', 'task-w-11', 'task-w-12', 'task-w-someday-1',
  'wheel-snapshot-1', 'wheel-snapshot-2', 'wheel-snapshot-3',
  'wheel-snapshot-u1-1', 'wheel-snapshot-u1-2', 'wheel-snapshot-u1-3', 'wheel-snapshot-u2-1', 'wheel-snapshot-u2-2'
]);

// Lo creado dentro de un perfil de demostración se ofrece como un perfil aparte en lugar de perderse
export const ORPHAN_PROFILE_ID = 'local-orphans';
const ORPHAN_PROFILE_NAME = 'Datos creados en los perfiles de demostración';

type Owned = { id: string; userId: string };

const readList = <T>(storage: Storage, key: string): T[] => {
  try {
    const data = storage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const ownerOf = (record: Owned) => (LEGACY_DEMO_USER_IDS.includes(record.userId) ? ORPHAN_PROFILE_ID : record.userId);

const readRecords = (storage: Storage): UserData => {
  const keep = <T extends Owned>(key: string) =>
    readList<T>(storage, key).filter((r) => !LEGACY_DEMO_RECORD_IDS.has(r.id));
  return {
    tasks: keep<TaskItem>(KEYS.TASKS),
    wheelLogs: keep<WheelOfLifeLog>(KEYS.WHEEL_LOGS),
    meetings: keep<MeetingGuard>(KEYS.MEETINGS),
    emails: keep<EmailDraft>(KEYS.EMAILS)
  };
};

export interface LocalProfileSummary {
  id: string;
  name: string;
  counts: { tasks: number; wheelLogs: number; meetings: number; emails: number };
}

// Perfiles locales con algún dato que importar (los vacíos y los de demostración no aparecen)
export const getLocalProfiles = (storage: Storage = localStorage): LocalProfileSummary[] => {
  const records = readRecords(storage);
  const profiles = readList<UserProfile>(storage, KEYS.USERS).filter((u) => !LEGACY_DEMO_USER_IDS.includes(u.id));
  const candidates = [...profiles.map((p) => ({ id: p.id, name: p.name })), { id: ORPHAN_PROFILE_ID, name: ORPHAN_PROFILE_NAME }];
  // Registros de perfiles que ya no existen también se atribuyen a su userId para no perderlos
  const knownIds = new Set(candidates.map((c) => c.id));
  for (const record of [...records.tasks, ...records.wheelLogs, ...records.meetings, ...records.emails]) {
    const owner = ownerOf(record);
    if (!knownIds.has(owner)) {
      knownIds.add(owner);
      candidates.push({ id: owner, name: 'Perfil sin nombre' });
    }
  }

  return candidates
    .map(({ id, name }) => {
      const count = (list: Owned[]) => list.filter((r) => ownerOf(r) === id).length;
      return {
        id,
        name,
        counts: {
          tasks: count(records.tasks),
          wheelLogs: count(records.wheelLogs),
          meetings: count(records.meetings),
          emails: count(records.emails)
        }
      };
    })
    .filter((p) => Object.values(p.counts).some((n) => n > 0));
};

// Datos de los perfiles elegidos, listos para escribir en la cuenta
export const buildImport = (profileIds: string[], storage: Storage = localStorage): UserData => {
  const selected = new Set(profileIds);
  const records = readRecords(storage);
  const pick = <T extends Owned>(list: T[]) => list.filter((r) => selected.has(ownerOf(r)));
  return {
    tasks: pick(records.tasks),
    wheelLogs: pick(records.wheelLogs),
    meetings: pick(records.meetings),
    emails: pick(records.emails)
  };
};

export const clearLocalData = (storage: Storage = localStorage) => {
  Object.values(KEYS).forEach((key) => storage.removeItem(key));
};
