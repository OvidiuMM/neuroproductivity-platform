import React, { useEffect, useRef, useState } from 'react';
import { Mail, Reply } from 'lucide-react';
import { FEEDBACK_TYPES, REPLY_MAX_LENGTH, cleanReply } from '../services/feedback';
import {
  newReplyId,
  type ClosedFeedbackPage,
  type FeedbackReply,
  type FeedbackStatus,
  type FeedbackTicket,
  type ReplyResult
} from '../services/feedbackApi';

interface FeedbackAdminViewProps {
  // Abiertos (nuevos y leídos), en vivo
  tickets: FeedbackTicket[];
  error: string | null;
  // Devuelve si se guardó
  onSetStatus: (ticket: FeedbackTicket, status: FeedbackStatus) => Promise<boolean>;
  // Envía la respuesta por email a quien escribió y la guarda en el mensaje (el id se repite en los reintentos)
  onReply: (ticket: FeedbackTicket, replyId: string, message: string) => Promise<ReplyResult>;
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

// Une listas de mensajes sin repetir ninguno (el primero que aparece manda): un mensaje cerrado aquí puede volver a
// llegar en una página posterior
const mergeById = (first: FeedbackTicket[], second: FeedbackTicket[]) => {
  const seen = new Set(first.map((t) => t.id));
  return [...first, ...second.filter((t) => !seen.has(t.id))];
};

// Respuesta a un mensaje: se envía por email desde la cuenta de CLAR; si la persona contesta, llega al email de la
// administración. Al abrirse, el foco va al texto.
const ReplyForm: React.FC<{
  ticket: FeedbackTicket;
  onSend: (replyId: string, message: string) => Promise<ReplyResult>;
  // Enviada: se cierra el formulario
  onSent: () => void;
  onCancel: () => void;
}> = ({ ticket, onSend, onSent, onCancel }) => {
  // Un id por respuesta: si hay que reintentar, se repite y el servidor no la envía dos veces
  const [replyId, setReplyId] = useState(newReplyId);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  const id = `reply-${ticket.id}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = cleanReply(message);
    setBusy(true);
    setError(null);
    const result = await onSend(replyId, text);
    setBusy(false);
    if ('error' in result) return setError(result.error);
    if (result.reply.message === text) return onSent();
    // Con este id ya había salido un texto anterior (un intento que dio error sin que se supiera que salió): el
    // servidor devuelve ese sin reenviar nada. Este texto no ha salido; se queda aquí y, si se envía, es otra respuesta
    setReplyId(newReplyId());
    setError(
      'Tu respuesta anterior sí se envió: es la que ves arriba. Este texto no se ha enviado; si quieres, envíalo como otra respuesta.'
    );
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
      <label htmlFor={id} className="block text-xs font-bold text-slate-800">
        Respuesta para {ticket.name || ticket.email}
      </label>
      <textarea
        ref={field}
        id={id}
        rows={5}
        required
        maxLength={REPLY_MAX_LENGTH}
        // Mientras se envía no cambia: lo que se ve es lo que sale
        readOnly={busy}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-describedby={`${id}-help`}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
      />
      <p id={`${id}-help`} className="text-[11px] text-slate-600">
        Se envía por email a {ticket.email} desde la cuenta de CLAR, con su mensaje citado. Si contesta, te llegará a tu
        email. {message.length}/{REPLY_MAX_LENGTH} caracteres.
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !message.trim()}
          className="min-h-11 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Enviando…' : 'Enviar respuesta'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

// Mensajes de contacto: los nuevos y leídos a la vista, los cerrados aparte. Se responden desde aquí, por email.
export const FeedbackAdminView: React.FC<FeedbackAdminViewProps> = ({
  tickets,
  error,
  onSetStatus,
  onReply,
  loadClosed
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  // Formulario de respuesta abierto (uno a la vez; cada vez que se abre es otro, aunque sea del mismo mensaje) y el
  // último mensaje respondido, para anunciarlo y devolver el foco
  const [replying, setReplying] = useState<{ ticketId: string; form: number } | null>(null);
  const [repliedId, setRepliedId] = useState<string | null>(null);
  const forms = useRef(0);
  // El formulario abierto en este momento: una respuesta que termina mientras se escribe otra (de este mensaje u otro)
  // no la cierra
  const replyingRef = useRef(replying);
  useEffect(() => {
    replyingRef.current = replying;
  }, [replying]);
  useEffect(() => {
    if (repliedId) document.getElementById(`reply-button-${repliedId}`)?.focus();
  }, [repliedId]);
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
      setClosed((current) => mergeById(current ?? [], page.tickets));
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
      // La lista de cerrados ya cargada se ajusta aquí (los abiertos llegan en vivo), solo si se guardó
      if (!(await onSetStatus(ticket, status))) return;
      if (status === 'closed') setClosed((current) => current && mergeById([{ ...ticket, status }], current));
      else setClosed((current) => current && current.filter((t) => t.id !== ticket.id));
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async (ticket: FeedbackTicket, replyId: string, message: string) => {
    const result = await onReply(ticket, replyId, message);
    if ('error' in result) return result;
    const addReply = (t: FeedbackTicket): FeedbackTicket =>
      t.id === ticket.id && !t.replies?.some((r) => r.id === result.reply.id)
        ? { ...t, replies: [...(t.replies ?? []), result.reply] }
        : t;
    // Los abiertos llegan en vivo; la lista de cerrados ya cargada se ajusta aquí
    setClosed((current) => current && current.map(addReply));
    return result;
  };

  // Solo se cierra (y se anuncia, con el foco en «Responder») si el formulario que la envió sigue siendo el abierto
  const replySent = (ticketId: string, form: number) => {
    if (replyingRef.current?.form !== form) return;
    setReplying(null);
    setRepliedId(ticketId);
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
      {(ticket.replies?.length ?? 0) > 0 && (
        <ol aria-label={`Respuestas a «${ticket.subject}»`} className="space-y-2 border-l-2 border-indigo-200 pl-3">
          {ticket.replies!.map((reply: FeedbackReply) => (
            <li key={reply.id} className="space-y-0.5">
              <p className="text-[11px] font-semibold text-indigo-800">
                Tu respuesta · {dateTime.format(new Date(reply.sentAt))}
              </p>
              <p className="text-xs break-words whitespace-pre-wrap text-slate-700">{reply.message}</p>
            </li>
          ))}
        </ol>
      )}
      {repliedId === ticket.id && (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          Respuesta enviada.
        </p>
      )}
      {replying?.ticketId === ticket.id && (
        <ReplyForm
          key={replying.form}
          ticket={ticket}
          onSend={(replyId, message) => sendReply(ticket, replyId, message)}
          onSent={() => replySent(ticket.id, replying.form)}
          onCancel={() => setReplying(null)}
        />
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {replying?.ticketId !== ticket.id && (
          <button
            id={`reply-button-${ticket.id}`}
            type="button"
            onClick={() => {
              setRepliedId(null);
              setReplying({ ticketId: ticket.id, form: ++forms.current });
            }}
            aria-label={`Responder: ${ticket.subject}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Reply className="h-4 w-4" aria-hidden="true" />
            Responder
          </button>
        )}
        <a
          href={`mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject}`)}`}
          aria-label={`Responder desde mi correo: ${ticket.subject}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Desde mi correo
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
