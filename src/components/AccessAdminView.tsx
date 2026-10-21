import React, { useEffect, useRef, useState } from 'react';
import { Ban, Check, Sparkles, UserX, X } from 'lucide-react';
import type { AccessRequest, DecisionStatus } from '../services/access';
import { EXTRA_FEATURES, type FeatureId } from '../services/features';

interface AccessAdminViewProps {
  requests: AccessRequest[];
  currentUid: string;
  error: string | null;
  onDecide: (uid: string, status: DecisionStatus) => Promise<void>;
  // Las cuentas que entraron solas después de esta fecha se señalan como nuevas
  newSince?: string;
  // Aprobación de cuentas obligatoria (null mientras se carga) y cómo cambiarla
  approvalRequired: boolean | null;
  onSetApprovalRequired: (approvalRequired: boolean) => Promise<void>;
  // Funciones extra concedidas a cada cuenta (por uid; null mientras se cargan o si no se pudieron cargar) y cómo
  // cambiarlas; devuelve si se guardaron
  features: Record<string, FeatureId[]> | null;
  onSetFeatures: (uid: string, features: FeatureId[]) => Promise<boolean>;
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
  },
  {
    id: 'access-blocked',
    title: 'Bloqueadas',
    matches: (r) => r.status === 'blocked',
    empty: 'Ninguna. Una cuenta bloqueada no puede entrar ni volver con otra cuenta del mismo email.'
  }
];

const BLOCK = {
  status: 'blocked' as const,
  label: 'Bloquear',
  icon: Ban,
  style: 'border border-slate-300 text-slate-700 hover:bg-slate-50'
};
const APPROVE = {
  status: 'approved' as const,
  label: 'Aprobar',
  icon: Check,
  style: 'bg-emerald-700 hover:bg-emerald-800 text-white'
};

const ACTIONS: Record<
  AccessRequest['status'],
  { status: DecisionStatus; label: string; icon: typeof Check; style: string }[]
> = {
  pending: [
    APPROVE,
    {
      status: 'rejected',
      label: 'Rechazar',
      icon: X,
      style: 'border border-slate-300 text-slate-700 hover:bg-slate-50'
    },
    BLOCK
  ],
  approved: [
    {
      status: 'revoked',
      label: 'Retirar acceso',
      icon: UserX,
      style: 'border border-red-300 text-red-700 hover:bg-red-50'
    },
    BLOCK
  ],
  rejected: [APPROVE, BLOCK],
  revoked: [APPROVE, BLOCK],
  blocked: [
    {
      status: 'revoked',
      label: 'Desbloquear',
      icon: UserX,
      style: 'border border-slate-300 text-slate-700 hover:bg-slate-50'
    }
  ]
};

const STATUS_LABEL: Record<AccessRequest['status'], string> = {
  pending: 'Pendiente',
  approved: 'Con acceso',
  rejected: 'Rechazada',
  revoked: 'Retirada',
  blocked: 'Bloqueada'
};

