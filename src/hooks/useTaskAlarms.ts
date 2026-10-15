import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TaskItem } from '../types';
import { scheduledAlarms, type ScheduledAlarm } from '../services/alarms';

// Alarmas ya avisadas, por cuenta: no se repiten al recargar ni en otra pestaña. Se olvidan pasados dos días.
const firedStorageKey = (uid: string) => `clar_alarms_fired:${uid}`;
const KEEP_FIRED_MS = 2 * 24 * 60 * 60 * 1000;
// Se revisa al menos cada minuto: así un cambio de hora del equipo o una suspensión no deja ninguna sin avisar
const MAX_WAIT_MS = 60_000;

const readFired = (uid: string): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(firedStorageKey(uid)) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};

// Marca la alarma como avisada si nadie lo hizo antes; true si le toca avisar a esta pestaña
const claimSync = (uid: string, key: string) => {
  const now = Date.now();
  const fired = readFired(uid);
  if (fired[key]) return false;
  const kept = Object.fromEntries(Object.entries(fired).filter(([, at]) => now - at < KEEP_FIRED_MS));
  localStorage.setItem(firedStorageKey(uid), JSON.stringify({ ...kept, [key]: now }));
  return true;
};

// Con varias pestañas abiertas, el bloqueo hace que solo una avise
const claim = (uid: string, key: string): Promise<boolean> =>
  'locks' in navigator
    ? navigator.locks.request(`clar-alarms:${uid}`, () => claimSync(uid, key))
    : Promise.resolve(claimSync(uid, key));

// Avisa de cada alarma a su hora mientras la app está abierta. Las que pasaron con la app cerrada se avisan al
// abrirla, si la tarea aún no ha vencido.
export const useTaskAlarms = (uid: string, tasks: TaskItem[], onAlarm: (alarm: ScheduledAlarm) => void) => {
  const onAlarmRef = useRef(onAlarm);
  useLayoutEffect(() => {
    onAlarmRef.current = onAlarm;
  });
  const [check, setCheck] = useState(0);

  useEffect(() => {
    const now = new Date();
    const alarms = scheduledAlarms(tasks, now);
    for (const alarm of alarms.filter((a) => a.at <= now)) {
      void claim(uid, alarm.key).then((mine) => {
        if (mine) onAlarmRef.current(alarm);
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
