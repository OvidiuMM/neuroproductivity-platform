import React, { useRef, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { describeAuthError, MIN_PASSWORD_LENGTH, type ReauthMethod } from '../services/auth';
import { UserProfile } from '../types';
import {
  X,
  LogOut,
  Download,
  Trash2,
  Cloud,
  Accessibility,
  KeyRound,
  MonitorSmartphone,
  MessageSquare
} from 'lucide-react';
import { DeleteAccountPanel } from './DeleteAccountPanel';
import { LegalLink } from './LegalLinks';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  // La cuenta tiene contraseña (puede cambiarla)
  hasPassword: boolean;
  // Cómo confirmar la eliminación, primero el método con el que se entró en esta sesión
  reauthMethods: ReauthMethod[];
  onSignOut: () => void;
  onExportData: () => Promise<void>;
  onDeleteAccount: (password?: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onSignOutEverywhere: () => Promise<void>;
  onOpenAccessibility: () => void;
  onContact: () => void;
  // Adónde vuelve el foco si el botón que abrió el menú ya no está (p. ej. la hoja «Más» del móvil)
  returnFocusTo?: () => HTMLElement | null;
}

type Busy = 'export' | 'delete' | 'password' | 'everywhere' | null;
type Panel = 'password' | 'everywhere' | 'delete' | null;

const actionClass =
  'w-full py-2.5 px-4 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2';
const inputClass =
  'w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

// Cuenta autogestionada: accesibilidad, datos, seguridad (contraseña y sesiones) y eliminación
export const AccountMenu: React.FC<AccountMenuProps> = ({
  isOpen,
  onClose,
  user,
  hasPassword,
  reauthMethods,
  onSignOut,
  onExportData,
  onDeleteAccount,
  onChangePassword,
  onSignOutEverywhere,
  onOpenAccessibility,
  onContact,
  returnFocusTo
}) => {
  const [busy, setBusy] = useState<Busy>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  useModalFocus(isOpen, dialogRef, onClose, returnFocusTo);

  // El menú sigue montado cerrado: lo escrito (contraseñas incluidas) no debe verse al volver a abrirlo
  const clearPasswords = () => {
    setCurrentPassword('');
    setNewPassword('');
  };

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setPanel(null);
      setError(null);
      setNotice(null);
      clearPasswords();
    }
  }

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
    clearPasswords();
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    void run(
      'password',
      async () => {
        await onChangePassword(currentPassword, newPassword);
        clearPasswords();
        setPanel(null);
      },
      'Contraseña cambiada.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tu cuenta"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-900">Tu cuenta</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold text-white">
                {user.initials}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900">{user.name}</h3>
              {user.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
              <p className="text-[11px] text-slate-600">
                {reauthMethods[0] === 'password' ? 'Entras con email y contraseña' : 'Entras con Google'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-[11px] leading-relaxed text-slate-600">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <p>
              Tus datos se guardan en tu cuenta (Google Cloud, UE) y solo tú puedes acceder a ellos. Se sincronizan
              entre tus dispositivos y, sin conexión, los cambios se envían al recuperarla. Más detalles en la{' '}
              <LegalLink to="privacy" newTab>
                política de privacidad
              </LegalLink>
              .
            </p>
          </div>

          <div aria-live="polite">
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                {notice}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <button type="button" onClick={onOpenAccessibility} disabled={busy !== null} className={actionClass}>
              <Accessibility className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              Accesibilidad: tamaño del texto, contraste y animaciones
            </button>
            <button
              type="button"
              onClick={() => run('export', onExportData)}
              disabled={busy !== null}
              className={actionClass}
            >
              <Download className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              {busy === 'export' ? 'Preparando descarga…' : 'Descargar mis datos (JSON)'}
            </button>
            <button type="button" onClick={onContact} disabled={busy !== null} className={actionClass}>
              <MessageSquare className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              Escríbenos: ideas, fallos o dudas
            </button>
          </div>

          {/* SEGURIDAD */}
          <section aria-labelledby="account-security" className="space-y-2">
            <h3 id="account-security" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
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
                <KeyRound className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                Cambiar la contraseña
              </button>
            )}
            {panel === 'password' && (
              <form onSubmit={submitPassword} className="space-y-3 rounded-2xl border border-slate-200 p-4">
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
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
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
              <MonitorSmartphone className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              Cerrar sesión en todos los dispositivos
            </button>
            {panel === 'everywhere' && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs leading-relaxed text-slate-700">
                  Se cerrará la sesión en todos tus dispositivos, también en este. Los demás dejarán de tener acceso en
                  menos de una hora. Úsalo si has perdido un dispositivo o has entrado en uno que no es tuyo.
                </p>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('everywhere', onSignOutEverywhere)}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy === 'everywhere' ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones'}
                </button>
              </div>
            )}

            <button type="button" onClick={onSignOut} disabled={busy !== null} className={actionClass}>
              <LogOut className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Cerrar sesión
            </button>
          </section>

          {panel === 'delete' ? (
            <DeleteAccountPanel
              methods={reauthMethods}
              busy={busy === 'delete'}
              onConfirm={(password) => run('delete', () => onDeleteAccount(password))}
              onCancel={() => {
                setPanel(null);
                // El botón que lo abrió vuelve a estar: el foco vuelve a él
                requestAnimationFrame(() => deleteButtonRef.current?.focus());
              }}
            />
          ) : (
            <button
              ref={deleteButtonRef}
              type="button"
              onClick={() => toggle('delete')}
              disabled={busy !== null}
              className="flex w-full items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Eliminar mi cuenta y todos mis datos
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
