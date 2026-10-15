/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { retryableLazy } from './lazy';
import { DeferredDialog, DeferredSection } from './components/Deferred';
import type { User } from 'firebase/auth';
import {
  AppTab,
  ListContext,
  TaskItem,
  TaskStatus,
  WheelCategory,
  WheelOfLifeLog,
  MeetingGuard,
  EmailDraft,
  Goal,
  GoalStatus,
  UserProfile
} from './types';
import { formatTaskDates, isArchived, withStatus } from './services/tasks';
import { nextRecurringTask } from './services/recurrence';
import { forceSync, signOutAndClearCache, type FirebaseServices } from './services/firebase';
import {
  appendWheelLog,
  completeRecurringTask,
  deleteTask,
  undoTaskChange,
  restoreDeletedTask,
  saveGoal,
  deleteGoal,
  subscribeToProfile,
  markOnboardingSeen,
  importUserData,
  saveEmail,
  deleteEmail,
  restoreDeletedEmail,
  saveMeeting,
  saveTask,
  subscribeToCollection,
  USER_COLLECTIONS,
  type SnapshotInfo,
  type UserCollection
} from './services/repository';
import { buildImport, clearLocalData, getLocalProfiles, type LocalProfileSummary } from './services/localData';
import { arrangeTasks, parseListPrefs, type ListPrefs } from './services/taskListing';
import { useNow } from './hooks/useNow';
import { Navbar } from './components/Navbar';
import { BottomNav, MORE_BUTTON_ID } from './components/BottomNav';
import { PHONE_QUERY, useMediaQuery } from './hooks/useMediaQuery';
import { MoreSheet } from './components/MoreSheet';
// Va ya en el paquete principal: también la usa la pantalla de acceso
import { FeedbackDialog } from './components/FeedbackDialog';
import { AlarmAlerts } from './components/AlarmAlerts';
import { useTaskAlarms } from './hooks/useTaskAlarms';
import type { ScheduledAlarm } from './services/alarms';
import { showSystemNotification } from './services/notifications';
import { TOUR_STEPS } from './tourSteps';
import {
  hasSeenLocally,
  hasSeenOnboarding,
  rememberLocally,
  type OnboardingOutcome,
  type OnboardingRecord
} from './services/onboarding';
import { applyGoalAreas, latestScores } from './services/goals';
import type { SyncStatus } from './components/SyncIndicator';
import { TaskList } from './components/TaskList';
import { TaskModal, type TaskFormData } from './components/TaskModal';
import { ArchivedTasksModal } from './components/ArchivedTasksModal';
import { MeetingModal } from './components/MeetingModal';
import { EmailModal, type EmailSaveKind } from './components/EmailModal';
import { isDraft } from './services/email';
import { SplashScreen } from './components/SplashScreen';
import { AccountMenu } from './components/AccountMenu';
import { LegalLinks } from './components/LegalLinks';
import { ImportLocalDataModal } from './components/ImportLocalDataModal';
import { HomeView } from './components/HomeView';
import {
  loadClosedFeedback,
  replyToFeedback,
  setFeedbackStatus,
  subscribeToOpenFeedback,
  type FeedbackTicket,
  type ReplyResult
} from './services/feedbackApi';
import { FirebaseError } from 'firebase/app';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import {
  setAccess,
  subscribeToAccessRequests,
  type AccessRequest,
  type DecisionStatus,
  setAccessMode,
  subscribeToApprovalRequired
} from './services/access';
import { deleteAccount, downloadAccountData, signOutEverywhere } from './services/account';
import { changePassword, hasPassword } from './services/auth';
import { CheckCircle2, Plus } from 'lucide-react';

interface AppProps {
  user: User;
  services: FirebaseServices;
  isAdmin?: boolean;
}

const initialsOf = (name: string) =>
  name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

// Secciones y ventanas que no se ven al arrancar: se cargan la primera vez que se abren
const AgendaView = retryableLazy(() => import('./components/AgendaView').then((m) => m.AgendaView));
const WheelOfLife = retryableLazy(() => import('./components/WheelOfLife').then((m) => m.WheelOfLife));
const BermudasShield = retryableLazy(() => import('./components/BermudasShield').then((m) => m.BermudasShield));
const HowItWorks = retryableLazy(() => import('./components/HowItWorks').then((m) => m.HowItWorks));
const AdminView = retryableLazy(() => import('./components/AdminView').then((m) => m.AdminView));
const GoalsView = retryableLazy(() => import('./components/GoalsView').then((m) => m.GoalsView));
const GoalModal = retryableLazy(() => import('./components/GoalModal').then((m) => m.GoalModal));
const WelcomeDialog = retryableLazy(() => import('./components/WelcomeDialog').then((m) => m.WelcomeDialog));
const ProductTour = retryableLazy(() => import('./components/ProductTour').then((m) => m.ProductTour));

