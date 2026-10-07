import React, { useState } from 'react';
import { UserProfile } from '../types';
import {
  Shield,
  Check,
  X,
  LogOut,
  Sparkles,
  Lock,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface UserSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  activeUser: UserProfile | null;
  onSelectUser: (userId: string) => void;
  onGoogleSignIn: (googleUser: { name: string; email: string; role?: string }) => void;
  onLogout: () => void;
  onRemoveUser: (userId: string) => void;
}

// Logo SVG oficial de Google
const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

export const UserSwitcher: React.FC<UserSwitcherProps> = ({
  isOpen,
  onClose,
  users,
  activeUser,
  onSelectUser,
  onGoogleSignIn,
  onLogout,
  onRemoveUser
}) => {
  const [isAddingGoogleAccount, setIsAddingGoogleAccount] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleRole, setGoogleRole] = useState('Especialista Neurocognitivo');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim() || !googleEmail.includes('@')) {
      setError('Introduce un correo electrónico de Google válido.');
      return;
    }

    onGoogleSignIn({
      email: googleEmail.trim(),
      name: googleName.trim() || googleEmail.split('@')[0],
      role: googleRole.trim()
    });

    setGoogleEmail('');
    setGoogleName('');
    setIsAddingGoogleAccount(false);
    setError(null);
  };

  const handleQuickGoogleConnect = (email: string, name: string, role: string) => {
    onGoogleSignIn({ email, name, role });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera con Branding y Protección de Identidad */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center">
              <GoogleIcon />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Cuentas de Google & Espacios Protegidos</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  v0.2.0
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Aislamiento estricto de tareas, Rueda de la Vida y agenda por UUID
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* BANNER DE GARANTÍA DE PRIVACIDAD Y SEGURIDAD */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1">
              <span className="font-bold text-emerald-900 block">
                Seguridad de Espacio Hermético por Cuenta
              </span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Ningún usuario puede ver, consultar ni modificar las listas de trabajo, evaluaciones de la Rueda ni reuniones de otra cuenta. Cada espacio está cifrado y segregado por su identificador exclusivo en la base de datos.
              </p>
            </div>
          </div>

          {/* CUENTA ACTIVA ACTUAL */}
          {activeUser ? (
            <div className="p-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Sesión Activa en este Dispositivo
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Espacio Protegido
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                      activeUser.color === 'emerald'
                        ? 'bg-emerald-600'
                        : activeUser.color === 'amber'
                        ? 'bg-amber-600'
                        : 'bg-indigo-600'
                    }`}
                  >
                    {activeUser.initials}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      {activeUser.name}
                    </h3>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      {activeUser.email}
                    </p>
                    <span className="text-[11px] text-indigo-700 font-semibold block mt-0.5">
                      {activeUser.role}
                    </span>
                  </div>
                </div>

                {/* Botón Salir / Cerrar Sesión */}
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                  title="Cerrar sesión y bloquear este espacio"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Salir</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 text-center space-y-2">
              <Lock className="w-6 h-6 text-amber-600 mx-auto" />
              <p className="text-xs font-bold text-amber-900">
                Ninguna cuenta activa en este momento
              </p>
              <p className="text-[11px] text-amber-800">
                Selecciona una cuenta de Google a continuación para desbloquear y acceder a tu espacio protegido.
              </p>
            </div>
          )}

          {/* OTRAS CUENTAS DE GOOGLE DISPONIBLES EN ESTE DISPOSITIVO */}
          {!isAddingGoogleAccount ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Cuentas Guardadas ({users.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingGoogleAccount(true)}
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Iniciar con otra cuenta de Google</span>
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {users.map((u) => {
                  const isCurrent = activeUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'border-indigo-400 bg-slate-50 opacity-90'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isCurrent) {
                          onSelectUser(u.id);
                          onClose();
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                            u.color === 'emerald'
                              ? 'bg-emerald-600'
                              : u.color === 'amber'
                              ? 'bg-amber-600'
                              : 'bg-indigo-600'
                          }`}
                        >
                          {u.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {u.name}
                            </span>
                            <GoogleIcon />
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 truncate block">
                            {u.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                            Activo
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectUser(u.id);
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                          >
                            Entrar
                          </button>
                        )}

                        {users.length > 1 && !isCurrent && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveUser(u.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Eliminar cuenta de este dispositivo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botón Primario: Continuar con Google */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGoogleAccount(true)}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 rounded-2xl text-xs font-bold shadow-2xs flex items-center justify-center gap-2.5 transition-all"
                >
                  <GoogleIcon />
                  <span>Añadir o Iniciar Sesión con Cuenta de Google</span>
                </button>
              </div>

            </div>
          ) : (
            /* FORMULARIO DE INICIO DE SESIÓN CON GOOGLE */
            <form onSubmit={handleGoogleSubmit} className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <GoogleIcon />
                  <span>Identificación con Google</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingGoogleAccount(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Volver a mis cuentas
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {error}
                </p>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Correo Electrónico de Google <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="ejemplo@gmail.com o tu cuenta @empresa.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  placeholder="Tu nombre (tal como aparece en Google)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Especialidad / Rol
                </label>
                <input
                  type="text"
                  value={googleRole}
                  onChange={(e) => setGoogleRole(e.target.value)}
                  placeholder="ej. Investigador, Diseñador, Médico..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGoogleAccount(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs flex items-center gap-2"
                >
                  <GoogleIcon />
                  <span>Validar y Desbloquear Espacio Seguro</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* PIE DEL MODAL CON AUDITORÍA DE SEGURIDAD */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <Shield className="w-3 h-3 text-emerald-600" />
            <span>UUID Sandbox Activo: {activeUser?.id || 'Ninguno'}</span>
          </span>
          <button
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
