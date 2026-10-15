import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  setDoc,
  waitForPendingWrites,
  writeBatch,
  type Firestore
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { EmailDraft, Goal, MeetingGuard, TaskItem, WheelOfLifeLog } from '../types';
import { isUnchanged, normalizeTask } from './tasks';
import { onboardingRecord, type OnboardingOutcome, type OnboardingRecord } from './onboarding';

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
  emails: (a: EmailDraft, b: EmailDraft) => byDateDesc(a.updatedAt ?? a.sentAt, b.updatedAt ?? b.sentAt),
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

// «Deshacer» necesita al servidor: primero se espera a que confirme lo que se acaba de escribir (o se desiste si no
// hay conexión) y después se comprueba y se restaura en una transacción, para no pisar cambios de otro dispositivo
const UNDO_SYNC_TIMEOUT_MS = 5_000;
const whenSynced = (db: Firestore) =>
  Promise.race([
    waitForPendingWrites(db),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('offline')), UNDO_SYNC_TIMEOUT_MS))
  ]);

// Deshacer un cambio de estado: solo si las tareas escritas siguen igual (mismo estado y fecha de modificación) se
// restaura la anterior y, si se creó, se borra la siguiente repetición. Devuelve false si algo cambió entretanto.
export const undoTaskChange = async (
  db: Firestore,
  uid: string,
  written: TaskItem[],
  restored: TaskItem,
  removeId?: string
) => {
  await whenSynced(db);
  const tasks = userCollection(db, uid, 'tasks');
  return runTransaction(db, async (tx) => {
    const snapshots = await Promise.all(written.map((task) => tx.get(doc(tasks, task.id))));
    const current = snapshots.filter((s) => s.exists()).map((s) => s.data() as TaskItem);
    if (!isUnchanged(written, current)) return false;
    tx.set(doc(tasks, restored.id), { ...restored, userId: uid });
    if (removeId) tx.delete(doc(tasks, removeId));
    return true;
  });
};

// Recuperar una tarea eliminada, solo si nadie la ha vuelto a crear entretanto
export const restoreDeletedTask = async (db: Firestore, uid: string, task: TaskItem) => {
  await whenSynced(db);
  const ref = doc(userCollection(db, uid, 'tasks'), task.id);
  return runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return false;
    tx.set(ref, { ...task, userId: uid });
    return true;
  });
};

export const deleteTask = (db: Firestore, uid: string, taskId: string) =>
  deleteDoc(doc(userCollection(db, uid, 'tasks'), taskId));

// La meta sola: sus tareas toman el área de la meta al leerlas (applyGoalAreas), no hay que reescribirlas
export const saveGoal = (db: Firestore, uid: string, goal: Goal) =>
  setDoc(doc(userCollection(db, uid, 'goals'), goal.id), { ...goal, userId: uid });

// Al eliminar una meta, sus tareas se quedan con el área que tenía y sin el vínculo. El vínculo a una meta que ya no
// existe se ignora al leer, así que esta limpieza no tiene que ser atómica en conjunto: busca las tareas vinculadas
// en ese momento y desvincula cada una en su propia transacción, solo si sigue apuntando a esta meta (si entretanto se
// vinculó a otra en otro dispositivo, no se toca). Sin límite de cantidad: van de diez en diez.
const UNLINK_CONCURRENCY = 10;
export const deleteGoal = async (db: Firestore, uid: string, goal: Goal) => {
  await deleteDoc(doc(userCollection(db, uid, 'goals'), goal.id));
  const linked = await getDocs(query(userCollection(db, uid, 'tasks'), where('goalId', '==', goal.id)));
  const updatedAt = new Date().toISOString();
  const unlink = (ref: (typeof linked.docs)[number]['ref']) =>
    runTransaction(db, async (tx) => {
      const current = await tx.get(ref);
      if ((current.data() as TaskItem | undefined)?.goalId !== goal.id) return;
      tx.update(ref, { goalId: deleteField(), wheelCategory: goal.area, updatedAt });
    });
  for (let i = 0; i < linked.docs.length; i += UNLINK_CONCURRENCY) {
    await Promise.all(linked.docs.slice(i, i + UNLINK_CONCURRENCY).map((task) => unlink(task.ref)));
  }
};

export const appendWheelLog = (db: Firestore, uid: string, log: WheelOfLifeLog) =>
  setDoc(doc(userCollection(db, uid, 'wheelLogs'), log.id), { ...log, userId: uid });

export const saveMeeting = (db: Firestore, uid: string, meeting: MeetingGuard) =>
  setDoc(doc(userCollection(db, uid, 'meetings'), meeting.id), { ...meeting, userId: uid });

export const saveEmail = (db: Firestore, uid: string, email: EmailDraft) =>
  setDoc(doc(userCollection(db, uid, 'emails'), email.id), { ...email, userId: uid });

export const deleteEmail = (db: Firestore, uid: string, emailId: string) =>
  deleteDoc(doc(userCollection(db, uid, 'emails'), emailId));

// Recuperar un correo eliminado, solo si nadie lo ha vuelto a guardar entretanto (p. ej. desde otra pestaña)
export const restoreDeletedEmail = async (db: Firestore, uid: string, email: EmailDraft) => {
  await whenSynced(db);
  const ref = doc(userCollection(db, uid, 'emails'), email.id);
  return runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return false;
    tx.set(ref, { ...email, userId: uid });
    return true;
  });
};

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

// Perfil (users/{uid}) en vivo: por ahora solo interesa si ya vio la bienvenida. `fromServer` dice si el dato ya
// está confirmado por el servidor (al principio puede venir solo de la caché, o no existir aún)
export const subscribeToProfile = (
  db: Firestore,
  uid: string,
  onData: (profile: OnboardingRecord | null, fromServer: boolean) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    doc(db, 'users', uid),
    { includeMetadataChanges: true },
    (snapshot) => onData((snapshot.data() as OnboardingRecord | undefined) ?? null, !snapshot.metadata.fromCache),
    onError
  );

export const markOnboardingSeen = (db: Firestore, uid: string, outcome: OnboardingOutcome) =>
  setDoc(doc(db, 'users', uid), onboardingRecord(outcome), { merge: true });

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
