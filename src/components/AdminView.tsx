import React, { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import type { AccessRequest, DecisionStatus } from '../services/access';
import type { FeatureId } from '../services/features';
import type { ClosedFeedbackPage, FeedbackStatus, FeedbackTicket, ReplyResult } from '../services/feedbackApi';
import { AccessAdminView } from './AccessAdminView';
import { FeedbackAdminView } from './FeedbackAdminView';
import { adminAlerts } from '../services/adminAlerts';

interface AdminViewProps {
  requests: AccessRequest[];
  currentUid: string;
  accessError: string | null;
  onDecide: (uid: string, status: DecisionStatus) => Promise<void>;
  // Cuándo se miraron por última vez las solicitudes, y cómo apuntar que se están mirando
  requestsSeenAt: string;
  onSeenRequests: () => void;
  approvalRequired: boolean | null;
  onSetApprovalRequired: (approvalRequired: boolean) => Promise<void>;
  features: Record<string, FeatureId[]> | null;
  onSetFeatures: (uid: string, features: FeatureId[]) => Promise<boolean>;
  tickets: FeedbackTicket[];
  feedbackError: string | null;
  onSetFeedbackStatus: (ticket: FeedbackTicket, status: FeedbackStatus) => Promise<boolean>;
  onReplyFeedback: (ticket: FeedbackTicket, replyId: string, message: string) => Promise<ReplyResult>;
  loadClosedFeedback: (cursor: ClosedFeedbackPage['cursor']) => Promise<ClosedFeedbackPage>;
}

type Panel = 'requests' | 'messages';

// Administración: solicitudes de acceso y mensajes de contacto
export const AdminView: React.FC<AdminViewProps> = ({
  requests,
  currentUid,
  accessError,
  onDecide,
  requestsSeenAt,
  onSeenRequests,
  approvalRequired,
  onSetApprovalRequired,
  features,
  onSetFeatures,
  tickets,
  feedbackError,
  onSetFeedbackStatus,
  onReplyFeedback,
  loadClosedFeedback
}) => {
  const [panel, setPanel] = useState<Panel>('requests');
  // Las cuentas nuevas se señalan en la lista desde la última vez que se miró, y dejan de contar en el aviso mientras
  // se ven las solicitudes
  const [highlightSince] = useState(requestsSeenAt);
  useEffect(() => {
    if (panel === 'requests') onSeenRequests();
  }, [panel, requests, onSeenRequests]);
  const { pending, newAccounts, unread } = adminAlerts(requests, tickets, requestsSeenAt);
  const requestsLabel = [
    pending > 0 && `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`,
    newAccounts > 0 && `${newAccounts} ${newAccounts === 1 ? 'cuenta nueva' : 'cuentas nuevas'}`
  ]
    .filter(Boolean)
    .join(', ');
  const options: { value: Panel; label: string; count: number; countLabel: string }[] = [
    { value: 'requests', label: 'Solicitudes', count: pending + newAccounts, countLabel: requestsLabel },
    {
      value: 'messages',
      label: 'Mensajes',
      count: unread,
      countLabel: `${unread} ${unread === 1 ? 'nuevo' : 'nuevos'}`
    }
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
              aria-label={count > 0 ? `${label}, ${countLabel}` : label}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${
                panel === value ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
              {count > 0 && (
                <span aria-hidden="true" className="rounded-full bg-red-600 px-1.5 text-[10px] leading-4 text-white">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {panel === 'requests' ? (
        <AccessAdminView
          requests={requests}
          currentUid={currentUid}
          error={accessError}
          onDecide={onDecide}
          newSince={highlightSince}
          approvalRequired={approvalRequired}
          onSetApprovalRequired={onSetApprovalRequired}
          features={features}
          onSetFeatures={onSetFeatures}
        />
      ) : (
        <FeedbackAdminView
          tickets={tickets}
          error={feedbackError}
          onSetStatus={onSetFeedbackStatus}
          onReply={onReplyFeedback}
          loadClosed={loadClosedFeedback}
        />
      )}
    </div>
  );
};
