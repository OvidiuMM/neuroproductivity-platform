import React from 'react';
import { AppTab, ListContext, UserProfile } from '../types';
import { Briefcase, User, ChevronDown } from 'lucide-react';
import { SyncIndicator, type SyncStatus } from './SyncIndicator';
import { BRAND_NAME, BrandMark } from './BrandMark';
import { Avatar, PendingBadge } from './NavParts';
import { sectionLabel, sectionsFor } from '../navigation';
import { messages } from '../i18n/locale';

const m = messages(
  {
    work: 'Profesional',
    personal: 'Personal',
    releaseNotes: (version: string) => `v${version}: novedades de esta versión`,
    sections: 'Secciones',
    activeList: 'Lista activa',
    listCount: (label: string, count: number) => `${label}, ${count} tareas`,
    accountOf: (name: string) => `Tu cuenta: ${name}`,
    account: 'Tu cuenta'
  },
  {
    work: 'Work',
    personal: 'Personal',
    releaseNotes: (version) => `v${version}: what’s new in this version`,
    sections: 'Sections',
    activeList: 'Active list',
    listCount: (label, count) => `${label}, ${count} ${count === 1 ? 'task' : 'tasks'}`,
    accountOf: (name) => `Your account: ${name}`,
    account: 'Your account'
  }
);

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  activeContext: ListContext;
  setActiveContext: (context: ListContext) => void;
  activeUser: UserProfile;
  onOpenAccount: () => void;
  taskCounts: { work: number; personal: number };
  syncStatus: SyncStatus;
  onForceSync: () => void;
  isAdmin?: boolean;
  pendingAccessCount?: number;
  // La versión abre sus novedades
  onShowReleaseNotes: () => void;
}

// Cabecera de una sola línea en todos los tamaños: marca y versión, las secciones (desde 768 px), las dos listas, la
// sincronización y la cuenta (desde 768 px). En el móvil las secciones van en la barra inferior y la cuenta, en «Más».
export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeContext,
  setActiveContext,
  activeUser,
  onOpenAccount,
  taskCounts,
  syncStatus,
  onForceSync,
  onShowReleaseNotes,
  isAdmin = false,
  pendingAccessCount = 0
}) => {
  const sections = sectionsFor(isAdmin);

  const contexts = [
    {
      value: 'WORK' as const,
      label: m.work,
      count: taskCounts.work,
      Icon: Briefcase,
      iconClass: 'text-indigo-600'
    },
    {
      value: 'PERSONAL' as const,
      label: m.personal,
      count: taskCounts.personal,
      Icon: User,
      iconClass: 'text-emerald-600'
    }
  ];

  return (
    // Con viewport-fit=cover (pantalla completa en iOS) la cabecera deja sitio a la barra de estado y la muesca
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* Una sola fila, también con el texto ampliado en el móvil; solo si aun así no cabe, pasa a varias */}
        <div className="navbar-row flex min-h-14 flex-nowrap items-center justify-between gap-2 py-2 sm:gap-3">
          {/* Marca: símbolo y nombre; la versión, desde 640 px (en el móvil está al pie de la página). Así la fila cabe
              también con el texto ampliado. */}
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <BrandMark size={36} />
            <span className="text-lg leading-tight font-extrabold tracking-[0.12em] whitespace-nowrap text-slate-900 sm:tracking-[0.2em]">
              {BRAND_NAME}
            </span>
            <button
              type="button"
              onClick={onShowReleaseNotes}
              aria-label={m.releaseNotes(__APP_VERSION__)}
              className="hidden rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold whitespace-nowrap text-indigo-700 hover:bg-indigo-100 sm:inline"
            >
              v{__APP_VERSION__}
            </button>
          </div>

          {/* Secciones (escritorio y tableta): solo icono hasta 1280 px; «Ayuda» y «Administración», siempre */}
          <nav aria-label={m.sections} className="hidden min-w-0 items-center gap-0.5 md:flex">
            {sections.map((section) => {
              const { tab, label, icon: Icon, iconOnly } = section;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  data-tour={`nav-${tab}`}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  aria-label={sectionLabel(section, pendingAccessCount)}
                  title={sectionLabel(section, pendingAccessCount)}
                  className={`relative flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                    activeTab === tab
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {!iconOnly && <span className="hidden whitespace-nowrap xl:inline">{label}</span>}
                  {tab === 'access' && <PendingBadge count={pendingAccessCount} corner />}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* Las dos listas, siempre a la vista */}
            <div
              role="group"
              aria-label={m.activeList}
              data-tour="lists"
              className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            >
              {contexts.map(({ value, label, count, Icon, iconClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveContext(value)}
                  aria-pressed={activeContext === value}
                  aria-label={m.listCount(label, count)}
                  title={label}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-all ${
                    activeContext === value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden="true" />
                  <span className="rounded-full bg-slate-200 px-1.5 font-mono text-[10px]">{count}</span>
                </button>
              ))}
            </div>

            <SyncIndicator status={syncStatus} onSync={onForceSync} />

            {/* Cuenta (escritorio y tableta); en el móvil está en «Más» */}
            <div className="hidden items-center md:flex">
              <button
                id="account-button"
                onClick={onOpenAccount}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 p-1 pr-2 pl-1.5 text-xs transition-all hover:border-slate-300 hover:bg-slate-50"
                title={m.accountOf(activeUser.name)}
                aria-label={m.account}
              >
                <Avatar user={activeUser} />
                <ChevronDown className="h-3 w-3 text-slate-500" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
