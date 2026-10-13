import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteAccountPanelProps {
  // Cuentas con contraseña: se pide para confirmar; las de Google confirman en la ventana de Google
  needsPassword: boolean;
  busy: boolean;
  onConfirm: (password?: string) => void;
  onCancel: () => void;
}

// Confirmación para eliminar la cuenta y todos sus datos (sustituye al window.confirm del navegador)
export const DeleteAccountPanel: React.FC<DeleteAccountPanelProps> = ({ needsPassword, busy, onConfirm, onCancel }) => {
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(needsPassword ? password : undefined);
      }}
      aria-labelledby="delete-account-title"
      className="p-4 rounded-2xl border border-red-200 bg-red-50/60 space-y-3"
    >
      <h3 id="delete-account-title" className="text-sm font-bold text-red-800">
        Eliminar tu cuenta
      </h3>
      <p className="text-xs text-red-900 leading-relaxed">
        Se eliminarán tu cuenta y todos tus datos (tareas, evaluaciones, reuniones y correos). No se puede deshacer.
        {needsPassword ? ' Escribe tu contraseña para confirmarlo.' : ' Para confirmarlo, Google te pedirá que vuelvas a entrar.'}
      </p>
      {needsPassword && (
        <div className="space-y-1">
          <label htmlFor="delete-account-password" className="block text-xs font-semibold text-red-900">
            Contraseña
          </label>
          <input
            id="delete-account-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-red-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};
