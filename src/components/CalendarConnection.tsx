import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck, CalendarX, Link2 } from 'lucide-react';
import { useNow } from '../hooks/useNow';
import { calendarErrorMessage, type CalendarStatus, type ReconnectReason } from '../services/googleCalendar';
import { messages } from '../i18n/locale';

export interface CalendarConnectionProps {
  // Si esta instalación puede conectar (tiene el id del cliente de Google)
  available: boolean;
  // null mientras se carga
  status: CalendarStatus | null;
  onConnect: (signal: AbortSignal, onAuthorized: () => void) => Promise<{ synced: number; failed: number }>;
  onDisconnect: () => Promise<void>;
}

const buttonClass =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold disabled:opacity-60 border border-slate-300 text-slate-700 hover:bg-slate-50';

const m = messages<{
  reconnectReason: Record<ReconnectReason, string>;
  connectedEmpty: string;
  connectedSynced: (synced: number) => string;
  failed: (failed: number) => string;
  unavailable: string;
  connectFailed: string;
  disconnected: string;
  disconnectFailed: string;
  waiting: string;
  uploading: string;
  connected: string;
  explain: string;
  cancelConnection: string;
  cancel: string;
  disconnecting: string;
  disconnectCalendar: string;
  reconnect: string;
  connect: string;
  disconnect: string;
}>(
  {
    reconnectReason: {
      revoked: 'El permiso de Google ya no vale (se retiró o caducó), así que las tareas han dejado de sincronizarse.',
      calendarMissing:
        'No se encuentra el calendario «CLAR» en tu cuenta de Google, así que las tareas han dejado de sincronizarse.'
    },
    connectedEmpty: 'Conectado: no había tareas con fecha que subir.',
    connectedSynced: (synced) =>
      `Conectado: ${synced === 1 ? 'se ha subido 1 tarea' : `se han subido ${synced} tareas`} al calendario «CLAR».`,
    failed: (failed) =>
      failed === 1
        ? '1 no se pudo subir: se subirá al cambiarla o al volver a conectar.'
        : `${failed} no se pudieron subir: se subirán al cambiarlas o al volver a conectar.`,
    unavailable: 'No disponible en esta instalación.',
    connectFailed: 'No se pudo conectar.',
    disconnected:
      'Desconectado. El calendario «CLAR» se queda en tu cuenta de Google: puedes borrarlo desde Google Calendar.',
    disconnectFailed: 'No se pudo desconectar. Revisa tu conexión e inténtalo de nuevo.',
    waiting: 'Esperando a Google: termina en su ventana. Si la cerraste sin terminar, cancela.',
    uploading: 'Subiendo tus tareas al calendario «CLAR»… Puede tardar unos minutos.',
    connected:
      'Conectado: tus tareas con fecha están en el calendario «CLAR» de tu cuenta de Google y se actualizan al cambiarlas.',
    explain:
      'Se abrirá Google para dar permiso a CLAR sobre un calendario propio, «CLAR». CLAR no ve ni cambia tus otros calendarios. Lo que cambies en Google no vuelve a CLAR.',
    cancelConnection: 'Cancelar la conexión con Google Calendar',
    cancel: 'Cancelar',
    disconnecting: 'Desconectando…',
    disconnectCalendar: 'Desconectar Google Calendar',
    reconnect: 'Volver a conectar',
    connect: 'Conectar Google Calendar',
    disconnect: 'Desconectar'
  },
  {
    reconnectReason: {
      revoked:
        "Google's permission is no longer valid (it was removed or expired), so your tasks have stopped syncing.",
      calendarMissing: "The “CLAR” calendar can't be found in your Google account, so your tasks have stopped syncing."
    },
    connectedEmpty: 'Connected: there were no tasks with a date to upload.',
    connectedSynced: (synced) =>
      `Connected: ${synced === 1 ? '1 task has been uploaded' : `${synced} tasks have been uploaded`} to the “CLAR” calendar.`,
    failed: (failed) =>
      failed === 1
        ? "1 couldn't be uploaded: it will be uploaded when you change it or connect again."
        : `${failed} couldn't be uploaded: they will be uploaded when you change them or connect again.`,
    unavailable: 'Not available in this installation.',
    connectFailed: "Couldn't connect.",
    disconnected:
      'Disconnected. The “CLAR” calendar stays in your Google account: you can delete it from Google Calendar.',
    disconnectFailed: "Couldn't disconnect. Check your connection and try again.",
    waiting: 'Waiting for Google: finish in its window. If you closed it without finishing, cancel.',
    uploading: 'Uploading your tasks to the “CLAR” calendar… It may take a few minutes.',
    connected:
      'Connected: your tasks with a date are in the “CLAR” calendar in your Google account and update when you change them.',
    explain:
      "Google will open so you can give CLAR permission for a calendar of its own, “CLAR”. CLAR doesn't see or change your other calendars. What you change in Google doesn't come back to CLAR.",
    cancelConnection: 'Cancel the Google Calendar connection',
    cancel: 'Cancel',
    disconnecting: 'Disconnecting…',
    disconnectCalendar: 'Disconnect Google Calendar',
    reconnect: 'Reconnect',
    connect: 'Connect Google Calendar',
    disconnect: 'Disconnect'
  }
);
const RECONNECT_REASON = m.reconnectReason;
// Una subida que lleva tanto «subiendo» se cortó (la función tiene 9 minutos): la conexión sigue
const STALE_SYNC_MS = 15 * 60_000;

