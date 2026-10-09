import React from 'react';
import { AppTab, ListContext, UserProfile } from '../types';
import { Brain, Briefcase, User, Calendar, Mail, Compass, Plus, ShieldCheck, CheckCircle2, ChevronDown, BookOpen } from 'lucide-react';

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
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeContext,
  setActiveContext,
  activeUser,
  onOpenAccount,
  onOpenNewTask,
  onOpenNewMeeting,
  onOpenNewEmail,
  taskCounts
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* 3-Zone Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Por debajo de 1280 px las zonas pasan a la línea siguiente en lugar de desbordar; desde ahí caben en una fila */}
        <div className="flex flex-wrap xl:flex-nowrap items-center justify-between min-h-16 py-2 gap-x-4 gap-y-2">
          
          {/* Zone 1: Single text element wordmark */}
          {/* Puede estrecharse: si falta espacio, la línea de atribución pasa a dos líneas en lugar de desbordar */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
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

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Listas Duales</span>
            </button>

            <button
              onClick={() => setActiveTab('wheel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'wheel'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Rueda de la Vida</span>
            </button>

            <button
              onClick={() => setActiveTab('bermudas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'bermudas'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Blindaje Bermudas</span>
            </button>

            <button
              onClick={() => setActiveTab('requirements')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'requirements'
                  ? 'bg-indigo-700 text-white shadow-sm'
                  : 'text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" />
              <span>Requisitos</span>
            </button>

            {/* Solo icono: el contenido de la cabecera no pasa de 1280 px (max-w-7xl) y no cabe la etiqueta completa */}
            <button
              onClick={() => setActiveTab('help')}
              aria-label="Cómo funciona"
              title="Cómo funciona"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'help'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          </nav>

          {/* Zone 3: Actions & Strict Context Switch */}
          <div className="flex items-center gap-2">
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
              >
                <Briefcase className="w-3 h-3 text-indigo-600" />
                <span className="hidden sm:inline">Profesional</span>
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
              >
                <User className="w-3 h-3 text-emerald-600" />
                <span className="hidden sm:inline">Personal</span>
                <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-mono">
                  {taskCounts.personal}
                </span>
              </button>
            </div>

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
                <ChevronDown className="w-3 h-3 text-slate-400" />
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
            <button
              onClick={onOpenNewTask}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nueva Tarea</span>
              <span className="sm:hidden">Tarea</span>
            </button>
          </div>

        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-2 py-1 font-semibold rounded ${activeTab === 'tasks' ? 'text-slate-900 bg-slate-100' : 'text-slate-500'}`}
          >
            Listas
          </button>
          <button
            onClick={() => setActiveTab('wheel')}
            className={`px-2 py-1 font-semibold rounded ${activeTab === 'wheel' ? 'text-slate-900 bg-slate-100' : 'text-slate-500'}`}
          >
            Rueda
          </button>
          <button
            onClick={() => setActiveTab('bermudas')}
            className={`px-2 py-1 font-semibold rounded ${activeTab === 'bermudas' ? 'text-slate-900 bg-slate-100' : 'text-slate-500'}`}
          >
            Bermudas
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-2 py-1 font-semibold rounded ${activeTab === 'requirements' ? 'text-indigo-700 bg-indigo-50 font-bold' : 'text-slate-500'}`}
          >
            Requisitos
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`px-2 py-1 font-semibold rounded ${activeTab === 'help' ? 'text-slate-900 bg-slate-100' : 'text-slate-500'}`}
          >
            Ayuda
          </button>
        </div>
      </div>
    </header>
  );
};
