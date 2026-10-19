import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck, CalendarX, Link2 } from 'lucide-react';
import { useNow } from '../hooks/useNow';
import { calendarErrorMessage, type CalendarStatus, type ReconnectReason } from '../services/googleCalendar';

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

const RECONNECT_REASON: Record<ReconnectReason, string> = {
  revoked: 'El permiso de Google ya no vale (se retiró o caducó), así que las tareas han dejado de sincronizarse.',
  calendarMissing:
    'No se encuentra el calendario «CLAR» en tu cuenta de Google, así que las tareas han dejado de sincronizarse.'
};
// Una subida que lleva tanto «subiendo» se cortó (la función tiene 9 minutos): la conexión sigue
const STALE_SYNC_MS = 15 * 60_000;

const uploaded = ({ synced, failed }: { synced: number; failed: number }) => {
  const done =
    synced === 0
      ? 'Conectado: no había tareas con fecha que subir.'
      : `Conectado: ${synced === 1 ? 'se ha subido 1 tarea' : `se han subido ${synced} tareas`} al calendario «CLAR».`;
  if (!failed) return done;
  return `${done} ${
    failed === 1
      ? '1 no se pudo subir: se subirá al cambiarla o al volver a conectar.'
      : `${failed} no se pudieron subir: se subirán al cambiarlas o al volver a conectar.`
  }`;
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
  // Tras pulsar un botón, si desaparece (cambia el paso o llega el estado nuevo) el foco va al control que queda, en
  // lugar de perderse. Deja de hacerlo en cuanto la persona lleva el foco a otra parte
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

  if (!available) return <p className="text-[11px] text-slate-600">No disponible en esta instalación.</p>;
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
      if (!controller.signal.aborted) setError(calendarErrorMessage(e, 'No se pudo conectar.'));
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
      setNotice(
        'Desconectado. El calendario «CLAR» se queda en tu cuenta de Google: puedes borrarlo desde Google Calendar.'
      );
    } catch (e) {
      setError(calendarErrorMessage(e, 'No se pudo desconectar. Revisa tu conexión e inténtalo de nuevo.'));
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
    <div ref={container} tabIndex={-1} className="space-y-2 rounded-lg bg-slate-50 p-2.5 focus:outline-none">
      <div aria-live="polite" className="space-y-2">
        {phase === 'authorizing' ? (
          <p className="text-[11px] text-slate-700">
            Esperando a Google: termina en su ventana. Si la cerraste sin terminar, cancela.
          </p>
        ) : phase === 'uploading' || state === 'syncing' ? (
          <p data-calendar-focus tabIndex={-1} className="text-[11px] text-slate-700 focus:outline-none">
            Subiendo tus tareas al calendario «CLAR»… Puede tardar unos minutos.
          </p>
        ) : connected ? (
          <p className="flex items-start gap-1.5 text-[11px] text-slate-700">
            <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
            Conectado: tus tareas con fecha están en el calendario «CLAR» de tu cuenta de Google y se actualizan al
            cambiarlas.
          </p>
        ) : (
          <p className="text-[11px] text-slate-700">
            {state === 'needsReconnect' && status.reason ? `${RECONNECT_REASON[status.reason]} ` : ''}
            Se abrirá Google para dar permiso a CLAR sobre un calendario propio, «CLAR». CLAR no ve ni cambia tus otros
            calendarios. Lo que cambies en Google no vuelve a CLAR.
          </p>
        )}
        {notice && <p className="text-[11px] text-emerald-800">{notice}</p>}
      </div>
      {phase === 'authorizing' ? (
        <button
          type="button"
          data-calendar-focus
          onClick={() => pending.current?.abort()}
          aria-label="Cancelar la conexión con Google Calendar"
          className={buttonClass}
        >
          Cancelar
        </button>
      ) : phase === 'uploading' ? null : connected ? (
        state === 'connected' && (
          <button type="button" data-calendar-focus onClick={disconnect} disabled={busy} className={buttonClass}>
            <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />
            {phase === 'disconnecting' ? 'Desconectando…' : 'Desconectar Google Calendar'}
          </button>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" data-calendar-focus onClick={connect} disabled={busy} className={buttonClass}>
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {state === 'needsReconnect' ? 'Volver a conectar' : 'Conectar Google Calendar'}
          </button>
          {state === 'needsReconnect' && (
            <button type="button" onClick={disconnect} disabled={busy} className={buttonClass}>
              {phase === 'disconnecting' ? 'Desconectando…' : 'Desconectar'}
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
