import React from 'react';
import { ListContext, UserProfile } from '../types';
import { Brain, Briefcase, User, Calendar, Mail, Compass, Plus, ShieldCheck, CheckCircle2, ChevronDown } from 'lucide-react';

interface NavbarProps {
  activeTab: 'tasks' | 'wheel' | 'bermudas' | 'requirements';
  setActiveTab: (tab: 'tasks' | 'wheel' | 'bermudas' | 'requirements') => void;
  activeContext: ListContext;
  setActiveContext: (context: ListContext) => void;
  activeUser: UserProfile | null;
  onOpenUserSwitcher: () => void;
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
  onOpenUserSwitcher,
  onOpenNewTask,
  onOpenNewMeeting,
  onOpenNewEmail,
  taskCounts
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* 3-Zone Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
                  NeuroProductividad
                </span>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                  v0.2.0
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Basado en la metodología de Dr. Jonathan Benito Sipos
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
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
              <span>Validación de Requisitos</span>
            </button>
          </nav>

          {/* Zone 3: Actions & Strict Context Switch */}
          <div className="flex items-center gap-2 sm:gap-3">
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
                onClick={onOpenUserSwitcher}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-xs"
                title={`Espacio de usuario: ${activeUser.name} (${activeUser.email})`}
              >
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
                <span className="hidden xl:inline font-bold text-slate-800 max-w-[110px] truncate">
                  {activeUser.name.split(' ')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            ) : (
              <button
                onClick={onOpenUserSwitcher}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all shadow-2xs"
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Entrar</span>
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
        </div>
      </div>
    </header>
  );
};
