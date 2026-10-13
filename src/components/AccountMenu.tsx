import React, { useRef, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { describeAuthError, MIN_PASSWORD_LENGTH } from '../services/auth';
import { UserProfile } from '../types';
import { X, LogOut, Download, Trash2, Cloud, Accessibility, KeyRound, MonitorSmartphone } from 'lucide-react';
import { DeleteAccountPanel } from './DeleteAccountPanel';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  // La cuenta entra con email y contraseña (puede cambiarla y la usa para confirmar el borrado)
  hasPassword: boolean;
  onSignOut: () => void;
  onExportData: () => Promise<void>;
  onDeleteAccount: (password?: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onSignOutEverywhere: () => Promise<void>;
  onOpenAccessibility: () => void;
}

type Busy = 'export' | 'delete' | 'password' | 'everywhere' | null;
type Panel = 'password' | 'everywhere' | 'delete' | null;

const actionClass =
  'w-full py-2.5 px-4 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2';
const inputClass = 'w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

// Cuenta autogestionada: accesibilidad, datos, seguridad (contraseña y sesiones) y eliminación
export const AccountMenu: React.FC<AccountMenuProps> = ({
  isOpen,
  onClose,
  user,
  hasPassword,
  onSignOut,
  onExportData,
  onDeleteAccount,
  onChangePassword,
  onSignOutEverywhere,
  onOpenAccessibility
}) => {
  const [busy, setBusy] = useState<Busy>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>, done?: string) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (done) setNotice(done);
    } catch (e) {
      setError(describeAuthError(e, e instanceof Error && e.message ? e.message : 'No se pudo completar la acción.'));
    } finally {
      setBusy(null);
    }
  };

  const toggle = (next: Panel) => {
    setPanel((current) => (current === next ? null : next));
    setError(null);
    setNotice(null);
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    run(
      'password',
      async () => {
        await onChangePassword(currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setPanel(null);
      },
      'Contraseña cambiada.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center p-4 sm:p-8 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tu cuenta"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <h2 className="text-sm font-bold text-slate-900">Tu cuenta</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
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
              <p className="text-[11px] text-slate-600">{hasPassword ? 'Entras con email y contraseña' : 'Entras con Google'}</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Tus datos se guardan en tu cuenta (Google Cloud, UE) y solo tú puedes acceder a ellos. Se sincronizan entre tus dispositivos y, sin conexión, los cambios se envían al recuperarla.
            </p>
          </div>

          <div aria-live="polite">
            {error && (
              <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                {error}
              </p>
            )}
            {notice && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{notice}</p>}
          </div>

          <div className="space-y-2">
            <button type="button" onClick={onOpenAccessibility} disabled={busy !== null} className={actionClass}>
              <Accessibility className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              Accesibilidad: tamaño del texto, contraste y animaciones
            </button>
            <button type="button" onClick={() => run('export', onExportData)} disabled={busy !== null} className={actionClass}>
              <Download className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              {busy === 'export' ? 'Preparando descarga…' : 'Descargar mis datos (JSON)'}
            </button>
          </div>

          {/* SEGURIDAD */}
          <section aria-labelledby="account-security" className="space-y-2">
            <h3 id="account-security" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Seguridad
            </h3>
            {hasPassword && (
              <button
                type="button"
                onClick={() => toggle('password')}
                aria-expanded={panel === 'password'}
                disabled={busy !== null}
                className={actionClass}
              >
                <KeyRound className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                Cambiar la contraseña
              </button>
            )}
            {panel === 'password' && (
              <form onSubmit={submitPassword} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="space-y-1">
                  <label htmlFor="current-password" className="block text-xs font-semibold text-slate-700">
                    Contraseña actual
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="new-password" className="block text-xs font-semibold text-slate-700">
                    Contraseña nueva
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    aria-describedby="new-password-hint"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                  <p id="new-password-hint" className="text-[11px] text-slate-600">
                    Al menos {MIN_PASSWORD_LENGTH} caracteres.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {busy === 'password' ? 'Guardando…' : 'Guardar la contraseña nueva'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => toggle('everywhere')}
              aria-expanded={panel === 'everywhere'}
              disabled={busy !== null}
              className={actionClass}
            >
              <MonitorSmartphone className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              Cerrar sesión en todos los dispositivos
            </button>
            {panel === 'everywhere' && (
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Se cerrará la sesión en todos tus dispositivos, también en este. Los demás dejarán de tener acceso en menos de una hora. Úsalo si has perdido un dispositivo o has entrado en uno que no es tuyo.
                </p>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('everywhere', onSignOutEverywhere)}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {busy === 'everywhere' ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones'}
                </button>
              </div>
            )}

            <button type="button" onClick={onSignOut} disabled={busy !== null} className={actionClass}>
              <LogOut className="w-4 h-4 text-slate-500" aria-hidden="true" />
              Cerrar sesión
            </button>
          </section>

          {panel === 'delete' ? (
            <DeleteAccountPanel
              needsPassword={hasPassword}
              busy={busy === 'delete'}
              onConfirm={(password) => run('delete', () => onDeleteAccount(password))}
              onCancel={() => setPanel(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => toggle('delete')}
              disabled={busy !== null}
              className="w-full py-2.5 px-4 text-xs font-bold text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-60 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Eliminar mi cuenta y todos mis datos
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
