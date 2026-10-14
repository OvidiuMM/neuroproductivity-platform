import React, { useState } from 'react';
import { UserCheck } from 'lucide-react';
import type { AccessRequest, DecisionStatus } from '../services/access';
import type { ClosedFeedbackPage, FeedbackStatus, FeedbackTicket } from '../services/feedbackApi';
import { AccessAdminView } from './AccessAdminView';
import { FeedbackAdminView } from './FeedbackAdminView';

interface AdminViewProps {
  requests: AccessRequest[];
  currentUid: string;
  accessError: string | null;
  onDecide: (uid: string, status: DecisionStatus) => Promise<void>;
  tickets: FeedbackTicket[];
  feedbackError: string | null;
  onSetFeedbackStatus: (ticket: FeedbackTicket, status: FeedbackStatus) => Promise<boolean>;
  loadClosedFeedback: (cursor: ClosedFeedbackPage['cursor']) => Promise<ClosedFeedbackPage>;
}

type Panel = 'requests' | 'messages';

// Administración: solicitudes de acceso y mensajes de contacto
export const AdminView: React.FC<AdminViewProps> = ({
  requests,
  currentUid,
  accessError,
  onDecide,
  tickets,
  feedbackError,
  onSetFeedbackStatus,
  loadClosedFeedback
}) => {
  const [panel, setPanel] = useState<Panel>('requests');
  const pending = requests.filter((r) => r.status === 'pending').length;
  const unread = tickets.filter((t) => t.status === 'new').length;
  const options: { value: Panel; label: string; count: number; countLabel: string }[] = [
    { value: 'requests', label: 'Solicitudes', count: pending, countLabel: pending === 1 ? 'pendiente' : 'pendientes' },
    { value: 'messages', label: 'Mensajes', count: unread, countLabel: unread === 1 ? 'nuevo' : 'nuevos' }
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <UserCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          Administración
        </h2>
        <div role="group" aria-label="Apartado" className="flex flex-wrap gap-2">
          {options.map(({ value, label, count, countLabel }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPanel(value)}
              aria-pressed={panel === value}
              aria-label={count > 0 ? `${label}, ${count} ${countLabel}` : label}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${
                panel === value ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
              {count > 0 && (
                <span aria-hidden="true" className="rounded-full bg-orange-700 px-1.5 text-[10px] leading-4 text-white">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {panel === 'requests' ? (
        <AccessAdminView requests={requests} currentUid={currentUid} error={accessError} onDecide={onDecide} />
      ) : (
        <FeedbackAdminView
          tickets={tickets}
          error={feedbackError}
          onSetStatus={onSetFeedbackStatus}
          loadClosed={loadClosedFeedback}
        />
      )}
    </div>
  );
};
