import React from 'react';
import { AppTab, UserProfile } from '../types';
import { PRIMARY_TABS, sectionLabel, sectionsFor } from '../navigation';
import { Avatar, PendingBadge } from './NavParts';
import { SyncIndicator, type SyncStatus } from './SyncIndicator';
import { MORE_BUTTON_ID } from './BottomNav';
import { BottomSheet } from './BottomSheet';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  isAdmin: boolean;
  pendingAccessCount: number;
  syncStatus: SyncStatus;
  onForceSync: () => void;
  activeUser: UserProfile;
  onOpenAccount: () => void;
}

// Hoja «Más» del móvil: las secciones que no caben en la barra inferior, la sincronización y la cuenta
export const MoreSheet: React.FC<MoreSheetProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigate,
  isAdmin,
  pendingAccessCount,
  syncStatus,
  onForceSync,
  activeUser,
  onOpenAccount
}) => {
  const sections = sectionsFor(isAdmin).filter(({ tab }) => !PRIMARY_TABS.includes(tab));

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Más"
      returnFocusTo={() => document.getElementById(MORE_BUTTON_ID)}
    >
      <nav aria-label="Más secciones">
        <ul className="space-y-1">
          {sections.map((section) => {
            const { tab, label, icon: Icon } = section;
            return (
              <li key={tab}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(tab);
                    onClose();
                  }}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  aria-label={sectionLabel(section, pendingAccessCount)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
                    activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {label}
                  <PendingBadge count={tab === 'access' ? pendingAccessCount : 0} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3">
        <SyncIndicator status={syncStatus} onSync={onForceSync} withText />
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenAccount();
          }}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Avatar user={activeUser} />
          Tu cuenta
        </button>
      </div>
    </BottomSheet>
  );
};
