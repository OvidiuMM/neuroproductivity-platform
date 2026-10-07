import React, { useState } from 'react';
import { UserProfile } from '../types';
import { User, UserPlus, Check, X, Shield, Mail, Briefcase, Sparkles } from 'lucide-react';

interface UserSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  activeUser: UserProfile;
  onSelectUser: (userId: string) => void;
  onCreateUser: (newUser: Omit<UserProfile, 'id' | 'createdAt' | 'initials' | 'color'>) => void;
}

export const UserSwitcher: React.FC<UserSwitcherProps> = ({
  isOpen,
  onClose,
  users,
  activeUser,
  onSelectUser,
  onCreateUser
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Profesional / Investigador');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { name?: string; email?: string } = {};

    if (!newName.trim()) errs.name = 'El nombre es obligatorio.';
    if (!newEmail.trim() || !newEmail.includes('@')) errs.email = 'Introduce un email válido.';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onCreateUser({
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole.trim()
    });

    setNewName('');
    setNewEmail('');
    setNewRole('Profesional / Investigador');
    setIsCreating(false);
    setErrors({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <span>Espacios de Usuario Aislados</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identificación y segregación total de datos por UUID
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          
          {/* Explicación de aislamiento */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Segregación Estricta Multi-Cuenta:
            </span>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              Cada perfil opera en su propio espacio aislado en la base de datos (clave foránea <code>user_id UUID</code>). Las listas operativas, el histórico de la Rueda de la Vida y las reuniones están completamente encapsulados.
            </p>
          </div>

          {/* LISTA DE USUARIOS EXISTENTES */}
          {!isCreating ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Seleccionar Cuenta Activa ({users.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Crear Nuevo Usuario</span>
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {users.map((u) => {
                  const isCurrent = u.id === activeUser.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        onSelectUser(u.id);
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs ${
                            u.color === 'emerald'
                              ? 'bg-emerald-600'
                              : u.color === 'amber'
                              ? 'bg-amber-600'
                              : 'bg-indigo-600'
                          }`}
                        >
                          {u.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{u.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                                Activo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>{u.role}</span>
                            <span>·</span>
                            <span className="font-mono text-slate-400">{u.email}</span>
                          </div>
                        </div>
                      </div>

                      {isCurrent && (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* FORMULARIO DE NUEVO USUARIO */
            <form onSubmit={handleCreateSubmit} className="space-y-3.5 animate-in fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Nuevo Perfil de Usuario
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Volver a la lista
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ej. Dra. Carmen Mendoza"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="carmen.mendoza@organizacion.org"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Rol / Especialidad
                </label>
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="ej. Neurólogo / Investigador"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
                >
                  Crear y Activar Espacio
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>ID de Sesión: <code className="font-mono text-slate-700">{activeUser.id}</code></span>
          <button
            onClick={onClose}
            className="font-semibold text-slate-700 hover:text-slate-900"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
