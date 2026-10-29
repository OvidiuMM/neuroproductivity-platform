import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationState, requestNotifications } from '../services/notifications';
import { isIOS, isStandalone, needsHomeScreenForPush } from '../services/platform';
import { messages } from '../i18n/locale';

const m = messages(
  {
    homeScreen:
      'En el iPhone, CLAR solo puede avisarte desde su icono en la pantalla de inicio: en Safari, pulsa Compartir y «Añadir a pantalla de inicio». Después abre CLAR desde el icono, entra con tu cuenta y activa los avisos en el menú de tu cuenta. Necesitas iOS 16.4 o posterior.',
    enable: 'Activar también las notificaciones del sistema',
    granted: 'También recibirás una notificación del sistema.',
    denied: 'Las notificaciones del sistema están bloqueadas en este navegador: el aviso sale dentro de CLAR.',
    oldIos: 'Para recibir avisos del sistema necesitas iOS 16.4 o posterior: de momento, el aviso sale dentro de CLAR.',
    unsupported: 'En este navegador el aviso sale dentro de CLAR.'
  },
  {
    homeScreen:
      'On iPhone, CLAR can only notify you from its icon on the Home Screen: in Safari, tap Share and then “Add to Home Screen”. Then open CLAR from the icon, sign in and turn on notifications in your account menu. You need iOS 16.4 or later.',
    enable: 'Also turn on system notifications',
    granted: "You'll also get a system notification.",
    denied: 'System notifications are blocked in this browser: the alert shows up inside CLAR.',
    oldIos: 'To get system notifications you need iOS 16.4 or later: for now, the alert shows up inside CLAR.',
    unsupported: 'In this browser, the alert shows up inside CLAR.'
  }
);

// En el iPhone, los avisos solo llegan a la app añadida a la pantalla de inicio: se explica cómo
export const HomeScreenGuide: React.FC = () => (
  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{m.homeScreen}</p>
);

// Si el navegador lo permite, ofrece activar las notificaciones del sistema de las alarmas (en el formulario de una
// tarea con alarma y en el menú de la cuenta)
export const NotificationPermission: React.FC<{ buttonLabel?: string }> = ({ buttonLabel = m.enable }) => {
  const [state, setState] = useState(notificationState);
  if (state === 'default') {
    return (
      <button
        type="button"
        onClick={() => void requestNotifications().then(setState)}
        className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
      >
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        {buttonLabel}
      </button>
    );
  }
  if (state === 'unsupported' && needsHomeScreenForPush()) return <HomeScreenGuide />;
  const text = {
    granted: m.granted,
    denied: m.denied,
    unsupported: isIOS() && isStandalone() ? m.oldIos : m.unsupported
  }[state];
  return (
    <p role="status" className="mt-1 text-[11px] text-slate-500">
      {text}
    </p>
  );
};
