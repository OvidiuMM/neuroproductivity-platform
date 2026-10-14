import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { EmailDraft, Goal, MeetingGuard, TaskItem, WheelOfLifeLog } from '../types';
import { normalizeTask } from './tasks';

// Datos de cada persona en users/{uid}/<colección>/<id>. Las reglas (firestore.rules) solo dejan acceder al propio uid.
export type UserCollection = 'tasks' | 'wheelLogs' | 'meetings' | 'emails' | 'goals';
export const USER_COLLECTIONS: UserCollection[] = ['tasks', 'wheelLogs', 'meetings', 'emails', 'goals'];

export interface UserData {
  tasks: TaskItem[];
  wheelLogs: WheelOfLifeLog[];
  meetings: MeetingGuard[];
  emails: EmailDraft[];
  goals: Goal[];
}

const userCollection = (db: Firestore, uid: string, name: UserCollection) => collection(db, 'users', uid, name);

const byDateDesc = (a?: string, b?: string) => (b ?? '').localeCompare(a ?? '');

// Orden en cliente: un orderBy en la consulta excluiría los documentos sin ese campo (p. ej. correos sin sentAt)
const SORTERS = {
  tasks: (a: TaskItem, b: TaskItem) => byDateDesc(a.createdAt, b.createdAt),
  wheelLogs: (a: WheelOfLifeLog, b: WheelOfLifeLog) => a.timestamp.localeCompare(b.timestamp),
  meetings: (a: MeetingGuard, b: MeetingGuard) => byDateDesc(a.createdAt, b.createdAt),
  emails: (a: EmailDraft, b: EmailDraft) => byDateDesc(a.sentAt, b.sentAt),
  goals: (a: Goal, b: Goal) => byDateDesc(a.createdAt, b.createdAt)
};

export interface SnapshotInfo {
  // false mientras los datos vienen solo de la caché local y aún no se han confirmado con el servidor
  fromServer: boolean;
  // true mientras haya escrituras locales que el servidor aún no ha confirmado
  hasPendingWrites: boolean;
}

export const subscribeToCollection = <K extends UserCollection>(
  db: Firestore,
  uid: string,
  name: K,
  onData: (items: UserData[K], info: SnapshotInfo) => void,
  onError: (error: Error) => void
): (() => void) =>
  onSnapshot(
    userCollection(db, uid, name),
    { includeMetadataChanges: true },
    (snapshot) => {
      const docs = snapshot.docs.map((d) => d.data());
      // Las tareas anteriores a la 0.6.0 usan `completed` en lugar de `status`
      const items = (name === 'tasks' ? docs.map((d) => normalizeTask(d as TaskItem)) : docs) as UserData[K];
      items.sort(SORTERS[name] as (a: unknown, b: unknown) => number);
      onData(items, { fromServer: !snapshot.metadata.fromCache, hasPendingWrites: snapshot.metadata.hasPendingWrites });
    },
    onError
  );

// Las escrituras se aplican al instante en la caché local; la promesa se resuelve cuando el servidor las confirma
export const saveTask = (db: Firestore, uid: string, task: TaskItem) =>
  setDoc(doc(userCollection(db, uid, 'tasks'), task.id), { ...task, userId: uid });

// Tarea recurrente hecha: la tarea archivada (con el id de la siguiente) y la siguiente repetición se guardan
// en un mismo lote, así nunca queda una sin la otra
export const completeRecurringTask = (db: Firestore, uid: string, done: TaskItem, next: TaskItem) => {
  const batch = writeBatch(db);
  batch.set(doc(userCollection(db, uid, 'tasks'), done.id), { ...done, userId: uid });
  batch.set(doc(userCollection(db, uid, 'tasks'), next.id), { ...next, userId: uid });
  return batch.commit();
};

// Deshacer una tarea recurrente hecha: vuelve tal como estaba y desaparece la repetición que se había creado
export const undoCompleteRecurringTask = (db: Firestore, uid: string, original: TaskItem, nextId: string) => {
  const batch = writeBatch(db);
  batch.set(doc(userCollection(db, uid, 'tasks'), original.id), { ...original, userId: uid });
  batch.delete(doc(userCollection(db, uid, 'tasks'), nextId));
  return batch.commit();
};

