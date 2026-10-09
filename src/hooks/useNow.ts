import { useEffect, useState } from 'react';

// Reloj para estados que dependen de la hora (p. ej. tareas que pasan a "vence pronto" o "vencida"
// con la página abierta). Se actualiza cada minuto y al volver a la pestaña, porque los navegadores
// ralentizan los temporizadores de las pestañas en segundo plano.
export const useNow = (intervalMs = 60_000) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);

  return now;
};
