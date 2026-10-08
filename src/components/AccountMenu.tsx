import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, LogOut, Download, Trash2, Cloud } from 'lucide-react';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSignOut: () => void;
  onExportData: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  isOpen,
  onClose,
  user,
  onSignOut,
  onExportData,
  onDeleteAccount
}) => {
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const run = async (kind: 'export' | 'delete', action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        'Se eliminarán tu cuenta y todos tus datos (tareas, evaluaciones, reuniones y correos). No se puede deshacer. ¿Continuar?'
      )
    ) {
      run('delete', onDeleteAccount);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-label="Tu cuenta"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <h2 className="text-sm font-bold text-slate-900">Tu cuenta</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" className="w-11 h-11 rounded-2xl object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                {user.initials}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{user.name}</h3>
              {user.email && <p className="text-xs text-slate-500 truncate">{user.email}</p>}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p>
              Tus datos se guardan en tu cuenta (Google Cloud, UE) y se sincronizan entre tus dispositivos. Sin conexión puedes seguir trabajando; los cambios se envían al recuperarla.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => run('export', onExportData)}
              disabled={busy !== null}
              className="w-full py-2.5 px-4 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              {busy === 'export' ? 'Preparando descarga…' : 'Descargar mis datos (JSON)'}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              disabled={busy !== null}
              className="w-full py-2.5 px-4 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== null}
              className="w-full py-2.5 px-4 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-60 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {busy === 'delete' ? 'Eliminando…' : 'Eliminar mi cuenta y todos mis datos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
