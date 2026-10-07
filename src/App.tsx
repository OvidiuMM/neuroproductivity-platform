/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ListContext, TaskItem, WheelCategory, MeetingGuard, EmailDraft, UserProfile } from './types';
import { StorageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { TaskList } from './components/TaskList';
import { TaskModal } from './components/TaskModal';
import { WheelOfLife } from './components/WheelOfLife';
import { BermudasShield } from './components/BermudasShield';
import { MeetingModal } from './components/MeetingModal';
import { EmailModal } from './components/EmailModal';
import { SystemRequirementsViewer } from './components/SystemRequirementsViewer';
import { SplashScreen } from './components/SplashScreen';
import { UserSwitcher } from './components/UserSwitcher';
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

export default function App() {
  // Gestión de Usuarios y Espacios Aislados
  const [users, setUsers] = useState<UserProfile[]>(() => StorageService.getUsers());
  const [activeUser, setActiveUser] = useState<UserProfile | null>(() => StorageService.getActiveUser());
  const [isUserSwitcherOpen, setIsUserSwitcherOpen] = useState(false);

  // Estados de datos aislados por usuario activo
  const [tasks, setTasks] = useState<TaskItem[]>(() => StorageService.getTasks());
  const [wheelLogs, setWheelLogs] = useState(() => StorageService.getWheelLogs());
  const [meetings, setMeetings] = useState<MeetingGuard[]>(() => StorageService.getMeetings());
  const [emails, setEmails] = useState<EmailDraft[]>(() => StorageService.getEmails());

  const [activeContext, setActiveContext] = useState<ListContext>('WORK');
  const [activeTab, setActiveTab] = useState<'tasks' | 'wheel' | 'bermudas' | 'requirements'>('tasks');

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

  // Cambio de Usuario con Segregación Total de Datos
  const handleSelectUser = (userId: string) => {
    StorageService.setActiveUserId(userId);
    const user = StorageService.getActiveUser();
    setActiveUser(user);
    setTasks(StorageService.getTasks(userId));
    setWheelLogs(StorageService.getWheelLogs(userId));
    setMeetings(StorageService.getMeetings(userId));
    setEmails(StorageService.getEmails(userId));
    showToast(`Espacio de trabajo cambiado a: ${user.name}`);
  };

  // Identificación e Inicio de Sesión con Cuenta de Google
  const handleGoogleSignIn = (googleData: { name: string; email: string; role?: string }) => {
    const user = StorageService.signInWithGoogle(googleData);
    setUsers(StorageService.getUsers());
    setActiveUser(user);
    setTasks(StorageService.getTasks(user.id));
    setWheelLogs(StorageService.getWheelLogs(user.id));
    setMeetings(StorageService.getMeetings(user.id));
    setEmails(StorageService.getEmails(user.id));
    showToast(`Autenticado con Google: ${user.name} (${user.email}). Espacio seguro activo.`);
  };

  // Cierre de Sesión (Bloqueo de Espacio)
  const handleLogout = () => {
    setActiveUser(null);
    setTasks([]);
    setWheelLogs([]);
    setMeetings([]);
    setEmails([]);
    showToast('Sesión cerrada. Espacio de datos bloqueado de forma segura.');
  };

  // Eliminación de Cuenta de este Dispositivo
  const handleRemoveUser = (userId: string) => {
    const removed = StorageService.deleteUser(userId);
    if (removed) {
      const remainingUsers = StorageService.getUsers();
      setUsers(remainingUsers);
      if (activeUser?.id === userId) {
        if (remainingUsers.length > 0) {
          handleSelectUser(remainingUsers[0].id);
        } else {
          handleLogout();
        }
      }
      showToast('Cuenta de Google desvinculada del dispositivo.');
    }
  };

  // Guardar en Storage al mutar estado con userId
  const handleSaveTask = (taskData: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'completed'>) => {
    const currentUserId = activeUser?.id || 'anonymous';
    if (editingTask) {
      const updated = tasks.map((t) =>
        t.id === editingTask.id
          ? {
              ...t,
              ...taskData,
              userId: currentUserId,
              updatedAt: new Date().toISOString()
            }
          : t
      );
      setTasks(updated);
      StorageService.saveTasks(updated, currentUserId);
      showToast('Acción operativa actualizada con validación sintáctica exitosa.');
      setEditingTask(null);
    } else {
      const newTask: TaskItem = {
        ...taskData,
        id: `task-${Date.now()}`,
        userId: currentUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completed: false
      };
      const updated = [newTask, ...tasks];
      setTasks(updated);
      StorageService.saveTasks(updated, currentUserId);
      showToast(
        taskData.isSomeday
          ? 'Tarea archivada en el Sumidero Cognitivo ("Opciones Futuras").'
          : 'Acción física agregada e incorporada al algoritmo de Jerarquía Visual.'
      );
    }
  };

  const handleToggleComplete = (id: string) => {
    const currentUserId = activeUser?.id || 'anonymous';
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() } : t
    );
    setTasks(updated);
    StorageService.saveTasks(updated, currentUserId);
  };

  const handleDeleteTask = (id: string) => {
    const currentUserId = activeUser?.id || 'anonymous';
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    StorageService.saveTasks(updated, currentUserId);
    showToast('Acción eliminada del inventario.');
  };

  const handleAppendWheelSnapshot = (scores: Record<WheelCategory, number>, label?: string) => {
    const currentUserId = activeUser?.id || 'anonymous';
    const newLog = StorageService.appendWheelSnapshot(scores, label, currentUserId);
    setWheelLogs([...wheelLogs, newLog]);
    showToast('Nuevo snapshot append-only consolidado con marca de tiempo UTC.');
  };

  const handleSaveMeeting = (meetingData: Omit<MeetingGuard, 'id' | 'createdAt'>) => {
    const currentUserId = activeUser?.id || 'anonymous';
    const saved = StorageService.saveMeeting(meetingData, currentUserId);
    setMeetings([saved, ...meetings]);
    showToast('Reunión blindada registrada exitosamente (fuera de la franja matutina).');
  };

  const handleSendEmail = (emailData: Omit<EmailDraft, 'id'>) => {
    const currentUserId = activeUser?.id || 'anonymous';
    const saved = StorageService.saveEmail(emailData, currentUserId);
    setEmails([saved, ...emails]);
    showToast('Mensaje despachado con protocolo de redacción inversa validado.');
  };

  // Conteo de tareas por contexto
  const workCount = tasks.filter((t) => t.listContext === 'WORK' && !t.isSomeday && !t.completed).length;
  const personalCount = tasks.filter((t) => t.listContext === 'PERSONAL' && !t.isSomeday && !t.completed).length;
  const somedayCount = tasks.filter((t) => t.isSomeday).length;

  // Cálculo de promedio actual de la Rueda
  const latestLog = wheelLogs[wheelLogs.length - 1];
  const wheelAverage = latestLog
    ? (Object.values(latestLog.scores).reduce((a, b) => a + b, 0) / Object.values(latestLog.scores).length).toFixed(1)
    : '7.0';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* Barra de Navegación Superior con Contrato de 3 Zonas */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeContext={activeContext}
        setActiveContext={setActiveContext}
        activeUser={activeUser}
        onOpenUserSwitcher={() => setIsUserSwitcherOpen(true)}
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
                  onClick={() => setIsUserSwitcherOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-semibold transition-colors"
                  title="Gestionar cuenta de Google y espacio aislado"
                >
                  {activeUser ? (
                    <>
                      <span className={`w-2 h-2 rounded-full ${activeUser.color === 'emerald' ? 'bg-emerald-500' : activeUser.color === 'amber' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                      <span>Google: {activeUser.name}</span>
                      <span className="text-[10px] text-indigo-600 font-normal">({activeUser.role.split(' ')[0]})</span>
                    </>
                  ) : (
                    <span className="text-amber-700 font-bold flex items-center gap-1">
                      <span>🔒 Iniciar Sesión con Google</span>
                    </span>
                  )}
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
          <WheelOfLife
            logs={wheelLogs}
            onAppendSnapshot={handleAppendWheelSnapshot}
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

      </main>

      {/* FOOTER DISCRETO Y EDITORIAL */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">NeuroProductividad v0.2.0</span>
            <span className="text-slate-300">·</span>
            <p className="text-slate-500">
              Metodología e investigación del Dr. Jonathan Benito Sipos (UAM).
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
            <span>Google Auth</span>
            <span className="text-slate-300">·</span>
            <span>Offline-First (IndexedDB)</span>
            <span className="text-slate-300">·</span>
            <span>Append-Only UTC</span>
          </div>
        </div>
      </footer>

      {/* PANTALLA DE INICIO MÓVIL (SPLASH SCREEN v0.2.0) */}
      {showSplash && (
        <SplashScreen
          version="0.2.0"
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

      {/* MODAL 4: GESTOR DE IDENTIDADES GOOGLE Y ESPACIOS AISLADOS DE USUARIO */}
      <UserSwitcher
        isOpen={isUserSwitcherOpen}
        onClose={() => setIsUserSwitcherOpen(false)}
        users={users}
        activeUser={activeUser}
        onSelectUser={handleSelectUser}
        onGoogleSignIn={handleGoogleSignIn}
        onLogout={handleLogout}
        onRemoveUser={handleRemoveUser}
      />

    </div>
  );
}
