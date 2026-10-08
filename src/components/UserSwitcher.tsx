import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, Plus, Trash2, UserCheck, Users, Info } from 'lucide-react';

interface UserSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  activeUser: UserProfile | null;
  onSelectUser: (userId: string) => void;
  onCreateProfile: (profile: { name: string; role: string }) => void;
  onRemoveUser: (userId: string) => void;
}

const avatarColor = (color: string) =>
  color === 'emerald' ? 'bg-emerald-600' : color === 'amber' ? 'bg-amber-600' : 'bg-indigo-600';

export const UserSwitcher: React.FC<UserSwitcherProps> = ({
  isOpen,
  onClose,
  users,
  activeUser,
  onSelectUser,
  onCreateProfile,
  onRemoveUser
}) => {
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setError('Escribe un nombre para el perfil.');
      return;
    }

    onCreateProfile({ name: profileName.trim(), role: profileRole.trim() });

    setProfileName('');
    setProfileRole('');
    setIsCreatingProfile(false);
    setError(null);
    onClose();
  };

  const handleRemove = (user: UserProfile) => {
    if (window.confirm(`¿Eliminar el perfil «${user.name}» y todos sus datos de este navegador? No se puede deshacer.`)) {
      onRemoveUser(user.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Cabecera */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Perfiles en este navegador</h2>
              <p className="text-[11px] text-slate-500">
                Cada perfil tiene sus propias tareas, Rueda de la Vida y agenda
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* AVISO SOBRE DÓNDE SE GUARDAN LOS DATOS */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Los datos se guardan solo en este navegador. No hay inicio de sesión ni sincronización entre dispositivos: cualquiera que use este navegador puede abrir estos perfiles. Si borras los datos del navegador, se pierden.
            </p>
          </div>

          {/* PERFIL ACTIVO */}
          {activeUser && (
            <div className="p-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Perfil activo
              </span>

              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${avatarColor(activeUser.color)}`}
                >
                  {activeUser.initials}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">{activeUser.name}</h3>
                  {activeUser.role && (
                    <span className="text-[11px] text-indigo-700 font-semibold block mt-0.5">{activeUser.role}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PERFILES GUARDADOS */}
          {!isCreatingProfile ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Perfiles guardados ({users.length})
                </span>
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
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${avatarColor(u.color)}`}
                        >
                          {u.initials}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate block">{u.name}</span>
                          {u.role && <span className="text-[11px] text-slate-500 truncate block">{u.role}</span>}
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
                            Abrir
                          </button>
                        )}

                        {users.length > 1 && !isCurrent && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(u);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Eliminar el perfil y sus datos de este navegador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(true)}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 rounded-2xl text-xs font-bold shadow-2xs flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Nuevo perfil</span>
                </button>
              </div>

            </div>
          ) : (
            /* FORMULARIO DE NUEVO PERFIL */
            <form onSubmit={handleCreateSubmit} className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Nuevo perfil</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Volver a los perfiles
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {error}
                </p>
              )}

              <div>
                <label htmlFor="profile-name" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="ej. Trabajo, Casa, Ana..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                />
              </div>

              <div>
                <label htmlFor="profile-role" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Descripción (opcional)
                </label>
                <input
                  id="profile-role"
                  type="text"
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                  placeholder="ej. Investigadora, Diseñador, Estudiante..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
                >
                  Crear perfil
                </button>
              </div>
            </form>
          )}

        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end text-[11px] text-slate-500">
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
