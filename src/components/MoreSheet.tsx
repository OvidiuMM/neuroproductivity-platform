import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';
import { AppTab, UserProfile } from '../types';
import { PRIMARY_TABS, sectionLabel, sectionsFor } from '../navigation';
import { Avatar, PendingBadge } from './NavParts';
import { SyncIndicator, type SyncStatus } from './SyncIndicator';
import { MORE_BUTTON_ID } from './BottomNav';

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
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, sheetRef, onClose, () => document.getElementById(MORE_BUTTON_ID));

  // Se cierra al tocar fuera de la hoja
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!sheetRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections = sectionsFor(isAdmin).filter(({ tab }) => !PRIMARY_TABS.includes(tab));

  return (
    // Por encima de los avisos, que de otro modo taparían las opciones mientras duran
    <div className="fixed inset-0 z-[60] flex items-end bg-slate-900/50 md:hidden">
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-sheet-title"
        className="animate-in slide-in-from-bottom w-full space-y-3 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between">
          <h2 id="more-sheet-title" className="text-sm font-bold text-slate-900">
            Más
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

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
      </div>
    </div>
  );
};
