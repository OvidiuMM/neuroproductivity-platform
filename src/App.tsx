/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
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
import { formatTaskDates, isArchived, isUnchanged, withStatus } from './services/tasks';
import { nextRecurringTask } from './services/recurrence';
import { forceSync, signOutAndClearCache, type FirebaseServices } from './services/firebase';
import {
  appendWheelLog,
  completeRecurringTask,
  deleteTask,
  undoCompleteRecurringTask,
  saveGoal,
  deleteGoal,
  subscribeToProfile,
  markOnboardingSeen,
  importUserData,
  saveEmail,
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
import { GoalModal } from './components/GoalModal';
import { WelcomeDialog } from './components/WelcomeDialog';
import { ProductTour } from './components/ProductTour';
import { TOUR_STEPS } from './tourSteps';
import {
  hasSeenLocally,
  hasSeenOnboarding,
  rememberLocally,
  type OnboardingOutcome,
  type OnboardingRecord
} from './services/onboarding';
import type { SyncStatus } from './components/SyncIndicator';
import { TaskList } from './components/TaskList';
import { TaskModal, type TaskFormData } from './components/TaskModal';
import { ArchivedTasksModal } from './components/ArchivedTasksModal';
import { WheelOfLife } from './components/WheelOfLife';
import { BermudasShield } from './components/BermudasShield';
import { MeetingModal } from './components/MeetingModal';
import { EmailModal } from './components/EmailModal';
import { SplashScreen } from './components/SplashScreen';
import { AccountMenu } from './components/AccountMenu';
import { ImportLocalDataModal } from './components/ImportLocalDataModal';
import { HowItWorks } from './components/HowItWorks';
import { AgendaView } from './components/AgendaView';
import { HomeView } from './components/HomeView';
import { AccessAdminView } from './components/AccessAdminView';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { setAccess, subscribeToAccessRequests, type AccessRequest, type DecisionStatus } from './services/access';
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
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [wheelLogs, setWheelLogs] = useState<WheelOfLifeLog[]>([]);
  const [wheelSynced, setWheelSynced] = useState(false);
  const [meetings, setMeetings] = useState<MeetingGuard[]>([]);
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  // Editor de metas: abierto con la meta que se edita, o vacío para crear una
  const [goalEditor, setGoalEditor] = useState<{ goal?: Goal } | null>(null);

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
  // Al dejar de ser administración se vacían las solicitudes y se sale de su pestaña
  const [wasAdmin, setWasAdmin] = useState(isAdmin);
  if (wasAdmin !== isAdmin) {
    setWasAdmin(isAdmin);
    if (!isAdmin) {
      setAccessRequests([]);
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
  const pendingAccessCount = accessRequests.filter((r) => r.status === 'pending').length;

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
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

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
  const openNewTask = (options?: { someday?: boolean }) => {
    setEditingTask(null);
    setNewTaskIsSomeday(Boolean(options?.someday));
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (taskData: TaskFormData) => {
    const now = new Date().toISOString();
    if (editingTask) {
      const current = tasks.find((t) => t.id === editingTask.id) ?? editingTask;
      saveTask(db, uid, { ...current, ...taskData, updatedAt: now }).catch(reportError('guardar la tarea'));
      showToast('Acción operativa actualizada con validación sintáctica exitosa.');
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
      showToast(
        taskData.isSomeday
          ? 'Tarea archivada en el Sumidero Cognitivo ("Opciones Futuras").'
          : 'Acción física agregada e incorporada al algoritmo de Jerarquía Visual.'
      );
    }
  };

  // "Hecha" archiva la tarea; cualquier otro estado la devuelve a su lista
  // Últimas tareas recibidas, también las cambiadas en otros dispositivos: «Deshacer» comprueba con ellas que no
  // ha cambiado nada desde que se escribió
  const latestTasks = useRef(tasks);
  useEffect(() => {
    latestTasks.current = tasks;
  }, [tasks]);

  const handleChangeStatus = (task: TaskItem, status: TaskStatus) => {
    if (status === task.status) return;
    // Tarea recurrente marcada como Hecha: se crea la siguiente repetición (una sola vez por tarea)
    const next = status === 'DONE' && !task.nextOccurrenceId ? nextRecurringTask(task) : null;
    const updated = withStatus(task, status);
    // Deshacer devuelve la tarea tal como estaba (y quita la repetición que se acaba de crear), pero solo si lo
    // escrito sigue igual: si entretanto se cambió aquí o en otro dispositivo, se avisa en vez de pisarlo.
    // Se comprueba con los datos en vivo y no con una transacción, que sin conexión no funcionaría.
    const restore = (written: TaskItem[], save: () => Promise<void>) => () => {
      if (!isUnchanged(written, latestTasks.current)) {
        showToast('No se puede deshacer: la tarea ha cambiado entretanto.');
        return;
      }
      save().catch(reportError('deshacer el cambio'));
      showToast('Tarea recuperada.');
    };
    if (next) {
      const done = { ...updated, nextOccurrenceId: next.id };
      completeRecurringTask(db, uid, done, next).catch(reportError('guardar la tarea y su siguiente repetición'));
      showToast(
        `Tarea hecha y archivada. Siguiente repetición: ${formatTaskDates(next)?.replace('Vence: ', '')}.`,
        restore([done, next], () => undoCompleteRecurringTask(db, uid, task, next.id))
      );
      return;
    }
    saveTask(db, uid, updated).catch(reportError('actualizar el estado'));
    if (status === 'DONE') {
      showToast(
        'Tarea hecha y archivada. La encontrarás en «Archivadas».',
        restore([updated], () => saveTask(db, uid, task))
      );
    } else if (isArchived(task)) {
      showToast('Tarea reactivada: vuelve a su lista.');
    }
  };

  // METAS: si cambia de área, sus tareas heredan la nueva; al eliminarla, sus tareas se quedan sin meta
  const handleSaveGoal = (goal: Goal) => {
    const previous = goals.find((g) => g.id === goal.id);
    const retagged =
      previous && previous.area !== goal.area ? tasks.filter((t) => t.goalId === goal.id).map((t) => t.id) : [];
    saveGoal(db, uid, goal, retagged).catch(reportError('guardar la meta'));
    showToast(previous ? 'Meta guardada.' : 'Meta creada. Vincúlale tareas desde el formulario de cada tarea.');
  };
  const handleSetGoalStatus = (goal: Goal, status: GoalStatus) => {
    saveGoal(db, uid, { ...goal, status, updatedAt: new Date().toISOString() }).catch(reportError('guardar la meta'));
    showToast(
      status === 'ACHIEVED' ? '¡Meta lograda!' : status === 'ARCHIVED' ? 'Meta archivada.' : 'Meta reactivada.'
    );
  };
  const handleDeleteGoal = (goal: Goal) => {
    deleteGoal(
      db,
      uid,
      goal.id,
      tasks.filter((t) => t.goalId === goal.id).map((t) => t.id)
    ).catch(reportError('eliminar la meta'));
    showToast('Meta eliminada. Sus tareas siguen en tus listas.');
  };

  const handleDeleteTask = (id: string) => {
    const deleted = tasks.find((t) => t.id === id);
    deleteTask(db, uid, id).catch(reportError('eliminar la tarea'));
    showToast(
      'Acción eliminada del inventario.',
      deleted &&
        (() => {
          saveTask(db, uid, deleted).catch(reportError('recuperar la tarea'));
          showToast('Tarea recuperada.');
        })
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
    showToast('Nuevo snapshot append-only consolidado con marca de tiempo UTC.');
  };

  const handleSaveMeeting = (meetingData: Omit<MeetingGuard, 'id' | 'createdAt'>) => {
    const meeting: MeetingGuard = {
      ...meetingData,
      id: `meet-${Date.now()}`,
      userId: uid,
      createdAt: new Date().toISOString()
    };
    saveMeeting(db, uid, meeting).catch(reportError('guardar la reunión'));
    showToast('Reunión blindada registrada exitosamente (fuera de la franja matutina).');
  };

  const handleSendEmail = (emailData: Omit<EmailDraft, 'id'>) => {
    saveEmail(db, uid, { ...emailData, id: `email-${Date.now()}`, userId: uid }).catch(
      reportError('guardar el correo')
    );
    showToast('Mensaje despachado con protocolo de redacción inversa validado.');
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
  // También se puede volver a ver desde la guía
  const [isWelcomeReplay, setIsWelcomeReplay] = useState(false);
  const isWelcomeOpen =
    isWelcomeReplay ||
    (!welcomeClosed && profileOnboarding.fromServer && !hasSeenOnboarding(profileOnboarding.record, seenOnThisDevice));

  // RECORRIDO GUIADO: tras la bienvenida o desde la guía. Empieza en las listas (allí están el Top 10 y los filtros);
  // al terminar, la primera vez, lleva a la Rueda para el primer paso
  const [isTourOpen, setIsTourOpen] = useState(false);
  const startTour = () => {
    navigate('tasks');
    setIsTourOpen(true);
  };
  const finishTour = () => {
    setIsTourOpen(false);
    if (wheelSynced && wheelLogs.length === 0) navigate('wheel');
  };

  const finishWelcome = (outcome: OnboardingOutcome) => {
    rememberLocally(uid, outcome);
    markOnboardingSeen(db, uid, outcome).catch(reportError('guardar tu progreso'));
    setWelcomeClosed(true);
    setIsWelcomeReplay(false);
    if (outcome === 'completed') startTour();
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
    isWelcomeOpen ||
    isTourOpen ||
    isMoreOpen ||
    goalEditor !== null ||
    isTaskModalOpen ||
    isArchiveOpen ||
    isMeetingModalOpen ||
    isEmailModalOpen ||
    isAccountMenuOpen ||
    isAccessibilityOpen ||
    isImportOpen;

  // Conteo de tareas por contexto
  const archivedTasks = tasks.filter(isArchived);
  const workCount = tasks.filter((t) => t.listContext === 'WORK' && !t.isSomeday && !isArchived(t)).length;
  // «Top 10 Foco» cuenta lo mismo que muestra la lista: tareas activas del contexto tras aplicar los filtros
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
            <AgendaView
              tasks={tasks}
              meetings={meetings}
              onEditTask={(task) => {
                setEditingTask(task);
                setIsTaskModalOpen(true);
              }}
            />
          )}

          {/* PESTAÑA 2: RUEDA DE LA VIDA (MÓDULO 1) */}
          {activeTab === 'wheel' && (
            // Se remonta cuando llegan los datos confirmados por el servidor para partir de la última evaluación
            <WheelOfLife
              key={wheelSynced ? 'synced' : 'cache'}
              logs={wheelLogs}
              showFirstStep={wheelSynced && wheelLogs.length === 0}
              onAppendSnapshot={handleAppendWheelSnapshot}
              onOpenHelp={() => navigate('help')}
              goals={goals}
              tasks={tasks}
              onNewGoal={() => setGoalEditor({})}
              onEditGoal={(goal) => setGoalEditor({ goal })}
              onSetGoalStatus={handleSetGoalStatus}
            />
          )}

          {/* PESTAÑA 3: BLINDAJE BERMUDAS (MÓDULO 5) */}
          {activeTab === 'bermudas' && (
            <BermudasShield
              meetings={meetings}
              emails={emails}
              onOpenNewMeeting={() => setIsMeetingModalOpen(true)}
              onOpenNewEmail={() => setIsEmailModalOpen(true)}
            />
          )}

          {/* PESTAÑA 4: CÓMO FUNCIONA LA APP */}
          {activeTab === 'help' && (
            <HowItWorks onNavigate={navigate} onStartTour={startTour} onShowWelcome={() => setIsWelcomeReplay(true)} />
          )}

          {activeTab === 'access' && isAdmin && (
            <AccessAdminView
              requests={accessRequests}
              currentUid={uid}
              error={accessError}
              onDecide={handleDecideAccess}
            />
          )}
        </main>

        {/* FOOTER DISCRETO Y EDITORIAL */}
        <footer className="mt-12 border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-bold text-slate-700">CLAR v{__APP_VERSION__}</span>
              <span className="text-slate-300">·</span>
              <p className="text-slate-500">Gestión del tiempo y neuroproductividad.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-slate-600">
              <button
                onClick={() => setShowSplash(true)}
                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
              >
                📱 Ver Pantalla de Inicio Móvil
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => navigate('help')}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Guía de uso
              </button>
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
      <EmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} onSendEmail={handleSendEmail} />

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

      {/* BIENVENIDA DE LA PRIMERA VEZ */}
      {isWelcomeOpen && <WelcomeDialog onFinish={finishWelcome} />}
      {isTourOpen && <ProductTour steps={TOUR_STEPS} onFinish={finishTour} />}

      {/* METAS: crear o editar (se monta al abrirse, así empieza limpio) */}
      {goalEditor && (
        <GoalModal
          goal={goalEditor.goal}
          onSave={handleSaveGoal}
          onDelete={handleDeleteGoal}
          onClose={() => setGoalEditor(null)}
        />
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
