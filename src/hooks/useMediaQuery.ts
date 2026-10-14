import { useCallback, useSyncExternalStore } from 'react';

// Si la consulta de medios se cumple ahora; se actualiza al girar el móvil o cambiar el tamaño de la ventana
export const useMediaQuery = (query: string) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
};

// Móvil: el mismo corte que usan las clases `md:` de Tailwind
export const PHONE_QUERY = '(max-width: 767px)';
