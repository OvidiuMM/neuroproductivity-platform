import React, { useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { describeAuthError, MIN_PASSWORD_LENGTH } from '../services/auth';
import { MIN_AGE } from '../services/legal';
import { LegalLink } from './LegalLinks';

export type EmailAuthMode = 'signin' | 'signup' | 'reset';
type Mode = EmailAuthMode;

interface EmailAuthFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (account: { name: string; email: string; password: string }) => Promise<void>;
  onReset: (email: string) => Promise<void>;
  // Con qué empieza (la página de presentación abre «Crear una cuenta» desde su botón)
  initialMode?: Mode;
}

const TITLES: Record<Mode, string> = {
  signin: 'Entrar con tu email',
  signup: 'Crear una cuenta',
  reset: 'Recuperar la contraseña'
};

const SUBMIT: Record<Mode, [string, string]> = {
  signin: ['Entrar', 'Entrando…'],
  signup: ['Crear cuenta', 'Creando la cuenta…'],
  reset: ['Enviar el enlace', 'Enviando…']
};

const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
const linkClass = 'text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline';

// Acceso con email y contraseña: entrar, crear cuenta (con verificación del email) y recuperar la contraseña
export const EmailAuthForm: React.FC<EmailAuthFormProps> = ({
  onSignIn,
  onSignUp,
  onReset,
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Al crear la cuenta se confirma la edad y se aceptan las condiciones (con el registro abierto no hay quien lo revise)
  const [accepted, setAccepted] = useState(false);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (mode === 'signup' && !accepted) {
      setError(`Para crear la cuenta, confirma que tienes ${MIN_AGE} años o más y acepta las condiciones de uso.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await onSignIn(email, password);
      else if (mode === 'signup') await onSignUp({ name, email, password });
      else {
        await onReset(email);
        setInfo(
          'Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Revisa también el correo no deseado.'
        );
      }
    } catch (err) {
      setError(describeAuthError(err, 'No se pudo completar. Inténtalo de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-labelledby="email-auth-title" className="space-y-3">
      <h3 id="email-auth-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Mail className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        {TITLES[mode]}
      </h3>

      {mode === 'signup' && (
        <div className="space-y-1">
          <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700">
            Nombre (opcional)
          </label>
          <input
            id="auth-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      {mode !== 'reset' && (
        <div className="space-y-1">
          <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              aria-label={showPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {mode === 'signup' && (
            <p id="auth-password-hint" className="text-[11px] text-slate-600">
              Al menos {MIN_PASSWORD_LENGTH} caracteres. Te enviaremos un email para confirmar tu dirección.
            </p>
          )}
        </div>
      )}

      {mode === 'signup' && (
        <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
          <input
            id="auth-accept"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            aria-invalid={Boolean(error) && !accepted}
            aria-describedby={error && !accepted ? 'auth-error' : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          <label htmlFor="auth-accept">
            Tengo {MIN_AGE} años o más (o la edad mínima legal en mi país, si es mayor) y acepto las condiciones de uso
          </label>
          <LegalLink to="terms" newTab>
            Leer las condiciones
          </LegalLink>
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <p
            id="auth-error"
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{info}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? SUBMIT[mode][1] : SUBMIT[mode][0]}
      </button>

      <div className="flex flex-wrap justify-between gap-2">
        {mode === 'signin' ? (
          <>
            <button type="button" onClick={() => switchTo('reset')} className={linkClass}>
              ¿Olvidaste tu contraseña?
            </button>
            <button type="button" onClick={() => switchTo('signup')} className={linkClass}>
              Crear una cuenta
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchTo('signin')} className={linkClass}>
            {mode === 'signup' ? 'Ya tengo cuenta: entrar' : 'Volver a entrar'}
          </button>
        )}
      </div>
    </form>
  );
};
