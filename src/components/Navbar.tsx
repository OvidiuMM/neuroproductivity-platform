import React, { useEffect, useRef, useState } from 'react';
import { AppTab, ListContext, UserProfile } from '../types';
import { Brain, Briefcase, User, Compass, Plus, ShieldCheck, ChevronDown, BookOpen, Menu, X, CalendarDays, UserCheck } from 'lucide-react';
import { SyncIndicator, type SyncStatus } from './SyncIndicator';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  activeContext: ListContext;
  setActiveContext: (context: ListContext) => void;
  activeUser: UserProfile | null;
  onOpenAccount: () => void;
  onOpenNewTask: () => void;
  onOpenNewMeeting: () => void;
  onOpenNewEmail: () => void;
  taskCounts: { work: number; personal: number; someday: number };
  syncStatus: SyncStatus;
  onForceSync: () => void;
  isAdmin?: boolean;
  pendingAccessCount?: number;
}

// Secciones de la app: pestañas en escritorio y menú desplegable en el móvil
const SECTIONS: { tab: AppTab; label: string; icon: typeof Briefcase; iconOnlyOnDesktop?: boolean }[] = [
  { tab: 'tasks', label: 'Listas Duales', icon: Briefcase },
  { tab: 'agenda', label: 'Agenda', icon: CalendarDays },
  { tab: 'wheel', label: 'Rueda de la Vida', icon: Compass },
  { tab: 'bermudas', label: 'Blindaje Bermudas', icon: ShieldCheck },
  // Solo icono en escritorio: el contenido de la cabecera no pasa de 1280 px (max-w-7xl)
  { tab: 'help', label: 'Cómo funciona', icon: BookOpen, iconOnlyOnDesktop: true }
];

// Solo para la administración, delante de «Cómo funciona»
const ACCESS_SECTION = { tab: 'access' as const, label: 'Accesos', icon: UserCheck, iconOnlyOnDesktop: true };

