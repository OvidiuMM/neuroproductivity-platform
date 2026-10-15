import React from 'react';
import { ShieldCheck, Compass, Briefcase, Cloud } from 'lucide-react';
import { BRAND_NAME, BRAND_TAGLINE, BrandMark } from './BrandMark';
import { AccessibilityTrigger, AccessibleScreen } from './AccessibilityPanel';
import { EmailAuthForm } from './EmailAuthForm';
import { LegalLink, LegalLinks } from './LegalLinks';
import { MIN_AGE } from '../services/legal';

interface LoginScreenProps {
  onSignIn: () => void;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (account: { name: string; email: string; password: string }) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  isSigningIn: boolean;
  error: string | null;
  version: string;
}

// Logo de Google para el botón de inicio de sesión (inicio de sesión real con Firebase Auth)
const GoogleIcon = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSignIn,
  onEmailSignIn,
  onEmailSignUp,
  onPasswordReset,
  isSigningIn,
  error,
  version
}) => (
  <AccessibleScreen>
    {(openAccessibility) => (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 antialiased">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <span className="tracking-[0.2em]">{BRAND_NAME}</span>
                <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                  v{version}
                </span>
              </h1>
              <p className="text-xs text-slate-600">{BRAND_TAGLINE}</p>
            </div>
          </div>

          <ul className="space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <Compass className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              Evalúa tu Rueda de la Vida y mide tu progreso.
            </li>
            <li className="flex items-start gap-2.5">
              <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              Convierte tus metas en acciones concretas, separadas en lista profesional y personal.
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              Protege tus mañanas de reuniones e interrupciones.
            </li>
          </ul>

          <button
            type="button"
            onClick={onSignIn}
            disabled={isSigningIn}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-60"
          >
            <GoogleIcon />
            <span>{isSigningIn ? 'Abriendo Google…' : 'Continuar con Google'}</span>
          </button>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-600" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />o con tu email
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <EmailAuthForm onSignIn={onEmailSignIn} onSignUp={onEmailSignUp} onReset={onPasswordReset} />

          <p className="text-[11px] leading-relaxed text-slate-600">
            Al continuar, con Google o con tu email, confirmas que tienes al menos {MIN_AGE} años y aceptas las{' '}
            <LegalLink to="terms">condiciones de uso</LegalLink>. Cómo tratamos tus datos:{' '}
            <LegalLink to="privacy">política de privacidad</LegalLink>.
          </p>

          <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-[11px] leading-relaxed text-slate-600">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>
              Si el acceso se aprueba cuenta a cuenta, al entrar por primera vez podrás solicitarlo (con email y
              contraseña, después de confirmar tu email). Tus tareas, metas, proyectos, evaluaciones, agenda y correos
              se guardan en tu cuenta, en servidores de Google Cloud en la Unión Europea (Bélgica). Solo tú puedes
              acceder a ellos, y puedes descargarlos o eliminarlos cuando quieras desde el menú de tu cuenta.
            </p>
          </div>

          <div className="space-y-2 text-center">
            <AccessibilityTrigger onClick={openAccessibility} />
            <LegalLinks />
          </div>
        </div>
      </div>
    )}
  </AccessibleScreen>
);
