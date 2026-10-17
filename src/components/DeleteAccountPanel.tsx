import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ReauthMethod } from '../services/auth';

interface DeleteAccountPanelProps {
  // Cómo se puede confirmar, primero el de la sesión actual: con la contraseña o en la ventana de Google
  methods: ReauthMethod[];
  busy: boolean;
  onConfirm: (password?: string) => void;
  onCancel: () => void;
}

// Confirmación para eliminar la cuenta y todos sus datos (sustituye al window.confirm del navegador)
export const DeleteAccountPanel: React.FC<DeleteAccountPanelProps> = ({ methods, busy, onConfirm, onCancel }) => {
  const [password, setPassword] = useState('');
  // El método elegido aquí; si no se cambia, el de la sesión (puede llegar después de abrir el panel)
  const [choice, setChoice] = useState<ReauthMethod | null>(null);
  const method = choice && methods.includes(choice) ? choice : methods[0];
  const needsPassword = method === 'password';
  const other = methods.find((m) => m !== method);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // El foco va a lo que hay que hacer: escribir la contraseña o confirmar (al abrir el panel y al cambiar de método)
  const focusNext = (next: ReauthMethod) =>
    requestAnimationFrame(() => (next === 'password' ? passwordRef.current : confirmRef.current)?.focus());
  useEffect(() => {
    focusNext(method);
    // Solo al abrirse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      <p id="delete-account-help" className="text-xs leading-relaxed text-red-900">
        Se eliminarán tu cuenta y todos tus datos (tareas, metas, proyectos, evaluaciones, reuniones, correos y tus
        mensajes de «Escríbenos»). No se puede deshacer.
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
            ref={passwordRef}
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
      {other && (
        <button
          type="button"
          onClick={() => {
            setChoice(other);
            focusNext(other);
          }}
          disabled={busy}
          className="min-h-9 text-xs font-semibold text-red-800 underline underline-offset-2 hover:text-red-950"
        >
          {other === 'google' ? 'Confirmar con Google en su lugar' : 'Confirmar con mi contraseña en su lugar'}
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          ref={confirmRef}
          type="submit"
          disabled={busy}
          aria-describedby="delete-account-help"
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
