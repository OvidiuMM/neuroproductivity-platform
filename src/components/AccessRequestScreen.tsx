import React, { useState } from 'react';
import { Brain, Clock, LogOut, Send, ShieldAlert, WifiOff } from 'lucide-react';
import { ACCESS_MESSAGE_MAX_LENGTH, type OwnAccessStatus } from '../services/access';
import { AccessibilityButton } from './AccessibilityPanel';

interface AccessRequestScreenProps {
  status: Exclude<OwnAccessStatus, 'approved'>;
  email: string;
  onRequest: (message: string) => Promise<void>;
  onRetry: () => void;
  onSignOut: () => void;
}

const COPY: Record<AccessRequestScreenProps['status'], { title: string; text: string }> = {
  none: {
    title: 'Solicita acceso',
    text: 'El acceso a NeuroProductividad se aprueba cuenta a cuenta. Envía tu solicitud y te avisaremos por email cuando esté aprobada.'
  },
  pending: {
    title: 'Solicitud enviada',
    text: 'Te avisaremos por email cuando se apruebe. Esta pantalla se actualizará sola en cuanto tengas acceso.'
  },
  rejected: {
    title: 'Solicitud no aprobada',
    text: 'Tu solicitud de acceso no se ha aprobado. Pasado un día puedes volver a solicitarlo.'
  },
  revoked: {
    title: 'Acceso retirado',
    text: 'Tu acceso a NeuroProductividad se ha retirado. Tus datos siguen guardados. Pasado un día puedes volver a solicitarlo.'
  },
  unknown: {
    title: 'No se pudo comprobar tu acceso',
    text: 'Necesitas conexión a internet para comprobar si tu cuenta tiene acceso.'
  }
};

const ICONS = { none: Send, pending: Clock, rejected: ShieldAlert, revoked: ShieldAlert, unknown: WifiOff };

// Pantalla para las cuentas sin acceso aprobado: solicitud con mensaje opcional y estado de la solicitud
export const AccessRequestScreen: React.FC<AccessRequestScreenProps> = ({ status, email, onRequest, onRetry, onSignOut }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRequest = status === 'none' || status === 'rejected' || status === 'revoked';
  const Icon = ICONS[status];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      await onRequest(message.trim());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <Brain className="w-6 h-6 text-indigo-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-900">NeuroProductividad</p>
            <p className="text-xs text-slate-600">Has entrado como {email}</p>
          </div>
        </div>

        <div aria-live="polite" className="space-y-2">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Icon className="w-5 h-5 text-indigo-600" aria-hidden="true" />
            {COPY[status].title}
          </h1>
          <p className="text-sm text-slate-700 leading-relaxed">{COPY[status].text}</p>
        </div>

        {canRequest && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <label htmlFor="access-message" className="text-xs font-semibold text-slate-700">
                  Mensaje para la administración (opcional)
                </label>
                <span className="text-[10px] font-mono text-slate-500" aria-hidden="true">
                  {message.length}/{ACCESS_MESSAGE_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="access-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={ACCESS_MESSAGE_MAX_LENGTH}
                rows={3}
                placeholder="Por ejemplo, quién eres o para qué quieres usar la app"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {isSending ? 'Enviando…' : status === 'none' ? 'Solicitar acceso' : 'Volver a solicitar acceso'}
            </button>
          </form>
        )}

        {status === 'unknown' && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold"
          >
            Reintentar
          </button>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </p>
        )}

        <p className="text-[11px] text-slate-600 leading-relaxed">
          Para revisar tu solicitud se guardan tu nombre, tu email, tu foto de perfil de Google y el mensaje, en servidores de Google Cloud en la Unión Europea (Bélgica).
        </p>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          Cerrar sesión
        </button>

        <div className="text-center">
          <AccessibilityButton />
        </div>
      </div>
    </main>
  );
};
