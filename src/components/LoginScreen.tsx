import React from 'react';
import { Brain, ShieldCheck, Compass, Briefcase, Cloud } from 'lucide-react';

interface LoginScreenProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  error: string | null;
  version: string;
}

// Logo de Google para el botón de inicio de sesión (inicio de sesión real con Firebase Auth)
const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSignIn, isSigningIn, error, version }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 antialiased">
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
          <Brain className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            NeuroProductividad
            <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
              v{version}
            </span>
          </h1>
          <p className="text-xs text-slate-500">Gestión del tiempo y neuroproductividad</p>
        </div>
      </div>

      <ul className="space-y-2.5 text-sm text-slate-700">
        <li className="flex items-start gap-2.5">
          <Compass className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          Evalúa tu Rueda de la Vida y mide tu progreso.
        </li>
        <li className="flex items-start gap-2.5">
          <Briefcase className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          Convierte tus metas en acciones concretas, separadas en lista profesional y personal.
        </li>
        <li className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          Protege tus mañanas de reuniones e interrupciones.
        </li>
      </ul>

      <button
        type="button"
        onClick={onSignIn}
        disabled={isSigningIn}
        className="w-full py-3 px-4 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 border-2 border-slate-200 rounded-2xl text-sm font-bold shadow-2xs flex items-center justify-center gap-2.5 transition-all"
      >
        <GoogleIcon />
        <span>{isSigningIn ? 'Abriendo Google…' : 'Continuar con Google'}</span>
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          {error}
        </p>
      )}

      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2.5">
        <Cloud className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          Tus tareas, evaluaciones y agenda se guardan en tu cuenta, en servidores de Google Cloud en la Unión Europea (Bélgica). Solo tú puedes acceder a ellos, y puedes descargarlos o eliminarlos cuando quieras desde el menú de tu cuenta.
        </p>
      </div>
    </div>
  </div>
);