export const deleteTask = (db: Firestore, uid: string, taskId: string) =>
  deleteDoc(doc(userCollection(db, uid, 'tasks'), taskId));

// Meta y, si cambia de área, sus tareas con el área nueva (heredan el área de la meta), en un mismo lote. En las
// tareas solo se tocan el área y la fecha de modificación: lo demás pudo cambiar en otro dispositivo, y la fecha nueva
// hace que un «Deshacer» pendiente sobre ellas detecte el cambio
export const saveGoal = (db: Firestore, uid: string, goal: Goal, retaggedTaskIds: string[] = []) => {
  const batch = writeBatch(db);
  batch.set(doc(userCollection(db, uid, 'goals'), goal.id), { ...goal, userId: uid });
  for (const taskId of retaggedTaskIds) {
    batch.update(doc(userCollection(db, uid, 'tasks'), taskId), {
      wheelCategory: goal.area,
      updatedAt: goal.updatedAt
    });
  }
  return batch.commit();
};

// Al eliminar una meta, sus tareas se quedan, sin meta (conservan el área); en ellas solo se quita el vínculo
export const deleteGoal = (db: Firestore, uid: string, goalId: string, linkedTaskIds: string[]) => {
  const batch = writeBatch(db);
  batch.delete(doc(userCollection(db, uid, 'goals'), goalId));
  const updatedAt = new Date().toISOString();
  for (const taskId of linkedTaskIds) {
    batch.update(doc(userCollection(db, uid, 'tasks'), taskId), { goalId: deleteField(), updatedAt });
  }
  return batch.commit();
};

export const appendWheelLog = (db: Firestore, uid: string, log: WheelOfLifeLog) =>
  setDoc(doc(userCollection(db, uid, 'wheelLogs'), log.id), { ...log, userId: uid });

export const saveMeeting = (db: Firestore, uid: string, meeting: MeetingGuard) =>
  setDoc(doc(userCollection(db, uid, 'meetings'), meeting.id), { ...meeting, userId: uid });

export const saveEmail = (db: Firestore, uid: string, email: EmailDraft) =>
  setDoc(doc(userCollection(db, uid, 'emails'), email.id), { ...email, userId: uid });

export const saveUserProfile = (db: Firestore, user: User) =>
  setDoc(
    doc(db, 'users', user.uid),
    {
      name: user.displayName ?? '',
      email: user.email ?? '',
      photoUrl: user.photoURL ?? '',
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : '',
      lastLoginAt: new Date().toISOString()
    },
    { merge: true }
  );

// Firestore admite como máximo 500 operaciones por lote
const BATCH_LIMIT = 450;

const commitInBatches = async (db: Firestore, ops: ((batch: ReturnType<typeof writeBatch>) => void)[]) => {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
};

export const importUserData = (db: Firestore, uid: string, data: UserData) =>
  commitInBatches(
    db,
    USER_COLLECTIONS.flatMap((name) =>
      (data[name] as { id: string }[]).map(
        (item) => (batch: ReturnType<typeof writeBatch>) =>
          batch.set(doc(userCollection(db, uid, name), item.id), { ...item, userId: uid })
      )
    )
  );

export const exportUserData = async (db: Firestore, uid: string): Promise<UserData> => {
  const entries = await Promise.all(
    USER_COLLECTIONS.map(async (name) => {
      const snapshot = await getDocs(userCollection(db, uid, name));
      return [name, snapshot.docs.map((d) => d.data())] as const;
    })
  );
  return Object.fromEntries(entries) as unknown as UserData;
};

export const deleteAllUserData = async (db: Firestore, uid: string) => {
  const snapshots = await Promise.all(USER_COLLECTIONS.map((name) => getDocs(userCollection(db, uid, name))));
  await commitInBatches(db, [
    ...snapshots.flatMap((snapshot) =>
      snapshot.docs.map((d) => (batch: ReturnType<typeof writeBatch>) => batch.delete(d.ref))
    ),
    (batch) => batch.delete(doc(db, 'users', uid))
  ]);
};