// En la pestaña de escritorio va sobre la esquina del icono para no ensanchar la cabecera
const PendingBadge: React.FC<{ count: number; corner?: boolean }> = ({ count, corner = false }) =>
  count > 0 ? (
    <span
      aria-hidden="true"
      className={`min-w-4 h-4 px-1 rounded-full bg-orange-700 text-white text-[10px] font-bold leading-4 text-center ${
        corner ? 'absolute -top-1.5 -right-1.5 ring-2 ring-white' : ''
      }`}
    >
      {count}
    </span>
  ) : null;

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeContext,
  setActiveContext,
  activeUser,
  onOpenAccount,
  onOpenNewTask,
  taskCounts,
  syncStatus,
  onForceSync,
  isAdmin = false,
  pendingAccessCount = 0
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sections = isAdmin ? [...SECTIONS.slice(0, -1), ACCESS_SECTION, ...SECTIONS.slice(-1)] : SECTIONS;
  // Nombre accesible con el número de solicitudes pendientes (el globo es solo visual)
  const accessibleLabel = (tab: AppTab, label: string) =>
    tab === 'access' && pendingAccessCount > 0 ? `${label}, ${pendingAccessCount} pendientes` : label;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  // El menú del móvil se cierra con Escape o al pulsar fuera de él y de su botón (también en otros
  // controles de la cabecera, como «Nueva Tarea» o la cuenta)
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setIsMenuOpen(false);
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isMenuOpen]);

  const goTo = (tab: AppTab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* 3-Zone Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Por debajo de 1280 px las zonas pasan a la línea siguiente en lugar de desbordar; desde ahí caben en una fila */}
        <div className="navbar-row flex flex-wrap xl:flex-nowrap items-center justify-between min-h-16 py-2 gap-x-4 xl:gap-x-3 gap-y-2">

          {/* Zone 1: Single text element wordmark */}
          {/* Puede estrecharse hasta el ancho del nombre y la versión (nunca menos, o los tapan las pestañas);
              la línea de debajo pasa a dos líneas si falta espacio */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
                  NeuroProductividad
                </span>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                  v{__APP_VERSION__}
                </span>
              </div>
              <span className="hidden sm:block text-[11px] leading-tight text-slate-500 font-medium">
                Gestión del tiempo y neuroproductividad
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links (escritorio) */}
          <nav aria-label="Secciones" className="hidden md:flex items-center gap-0.5">
            {sections.map(({ tab, label, icon: Icon, iconOnlyOnDesktop }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                aria-label={iconOnlyOnDesktop || tab === 'access' ? accessibleLabel(tab, label) : undefined}
                title={iconOnlyOnDesktop ? accessibleLabel(tab, label) : undefined}
                className={`relative ${iconOnlyOnDesktop ? 'px-2' : 'px-2.5'} py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {!iconOnlyOnDesktop && <span className="whitespace-nowrap">{label}</span>}
                {tab === 'access' && <PendingBadge count={pendingAccessCount} corner />}
              </button>
            ))}
          </nav>

          {/* Zone 3: Actions & Strict Context Switch */}
          {/* Con el texto muy grande en un móvil no cabe en una fila y pasa a la siguiente */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Context Switcher (Exclusión absoluta de esferas) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveContext('WORK')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeContext === 'WORK'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Esfera Profesional: Tareas de trabajo"
                aria-label={`Profesional, ${taskCounts.work} tareas`}
              >
                <Briefcase className="w-3 h-3 text-indigo-600" aria-hidden="true" />
                {/* Desde 1280 px todo va en una fila: el nombre se queda en el aria-label y el title */}
                <span className="hidden sm:inline xl:hidden">Profesional</span>
                <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-mono">
                  {taskCounts.work}
                </span>
              </button>

              <button
                onClick={() => setActiveContext('PERSONAL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeContext === 'PERSONAL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Esfera Personal: Tareas de vida personal"
                aria-label={`Personal, ${taskCounts.personal} tareas`}
              >
                <User className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                <span className="hidden sm:inline xl:hidden">Personal</span>
                <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-mono">
                  {taskCounts.personal}
                </span>
              </button>
            </div>

            {/* Estado de sincronización con el servidor (pulsar fuerza la sincronización) */}
            <SyncIndicator status={syncStatus} onSync={onForceSync} />

            {/* User Profile & Space Isolation Trigger */}
            {activeUser ? (
              <button
                onClick={onOpenAccount}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-xs"
                title={`Tu cuenta: ${activeUser.name}`}
                aria-label="Tu cuenta"
              >
                {activeUser.photoUrl ? (
                  <img src={activeUser.photoUrl} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-lg object-cover shrink-0" />
                ) : (
                  <div
                    className={`w-6 h-6 rounded-lg text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs ${
                      activeUser.color === 'emerald'
                        ? 'bg-emerald-600'
                        : activeUser.color === 'amber'
                        ? 'bg-amber-600'
                        : 'bg-indigo-600'
                    }`}
                  >
                    {activeUser.initials}
                  </div>
                )}
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
            ) : (
              <button
                onClick={onOpenAccount}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all shadow-2xs"
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Elegir perfil</span>
              </button>
            )}

            {/* Primary Action Button */}
            {/* En pantallas estrechas solo el icono; el nombre accesible es siempre "Nueva Tarea" */}
            <button
              onClick={onOpenNewTask}
              aria-label="Nueva Tarea"
              className="h-8 px-2.5 sm:px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Nueva Tarea</span>
            </button>

            {/* Menú de secciones en el móvil */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-sections-menu"
              aria-label={isAdmin && pendingAccessCount > 0 ? `Menú, ${pendingAccessCount} solicitudes de acceso pendientes` : 'Menú'}
              className="relative md:hidden w-8 h-8 shrink-0 rounded-lg border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50"
            >
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              {isAdmin && pendingAccessCount > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-600 ring-2 ring-white" />
              )}
            </button>
          </div>

        </div>

        {/* Menú desplegable del móvil con las secciones */}
        {isMenuOpen && (
          <nav ref={menuRef} id="mobile-sections-menu" aria-label="Secciones" className="md:hidden border-t border-slate-100 py-2">
            <ul className="space-y-1">
              {sections.map(({ tab, label, icon: Icon }) => (
                <li key={tab}>
                  <button
                    type="button"
                    onClick={() => goTo(tab)}
                    aria-current={activeTab === tab ? 'page' : undefined}
                    aria-label={tab === 'access' ? accessibleLabel(tab, label) : undefined}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2.5 ${
                      activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {tab === 'access' && <PendingBadge count={pendingAccessCount} />}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
};
