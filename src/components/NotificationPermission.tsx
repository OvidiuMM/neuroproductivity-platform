import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationState, requestNotifications } from '../services/notifications';

// Si el navegador lo permite, ofrece activar las notificaciones del sistema de las alarmas (en el formulario de una
// tarea con alarma y en el menú de la cuenta)
export const NotificationPermission: React.FC<{ buttonLabel?: string }> = ({
  buttonLabel = 'Activar también las notificaciones del sistema'
}) => {
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
  const text = {
    granted: 'También recibirás una notificación del sistema.',
    denied: 'Las notificaciones del sistema están bloqueadas en este navegador: el aviso sale dentro de CLAR.',
    unsupported: 'En este navegador el aviso sale dentro de CLAR.'
  }[state];
  return (
    <p role="status" className="mt-1 text-[11px] text-slate-500">
      {text}
    </p>
  );
};