// Solo para la administración: decide quién puede usar la app
export const AccessAdminView: React.FC<AccessAdminViewProps> = ({
  requests,
  currentUid,
  error,
  onDecide,
  newSince,
  approvalRequired,
  onSetApprovalRequired,
  features,
  onSetFeatures
}) => {
  const [busyUid, setBusyUid] = useState<string | null>(null);
  // Las funciones extra de una cuenta con acceso, mientras se eligen (una cuenta a la vez). Si la cuenta pierde el
  // acceso, se descarta lo elegido: al volver a aprobarla empieza sin ninguna
  const [editing, setEditing] = useState<{ uid: string; selected: FeatureId[] } | null>(null);
  if (editing && !requests.some((r) => r.uid === editing.uid && r.status === 'approved')) setEditing(null);
  // Al cerrar el panel, el foco vuelve a su botón «Funciones extra» (cuando vuelve a estar activo)
  const focusAfterClose = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfterClose.current || editing || busyUid) return;
    document.getElementById(`features-button-${focusAfterClose.current}`)?.focus();
    focusAfterClose.current = null;
  }, [editing, busyUid]);
  const closeEditing = (uid: string) => {
    focusAfterClose.current = uid;
    setEditing(null);
  };
  // Escape cierra el panel sin guardar
  const panelRef = useRef<HTMLFieldSetElement>(null);
  const editingUid = editing?.uid;
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !editingUid) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      focusAfterClose.current = editingUid;
      setEditing(null);
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [editingUid]);
  // Pasar a aprobación libre aprueba también las pendientes (no las que vuelven tras un rechazo): se confirma antes
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const pendingCount = requests.filter((r) => r.status === 'pending' && !r.review).length;
  const setMode = async (required: boolean) => {
    setModeBusy(true);
    try {
      await onSetApprovalRequired(required);
      setConfirmOpen(false);
    } finally {
      setModeBusy(false);
    }
  };

  const decide = async (uid: string, status: DecisionStatus) => {
    setBusyUid(uid);
    try {
      await onDecide(uid, status);
    } finally {
      setBusyUid(null);
    }
  };

  const toggleEditing = (uid: string) =>
    setEditing((current) => (current?.uid === uid ? null : { uid, selected: features?.[uid] ?? [] }));
  const saveFeatures = async () => {
    if (!editing) return;
    const { uid, selected } = editing;
    setBusyUid(uid);
    try {
      if (await onSetFeatures(uid, selected)) closeEditing(uid);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-600">
        Aprueba quién puede usar la app. Cada solicitud nueva te llega también por email, y la persona recibe otro
        cuando la apruebas. Con la aprobación desactivada, las cuentas nuevas entran solas y salen aquí como «Nueva»;
        solo te llega un email si una cuenta rechazada o retirada vuelve a pedir acceso. Una cuenta retirada puede
        eliminarse y volver con el mismo email; para impedirlo, bloquéala.
      </p>

      <section
        aria-labelledby="access-mode-title"
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h3 id="access-mode-title" className="text-sm font-bold text-slate-900">
              Aprobación obligatoria
            </h3>
            <p id="access-mode-description" className="text-xs text-slate-600">
              {approvalRequired === false
                ? 'Desactivada: las cuentas nuevas entran solas, salvo las bloqueadas.'
                : 'Activada: cada cuenta nueva espera a que la apruebes.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={approvalRequired !== false}
            aria-labelledby="access-mode-title"
            aria-describedby="access-mode-description"
            disabled={approvalRequired === null || modeBusy}
            onClick={() => (approvalRequired === false ? setMode(true) : setConfirmOpen(true))}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              approvalRequired !== false ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                approvalRequired !== false ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {confirmOpen && (
          <div
            role="alert"
            className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            <p>
              Sin aprobación obligatoria, las cuentas nuevas o pendientes con el email confirmado entran solas; las
              rechazadas, retiradas y bloqueadas, no (si vuelven a pedir acceso, esperan a que lo decidas).
              {pendingCount > 0 &&
                ` También se aprobarán ${pendingCount === 1 ? 'la solicitud pendiente' : `las ${pendingCount} solicitudes pendientes`}.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={modeBusy}
                onClick={() => setMode(false)}
                className="min-h-11 rounded-xl bg-slate-900 px-4 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Desactivar la aprobación
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="min-h-11 rounded-xl px-3 font-semibold text-amber-900 hover:bg-amber-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

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
                  const canHaveFeatures = !isSelf && request.status === 'approved';
                  const granted = canHaveFeatures ? (features?.[request.uid] ?? []) : [];
                  const isEditing = canHaveFeatures && editing?.uid === request.uid;
                  const panelId = `features-${request.uid}`;
                  return (
                    <li key={request.uid} aria-label={who} className="space-y-3 py-3">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
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
                              {newSince && request.status === 'approved' && request.requestedAt > newSince && (
                                <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">
                                  Nueva
                                </span>
                              )}
                            </p>
                            <p className="text-xs break-all text-slate-600">{request.email}</p>
                            <p className="text-[11px] text-slate-500">
                              {STATUS_LABEL[request.status]}
                              {request.status === 'pending' && request.review && ' · vuelve a pedirlo'} · solicitado el{' '}
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
                            {granted.length > 0 && (
                              <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                                <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                                Funciones extra:{' '}
                                {EXTRA_FEATURES.filter((f) => granted.includes(f.id))
                                  .map((f) => f.label)
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {isSelf ? (
                            <span className="text-[11px] font-semibold text-slate-500">Tú (administración)</span>
                          ) : (
                            <>
                              {canHaveFeatures && (
                                <button
                                  id={`features-button-${request.uid}`}
                                  type="button"
                                  disabled={busyUid === request.uid || features === null}
                                  onClick={() => toggleEditing(request.uid)}
                                  aria-expanded={isEditing}
                                  aria-controls={isEditing ? panelId : undefined}
                                  aria-label={`Funciones extra: ${who}`}
                                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                                >
                                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                  Funciones extra
                                </button>
                              )}
                              {ACTIONS[request.status].map(({ status, label, icon: Icon, style }) => (
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
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <fieldset
                          ref={panelRef}
                          id={panelId}
                          className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3"
                        >
                          <legend className="sr-only">Funciones extra de {who}</legend>
                          <p className="text-[11px] text-slate-600">
                            Se activan para esta cuenta en cuanto las guardas; para quitarlas, desmárcalas y guarda.
                          </p>
                          {EXTRA_FEATURES.map((feature) => {
                            const inputId = `features-${request.uid}-${feature.id}`;
                            return (
                              <div key={feature.id} className="flex items-start gap-2 text-xs">
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  aria-describedby={`${inputId}-description`}
                                  checked={editing.selected.includes(feature.id)}
                                  disabled={busyUid === request.uid}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setEditing({
                                      uid: request.uid,
                                      selected: EXTRA_FEATURES.map((f) => f.id).filter((id) =>
                                        id === feature.id ? on : editing.selected.includes(id)
                                      )
                                    });
                                  }}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
                                />
                                <div>
                                  <label htmlFor={inputId} className="cursor-pointer font-bold text-slate-900">
                                    {feature.label}
                                  </label>
                                  <p id={`${inputId}-description`} className="text-slate-600">
                                    {feature.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              disabled={busyUid === request.uid}
                              onClick={saveFeatures}
                              className="min-h-11 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                              {busyUid === request.uid ? 'Guardando…' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              disabled={busyUid === request.uid}
                              onClick={() => closeEditing(request.uid)}
                              className="min-h-11 rounded-xl px-3 text-xs font-semibold text-slate-700 hover:bg-white"
                            >
                              Cancelar
                            </button>
                          </div>
                        </fieldset>
                      )}
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
