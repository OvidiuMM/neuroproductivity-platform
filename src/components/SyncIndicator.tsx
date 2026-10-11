import React from 'react';
import { CloudCheck, CloudOff, RefreshCw } from 'lucide-react';

// synced: todo confirmado por el servidor · pending: hay cambios sin confirmar · offline: sin conexión · syncing: forzando
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'syncing';

const STATES: Record<SyncStatus, { label: string; className: string; Icon: typeof RefreshCw }> = {
  synced: {
    label: 'Sincronizado con el servidor. Pulsa para comprobarlo de nuevo.',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    Icon: CloudCheck
  },
  pending: {
    label: 'Hay cambios pendientes de sincronizar. Pulsa para sincronizar ahora.',
    className: 'text-orange-700 bg-orange-50 border-orange-300',
    Icon: RefreshCw
  },
  offline: {
    label: 'Sin conexión: los cambios se guardan en este dispositivo y se enviarán al volver. Pulsa para reintentar.',
    className: 'text-orange-700 bg-orange-50 border-orange-300',
    Icon: CloudOff
  },
  syncing: {
    label: 'Sincronizando…',
    className: 'text-orange-700 bg-orange-50 border-orange-300',
    Icon: RefreshCw
  }
};

// Verde si el contenido coincide con el servidor, naranja si no; cada estado tiene además su propio icono
export const SyncIndicator: React.FC<{ status: SyncStatus; onSync: () => void }> = ({ status, onSync }) => {
  const { label, className, Icon } = STATES[status];
  return (
    <button
      type="button"
      onClick={onSync}
      disabled={status === 'syncing'}
      title={label}
      aria-label={label}
      data-sync-status={status}
      className={`w-8 h-8 shrink-0 rounded-full border flex items-center justify-center transition-colors disabled:cursor-wait ${className}`}
    >
      <Icon className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} aria-hidden="true" />
    </button>
  );
};
