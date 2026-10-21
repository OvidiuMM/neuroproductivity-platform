import React, { useState } from 'react';
import { ShieldCheck, Compass, Briefcase, Cloud, Target, CalendarDays, Mic, WifiOff } from 'lucide-react';
import { BRAND_NAME, BRAND_TAGLINE, BrandMark } from './BrandMark';
import { AccessibilityTrigger, AccessibleScreen } from './AccessibilityPanel';
import { EmailAuthForm, type EmailAuthMode } from './EmailAuthForm';
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

// Lo que hace CLAR, en la página de presentación (los textos los aprobó la persona responsable; las funciones extra
// no se anuncian)
const FEATURES: { icon: React.ReactNode; title: string; text: string }[] = [
  {
    icon: <Compass className="h-5 w-5 text-indigo-600" aria-hidden="true" />,
    title: 'Rueda de la Vida',
    text: 'Valora de 1 a 10 cada área de tu vida y mira cómo cambia con el tiempo.'
  },
  {
    icon: <Target className="h-5 w-5 text-indigo-600" aria-hidden="true" />,
    title: 'Metas y proyectos',
    text: 'Convierte cada meta en tareas concretas y, si te ayuda, agrúpalas en proyectos.'
  },
  {
    icon: <Briefcase className="h-5 w-5 text-indigo-600" aria-hidden="true" />,
    title: 'Tu Top 10',
    text: 'Dos listas, profesional y personal. Las 10 primeras son tu foco; lo demás espera.'
  },
  {
    icon: <CalendarDays className="h-5 w-5 text-indigo-600" aria-hidden="true" />,
    title: 'Agenda y alarmas',
    text: 'Fechas, repeticiones y alarmas que te avisan aunque CLAR esté cerrada. Lo de hoy, a la vista.'
  },
  {
    icon: <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />,
    title: 'Tiempo protegido',
    text: 'Reuniones con orden del día y correos pensados antes de escribirlos.'
  },
  {
    icon: <Mic className="h-5 w-5 text-indigo-600" aria-hidden="true" />,
    title: 'Dicta tus tareas',
    text: 'Pulsa el micrófono y dilo, o mantén pulsado el icono de la app: «Nueva tarea por voz».'
  },
  {
    icon: <WifiOff className="h-5 w-5 text-indigo-600" aria-hidden="true" />,
    title: 'También sin conexión',
    text: 'Funciona sin conexión y se sincroniza entre tus dispositivos al volver.'
  }
];

export const REPOSITORY_URL = 'https://github.com/OvidiuMM/neuroproductivity-platform';

// PÁGINA DE PRESENTACIÓN: qué es CLAR y, al lado (debajo en el móvil), cómo entrar o crear una cuenta
export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSignIn,
  onEmailSignIn,
  onEmailSignUp,
  onPasswordReset,
  isSigningIn,
  error,
  version
}) => {
  // «Crear cuenta gratis» abre el formulario en «Crear una cuenta»; «Ya tengo cuenta», en «Entrar» (se vuelve a montar)
  const [emailMode, setEmailMode] = useState<{ mode: EmailAuthMode; key: number }>({ mode: 'signin', key: 0 });
  const goToForm = (mode: EmailAuthMode) => {
    setEmailMode((current) => ({ mode, key: current.key + 1 }));
    requestAnimationFrame(() => {
      const target = document.getElementById(mode === 'signup' ? 'email-auth' : 'entrar');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
    });
  };
  return (
    <AccessibleScreen>
      {(openAccessibility) => (
        <div className="min-h-screen bg-slate-50 antialiased">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_28rem] lg:items-start lg:gap-12 lg:py-14">
            {/* Qué es CLAR */}
            <section aria-labelledby="landing-title" className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <BrandMark size={56} />
                  <h1 id="landing-title" className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <span className="tracking-[0.2em]">{BRAND_NAME}</span>
                    <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                      v{version}
                    </span>
                  </h1>
                </div>
                <p className="text-xl font-semibold text-slate-800 sm:text-2xl">{BRAND_TAGLINE}</p>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Una app gratuita para pasar de tus metas a la siguiente acción concreta, sin perderte en listas
                  infinitas.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => goToForm('signup')}
                    className="min-h-11 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                  >
                    Crear cuenta gratis
                  </button>
                  <button
                    type="button"
                    onClick={() => goToForm('signin')}
                    className="min-h-11 rounded-2xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 hover:bg-slate-50"
                  >
                    Ya tengo cuenta
                  </button>
                </div>
              </div>

              <ul aria-label="Qué hace CLAR" className="grid gap-3 sm:grid-cols-2">
                {FEATURES.map((feature) => (
                  <li
                    key={feature.title}
                    className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
                  >
                    <span className="mt-0.5 shrink-0">{feature.icon}</span>
                    <div className="space-y-1">
                      <h2 className="text-sm font-bold text-slate-900">{feature.title}</h2>
                      <p className="text-xs leading-relaxed text-slate-600">{feature.text}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Cloud className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  Tus datos
                </h2>
                <p>
                  Se guardan en la Unión Europea y solo tú los ves. Puedes descargarlos o borrarlos cuando quieras. Sin
                  anuncios ni analítica.
                </p>
                <p>Instálala en el móvil desde el navegador: «Añadir a la pantalla de inicio».</p>
                <p>
                  Código abierto (licencia MIT):{' '}
                  <a
                    href={REPOSITORY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                  >
                    el código en GitHub
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                  .
                </p>
              </div>
            </section>

            {/* Entrar o crear una cuenta */}
            <div
              id="entrar"
              className="w-full space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl lg:sticky lg:top-8"
            >
              <h2 className="text-lg font-bold text-slate-900">Entra en CLAR</h2>
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
              <div id="email-auth">
                <EmailAuthForm
                  key={emailMode.key}
                  initialMode={emailMode.mode}
                  onSignIn={onEmailSignIn}
                  onSignUp={onEmailSignUp}
                  onReset={onPasswordReset}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Al continuar, con Google o con tu email, confirmas que tienes al menos {MIN_AGE} años (o la edad mínima
                legal para dar tu consentimiento en tu país de residencia, si es mayor) y aceptas las{' '}
                <LegalLink to="terms">condiciones de uso</LegalLink>. Cómo tratamos tus datos:{' '}
                <LegalLink to="privacy">política de privacidad</LegalLink>.
              </p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Si entras con email y contraseña, primero confirmarás tu email. Tus tareas, metas, proyectos,
                evaluaciones, agenda y correos se guardan en tu cuenta, en servidores de Google Cloud en la Unión
                Europea (Bélgica).
              </p>
            </div>
          </div>

          <footer className="space-y-2 border-t border-slate-200 bg-white px-4 py-6 text-center">
            <AccessibilityTrigger onClick={openAccessibility} />
            <LegalLinks />
          </footer>
        </div>
      )}
    </AccessibleScreen>
  );
};
