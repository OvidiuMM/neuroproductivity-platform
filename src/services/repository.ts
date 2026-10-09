import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { EmailDraft, MeetingGuard, TaskItem, WheelOfLifeLog } from '../types';
import { normalizeTask } from './tasks';

// Datos de cada persona en users/{uid}/<colección>/<id>. Las reglas (firestore.rules) solo dejan acceder al propio uid.
export type UserCollection = 'tasks' | 'wheelLogs' | 'meetings' | 'emails';
export const USER_COLLECTIONS: UserCollection[] = ['tasks', 'wheelLogs', 'meetings', 'emails'];

export interface UserData {
  tasks: TaskItem[];
  wheelLogs: WheelOfLifeLog[];
  meetings: MeetingGuard[];
  emails: EmailDraft[];
}

const userCollection = (db: Firestore, uid: string, name: UserCollection) => collection(db, 'users', uid, name);

const byDateDesc = (a?: string, b?: string) => (b ?? '').localeCompare(a ?? '');

// Orden en cliente: un orderBy en la consulta excluiría los documentos sin ese campo (p. ej. correos sin sentAt)
const SORTERS = {
  tasks: (a: TaskItem, b: TaskItem) => byDateDesc(a.createdAt, b.createdAt),
  wheelLogs: (a: WheelOfLifeLog, b: WheelOfLifeLog) => a.timestamp.localeCompare(b.timestamp),
  meetings: (a: MeetingGuard, b: MeetingGuard) => byDateDesc(a.createdAt, b.createdAt),
  emails: (a: EmailDraft, b: EmailDraft) => byDateDesc(a.sentAt, b.sentAt)
};

export interface SnapshotInfo {
  // false mientras los datos vienen solo de la caché local y aún no se han confirmado con el servidor
  fromServer: boolean;
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
      onData(items, { fromServer: !snapshot.metadata.fromCache });
    },
    onError
  );

// Las escrituras se aplican al instante en la caché local; la promesa se resuelve cuando el servidor las confirma
export const saveTask = (db: Firestore, uid: string, task: TaskItem) =>
  setDoc(doc(userCollection(db, uid, 'tasks'), task.id), { ...task, userId: uid });

export const deleteTask = (db: Firestore, uid: string, taskId: string) =>
  deleteDoc(doc(userCollection(db, uid, 'tasks'), taskId));

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
    ...snapshots.flatMap((snapshot) => snapshot.docs.map((d) => (batch: ReturnType<typeof writeBatch>) => batch.delete(d.ref))),
    (batch) => batch.delete(doc(db, 'users', uid))
  ]);
};
