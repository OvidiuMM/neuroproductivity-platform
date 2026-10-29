import React, { useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { describeAuthError, MIN_PASSWORD_LENGTH } from '../services/auth';
import { MIN_AGE } from '../services/legal';
import { LegalLink } from './LegalLinks';
import { messages } from '../i18n/locale';

export type EmailAuthMode = 'signin' | 'signup' | 'reset';
type Mode = EmailAuthMode;

interface EmailAuthFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (account: { name: string; email: string; password: string }) => Promise<void>;
  onReset: (email: string) => Promise<void>;
  // Con qué empieza (la página de presentación abre «Crear una cuenta» desde su botón)
  initialMode?: Mode;
}

const m = messages<{
  titles: Record<Mode, string>;
  submit: Record<Mode, [string, string]>;
  shortPassword: string;
  mustAccept: string;
  resetSent: string;
  failed: string;
  name: string;
  email: string;
  password: string;
  hidePassword: string;
  showPassword: string;
  passwordHint: string;
  accept: string;
  readTerms: string;
  forgot: string;
  signUp: string;
  haveAccount: string;
  backToSignIn: string;
}>(
  {
    titles: { signin: 'Entrar con tu email', signup: 'Crear una cuenta', reset: 'Recuperar la contraseña' },
    submit: {
      signin: ['Entrar', 'Entrando…'],
      signup: ['Crear cuenta', 'Creando la cuenta…'],
      reset: ['Enviar el enlace', 'Enviando…']
    },
    shortPassword: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    mustAccept: `Para crear la cuenta, confirma que tienes ${MIN_AGE} años o más y acepta las condiciones de uso.`,
    resetSent:
      'Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Revisa también el correo no deseado.',
    failed: 'No se pudo completar. Inténtalo de nuevo.',
    name: 'Nombre (opcional)',
    email: 'Email',
    password: 'Contraseña',
    hidePassword: 'Ocultar la contraseña',
    showPassword: 'Mostrar la contraseña',
    passwordHint: `Al menos ${MIN_PASSWORD_LENGTH} caracteres. Te enviaremos un email para confirmar tu dirección.`,
    accept: `Tengo ${MIN_AGE} años o más (o la edad mínima legal en mi país, si es mayor) y acepto las condiciones de uso`,
    readTerms: 'Leer las condiciones',
    forgot: '¿Olvidaste tu contraseña?',
    signUp: 'Crear una cuenta',
    haveAccount: 'Ya tengo cuenta: entrar',
    backToSignIn: 'Volver a entrar'
  },
  {
    titles: { signin: 'Sign in with your email', signup: 'Create an account', reset: 'Reset your password' },
    submit: {
      signin: ['Sign in', 'Signing in…'],
      signup: ['Create account', 'Creating your account…'],
      reset: ['Send the link', 'Sending…']
    },
    shortPassword: `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    mustAccept: `To create your account, confirm that you are ${MIN_AGE} or older and accept the terms of use.`,
    resetSent:
      "If there's an account with that email, we've sent you a link to create a new password. Check your spam folder too.",
    failed: "Couldn't complete it. Try again.",
    name: 'Name (optional)',
    email: 'Email',
    password: 'Password',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    passwordHint: `At least ${MIN_PASSWORD_LENGTH} characters. We'll send you an email to confirm your address.`,
    accept: `I am ${MIN_AGE} or older (or the minimum legal age in my country, if higher) and I accept the terms of use`,
    readTerms: 'Read the terms',
    forgot: 'Forgot your password?',
    signUp: 'Create an account',
    haveAccount: 'I already have an account: sign in',
    backToSignIn: 'Back to sign in'
  }
);

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
      setError(m.shortPassword);
      return;
    }
    if (mode === 'signup' && !accepted) {
      setError(m.mustAccept);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await onSignIn(email, password);
      else if (mode === 'signup') await onSignUp({ name, email, password });
      else {
        await onReset(email);
        setInfo(m.resetSent);
      }
    } catch (err) {
      setError(describeAuthError(err, m.failed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-labelledby="email-auth-title" className="space-y-3">
      <h3 id="email-auth-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Mail className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        {m.titles[mode]}
      </h3>

      {mode === 'signup' && (
        <div className="space-y-1">
          <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700">
            {m.name}
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
          {m.email}
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
            {m.password}
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
              aria-label={showPassword ? m.hidePassword : m.showPassword}
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
              {m.passwordHint}
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
          <label htmlFor="auth-accept">{m.accept}</label>
          <LegalLink to="terms" newTab>
            {m.readTerms}
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
        {busy ? m.submit[mode][1] : m.submit[mode][0]}
      </button>

      <div className="flex flex-wrap justify-between gap-2">
        {mode === 'signin' ? (
          <>
            <button type="button" onClick={() => switchTo('reset')} className={linkClass}>
              {m.forgot}
            </button>
            <button type="button" onClick={() => switchTo('signup')} className={linkClass}>
              {m.signUp}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchTo('signin')} className={linkClass}>
            {mode === 'signup' ? m.haveAccount : m.backToSignIn}
          </button>
        )}
      </div>
    </form>
  );
};
