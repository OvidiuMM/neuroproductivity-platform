import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { FEEDBACK_TYPES } from '../services/feedback';
import type { ClosedFeedbackPage, FeedbackStatus, FeedbackTicket } from '../services/feedbackApi';

interface FeedbackAdminViewProps {
  // Abiertos (nuevos y leídos), en vivo
  tickets: FeedbackTicket[];
  error: string | null;
  onSetStatus: (ticket: FeedbackTicket, status: FeedbackStatus) => Promise<void>;
  // Cerrados, por páginas y bajo demanda
  loadClosed: (cursor: ClosedFeedbackPage['cursor']) => Promise<ClosedFeedbackPage>;
}

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const typeLabel = (type: FeedbackTicket['type']) => FEEDBACK_TYPES.find((t) => t.value === type)?.label ?? type;
const STATUS_LABEL: Record<FeedbackStatus, string> = { new: 'Nuevo', read: 'Leído', closed: 'Cerrado' };
const STATUS_CLASS: Record<FeedbackStatus, string> = {
  new: 'border-orange-200 bg-orange-50 text-orange-800',
  read: 'border-slate-200 bg-slate-100 text-slate-700',
  closed: 'border-emerald-200 bg-emerald-50 text-emerald-800'
};

// Mensajes de contacto: los nuevos y leídos a la vista, los cerrados aparte. Se responde por email.
export const FeedbackAdminView: React.FC<FeedbackAdminViewProps> = ({ tickets, error, onSetStatus, loadClosed }) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const open = tickets;
  // Cerrados: no se cargan hasta que se piden
  const [closed, setClosed] = useState<FeedbackTicket[] | null>(null);
  const [closedPage, setClosedPage] = useState<ClosedFeedbackPage | null>(null);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [closedError, setClosedError] = useState<string | null>(null);

  const loadMoreClosed = async () => {
    setLoadingClosed(true);
    setClosedError(null);
    try {
      const page = await loadClosed(closedPage?.cursor ?? null);
      setClosed((current) => [...(current ?? []), ...page.tickets]);
      setClosedPage(page);
    } catch (e) {
      console.error('Error loading closed feedback:', e);
      setClosedError('No se pudieron cargar los mensajes cerrados.');
    } finally {
      setLoadingClosed(false);
    }
  };

  const setStatus = async (ticket: FeedbackTicket, status: FeedbackStatus) => {
    setBusyId(ticket.id);
    try {
      await onSetStatus(ticket, status);
      // La lista de cerrados ya cargada se ajusta aquí (los abiertos llegan en vivo)
      if (status === 'closed') setClosed((current) => current && [{ ...ticket, status }, ...current]);
      else setClosed((current) => current && current.filter((t) => t.id !== ticket.id));
    } finally {
      setBusyId(null);
    }
  };

  const actionClass =
    'min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60';

  const renderTicket = (ticket: FeedbackTicket) => (
    <li
      key={ticket.id}
      aria-label={`${ticket.subject} (${STATUS_LABEL[ticket.status]})`}
      className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${STATUS_CLASS[ticket.status]}`}>
          {STATUS_LABEL[ticket.status]}
        </span>
        <span className="font-semibold text-indigo-700">{typeLabel(ticket.type)}</span>
        <span className="text-slate-500">{dateTime.format(new Date(ticket.createdAt))}</span>
      </div>
      <h4 className="text-sm font-bold break-words text-slate-900">{ticket.subject}</h4>
      <p className="text-xs break-words whitespace-pre-wrap text-slate-700">{ticket.description}</p>
      <p className="text-xs break-words text-slate-600">
        {ticket.name || 'Sin nombre'} · {ticket.email}
      </p>
      {ticket.context && (
        <p className="text-[11px] text-slate-500">
          CLAR {ticket.context.appVersion} · {ticket.context.os} · {ticket.context.browser} ·{' '}
          {ticket.context.deviceClass} · {ticket.context.language} ·{' '}
          {ticket.context.online ? 'con conexión' : 'sin conexión'}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={`mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject}`)}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Responder por email
        </a>
        {ticket.status === 'new' && (
          <button
            type="button"
            disabled={busyId === ticket.id}
            onClick={() => setStatus(ticket, 'read')}
            aria-label={`Marcar como leído: ${ticket.subject}`}
            className={actionClass}
          >
            Marcar como leído
          </button>
        )}
        {ticket.status === 'closed' ? (
          <button
            type="button"
            disabled={busyId === ticket.id}
            onClick={() => setStatus(ticket, 'read')}
            aria-label={`Reabrir: ${ticket.subject}`}
            className={actionClass}
          >
            Reabrir
          </button>
        ) : (
          <button
            type="button"
            disabled={busyId === ticket.id}
            onClick={() => setStatus(ticket, 'closed')}
            aria-label={`Cerrar: ${ticket.subject}`}
            className={actionClass}
          >
            Cerrar
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}
      <section aria-labelledby="feedback-open" className="space-y-3">
        <h3 id="feedback-open" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
          Abiertos ({open.length})
        </h3>
        {open.length === 0 ? (
          <p className="text-xs text-slate-600">No hay mensajes por atender.</p>
        ) : (
          <ul className="space-y-3">{open.map(renderTicket)}</ul>
        )}
      </section>
      <section aria-labelledby="feedback-closed" className="space-y-3">
        <h3 id="feedback-closed" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
          Cerrados{closed ? ` (${closed.length}${closedPage?.hasMore ? '+' : ''})` : ''}
        </h3>
        {closedError && (
          <p role="alert" className="text-xs text-red-700">
            {closedError}
          </p>
        )}
        {closed && closed.length === 0 && !closedPage?.hasMore && (
          <p className="text-xs text-slate-600">No hay mensajes cerrados.</p>
        )}
        {closed && closed.length > 0 && <ul className="space-y-3">{closed.map(renderTicket)}</ul>}
        {(!closed || closedPage?.hasMore) && (
          <button type="button" onClick={loadMoreClosed} disabled={loadingClosed} className={actionClass}>
            {loadingClosed ? 'Cargando…' : closed ? 'Cargar más' : 'Ver los cerrados'}
          </button>
        )}
      </section>
    </div>
  );
};
