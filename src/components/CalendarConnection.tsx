import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck, CalendarX, Link2 } from 'lucide-react';
import { describeAuthError } from '../services/auth';
import type { CalendarStatus } from '../services/googleCalendar';

export interface CalendarConnectionProps {
  // Si esta instalación puede conectar (tiene el id del cliente de Google)
  available: boolean;
  // null mientras se carga
  status: CalendarStatus | null;
  onConnect: (signal: AbortSignal) => Promise<{ synced: number; failed: number }>;
  onDisconnect: () => Promise<void>;
}

const buttonClass =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold disabled:opacity-60 border border-slate-300 text-slate-700 hover:bg-slate-50';

const RECONNECT_REASON: Record<NonNullable<CalendarStatus['reason']>, string> = {
  revoked: 'Google retiró el permiso de CLAR, así que las tareas han dejado de sincronizarse.',
  calendarMissing:
    'No se encuentra el calendario «CLAR» en tu cuenta de Google, así que las tareas han dejado de sincronizarse.'
};

// Conexión con Google Calendar en «Tu cuenta», bajo la función extra: conectar, el estado y desconectar
export const CalendarConnection: React.FC<CalendarConnectionProps> = ({
  available,
  status,
  onConnect,
  onDisconnect
}) => {
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Mientras se espera a Google se puede cancelar; al cerrar el menú, también se cancela
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  if (!available) return <p className="text-[11px] text-slate-600">No disponible en esta instalación.</p>;
  if (!status) return null;

  const connect = async () => {
    const controller = new AbortController();
    pending.current = controller;
    setBusy('connect');
    setError(null);
    setNotice(null);
    try {
      const { synced, failed } = await onConnect(controller.signal);
      setNotice(
        `Conectado: ${synced === 1 ? 'se ha subido 1 tarea' : `se han subido ${synced} tareas`} al calendario «CLAR».` +
          (failed
            ? ` ${failed === 1 ? '1 no se pudo subir' : `${failed} no se pudieron subir`}: se subirán al cambiarlas.`
            : '')
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(describeAuthError(e, e instanceof Error && e.message ? e.message : 'No se pudo conectar.'));
    } finally {
      pending.current = null;
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    setError(null);
    setNotice(null);
    try {
      await onDisconnect();
      setNotice(
        'Desconectado. El calendario «CLAR» se queda en tu cuenta de Google: puedes borrarlo desde Google Calendar.'
      );
    } catch {
      setError('No se pudo desconectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const connected = status.state === 'connected' || status.state === 'syncing';
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-2.5">
      {busy === 'connect' ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-slate-700">Esperando a Google… Termina en la ventana de Google.</p>
          <button type="button" onClick={() => pending.current?.abort()} className={buttonClass}>
            Cancelar
          </button>
        </div>
      ) : connected ? (
        <>
          <p className="flex items-start gap-1.5 text-[11px] text-slate-700">
            <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
            {status.state === 'syncing'
              ? 'Subiendo tus tareas al calendario «CLAR»…'
              : 'Conectado: tus tareas con fecha están en el calendario «CLAR» de tu cuenta de Google y se actualizan al cambiarlas.'}
          </p>
          <button type="button" onClick={disconnect} disabled={busy !== null} className={buttonClass}>
            <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />
            {busy === 'disconnect' ? 'Desconectando…' : 'Desconectar Google Calendar'}
          </button>
        </>
      ) : (
        <>
          <p className="text-[11px] text-slate-700">
            {status.state === 'needsReconnect' && status.reason ? `${RECONNECT_REASON[status.reason]} ` : ''}
            Se abrirá Google para dar permiso a CLAR sobre un calendario propio, «CLAR». CLAR no ve ni cambia tus otros
            calendarios. Lo que cambies en Google no vuelve a CLAR.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={connect} disabled={busy !== null} className={buttonClass}>
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              {status.state === 'needsReconnect' ? 'Volver a conectar' : 'Conectar Google Calendar'}
            </button>
            {status.state === 'needsReconnect' && (
              <button type="button" onClick={disconnect} disabled={busy !== null} className={buttonClass}>
                Desconectar
              </button>
            )}
          </div>
        </>
      )}
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-[11px] font-semibold text-red-700">
            {error}
          </p>
        )}
        {notice && <p className="text-[11px] text-emerald-800">{notice}</p>}
      </div>
    </div>
  );
};
