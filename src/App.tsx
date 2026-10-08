/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, deleteUser, reauthenticateWithPopup, type User } from 'firebase/auth';
import { AppTab, ListContext, TaskItem, WheelCategory, WheelOfLifeLog, MeetingGuard, EmailDraft, UserProfile } from './types';
import { signOutAndClearCache, type FirebaseServices } from './services/firebase';
import {
  appendWheelLog,
  deleteAllUserData,
  deleteTask,
  exportUserData,
  importUserData,
  saveEmail,
  saveMeeting,
  saveTask,
  subscribeToCollection
} from './services/repository';
import { buildImport, clearLocalData, getLocalProfiles, type LocalProfileSummary } from './services/localData';
import { Navbar } from './components/Navbar';
import { TaskList } from './components/TaskList';
import { TaskModal } from './components/TaskModal';
import { WheelOfLife } from './components/WheelOfLife';
import { BermudasShield } from './components/BermudasShield';
import { MeetingModal } from './components/MeetingModal';
import { EmailModal } from './components/EmailModal';
import { SystemRequirementsViewer } from './components/SystemRequirementsViewer';
import { SplashScreen } from './components/SplashScreen';
import { AccountMenu } from './components/AccountMenu';
import { ImportLocalDataModal } from './components/ImportLocalDataModal';
import { HowItWorks } from './components/HowItWorks';
import {
  Brain,
  Sparkles,
  ShieldAlert,
  Flame,
  Clock,
  Compass,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AppProps {
  user: User;
  services: FirebaseServices;
}

const initialsOf = (name: string) =>
  name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

const downloadJson = (filename: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function App({ user, services }: AppProps) {
  const { db } = services;
  const uid = user.uid;

  // Perfil para la interfaz a partir de la cuenta de Google
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

  // Datos de la cuenta, sincronizados en tiempo real con Firestore (y disponibles sin conexión desde la caché)
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [wheelLogs, setWheelLogs] = useState<WheelOfLifeLog[]>([]);
  const [wheelSynced, setWheelSynced] = useState(false);
  const [meetings, setMeetings] = useState<MeetingGuard[]>([]);
  const [emails, setEmails] = useState<EmailDraft[]>([]);

  // Datos de la versión sin cuentas que siguen en este navegador, pendientes de importar
  const [localProfiles, setLocalProfiles] = useState<LocalProfileSummary[]>(() => getLocalProfiles());
  const [isImportPostponed, setIsImportPostponed] = useState(false);

  const [activeContext, setActiveContext] = useState<ListContext>('WORK');
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const firstRunChecked = useRef(false);

  // Estado de pantalla de inicio móvil (Splash Screen)
  const [showSplash, setShowSplash] = useState(true);

  // Modales
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Toast / Banner de notificación
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const reportError = (action: string) => (e: unknown) => {
    console.error(`Error al ${action}:`, e);
    showToast(`No se pudo ${action}. Revisa tu conexión e inténtalo de nuevo.`);
  };

  // Suscripción en tiempo real a los datos de la cuenta
  useEffect(() => {
    const onError = reportError('cargar tus datos');
    const unsubscribers = [
      subscribeToCollection(db, uid, 'tasks', setTasks, onError),
      subscribeToCollection(
        db,
        uid,
        'wheelLogs',
        (logs, { fromServer }) => {
          setWheelLogs(logs);
          if (fromServer) setWheelSynced(true);
          // Primer arranque: sin evaluaciones confirmadas por el servidor, la app abre en la Rueda de la Vida
          if (!firstRunChecked.current && (fromServer || logs.length > 0)) {
            firstRunChecked.current = true;
            if (logs.length === 0) setActiveTab('wheel');
          }
        },
        onError
      ),
      subscribeToCollection(db, uid, 'meetings', setMeetings, onError),
      subscribeToCollection(db, uid, 'emails', setEmails, onError)
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [db, uid]);

  // Las escrituras se reflejan al instante (caché local) y se sincronizan con el servidor en segundo plano
  const handleSaveTask = (taskData: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'completed'>) => {
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
        completed: false
      };
      saveTask(db, uid, newTask).catch(reportError('guardar la tarea'));
      showToast(
        taskData.isSomeday
          ? 'Tarea archivada en el Sumidero Cognitivo ("Opciones Futuras").'
          : 'Acción física agregada e incorporada al algoritmo de Jerarquía Visual.'
      );
    }
  };

  const handleToggleComplete = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    saveTask(db, uid, { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }).catch(
      reportError('actualizar la tarea')
    );
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(db, uid, id).catch(reportError('eliminar la tarea'));
    showToast('Acción eliminada del inventario.');
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
    saveEmail(db, uid, { ...emailData, id: `email-${Date.now()}`, userId: uid }).catch(reportError('guardar el correo'));
    showToast('Mensaje despachado con protocolo de redacción inversa validado.');
  };

  // CUENTA
  const handleExportData = async () => {
    const data = await exportUserData(db, uid);
    downloadJson(`neuroproductividad-${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: new Date().toISOString(),
      account: { name: user.displayName, email: user.email },
      ...data
    });
  };

  const handleDeleteAccount = async () => {
    // Firebase exige un inicio de sesión reciente para eliminar la cuenta
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    await deleteAllUserData(db, uid);
    await deleteUser(user);
    await signOutAndClearCache(services);
  };

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

  // Conteo de tareas por contexto
  const workCount = tasks.filter((t) => t.listContext === 'WORK' && !t.isSomeday && !t.completed).length;
  const personalCount = tasks.filter((t) => t.listContext === 'PERSONAL' && !t.isSomeday && !t.completed).length;
  const somedayCount = tasks.filter((t) => t.isSomeday).length;

  // Cálculo de promedio actual de la Rueda
  const latestLog = wheelLogs[wheelLogs.length - 1];
  const wheelAverage = latestLog
    ? (Object.values(latestLog.scores).reduce((a, b) => a + b, 0) / Object.values(latestLog.scores).length).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* Barra de Navegación Superior con Contrato de 3 Zonas */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeContext={activeContext}
        setActiveContext={setActiveContext}
        activeUser={profile}
        onOpenAccount={() => setIsAccountMenuOpen(true)}
        onOpenNewTask={() => {
          setEditingTask(null);
          setIsTaskModalOpen(true);
        }}
        onOpenNewMeeting={() => setIsMeetingModalOpen(true)}
        onOpenNewEmail={() => setIsEmailModalOpen(true)}
        taskCounts={{
          work: workCount,
          personal: personalCount,
          someday: somedayCount
        }}
      />

      {/* BANNER TOAST DE NOTIFICACIÓN */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* HERO ESTRATÉGICO CON CONTEXTO Y MÉTRICAS BIOLÓGICAS */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                <Brain className="w-4 h-4" />
                <span>Andamiaje Digital para la Corteza Prefrontal</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">
                  Contexto Activo:{' '}
                  <strong className={activeContext === 'WORK' ? 'text-indigo-600' : 'text-emerald-600'}>
                    {activeContext === 'WORK' ? 'Esfera Profesional' : 'Esfera Personal'}
                  </strong>
                </span>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-semibold transition-colors"
                  title="Tu cuenta"
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Cuenta: {profile.name}</span>
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                {activeContext === 'WORK'
                  ? 'Foco de Concentración Profesional'
                  : 'Equilibrio de Esfera Personal & Vital'}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Gestión neurocientífica sin listas pasivas ni "Tareas Muro" coercitivas. La Jerarquía Visual Gestalt destaca matemáticamente tu <strong>Top 10 operativo</strong>, mientras el analizador sintáctico y el motor TF-IDF alinean cada acción con tu Rueda de la Vida.
              </p>
            </div>

            {/* TARJETAS DE INDICADORES EN TIEMPO REAL */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  Top 10 Foco
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
                  {Math.min(10, activeContext === 'WORK' ? workCount : personalCount)}/10
                </div>
                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                  Máx. prioridad
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  Índice Rueda
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
                  {wheelAverage}/10
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  {wheelLogs.length} capturas
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  Reuniones
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
                  {meetings.length}
                </div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                  Mañanas libres
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* PESTAÑA 1: LISTAS DUALES (GESTOR DUAL CON JERARQUÍA VISUAL TOP 10) */}
        {activeTab === 'tasks' && (
          <TaskList
            tasks={tasks}
            activeContext={activeContext}
            onToggleComplete={handleToggleComplete}
            onDeleteTask={handleDeleteTask}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onOpenNewTask={() => {
              setEditingTask(null);
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
            onOpenHelp={() => setActiveTab('help')}
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

        {/* PESTAÑA 4: ESPECIFICACIÓN TÉCNICA & BANCO DE PRUEBAS */}
        {activeTab === 'requirements' && <SystemRequirementsViewer />}

        {/* PESTAÑA 5: CÓMO FUNCIONA LA APP */}
        {activeTab === 'help' && <HowItWorks onNavigate={setActiveTab} />}

      </main>

      {/* FOOTER DISCRETO Y EDITORIAL */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">NeuroProductividad v{__APP_VERSION__}</span>
            <span className="text-slate-300">·</span>
            <p className="text-slate-500">
              Basado en la metodología de Dr. Jonathan Benito Sipos (UAM).
            </p>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <button
              onClick={() => setShowSplash(true)}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 transition-colors"
            >
              📱 Ver Pantalla de Inicio Móvil
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => setActiveTab('help')}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Guía de uso
            </button>
            <span className="text-slate-300">·</span>
            <span>Datos sincronizados en tu cuenta</span>
            <span className="text-slate-300">·</span>
            <span>Append-Only UTC</span>
          </div>
        </div>
      </footer>

      {/* PANTALLA DE INICIO MÓVIL (SPLASH SCREEN) */}
      {showSplash && (
        <SplashScreen
          version={__APP_VERSION__}
          autoDismissMs={1600}
          onFinish={() => setShowSplash(false)}
        />
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
        editingTask={editingTask}
      />

      {/* MODAL 2: AGENDA DE REUNIONES CON TRIPLE VALIDACIÓN Y BLOQUEO MATUTINO */}
      <MeetingModal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        onSaveMeeting={handleSaveMeeting}
      />

      {/* MODAL 3: CORREO CON REDACCIÓN INVERSA Y ALERTA NO-SCROLL */}
      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSendEmail={handleSendEmail}
      />

      {/* MODAL 4: CUENTA (CERRAR SESIÓN, DESCARGAR DATOS, ELIMINAR CUENTA) */}
      <AccountMenu
        isOpen={isAccountMenuOpen}
        onClose={() => setIsAccountMenuOpen(false)}
        user={profile}
        onSignOut={() => signOutAndClearCache(services)}
        onExportData={handleExportData}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* MODAL 5: IMPORTAR DATOS DE LA VERSIÓN SIN CUENTAS */}
      {localProfiles.length > 0 && !isImportPostponed && (
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
