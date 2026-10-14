import React, { useState } from 'react';
import { Check, UserCheck, UserX, X } from 'lucide-react';
import type { AccessRequest, DecisionStatus } from '../services/access';

interface AccessAdminViewProps {
  requests: AccessRequest[];
  currentUid: string;
  error: string | null;
  onDecide: (uid: string, status: DecisionStatus) => Promise<void>;
}

const dateFormat = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const GROUPS: { id: string; title: string; matches: (r: AccessRequest) => boolean; empty: string }[] = [
  {
    id: 'access-pending',
    title: 'Pendientes',
    matches: (r) => r.status === 'pending',
    empty: 'No hay solicitudes pendientes.'
  },
  {
    id: 'access-approved',
    title: 'Con acceso',
    matches: (r) => r.status === 'approved',
    empty: 'Nadie tiene acceso todavía.'
  },
  {
    id: 'access-closed',
    title: 'Rechazadas o retiradas',
    matches: (r) => r.status === 'rejected' || r.status === 'revoked',
    empty: 'Ninguna.'
  }
];

const ACTIONS: Record<
  AccessRequest['status'],
  { status: DecisionStatus; label: string; icon: typeof Check; style: string }[]
> = {
  pending: [
    { status: 'approved', label: 'Aprobar', icon: Check, style: 'bg-emerald-700 hover:bg-emerald-800 text-white' },
    {
      status: 'rejected',
      label: 'Rechazar',
      icon: X,
      style: 'border border-slate-300 text-slate-700 hover:bg-slate-50'
    }
  ],
  approved: [
    {
      status: 'revoked',
      label: 'Retirar acceso',
      icon: UserX,
      style: 'border border-red-300 text-red-700 hover:bg-red-50'
    }
  ],
  rejected: [
    { status: 'approved', label: 'Aprobar', icon: Check, style: 'bg-emerald-700 hover:bg-emerald-800 text-white' }
  ],
  revoked: [
    { status: 'approved', label: 'Aprobar', icon: Check, style: 'bg-emerald-700 hover:bg-emerald-800 text-white' }
  ]
};

const STATUS_LABEL: Record<AccessRequest['status'], string> = {
  pending: 'Pendiente',
  approved: 'Con acceso',
  rejected: 'Rechazada',
  revoked: 'Retirada'
};

// Solo para la administración: decide quién puede usar la app
export const AccessAdminView: React.FC<AccessAdminViewProps> = ({ requests, currentUid, error, onDecide }) => {
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const decide = async (uid: string, status: DecisionStatus) => {
    setBusyUid(uid);
    try {
      await onDecide(uid, status);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <UserCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          Accesos
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Aprueba quién puede usar la app. Cada solicitud nueva te llega también por email, y la persona recibe otro
          cuando la apruebas.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      {GROUPS.map(({ id, title, matches, empty }) => {
        const items = requests.filter(matches);
        return (
          <section
            key={id}
            aria-labelledby={id}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h3 id={id} className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              {title} ({items.length})
            </h3>
            {items.length === 0 ? (
              <p className="text-xs text-slate-500">{empty}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((request) => {
                  const who = `${request.name || request.email} (${request.email})`;
                  const isSelf = request.uid === currentUid;
                  return (
                    <li
                      key={request.uid}
                      aria-label={who}
                      className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-start"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        {request.photoUrl ? (
                          <img
                            src={request.photoUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white"
                            aria-hidden="true"
                          >
                            {(request.name || request.email).slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-semibold break-words text-slate-900">
                            {request.name || request.email}
                          </p>
                          <p className="text-xs break-all text-slate-600">{request.email}</p>
                          <p className="text-[11px] text-slate-500">
                            {STATUS_LABEL[request.status]} · solicitado el{' '}
                            {dateFormat.format(new Date(request.requestedAt))}
                            {request.decidedAt && request.status !== 'pending' && (
                              <> · decidido el {dateFormat.format(new Date(request.decidedAt))}</>
                            )}
                          </p>
                          {request.message && (
                            <blockquote className="mt-1 rounded-r-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-xs break-words whitespace-pre-wrap text-slate-700">
                              {request.message}
                            </blockquote>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isSelf ? (
                          <span className="text-[11px] font-semibold text-slate-500">Tú (administración)</span>
                        ) : (
                          ACTIONS[request.status].map(({ status, label, icon: Icon, style }) => (
                            <button
                              key={status}
                              type="button"
                              disabled={busyUid === request.uid}
                              onClick={() => decide(request.uid, status)}
                              aria-label={`${label}: ${who}`}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${style}`}
                            >
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {label}
                            </button>
                          ))
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
