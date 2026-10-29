import React from 'react';
import { CloudCheck, CloudOff, RefreshCw } from 'lucide-react';
import { messages } from '../i18n/locale';

// synced: todo confirmado por el servidor · pending: hay cambios sin confirmar · offline: sin conexión · syncing: forzando
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'syncing';

const m = messages<Record<SyncStatus, { label: string; short: string }>>(
  {
    synced: { label: 'Sincronizado con el servidor. Pulsa para comprobarlo de nuevo.', short: 'Sincronizado' },
    pending: {
      label: 'Hay cambios pendientes de sincronizar. Pulsa para sincronizar ahora.',
      short: 'Cambios pendientes'
    },
    offline: {
      label: 'Sin conexión: los cambios se guardan en este dispositivo y se enviarán al volver. Pulsa para reintentar.',
      short: 'Sin conexión'
    },
    syncing: { label: 'Sincronizando…', short: 'Sincronizando…' }
  },
  {
    synced: { label: 'Synced with the server. Tap to check again.', short: 'Synced' },
    pending: { label: 'There are changes waiting to sync. Tap to sync now.', short: 'Pending changes' },
    offline: {
      label: "Offline: your changes are saved on this device and will be sent when you're back online. Tap to retry.",
      short: 'Offline'
    },
    syncing: { label: 'Syncing…', short: 'Syncing…' }
  }
);

const STATES: Record<SyncStatus, { label: string; short: string; className: string; Icon: typeof RefreshCw }> = {
  synced: { ...m.synced, className: 'text-emerald-700 bg-emerald-50 border-emerald-300', Icon: CloudCheck },
  pending: { ...m.pending, className: 'text-orange-700 bg-orange-50 border-orange-300', Icon: RefreshCw },
  offline: { ...m.offline, className: 'text-orange-700 bg-orange-50 border-orange-300', Icon: CloudOff },
  syncing: { ...m.syncing, className: 'text-orange-700 bg-orange-50 border-orange-300', Icon: RefreshCw }
};

// Verde si el contenido coincide con el servidor, naranja si no; cada estado tiene además su propio icono.
// `withText`: fila con el estado escrito (menú del móvil).
export const SyncIndicator: React.FC<{ status: SyncStatus; onSync: () => void; withText?: boolean }> = ({
  status,
  onSync,
  withText = false
}) => {
  const { label, short, className, Icon } = STATES[status];
  if (withText) {
    return (
      <button
        type="button"
        onClick={onSync}
        disabled={status === 'syncing'}
        aria-label={label}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-semibold disabled:cursor-wait ${className}`}
      >
        <Icon className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} aria-hidden="true" />
        {short}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSync}
      disabled={status === 'syncing'}
      title={label}
      aria-label={label}
      data-sync-status={status}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-wait ${className}`}
    >
      <Icon className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} aria-hidden="true" />
    </button>
  );
};
