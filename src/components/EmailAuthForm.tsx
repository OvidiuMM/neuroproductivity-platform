import React, { useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { describeAuthError, MIN_PASSWORD_LENGTH } from '../services/auth';

type Mode = 'signin' | 'signup' | 'reset';

interface EmailAuthFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (account: { name: string; email: string; password: string }) => Promise<void>;
  onReset: (email: string) => Promise<void>;
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
export const EmailAuthForm: React.FC<EmailAuthFormProps> = ({ onSignIn, onSignUp, onReset }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    setBusy(true);
    try {
      if (mode === 'signin') await onSignIn(email, password);
      else if (mode === 'signup') await onSignUp({ name, email, password });
      else {
        await onReset(email);
        setInfo('Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Revisa también el correo no deseado.');
      }
    } catch (err) {
      setError(describeAuthError(err, 'No se pudo completar. Inténtalo de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-labelledby="email-auth-title" className="space-y-3">
      <h2 id="email-auth-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Mail className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        {TITLES[mode]}
      </h2>

      {mode === 'signup' && (
        <div className="space-y-1">
          <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700">
            Nombre (opcional)
          </label>
          <input id="auth-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
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
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center"
            >
              {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
          {mode === 'signup' && (
            <p id="auth-password-hint" className="text-[11px] text-slate-600">
              Al menos {MIN_PASSWORD_LENGTH} caracteres. Te enviaremos un email para confirmar tu dirección.
            </p>
          )}
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </p>
        )}
        {info && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{info}</p>}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-2xl text-sm font-bold"
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