// Por qué no salió una respuesta a un mensaje de contacto (los códigos que devuelve replyToFeedback)
const REPLY_ERRORS: Record<string, string> = {
  'functions/permission-denied': 'Solo la administración puede responder los mensajes.',
  'functions/invalid-argument': 'Escribe la respuesta.',
  'functions/not-found': 'El mensaje ya no existe: quizá se eliminó la cuenta que lo envió.',
  'functions/unavailable': 'No se pudo enviar la respuesta. Inténtalo de nuevo.',
  'functions/failed-precondition': 'El envío de correos no está configurado.',
  'functions/aborted':
    'Esta respuesta ya se estaba enviando y no se sabe si salió: para no duplicarla, no se reenvía. Cancela y escribe otra si hace falta.'
};

export default function App({ user, services, isAdmin = false }: AppProps) {
  const { db } = services;
  const uid = user.uid;

  // Perfil para la interfaz a partir de la cuenta (Google o email)
  const profile: UserProfile = {
    id: uid,
    name: user.displayName || user.email || 'Tu cuenta',
    email: user.email ?? undefined,
    photoUrl: user.photoURL ?? undefined,
    role: '',
    color: 'indigo',
    initials: initialsOf(user.displayName || user.email || ''),
    authProvider: 'google',
    createdAt: user.metadata.creationTime ?? ''
  };
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);

  // Datos de la cuenta, sincronizados en tiempo real con Firestore (y disponibles sin conexión desde la caché)
  const [storedTasks, setTasks] = useState<TaskItem[]>([]);
  const [wheelLogs, setWheelLogs] = useState<WheelOfLifeLog[]>([]);
  const [wheelSynced, setWheelSynced] = useState(false);
  const [meetings, setMeetings] = useState<MeetingGuard[]>([]);
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  // Las tareas vinculadas a una meta tienen el área de la meta
  const tasks = useMemo(() => applyGoalAreas(storedTasks, goals), [storedTasks, goals]);
  // Editor de metas: abierto con la meta que se edita, o vacío para crear una
  // Meta que se edita, o una nueva (con su área ya elegida si se crea desde un área de «Metas»)
  const [goalEditor, setGoalEditor] = useState<{ goal?: Goal; area?: WheelCategory } | null>(null);

  // Datos de la versión sin cuentas que siguen en este navegador, pendientes de importar
  const [localProfiles, setLocalProfiles] = useState<LocalProfileSummary[]>(() => getLocalProfiles());
  const [isImportPostponed, setIsImportPostponed] = useState(false);

  const [activeContext, setActiveContext] = useState<ListContext>('WORK');
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  // Orden y filtros del Top 10, guardados en este dispositivo para cada cuenta
  const listPrefsKey = `neuro_list_prefs_v1:${uid}`;
  const [listPrefs, setListPrefs] = useState<ListPrefs>(() => parseListPrefs(localStorage.getItem(listPrefsKey)));
  useEffect(() => {
    localStorage.setItem(listPrefsKey, JSON.stringify(listPrefs));
  }, [listPrefs, listPrefsKey]);
  const now = useNow();
  const firstRunChecked = useRef(false);
  // Secciones que abre la persona: una vez que navega, el primer arranque ya no la lleva a la Rueda
  const hasNavigated = useRef(false);
  const navigate = (tab: AppTab) => {
    hasNavigated.current = true;
    setActiveTab(tab);
  };

  // ACCESOS (solo administración): solicitudes en vivo para la pestaña y su contador de pendientes
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  // APROBACIÓN DE CUENTAS (solo administración): obligatoria o libre
  const [approvalRequired, setApprovalRequired] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToApprovalRequired(db, setApprovalRequired, (e) => {
      console.error('Error loading access settings:', e);
      setAccessError('No se pudo cargar la configuración de la aprobación de cuentas.');
    });
  }, [db, isAdmin]);
  const handleSetApprovalRequired = async (required: boolean) => {
    setAccessError(null);
    try {
      const { approved } = await setAccessMode(services.functions, required);
      showToast(
        required
          ? 'Aprobación obligatoria activada.'
          : approved > 0
            ? `Aprobación desactivada. Se han aprobado ${approved === 1 ? '1 solicitud' : `${approved} solicitudes`}.`
            : 'Aprobación desactivada: las cuentas nuevas entran solas.'
      );
    } catch (e) {
      console.error('Error changing access mode:', e);
      setAccessError('No se pudo cambiar la aprobación de cuentas. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  // MENSAJES DE CONTACTO (solo administración): los abiertos en vivo; los cerrados, bajo demanda en su vista
  const [feedbackTickets, setFeedbackTickets] = useState<FeedbackTicket[]>([]);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // Al dejar de ser administración se vacían las solicitudes y se sale de su pestaña
  const [wasAdmin, setWasAdmin] = useState(isAdmin);
  if (wasAdmin !== isAdmin) {
    setWasAdmin(isAdmin);
    if (!isAdmin) {
      setAccessRequests([]);
      setFeedbackTickets([]);
      setActiveTab((tab) => (tab === 'access' ? 'tasks' : tab));
    }
  }
  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToAccessRequests(db, setAccessRequests, (e) => {
      console.error('Error loading access requests:', e);
      setAccessError('No se pudieron cargar las solicitudes de acceso.');
    });
  }, [db, isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToOpenFeedback(db, setFeedbackTickets, (e) => {
      console.error('Error loading feedback:', e);
      setFeedbackError('No se pudieron cargar los mensajes.');
    });
  }, [db, isAdmin]);
  // Lo pendiente en Administración: solicitudes por decidir y mensajes sin leer
  const pendingAccessCount =
    accessRequests.filter((r) => r.status === 'pending').length +
    feedbackTickets.filter((t) => t.status === 'new').length;
  // Devuelve si se guardó: la vista solo ajusta su lista de cerrados cuando la escritura fue bien
  const handleSetFeedbackStatus = async (ticket: FeedbackTicket, status: FeedbackTicket['status']) => {
    setFeedbackError(null);
    try {
      await setFeedbackStatus(db, ticket.id, status);
      return true;
    } catch (e) {
      console.error('Error updating feedback:', e);
      setFeedbackError('No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    }
  };

  // RESPONDER A UN MENSAJE: la función lo envía por email y, si sale, lo guarda
  const handleReplyFeedback = async (
    ticket: FeedbackTicket,
    replyId: string,
    message: string
  ): Promise<ReplyResult> => {
    try {
      return { reply: await replyToFeedback(services.functions, ticket.id, replyId, message) };
    } catch (e) {
      console.error('Error replying to feedback:', e);
      return {
        error:
          (e instanceof FirebaseError && REPLY_ERRORS[e.code]) ||
          'No se pudo enviar la respuesta. Comprueba la conexión e inténtalo de nuevo.'
      };
    }
  };

  // CONTACTO: desde la ayuda o la cuenta
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const handleDecideAccess = async (targetUid: string, status: DecisionStatus) => {
    setAccessError(null);
    try {
      await setAccess(services.functions, targetUid, status);
    } catch (e) {
      console.error('Error deciding access:', e);
      setAccessError('No se pudo guardar la decisión. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  // Estado de pantalla de inicio móvil (Splash Screen)
  const [showSplash, setShowSplash] = useState(true);

  // Modales
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [newTaskIsSomeday, setNewTaskIsSomeday] = useState(false);
  const [newTaskGoalId, setNewTaskGoalId] = useState<string | undefined>();
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  // Correo que se está escribiendo: uno nuevo, un borrador que se continúa o uno guardado que se abre
  const [emailEditor, setEmailEditor] = useState<{ email?: EmailDraft } | null>(null);

  // Toast / Banner de notificación
  // Con `undo`, el aviso ofrece «Deshacer» y dura un poco más
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 4000);
  }, []);

  const reportError = useCallback(
    (action: string) => (e: unknown) => {
      console.error(`Error al ${action}:`, e);
      showToast(`No se pudo ${action}. Revisa tu conexión e inténtalo de nuevo.`);
    },
    [showToast]
  );

  // SINCRONIZACIÓN: verde solo si las cuatro colecciones están confirmadas por el servidor y sin escrituras pendientes
  const [syncByCollection, setSyncByCollection] = useState<Record<UserCollection, SnapshotInfo>>(
    () =>
      Object.fromEntries(
        USER_COLLECTIONS.map((name) => [name, { fromServer: false, hasPendingWrites: false }])
      ) as Record<UserCollection, SnapshotInfo>
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const trackSync = (name: UserCollection, info: SnapshotInfo) =>
    setSyncByCollection((current) =>
      current[name].fromServer === info.fromServer && current[name].hasPendingWrites === info.hasPendingWrites
        ? current
        : { ...current, [name]: info }
    );

  const syncStatus: SyncStatus = isSyncing
    ? 'syncing'
    : !isOnline
      ? 'offline'
      : Object.values(syncByCollection).every((s) => s.fromServer && !s.hasPendingWrites)
        ? 'synced'
        : 'pending';

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const synced = await forceSync(db, uid);
      showToast(
        synced
          ? 'Todo está sincronizado con el servidor.'
          : 'No se pudo sincronizar. Revisa tu conexión: tus cambios siguen guardados en este dispositivo.'
      );
    } catch (e) {
      reportError('sincronizar')(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Suscripción en tiempo real a los datos de la cuenta
  useEffect(() => {
    const onError = reportError('cargar tus datos');
    const unsubscribers = [
      subscribeToCollection(
        db,
        uid,
        'tasks',
        (items, info) => {
          setTasks(items);
          trackSync('tasks', info);
        },
        onError
      ),
      subscribeToCollection(
        db,
        uid,
        'wheelLogs',
        (logs, info) => {
          const { fromServer } = info;
          setWheelLogs(logs);
          trackSync('wheelLogs', info);
          if (fromServer) setWheelSynced(true);
          // Primer arranque: sin evaluaciones confirmadas por el servidor, la app abre en la Rueda de la Vida
          if (!firstRunChecked.current && (fromServer || logs.length > 0)) {
            firstRunChecked.current = true;
            if (logs.length === 0 && !hasNavigated.current) setActiveTab('wheel');
          }
        },
        onError
      ),
      subscribeToCollection(
        db,
        uid,
        'meetings',
        (items, info) => {
          setMeetings(items);
          trackSync('meetings', info);
        },
        onError
      ),
      subscribeToCollection(
        db,
        uid,
        'emails',
        (items, info) => {
          setEmails(items);
          trackSync('emails', info);
        },
        onError
      ),
      subscribeToCollection(
        db,
        uid,
        'goals',
        (items, info) => {
          setGoals(items);
          trackSync('goals', info);
        },
        onError
      )
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [db, uid, reportError]);

  // Las escrituras se reflejan al instante (caché local) y se sincronizan con el servidor en segundo plano
  const openNewTask = (options?: { someday?: boolean; goalId?: string }) => {
    setEditingTask(null);
    setNewTaskIsSomeday(Boolean(options?.someday));
    setNewTaskGoalId(options?.goalId);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (taskData: TaskFormData) => {
    const now = new Date().toISOString();
    if (editingTask) {
      const current = tasks.find((t) => t.id === editingTask.id) ?? editingTask;
      saveTask(db, uid, { ...current, ...taskData, updatedAt: now }).catch(reportError('guardar la tarea'));
      showToast('Tarea guardada.');
      setEditingTask(null);
    } else {
      const newTask: TaskItem = {
        ...taskData,
        id: `task-${Date.now()}`,
        userId: uid,
        createdAt: now,
        updatedAt: now,
        status: 'PENDING'
      };
      saveTask(db, uid, newTask).catch(reportError('guardar la tarea'));
      showToast(taskData.isSomeday ? 'Tarea guardada en «Algún día».' : 'Tarea añadida.');
    }
  };

  // "Hecha" archiva la tarea; cualquier otro estado la devuelve a su lista
  // «Deshacer»: comprueba en el servidor que nada ha cambiado y restaura con la hora de ahora (es un cambio nuevo)
  const undo = (attempt: () => Promise<boolean>) => () => {
    showToast('Deshaciendo…');
    attempt()
      .then((done) => showToast(done ? 'Tarea recuperada.' : 'No se puede deshacer: la tarea ha cambiado entretanto.'))
      .catch((e: unknown) => {
        console.error('Error al deshacer:', e);
        showToast('No se pudo deshacer: hace falta conexión. Puedes cambiarlo a mano.');
      });
  };

  const handleChangeStatus = (task: TaskItem, status: TaskStatus) => {
    if (status === task.status) return;
    // Tarea recurrente marcada como Hecha: se crea la siguiente repetición (una sola vez por tarea)
    const next = status === 'DONE' && !task.nextOccurrenceId ? nextRecurringTask(task) : null;
    const updated = withStatus(task, status);
    // Deshacer devuelve la tarea como estaba (y quita la repetición que se acaba de crear) si nada cambió entretanto
    const restored = () => ({ ...task, updatedAt: new Date().toISOString() });
    if (next) {
      const done = { ...updated, nextOccurrenceId: next.id };
      completeRecurringTask(db, uid, done, next).catch(reportError('guardar la tarea y su siguiente repetición'));
      showToast(
        `Tarea hecha y archivada. Siguiente repetición: ${formatTaskDates(next)?.replace('Vence: ', '')}.`,
        undo(() => undoTaskChange(db, uid, [done, next], restored(), next.id))
      );
      return;
    }
    saveTask(db, uid, updated).catch(reportError('actualizar el estado'));
    if (status === 'DONE') {
      showToast(
        'Tarea hecha y archivada. La encontrarás en «Archivadas».',
        undo(() => undoTaskChange(db, uid, [updated], restored()))
      );
    } else if (isArchived(task)) {
      showToast('Tarea reactivada: vuelve a su lista.');
    }
  };

  // METAS: si cambia de área, sus tareas heredan la nueva; al eliminarla, sus tareas se quedan sin meta
  const handleSaveGoal = (goal: Goal) => {
    const previous = goals.find((g) => g.id === goal.id);
    saveGoal(db, uid, goal).catch(reportError('guardar la meta'));
    showToast(previous ? 'Meta guardada.' : 'Meta creada. Añádele tareas en «Metas».');
  };
  const handleSetGoalStatus = (goal: Goal, status: GoalStatus) => {
    saveGoal(db, uid, { ...goal, status, updatedAt: new Date().toISOString() }).catch(reportError('guardar la meta'));
    showToast(
      status === 'ACHIEVED' ? '¡Meta lograda!' : status === 'ARCHIVED' ? 'Meta archivada.' : 'Meta reactivada.'
    );
  };
  const handleDeleteGoal = (goal: Goal) => {
    deleteGoal(db, uid, goal).catch(reportError('eliminar la meta'));
    showToast('Meta eliminada. Sus tareas siguen en tus listas.');
  };

  const handleDeleteTask = (id: string) => {
    const deleted = tasks.find((t) => t.id === id);
    deleteTask(db, uid, id).catch(reportError('eliminar la tarea'));
    showToast(
      'Tarea eliminada.',
      deleted && undo(() => restoreDeletedTask(db, uid, { ...deleted, updatedAt: new Date().toISOString() }))
    );
  };

  const handleAppendWheelSnapshot = (scores: Record<WheelCategory, number>, label?: string) => {
    const now = new Date();
    const log: WheelOfLifeLog = {
      id: `wheel-snapshot-${now.getTime()}`,
      userId: uid,
      timestamp: now.toISOString(),
      label:
        label ||
        `Evaluación ${now.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      scores: { ...scores }
    };
    appendWheelLog(db, uid, log).catch(reportError('guardar la evaluación'));
    showToast('Evaluación guardada.');
  };

  const handleSaveMeeting = (meetingData: Omit<MeetingGuard, 'id' | 'createdAt'>) => {
    const meeting: MeetingGuard = {
      ...meetingData,
      id: `meet-${Date.now()}`,
      userId: uid,
      createdAt: new Date().toISOString()
    };
    saveMeeting(db, uid, meeting).catch(reportError('guardar la reunión'));
    showToast('Reunión guardada.');
  };

  const handleSaveEmail = (email: EmailDraft, kind: EmailSaveKind) => {
    saveEmail(db, uid, { ...email, userId: uid }).catch(reportError('guardar el correo'));
    showToast(
      kind === 'saved'
        ? 'Correo guardado.'
        : kind === 'draft'
          ? 'Borrador guardado. Lo tienes en «Borradores».'
          : 'Lo que escribiste se guardó como borrador.'
    );
  };
  const handleDeleteEmail = (email: EmailDraft) => {
    deleteEmail(db, uid, email.id).catch(reportError('eliminar el correo'));
    showToast(isDraft(email) ? 'Borrador eliminado.' : 'Correo eliminado.', () => {
      showToast('Deshaciendo…');
      restoreDeletedEmail(db, uid, email)
        .then((done) =>
          showToast(done ? 'Correo recuperado.' : 'No se puede deshacer: el correo se ha vuelto a guardar entretanto.')
        )
        .catch(reportError('recuperar el correo'));
    });
  };

  // CUENTA
  const handleExportData = () => downloadAccountData(services, user);
  const handleDeleteAccount = (password?: string) => deleteAccount(services, user, password);

  // IMPORTACIÓN DE DATOS DE LA VERSIÓN SIN CUENTAS
  const handleImportLocalData = async (profileIds: string[]) => {
    await importUserData(db, uid, buildImport(profileIds));
    clearLocalData();
    setLocalProfiles([]);
    showToast('Datos importados a tu cuenta.');
  };

  const handleDiscardLocalData = () => {
    clearLocalData();
    setLocalProfiles([]);
  };

  const isImportOpen = localProfiles.length > 0 && !isImportPostponed;
  // BIENVENIDA: una vez por cuenta. Cuenta como vista si lo dice el perfil o este dispositivo; si no, se espera al
  // perfil confirmado por el servidor para no mostrarla a quien ya la vio en otro dispositivo
  const [profileOnboarding, setProfileOnboarding] = useState<{
    record: OnboardingRecord | null;
    fromServer: boolean;
  }>({ record: null, fromServer: false });
  const [seenOnThisDevice] = useState(() => hasSeenLocally(uid));
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  useEffect(
    () =>
      subscribeToProfile(
        db,
        uid,
        (record, fromServer) => setProfileOnboarding({ record, fromServer }),
        (e) => console.error('Error loading profile:', e)
      ),
    [db, uid]
  );
  // También se puede volver a ver desde la guía. Si al entrar por primera vez hay datos de la versión sin cuentas,
  // primero se resuelve su importación: una sola ventana modal a la vez
  const [isWelcomeReplay, setIsWelcomeReplay] = useState(false);
  const isWelcomeOpen =
    isWelcomeReplay ||
    (!welcomeClosed &&
      !isImportOpen &&
      profileOnboarding.fromServer &&
      !hasSeenOnboarding(profileOnboarding.record, seenOnThisDevice));

  // RECORRIDO GUIADO: tras la bienvenida o desde la guía. Empieza en las listas (allí están el Top 10 y los filtros);
  // al terminar, la primera vez, lleva a la Rueda para el primer paso
  const [isTourOpen, setIsTourOpen] = useState(false);
  // Solo el recorrido de la primera vez (tras la bienvenida automática) acaba en la Rueda; al repetirlo desde la
  // ayuda, se vuelve a donde se estaba
  const [isFirstRunTour, setIsFirstRunTour] = useState(false);
  const startTour = (firstRun = false) => {
    navigate('tasks');
    setIsFirstRunTour(firstRun);
    setIsTourOpen(true);
  };
  const finishTour = () => {
    setIsTourOpen(false);
    if (isFirstRunTour && wheelSynced && wheelLogs.length === 0) navigate('wheel');
  };

  const finishWelcome = (outcome: OnboardingOutcome) => {
    rememberLocally(uid, outcome);
    markOnboardingSeen(db, uid, outcome).catch(reportError('guardar tu progreso'));
    setWelcomeClosed(true);
    setIsWelcomeReplay(false);
    if (outcome === 'completed') startTour(!isWelcomeReplay);
  };

  // Hoja «Más» del móvil: secciones que no caben en la barra inferior, sincronización y cuenta
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  // Al pasar a tableta o escritorio (p. ej. girando el móvil) la hoja deja de verse: se cierra para que el resto de
  // la app no se quede inerte
  const isPhone = useMediaQuery(PHONE_QUERY);
  if (isMoreOpen && !isPhone) setIsMoreOpen(false);
  // El botón de la cuenta está en la cabecera en escritorio y dentro de «Más» en el móvil
  const accountButton = () => {
    const header = document.getElementById('account-button');
    return header?.offsetParent ? header : document.getElementById(MORE_BUTTON_ID);
  };
  // La pantalla de bienvenida no cuenta: es decorativa, se quita sola y deja pasar los clics mientras se desvanece
  const isDialogOpen =
    isFeedbackOpen ||
    isWelcomeOpen ||
    isTourOpen ||
    isMoreOpen ||
    goalEditor !== null ||
    isTaskModalOpen ||
    isArchiveOpen ||
    isMeetingModalOpen ||
    emailEditor !== null ||
    isAccountMenuOpen ||
    isAccessibilityOpen ||
    isImportOpen;

  // ALARMAS: avisan mientras la app está abierta, dentro de ella (en todas las pestañas) y, con permiso, también con
  // una notificación del sistema. El aviso muestra la tarea tal como está ahora y desaparece si se marca como hecha.
  const [alarmAlerts, setAlarmAlerts] = useState<ScheduledAlarm[]>([]);
  useTaskAlarms(uid, tasks, {
    onAlert: (alarm) => setAlarmAlerts((list) => [...list.filter((a) => a.key !== alarm.key), alarm]),
    onNotify: (alarm) =>
      showSystemNotification(`Alarma: ${alarm.task.title}`, formatTaskDates(alarm.task) ?? '', alarm.key)
  });
  const visibleAlarms = alarmAlerts.flatMap((alarm) => {
    const task = tasks.find((t) => t.id === alarm.task.id);
    return task && !isArchived(task) ? [{ ...alarm, task }] : [];
  });
  const openAlarmTask = (task: TaskItem) => {
    setAlarmAlerts((list) => list.filter((a) => a.task.id !== task.id));
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  // Conteo de tareas por contexto
  const archivedTasks = tasks.filter(isArchived);
  const workCount = tasks.filter((t) => t.listContext === 'WORK' && !t.isSomeday && !isArchived(t)).length;
  // «Top 10» cuenta lo mismo que muestra la lista: tareas activas del contexto tras aplicar los filtros
  const top10Count = Math.min(
    10,
    arrangeTasks(
      tasks.filter((t) => t.listContext === activeContext && !t.isSomeday && !isArchived(t)),
      listPrefs,
      now
    ).length
  );
  const personalCount = tasks.filter((t) => t.listContext === 'PERSONAL' && !t.isSomeday && !isArchived(t)).length;

  // Cálculo de promedio actual de la Rueda
  const latestLog = wheelLogs[wheelLogs.length - 1];
  const wheelAverage = latestLog
    ? (Object.values(latestLog.scores).reduce((a, b) => a + b, 0) / Object.values(latestLog.scores).length).toFixed(1)
    : '0.0';

  return (
    // En el móvil queda sitio abajo para la barra de secciones y el botón «Nueva tarea»
    <div className="flex min-h-screen flex-col bg-slate-50 pr-[env(safe-area-inset-right)] pb-[calc(9rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white md:pb-0">
      {/* Con un diálogo abierto, el resto de la página queda inerte: ni el teclado ni los lectores de pantalla llegan */}
      <div className="contents" inert={isDialogOpen}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>
        {/* Barra de Navegación Superior con Contrato de 3 Zonas */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={navigate}
          activeContext={activeContext}
          setActiveContext={setActiveContext}
          activeUser={profile}
          onOpenAccount={() => setIsAccountMenuOpen(true)}
          taskCounts={{ work: workCount, personal: personalCount }}
          syncStatus={syncStatus}
          onForceSync={handleForceSync}
          isAdmin={isAdmin}
          pendingAccessCount={pendingAccessCount}
        />

        {/* NUEVA TAREA: debajo de la cabecera en tableta y escritorio; en el móvil, botón flotante sobre la barra */}
        <div className="mx-auto hidden w-full max-w-7xl justify-end px-4 pt-4 sm:px-6 md:flex lg:px-8">
          <button
            type="button"
            onClick={() => openNewTask()}
            data-tour="new-task"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva tarea
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 pt-4 pb-8 focus:outline-none sm:px-6 lg:px-8"
        >
          {/* INICIO: foco de la lista activa, estadísticas y recomendaciones */}
          {activeTab === 'home' && (
            <HomeView
              tasks={tasks}
              goals={goals}
              activeContext={activeContext}
              accountName={profile.name}
              top10Count={top10Count}
              wheelLogs={wheelLogs}
              wheelAverage={wheelAverage}
              meetings={meetings}
              now={now}
              onOpenAccount={() => setIsAccountMenuOpen(true)}
              onNavigate={navigate}
            />
          )}

          {/* PESTAÑA 1: LISTAS DUALES (GESTOR DUAL CON JERARQUÍA VISUAL TOP 10) */}
          {activeTab === 'tasks' && (
            <TaskList
              tasks={tasks}
              goals={goals}
              activeContext={activeContext}
              prefs={listPrefs}
              onPrefsChange={setListPrefs}
              archivedCount={archivedTasks.length}
              onChangeStatus={handleChangeStatus}
              onDeleteTask={handleDeleteTask}
              onEditTask={(task) => {
                setEditingTask(task);
                setIsTaskModalOpen(true);
              }}
              onOpenNewTask={openNewTask}
              onOpenArchive={() => setIsArchiveOpen(true)}
            />
          )}

          {/* AGENDA: tareas con fecha de las dos listas, repeticiones previstas y reuniones */}
          {activeTab === 'agenda' && (
            <DeferredSection retry={AgendaView.retry}>
              <AgendaView
                tasks={tasks}
                meetings={meetings}
                onEditTask={(task) => {
                  setEditingTask(task);
                  setIsTaskModalOpen(true);
                }}
              />
            </DeferredSection>
          )}

          {/* PESTAÑA 2: RUEDA DE LA VIDA (MÓDULO 1) */}
          {activeTab === 'wheel' && (
            // Se remonta cuando llegan los datos confirmados por el servidor para partir de la última evaluación
            <DeferredSection retry={WheelOfLife.retry}>
              <WheelOfLife
                key={wheelSynced ? 'synced' : 'cache'}
                logs={wheelLogs}
                showFirstStep={wheelSynced && wheelLogs.length === 0}
                onAppendSnapshot={handleAppendWheelSnapshot}
                onOpenHelp={() => navigate('help')}
                goals={goals}
                onOpenGoals={() => navigate('goals')}
              />
            </DeferredSection>
          )}

          {/* METAS: de las áreas de la Rueda a las tareas, empezando por las áreas más bajas */}
          {activeTab === 'goals' && (
            <DeferredSection retry={GoalsView.retry}>
              <GoalsView
                goals={goals}
                tasks={tasks}
                scores={wheelSynced || wheelLogs.length > 0 ? latestScores(wheelLogs) : undefined}
                onNewGoal={(area) => setGoalEditor({ area })}
                onEditGoal={(goal) => setGoalEditor({ goal })}
                onSetGoalStatus={handleSetGoalStatus}
                onAddTask={(goal) => openNewTask({ goalId: goal.id })}
                onEditTask={(task) => {
                  setEditingTask(task);
                  setIsTaskModalOpen(true);
                }}
                onOpenWheel={() => navigate('wheel')}
              />
            </DeferredSection>
          )}

          {/* PESTAÑA 3: BLINDAJE BERMUDAS (MÓDULO 5) */}
          {activeTab === 'bermudas' && (
            <DeferredSection retry={BermudasShield.retry}>
              <BermudasShield
                meetings={meetings}
                emails={emails}
                onOpenNewMeeting={() => setIsMeetingModalOpen(true)}
                onOpenNewEmail={() => setEmailEditor({})}
                onOpenEmail={(email) => setEmailEditor({ email })}
                onDeleteEmail={handleDeleteEmail}
              />
            </DeferredSection>
          )}

          {/* PESTAÑA 4: CÓMO FUNCIONA LA APP */}
          {activeTab === 'help' && (
            <DeferredSection retry={HowItWorks.retry}>
              <HowItWorks
                onNavigate={navigate}
                onStartTour={() => startTour()}
                onShowWelcome={() => setIsWelcomeReplay(true)}
                onContact={() => setIsFeedbackOpen(true)}
              />
            </DeferredSection>
          )}

          {activeTab === 'access' && isAdmin && (
            <DeferredSection retry={AdminView.retry}>
              <AdminView
                requests={accessRequests}
                currentUid={uid}
                accessError={accessError}
                onDecide={handleDecideAccess}
                approvalRequired={approvalRequired}
                onSetApprovalRequired={handleSetApprovalRequired}
                tickets={feedbackTickets}
                feedbackError={feedbackError}
                onSetFeedbackStatus={handleSetFeedbackStatus}
                onReplyFeedback={handleReplyFeedback}
                loadClosedFeedback={(cursor) => loadClosedFeedback(db, cursor)}
              />
            </DeferredSection>
          )}
        </main>

        {/* FOOTER DISCRETO Y EDITORIAL */}
        <footer className="mt-12 border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-bold text-slate-700">CLAR v{__APP_VERSION__}</span>
              <span className="text-slate-300">·</span>
              <p className="text-slate-500">Decide qué hacer ahora, con claridad.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-slate-600">
              <button
                onClick={() => navigate('help')}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Ver la ayuda
              </button>
              <LegalLinks newTab />
            </div>
          </div>
        </footer>

        <button
          type="button"
          onClick={() => openNewTask()}
          data-tour="new-task"
          aria-label="Nueva tarea"
          className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/30 transition-transform hover:bg-slate-800 active:scale-95 md:hidden"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>

        <BottomNav
          activeTab={activeTab}
          onNavigate={navigate}
          isMoreOpen={isMoreOpen}
          onOpenMore={() => setIsMoreOpen(true)}
          pendingAccessCount={isAdmin ? pendingAccessCount : 0}
        />
      </div>

      <MoreSheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        activeTab={activeTab}
        onNavigate={navigate}
        isAdmin={isAdmin}
        pendingAccessCount={pendingAccessCount}
        syncStatus={syncStatus}
        onForceSync={handleForceSync}
        activeUser={profile}
        onOpenAccount={() => setIsAccountMenuOpen(true)}
      />

      {/* Con una ventana abierta los avisos esperan: quedarían fuera de su foco (no se llegaría con el teclado) y
          taparían sus controles. Se muestran al cerrarla. */}
      <AlarmAlerts
        alarms={isDialogOpen ? [] : visibleAlarms}
        onOpenTask={openAlarmTask}
        onDismiss={(key) => setAlarmAlerts((list) => list.filter((a) => a.key !== key))}
      />

      {/* BANNER TOAST DE NOTIFICACIÓN: región viva siempre presente para que los lectores de pantalla lo anuncien */}
      <div role="status" aria-live="polite">
        {toast && (
          <div className="animate-in slide-in-from-bottom-3 fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(9.5rem+env(safe-area-inset-bottom))] left-[calc(1rem+env(safe-area-inset-left))] z-50 flex items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-xs text-white shadow-xl duration-200 md:right-6 md:bottom-6 md:left-auto">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span className="font-semibold">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={toast.undo}
                className="-my-1 ml-auto min-h-9 shrink-0 rounded-lg px-2.5 font-bold text-indigo-300 hover:bg-white/10 hover:text-indigo-200"
              >
                Deshacer
              </button>
            )}
          </div>
        )}
      </div>

      {/* PANTALLA DE INICIO MÓVIL (SPLASH SCREEN) */}
      {showSplash && (
        <SplashScreen version={__APP_VERSION__} autoDismissMs={1600} onFinish={() => setShowSplash(false)} />
      )}

      {/* MODAL 1: CAPTURA DE TAREA CON ANALIZADOR SINTÁCTICO Y TF-IDF */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSaveTask={handleSaveTask}
        initialContext={activeContext}
        initialSomeday={newTaskIsSomeday}
        initialGoalId={newTaskGoalId}
        editingTask={editingTask}
        goals={goals}
      />

      {/* VENTANA DE TAREAS ARCHIVADAS (ESTADO HECHA) */}
      <ArchivedTasksModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        tasks={archivedTasks}
        onChangeStatus={handleChangeStatus}
        onDeleteTask={handleDeleteTask}
      />

      {/* MODAL 2: AGENDA DE REUNIONES CON TRIPLE VALIDACIÓN Y BLOQUEO MATUTINO */}
      <MeetingModal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        onSaveMeeting={handleSaveMeeting}
      />

      {/* MODAL 3: CORREO CON REDACCIÓN INVERSA Y ALERTA NO-SCROLL */}
      {emailEditor && (
        <EmailModal email={emailEditor.email} onClose={() => setEmailEditor(null)} onSave={handleSaveEmail} />
      )}

      {/* MODAL 4: CUENTA (CERRAR SESIÓN, DESCARGAR DATOS, ELIMINAR CUENTA) */}
      <AccountMenu
        isOpen={isAccountMenuOpen}
        onClose={() => setIsAccountMenuOpen(false)}
        user={profile}
        onSignOut={() => signOutAndClearCache(services)}
        hasPassword={hasPassword(user)}
        onExportData={handleExportData}
        onDeleteAccount={handleDeleteAccount}
        onChangePassword={(currentPassword, newPassword) => changePassword(user, currentPassword, newPassword)}
        onSignOutEverywhere={() => signOutEverywhere(services)}
        returnFocusTo={accountButton}
        onContact={() => {
          setIsAccountMenuOpen(false);
          setIsFeedbackOpen(true);
        }}
        onOpenAccessibility={() => {
          setIsAccountMenuOpen(false);
          setIsAccessibilityOpen(true);
        }}
      />

      {/* Se abre desde el menú de la cuenta, que ya no existe al cerrarse: el foco vuelve al botón de la cuenta */}
      <AccessibilityPanel
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
        returnFocusTo={accountButton}
      />

      {/* CONTACTO: sugerencias, errores o mensajes (se monta al abrirse, así empieza limpio) */}
      {isFeedbackOpen && (
        <FeedbackDialog
          functions={services.functions}
          onClose={() => setIsFeedbackOpen(false)}
          returnFocusTo={accountButton}
        />
      )}

      {/* BIENVENIDA DE LA PRIMERA VEZ */}
      {isWelcomeOpen && (
        <DeferredDialog retry={WelcomeDialog.retry} onCancel={() => finishWelcome('skipped')}>
          <WelcomeDialog onFinish={finishWelcome} />
        </DeferredDialog>
      )}
      {isTourOpen && (
        <DeferredDialog retry={ProductTour.retry} onCancel={finishTour}>
          <ProductTour steps={TOUR_STEPS} onFinish={finishTour} />
        </DeferredDialog>
      )}

      {/* METAS: crear o editar (se monta al abrirse, así empieza limpio) */}
      {goalEditor && (
        <DeferredDialog retry={GoalModal.retry} onCancel={() => setGoalEditor(null)}>
          <GoalModal
            goal={goalEditor.goal}
            initialArea={goalEditor.area}
            onSave={handleSaveGoal}
            onDelete={handleDeleteGoal}
            onClose={() => setGoalEditor(null)}
          />
        </DeferredDialog>
      )}

      {/* MODAL 5: IMPORTAR DATOS DE LA VERSIÓN SIN CUENTAS */}
      {isImportOpen && (
        <ImportLocalDataModal
          profiles={localProfiles}
          onImport={handleImportLocalData}
          onDiscard={handleDiscardLocalData}
          onLater={() => setIsImportPostponed(true)}
        />
      )}
    </div>
  );
}
