import React, { useRef, useState } from 'react';
import { Ban, Clock, Download, LogOut, Send, ShieldAlert, Trash2, WifiOff } from 'lucide-react';
import { BRAND_NAME, BrandMark } from './BrandMark';
import { ACCESS_MESSAGE_MAX_LENGTH, type OwnAccessStatus } from '../services/access';
import { describeAuthError } from '../services/auth';
import { DeleteAccountPanel } from './DeleteAccountPanel';
import type { ReauthMethod } from '../services/auth';
import { AccessibilityTrigger, AccessibleScreen } from './AccessibilityPanel';
import { LegalLinks } from './LegalLinks';
import { LanguageSelector } from './LanguageSelector';
import { messages } from '../i18n/locale';

interface AccessRequestScreenProps {
  status: Exclude<OwnAccessStatus, 'approved'>;
  email: string;
  onRequest: (message: string) => Promise<void>;
  onRetry: () => void;
  onSignOut: () => void;
  onContact: () => void;
  onDownloadData: () => Promise<void>;
  onDeleteAccount: (password?: string) => Promise<void>;
  // Cómo confirmar la eliminación, primero el método de la sesión actual
  reauthMethods: ReauthMethod[];
}

const m = messages<{
  copy: Record<AccessRequestScreenProps['status'], { title: string; text: string }>;
  downloadFailed: string;
  deleteFailed: string;
  requestFailed: string;
  signedInAs: (email: string) => string;
  messageLabel: string;
  messagePlaceholder: string;
  sending: string;
  request: string;
  requestAgain: string;
  retry: string;
  yourData: string;
  dataHelp: string;
  preparing: string;
  download: string;
  delete: string;
  privacy: string;
  contact: string;
  signOut: string;
}>(
  {
    copy: {
      none: {
        title: 'Solicita acceso',
        text: 'Tu cuenta aún no tiene acceso. Solicítalo: si la aprobación es automática, entrarás al momento; si no, te avisaremos por email cuando esté aprobada.'
      },
      pending: {
        title: 'Solicitud enviada',
        text: 'Te avisaremos por email cuando se apruebe. Esta pantalla se actualizará sola en cuanto tengas acceso.'
      },
      rejected: {
        title: 'Solicitud no aprobada',
        text: 'Tu solicitud de acceso no se ha aprobado. Pasado un día puedes volver a solicitarlo, y la administración lo revisará.'
      },
      revoked: {
        title: 'Acceso retirado',
        text: 'Tu acceso a CLAR se ha retirado. Tus datos siguen guardados. Pasado un día puedes volver a solicitarlo, y la administración lo revisará.'
      },
      blocked: {
        title: 'Cuenta bloqueada',
        text: 'Esta cuenta no puede usar CLAR. Si crees que es un error, escríbenos: te responderemos por email.'
      },
      unknown: {
        title: 'No se pudo comprobar tu acceso',
        text: 'Necesitas conexión a internet para comprobar si tu cuenta tiene acceso.'
      }
    },
    downloadFailed: 'No se pudieron descargar tus datos. Inténtalo de nuevo.',
    deleteFailed: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
    requestFailed: 'No se pudo enviar la solicitud. Inténtalo de nuevo.',
    signedInAs: (email) => `Has entrado como ${email}`,
    messageLabel: 'Mensaje para la administración (opcional)',
    messagePlaceholder: 'Por ejemplo, quién eres o para qué quieres usar la app',
    sending: 'Enviando…',
    request: 'Solicitar acceso',
    requestAgain: 'Volver a solicitar acceso',
    retry: 'Reintentar',
    yourData: 'Tus datos',
    dataHelp: 'Aunque no tengas acceso, puedes descargar o eliminar los datos que tengas guardados.',
    preparing: 'Preparando descarga…',
    download: 'Descargar mis datos',
    delete: 'Eliminar mi cuenta y mis datos',
    privacy:
      'Para gestionar tu acceso se guardan tu nombre, tu email, tu foto de perfil (si entras con Google) y el mensaje, en servidores de Google Cloud en la Unión Europea (Bélgica).',
    contact: '¿Alguna duda o problema? Escríbenos',
    signOut: 'Cerrar sesión'
  },
  {
    copy: {
      none: {
        title: 'Request access',
        text: "Your account doesn't have access yet. Request it: if approval is automatic, you'll get in right away; if not, we'll email you when it's approved."
      },
      pending: {
        title: 'Request sent',
        text: "We'll email you when it's approved. This screen will update by itself as soon as you have access."
      },
      rejected: {
        title: 'Request not approved',
        text: "Your access request wasn't approved. After a day you can request it again, and the admin will review it."
      },
      revoked: {
        title: 'Access removed',
        text: 'Your access to CLAR has been removed. Your data is still saved. After a day you can request it again, and the admin will review it.'
      },
      blocked: {
        title: 'Account blocked',
        text: "This account can't use CLAR. If you think this is a mistake, contact us: we'll reply by email."
      },
      unknown: {
        title: "Couldn't check your access",
        text: 'You need an internet connection to check whether your account has access.'
      }
    },
    downloadFailed: "Couldn't download your data. Try again.",
    deleteFailed: "Couldn't delete your account. Try again.",
    requestFailed: "Couldn't send the request. Try again.",
    signedInAs: (email) => `Signed in as ${email}`,
    messageLabel: 'Message for the admin (optional)',
    messagePlaceholder: 'For example, who you are or what you want to use the app for',
    sending: 'Sending…',
    request: 'Request access',
    requestAgain: 'Request access again',
    retry: 'Retry',
    yourData: 'Your data',
    dataHelp: "Even without access, you can download or delete the data you've saved.",
    preparing: 'Preparing download…',
    download: 'Download my data',
    delete: 'Delete my account and my data',
    privacy:
      'To manage your access, we store your name, your email, your profile photo (if you sign in with Google) and your message on Google Cloud servers in the European Union (Belgium).',
    contact: 'Any questions or problems? Contact us',
    signOut: 'Sign out'
  }
);