const uploaded = ({ synced, failed }: { synced: number; failed: number }) => {
  const done = synced === 0 ? m.connectedEmpty : m.connectedSynced(synced);
  if (!failed) return done;
  return `${done} ${m.failed(failed)}`;
};

type Phase = 'idle' | 'authorizing' | 'uploading' | 'disconnecting';

// Conexión con Google Calendar en «Tu cuenta», bajo la función extra: conectar, el estado y desconectar
export const CalendarConnection: React.FC<CalendarConnectionProps> = ({
  available,
  status,
  onConnect,
  onDisconnect
}) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const now = useNow();
  // Mientras se espera a Google se puede cancelar; al cerrar el menú, también se cancela
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  // Mientras el foco está en el bloque, si su control desaparece (cambia el paso o llega un estado nuevo, también desde
  // otro dispositivo) el foco va al control que queda, en lugar de perderse. Deja de hacerlo en cuanto la persona lleva
  // el foco a otra parte
  const container = useRef<HTMLDivElement>(null);
  const keepFocus = useRef(false);
  useEffect(() => {
    const box = container.current;
    if (!keepFocus.current || !box) return;
    const active = document.activeElement;
    if (active && active !== document.body) {
      if (!box.contains(active)) keepFocus.current = false;
      return;
    }
    (box.querySelector<HTMLElement>('[data-calendar-focus]') ?? box).focus();
  });

  if (!available) return <p className="text-[11px] text-slate-600">{m.unavailable}</p>;
  if (!status) return null;

  const connect = async () => {
    const controller = new AbortController();
    pending.current = controller;
    keepFocus.current = true;
    setPhase('authorizing');
    setError(null);
    setNotice(null);
    try {
      setNotice(uploaded(await onConnect(controller.signal, () => setPhase('uploading'))));
    } catch (e) {
      if (!controller.signal.aborted) setError(calendarErrorMessage(e, m.connectFailed));
    } finally {
      pending.current = null;
      setPhase('idle');
    }
  };

  const disconnect = async () => {
    keepFocus.current = true;
    setPhase('disconnecting');
    setError(null);
    setNotice(null);
    try {
      await onDisconnect();
      setNotice(m.disconnected);
    } catch (e) {
      setError(calendarErrorMessage(e, m.disconnectFailed));
    } finally {
      setPhase('idle');
    }
  };

  const staleSync =
    status.state === 'syncing' &&
    Boolean(status.updatedAt) &&
    now.getTime() - Date.parse(status.updatedAt!) > STALE_SYNC_MS;
  const state = staleSync ? 'connected' : status.state;
  const connected = state === 'connected' || state === 'syncing';
  const busy = phase !== 'idle';

  return (
    <div
      ref={container}
      tabIndex={-1}
      onFocus={() => {
        keepFocus.current = true;
      }}
      className="space-y-2 rounded-lg bg-slate-50 p-2.5 focus:outline-none"
    >
      <div aria-live="polite" className="space-y-2">
        {phase === 'authorizing' ? (
          <p className="text-[11px] text-slate-700">{m.waiting}</p>
        ) : phase === 'uploading' || state === 'syncing' ? (
          <p data-calendar-focus tabIndex={-1} className="text-[11px] text-slate-700 focus:outline-none">
            {m.uploading}
          </p>
        ) : connected ? (
          <p className="flex items-start gap-1.5 text-[11px] text-slate-700">
            <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
            {m.connected}
          </p>
        ) : (
          <p className="text-[11px] text-slate-700">
            {state === 'needsReconnect' && status.reason ? `${RECONNECT_REASON[status.reason]} ` : ''}
            {m.explain}
          </p>
        )}
        {notice && <p className="text-[11px] text-emerald-800">{notice}</p>}
      </div>
      {phase === 'authorizing' ? (
        <button
          type="button"
          data-calendar-focus
          onClick={() => pending.current?.abort()}
          aria-label={m.cancelConnection}
          className={buttonClass}
        >
          {m.cancel}
        </button>
      ) : phase === 'uploading' ? null : connected ? (
        state === 'connected' && (
          <button type="button" data-calendar-focus onClick={disconnect} disabled={busy} className={buttonClass}>
            <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />
            {phase === 'disconnecting' ? m.disconnecting : m.disconnectCalendar}
          </button>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" data-calendar-focus onClick={connect} disabled={busy} className={buttonClass}>
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {state === 'needsReconnect' ? m.reconnect : m.connect}
          </button>
          {state === 'needsReconnect' && (
            <button type="button" onClick={disconnect} disabled={busy} className={buttonClass}>
              {phase === 'disconnecting' ? m.disconnecting : m.disconnect}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-[11px] font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};
