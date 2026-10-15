import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TaskItem } from '../types';
import { matchPendingAlerts, scheduledAlarms, type ScheduledAlarm } from '../services/alarms';

// Alarmas ya avisadas, por cuenta: no se repiten al recargar ni en otra pestaña. Se olvidan pasados dos días.
const firedStorageKey = (uid: string) => `clar_alarms_fired:${uid}`;
const KEEP_FIRED_MS = 2 * 24 * 60 * 60 * 1000;
// Se revisa al menos cada minuto: así un cambio de hora del equipo o una suspensión no deja ninguna sin avisar
const MAX_WAIT_MS = 60_000;
// Las avisadas en esta pestaña, por cuenta (dos cuentas pueden tener tareas con el mismo id, p. ej. importadas). Si
// el navegador no deja guardar (almacenamiento lleno o bloqueado), al menos no se repiten mientras siga abierta.
const claimedHere = new Set<string>();

const readFired = (uid: string): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(firedStorageKey(uid)) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};

// Marca la alarma como avisada si nadie lo hizo antes; true si le toca avisar a esta pestaña
const claimSync = (uid: string, key: string) => {
  const here = `${uid}:${key}`;
  if (claimedHere.has(here)) return false;
  claimedHere.add(here);
  const now = Date.now();
  const fired = readFired(uid);
  if (fired[key]) return false;
  try {
    const kept = Object.fromEntries(Object.entries(fired).filter(([, at]) => now - at < KEEP_FIRED_MS));
    localStorage.setItem(firedStorageKey(uid), JSON.stringify({ ...kept, [key]: now }));
  } catch {
    // Sin poder guardarla, avisa igual (otra pestaña o una recarga podrían repetirla)
  }
  return true;
};

// Con varias pestañas abiertas, el bloqueo hace que solo una se la quede
const claim = (uid: string, key: string): Promise<boolean> =>
  'locks' in navigator
    ? navigator.locks.request(`clar-alarms:${uid}`, () => claimSync(uid, key)).catch(() => claimSync(uid, key))
    : Promise.resolve(claimSync(uid, key));

interface AlarmHandlers {
  // Aviso dentro de la app: en todas las pestañas abiertas
  onAlert: (alarm: ScheduledAlarm) => void;
  // Notificación del sistema: una sola vez, desde la pestaña que se quedó la alarma
  onNotify: (alarm: ScheduledAlarm) => void;
}

// Avisa de cada alarma a su hora mientras la app está abierta. Las que pasaron con la app cerrada se avisan al
// abrirla, si la tarea aún no ha vencido.
export const useTaskAlarms = (uid: string, tasks: TaskItem[], handlers: AlarmHandlers) => {
  const handlersRef = useRef(handlers);
  const tasksRef = useRef(tasks);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
    tasksRef.current = tasks;
  });
  const [check, setCheck] = useState(0);

  // La pestaña que se queda una alarma lo cuenta a las demás, que muestran también el aviso (puede que la que la
  // tomó esté en segundo plano y la que se está mirando no tenga notificaciones). Si aquí aún no ha llegado la tarea,
  // el aviso espera a que llegue.
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pendingRef = useRef(new Map<string, number>());
  useEffect(() => {
    pendingRef.current = new Map();
    if (!('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel(`clar-alarms:${uid}`);
    channel.onmessage = (event: MessageEvent<{ key?: unknown }>) => {
      if (typeof event.data.key !== 'string') return;
      const alarm = scheduledAlarms(tasksRef.current, new Date()).find((a) => a.key === event.data.key);
      if (alarm) handlersRef.current.onAlert(alarm);
      else pendingRef.current.set(event.data.key, Date.now());
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [uid]);

  useEffect(() => {
    const now = new Date();
    const alarms = scheduledAlarms(tasks, now);
    const { matched, rest } = matchPendingAlerts(pendingRef.current, alarms, now.getTime());
    pendingRef.current = rest;
    for (const alarm of matched) handlersRef.current.onAlert(alarm);
    for (const alarm of alarms.filter((a) => a.at <= now)) {
      void claim(uid, alarm.key).then((mine) => {
        if (!mine) return;
        handlersRef.current.onNotify(alarm);
        handlersRef.current.onAlert(alarm);
        channelRef.current?.postMessage({ key: alarm.key });
      });
    }
    const next = alarms.find((a) => a.at > now);
    const wait = next ? Math.min(next.at.getTime() - now.getTime(), MAX_WAIT_MS) : MAX_WAIT_MS;
    const timer = window.setTimeout(() => setCheck((n) => n + 1), wait + 50);
    return () => window.clearTimeout(timer);
  }, [uid, tasks, check]);

  // Al volver a la pestaña o al despertar el equipo, se revisa al momento
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible') setCheck((n) => n + 1);
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, []);
};