const ICONS = {
  none: Send,
  pending: Clock,
  rejected: ShieldAlert,
  revoked: ShieldAlert,
  blocked: Ban,
  unknown: WifiOff
};

// Pantalla para las cuentas sin acceso aprobado: solicitud con mensaje opcional y estado de la solicitud
export const AccessRequestScreen: React.FC<AccessRequestScreenProps> = ({
  status,
  email,
  onRequest,
  onRetry,
  onSignOut,
  onContact,
  onDownloadData,
  onDeleteAccount,
  reauthMethods
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [dataBusy, setDataBusy] = useState<'download' | 'delete' | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sin acceso aprobado la cuenta sigue pudiendo llevarse o eliminar sus datos (p. ej. tras una retirada)
  const runDataAction = async (kind: 'download' | 'delete', action: () => Promise<void>) => {
    setDataBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      console.error(`Account ${kind} failed:`, err);
      setError(describeAuthError(err, kind === 'download' ? m.downloadFailed : m.deleteFailed));
    } finally {
      setDataBusy(null);
    }
  };
  const canRequest = status === 'none' || status === 'rejected' || status === 'revoked';
  const Icon = ICONS[status];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      await onRequest(message.trim());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : m.requestFailed);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AccessibleScreen>
      {(openAccessibility) => (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 antialiased">
          <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            {/* El idioma, también antes de tener acceso (la solicitud y su email van en él) */}
            <div className="flex justify-end">
              <LanguageSelector />
            </div>
            <div className="flex items-center gap-3">
              <BrandMark size={44} />
              <div>
                <p className="text-xl font-bold tracking-[0.2em] text-slate-900">{BRAND_NAME}</p>
                <p className="text-xs text-slate-600">{m.signedInAs(email)}</p>
              </div>
            </div>

            <div aria-live="polite" className="space-y-2">
              <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Icon className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                {m.copy[status].title}
              </h1>
              <p className="text-sm leading-relaxed text-slate-700">{m.copy[status].text}</p>
            </div>

            {canRequest && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="access-message" className="text-xs font-semibold text-slate-700">
                      {m.messageLabel}
                    </label>
                    <span className="font-mono text-[10px] text-slate-500" aria-hidden="true">
                      {message.length}/{ACCESS_MESSAGE_MAX_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="access-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={ACCESS_MESSAGE_MAX_LENGTH}
                    rows={3}
                    placeholder={m.messagePlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {isSending ? m.sending : status === 'none' ? m.request : m.requestAgain}
                </button>
              </form>
            )}

            {status === 'unknown' && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                {m.retry}
              </button>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </p>
            )}

            {status !== 'unknown' && (
              <section aria-labelledby="access-data-title" className="space-y-2 border-t border-slate-100 pt-3">
                <h2 id="access-data-title" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                  {m.yourData}
                </h2>
                <p className="text-[11px] leading-relaxed text-slate-600">{m.dataHelp}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={dataBusy !== null}
                    onClick={() => runDataAction('download', onDownloadData)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {dataBusy === 'download' ? m.preparing : m.download}
                  </button>
                  <button
                    type="button"
                    disabled={dataBusy !== null}
                    ref={deleteButtonRef}
                    onClick={() => setIsDeleting(true)}
                    aria-expanded={isDeleting}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {m.delete}
                  </button>
                </div>
                {isDeleting && (
                  <DeleteAccountPanel
                    methods={reauthMethods}
                    busy={dataBusy === 'delete'}
                    onConfirm={(password) => runDataAction('delete', () => onDeleteAccount(password))}
                    onCancel={() => {
                      setIsDeleting(false);
                      requestAnimationFrame(() => deleteButtonRef.current?.focus());
                    }}
                  />
                )}
              </section>
            )}

            <p className="text-[11px] leading-relaxed text-slate-600">{m.privacy}</p>

            <button
              type="button"
              onClick={onContact}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {m.contact}
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {m.signOut}
            </button>

            <div className="space-y-2 text-center">
              <AccessibilityTrigger onClick={openAccessibility} />
              <LegalLinks />
            </div>
          </div>
        </main>
      )}
    </AccessibleScreen>
  );
};
