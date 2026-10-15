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
      className="space-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4"
    >
      <h3 id="delete-account-title" className="text-sm font-bold text-red-800">
        Eliminar tu cuenta
      </h3>
      <p className="text-xs leading-relaxed text-red-900">
        Se eliminarán tu cuenta y todos tus datos (tareas, metas, evaluaciones, reuniones, correos y tus mensajes de
        «Escríbenos»). No se puede deshacer.
        {needsPassword
          ? ' Escribe tu contraseña para confirmarlo.'
          : ' Para confirmarlo, Google te pedirá que vuelvas a entrar.'}
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
            className="w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};
