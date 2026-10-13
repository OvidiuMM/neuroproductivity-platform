import React, { useEffect, useRef, useState } from 'react';
import { AppTab, ListContext, UserProfile } from '../types';
import { Brain, Briefcase, User, Compass, ShieldCheck, ChevronDown, BookOpen, Menu, X, CalendarDays, UserCheck, LayoutDashboard } from 'lucide-react';
import { SyncIndicator, type SyncStatus } from './SyncIndicator';

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
}

// Secciones de la app: pestañas en escritorio (con nombre desde 1280 px) y menú desplegable en el móvil.
// «Cómo funciona» y «Accesos» son siempre solo icono en escritorio: con su nombre la cabecera no cabe en una
// línea a 1280 px (su nombre accesible y su título siguen ahí).
const SECTIONS: { tab: AppTab; label: string; icon: typeof Briefcase; iconOnly?: boolean }[] = [
  { tab: 'home', label: 'Inicio', icon: LayoutDashboard },
  { tab: 'tasks', label: 'Listas Duales', icon: Briefcase },
  { tab: 'agenda', label: 'Agenda', icon: CalendarDays },
  { tab: 'wheel', label: 'Rueda de la Vida', icon: Compass },
  { tab: 'bermudas', label: 'Blindaje Bermudas', icon: ShieldCheck },
  { tab: 'help', label: 'Cómo funciona', icon: BookOpen, iconOnly: true }
];

// Solo para la administración, delante de «Cómo funciona»
const ACCESS_SECTION = { tab: 'access' as const, label: 'Accesos', icon: UserCheck, iconOnly: true };

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

const Avatar: React.FC<{ user: UserProfile }> = ({ user }) =>
  user.photoUrl ? (
    <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-lg object-cover shrink-0" />
  ) : (
    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
      {user.initials}
    </div>
  );

// Cabecera de una sola línea en todos los tamaños. En el móvil: marca y versión, las dos listas y el menú, que
// lleva las secciones, la sincronización y la cuenta. «Nueva tarea» está debajo, fuera de la cabecera.
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

  // El menú del móvil se cierra con Escape o al pulsar fuera de él y de su botón
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

  // El punto naranja del botón del menú es solo visual: su nombre accesible dice lo mismo
  const menuLabel = [
    'Menú',
    isAdmin && pendingAccessCount > 0 ? `${pendingAccessCount} solicitudes de acceso pendientes` : '',
    syncStatus === 'pending' ? 'cambios sin sincronizar' : syncStatus === 'offline' ? 'sin conexión' : ''
  ]
    .filter(Boolean)
    .join(', ');

  const goTo = (tab: AppTab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const contexts = [
    { value: 'WORK' as const, label: 'Profesional', count: taskCounts.work, Icon: Briefcase, iconClass: 'text-indigo-600' },
    { value: 'PERSONAL' as const, label: 'Personal', count: taskCounts.personal, Icon: User, iconClass: 'text-emerald-600' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Una sola fila; solo con el texto ampliado (panel de accesibilidad) puede pasar a varias */}
        <div className="navbar-row flex flex-nowrap items-center justify-between min-h-14 py-2 gap-2 sm:gap-3">
          {/* Marca: el nombre completo desde 1024 px; antes, el símbolo y la versión */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <Brain className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            </div>
            <span className="hidden lg:block text-lg font-bold tracking-tight text-slate-900 leading-tight whitespace-nowrap">
              NeuroProductividad
            </span>
            <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 whitespace-nowrap">
              v{__APP_VERSION__}
            </span>
          </div>

          {/* Secciones (escritorio y tableta): solo icono hasta 1280 px; «Cómo funciona» y «Accesos», siempre */}
          <nav aria-label="Secciones" className="hidden md:flex items-center gap-0.5 min-w-0">
            {sections.map(({ tab, label, icon: Icon, iconOnly }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                aria-label={accessibleLabel(tab, label)}
                title={accessibleLabel(tab, label)}
                className={`relative h-9 px-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {!iconOnly && <span className="hidden xl:inline whitespace-nowrap">{label}</span>}
                {tab === 'access' && <PendingBadge count={pendingAccessCount} corner />}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/* Las dos listas, siempre a la vista */}
            <div role="group" aria-label="Lista activa" className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {contexts.map(({ value, label, count, Icon, iconClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveContext(value)}
                  aria-pressed={activeContext === value}
                  aria-label={`${label}, ${count} tareas`}
                  title={label}
                  className={`h-8 px-2 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    activeContext === value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${iconClass}`} aria-hidden="true" />
                  <span className="text-[10px] bg-slate-200 px-1.5 rounded-full font-mono">{count}</span>
                </button>
              ))}
            </div>

            {/* Sincronización y cuenta (escritorio y tableta); en el móvil van en el menú */}
            <div className="hidden md:flex items-center gap-2">
              <SyncIndicator status={syncStatus} onSync={onForceSync} />
              <button
                id="account-button"
                onClick={onOpenAccount}
                className="flex items-center gap-1.5 p-1 pl-1.5 pr-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-xs"
                title={`Tu cuenta: ${activeUser.name}`}
                aria-label="Tu cuenta"
              >
                <Avatar user={activeUser} />
                <ChevronDown className="w-3 h-3 text-slate-500" aria-hidden="true" />
              </button>
            </div>

            {/* Menú del móvil */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-sections-menu"
              aria-label={menuLabel}
              className="relative md:hidden w-9 h-9 shrink-0 rounded-lg border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50"
            >
              {isMenuOpen ? <X className="w-4 h-4" aria-hidden="true" /> : <Menu className="w-4 h-4" aria-hidden="true" />}
              {((isAdmin && pendingAccessCount > 0) || syncStatus === 'pending' || syncStatus === 'offline') && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-600 ring-2 ring-white" />
              )}
            </button>
          </div>
        </div>

        {/* Menú desplegable del móvil: secciones, sincronización y cuenta */}
        {isMenuOpen && (
          <nav ref={menuRef} id="mobile-sections-menu" aria-label="Secciones" className="md:hidden border-t border-slate-100 py-2 space-y-2">
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
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {label}
                    {tab === 'access' && <PendingBadge count={pendingAccessCount} />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 gap-2">
              <SyncIndicator status={syncStatus} onSync={onForceSync} withText />
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAccount();
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
              >
                <Avatar user={activeUser} />
                Tu cuenta
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
