import React, { useState } from 'react';
import { LogOut, MailCheck, RefreshCw, Send } from 'lucide-react';
import type { User } from 'firebase/auth';
import { describeAuthError, refreshVerification, resendVerification } from '../services/auth';
import { AccessibilityTrigger, AccessibleScreen } from './AccessibilityPanel';
import { BRAND_NAME, BrandMark } from './BrandMark';

interface EmailVerificationScreenProps {
  user: User;
  onVerified: () => void;
  onSignOut: () => void;
}

// Cuentas con email y contraseña: hay que confirmar el email antes de solicitar acceso
export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ user, onVerified, onSignOut }) => {
  const [busy, setBusy] = useState<'check' | 'resend' | null>(null);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const run = async (kind: 'check' | 'resend') => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'check') {
        if (await refreshVerification(user)) onVerified();
        else
          setMessage({
            kind: 'error',
            text: 'Tu email aún no consta como confirmado. Abre el enlace del correo y vuelve a intentarlo.'
          });
      } else {
        await resendVerification(user);
        setMessage({ kind: 'info', text: `Te hemos enviado otro enlace a ${user.email}.` });
      }
    } catch (e) {
      setMessage({ kind: 'error', text: describeAuthError(e, 'No se pudo completar. Inténtalo de nuevo.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AccessibleScreen>
      {(openAccessibility) => (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 antialiased">
          <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex items-center gap-3">
              <BrandMark size={44} />
              <div>
                <p className="text-xl font-bold tracking-[0.2em] text-slate-900">{BRAND_NAME}</p>
                <p className="text-xs text-slate-600">Has entrado como {user.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <MailCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                Confirma tu email
              </h1>
              <p className="text-sm leading-relaxed text-slate-700">
                Te hemos enviado un enlace a <strong>{user.email}</strong>. Ábrelo para confirmar tu dirección y después
                pulsa «Ya lo he confirmado». Revisa también el correo no deseado.
              </p>
            </div>

            <div aria-live="polite">
              {message && (
                <p
                  role={message.kind === 'error' ? 'alert' : undefined}
                  className={`rounded-xl border p-3 text-xs ${
                    message.kind === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {message.text}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run('check')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {busy === 'check' ? 'Comprobando…' : 'Ya lo he confirmado'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run('resend')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {busy === 'resend' ? 'Enviando…' : 'Reenviar el email'}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>

            <div className="text-center">
              <AccessibilityTrigger onClick={openAccessibility} />
            </div>
          </div>
        </main>
      )}
    </AccessibleScreen>
  );
};
