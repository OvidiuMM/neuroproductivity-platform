import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { AppTab } from '../types';
import { PRIMARY_TABS, SECTIONS } from '../navigation';

interface BottomNavProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  isMoreOpen: boolean;
  onOpenMore: () => void;
  pendingAccessCount: number;
}

export const MORE_BUTTON_ID = 'more-button';

const itemClass = (active: boolean) =>
  `flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
    active ? 'text-indigo-700' : 'text-slate-600 hover:text-slate-900'
  }`;
const iconClass = (active: boolean) =>
  `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-indigo-100' : ''}`;

// Secciones en el móvil (< 768 px): barra fija abajo, al alcance del pulgar, con las cuatro más usadas y «Más»
export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigate,
  isMoreOpen,
  onOpenMore,
  pendingAccessCount
}) => {
  const primary = SECTIONS.filter(({ tab }) => PRIMARY_TABS.includes(tab));
  const moreIsCurrent = !PRIMARY_TABS.includes(activeTab);
  const pending =
    pendingAccessCount === 1 ? '1 pendiente en Administración' : `${pendingAccessCount} pendientes en Administración`;
  const moreLabel = pendingAccessCount > 0 ? `Más secciones, ${pending}` : 'Más secciones';

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {primary.map(({ tab, label, short, icon: Icon }) => (
          <li key={tab}>
            <button
              type="button"
              onClick={() => onNavigate(tab)}
              data-tour={`nav-${tab}`}
              aria-current={activeTab === tab ? 'page' : undefined}
              aria-label={label}
              className={itemClass(activeTab === tab)}
            >
              <span className={iconClass(activeTab === tab)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {short}
            </button>
          </li>
        ))}
        <li>
          <button
            id={MORE_BUTTON_ID}
            data-tour="nav-more"
            type="button"
            onClick={onOpenMore}
            aria-haspopup="dialog"
            aria-expanded={isMoreOpen}
            aria-label={moreLabel}
            className={itemClass(moreIsCurrent)}
          >
            <span className={`relative ${iconClass(moreIsCurrent)}`}>
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              {pendingAccessCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 right-2 h-2.5 w-2.5 rounded-full bg-orange-600 ring-2 ring-white"
                />
              )}
            </span>
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
};
