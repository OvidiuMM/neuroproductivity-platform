import React from 'react';
import { UserProfile } from '../types';

// Número de solicitudes de acceso pendientes. En la pestaña de escritorio va sobre la esquina del icono para no
// ensanchar la cabecera. Es solo visual: el nombre accesible de la sección ya lo dice.
export const PendingBadge: React.FC<{ count: number; corner?: boolean }> = ({ count, corner = false }) =>
  count > 0 ? (
    <span
      aria-hidden="true"
      className={`h-4 min-w-4 rounded-full bg-orange-700 px-1 text-center text-[10px] leading-4 font-bold text-white ${
        corner ? 'absolute -top-1.5 -right-1.5 ring-2 ring-white' : ''
      }`}
    >
      {count}
    </span>
  ) : null;

export const Avatar: React.FC<{ user: UserProfile }> = ({ user }) =>
  user.photoUrl ? (
    <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" className="h-6 w-6 shrink-0 rounded-lg object-cover" />
  ) : (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white shadow-2xs">
      {user.initials}
    </div>
  );
