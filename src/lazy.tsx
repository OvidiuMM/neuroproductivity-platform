import React, { lazy, type ComponentType } from 'react';

// ¿Responde el servidor? Sin conexión no se recarga: la app abierta, con las tareas, sigue en pie
const serverReachable = () =>
  fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' }).then(
    (response) => response.ok,
    () => false
  );

// Componente que se descarga la primera vez que se muestra. React.lazy guarda también una descarga fallida (p. ej.
// sin conexión), así que para reintentar hace falta otro: retry() lo cambia por uno nuevo.
export const retryableLazy = <P extends object>(load: () => Promise<ComponentType<P>>) => {
  let Current = lazy(() => load().then((component) => ({ default: component })));
  const Deferred = (props: P) => <Current {...props} />;
  return Object.assign(Deferred, {
    retry: () => {
      Current = lazy(async () => {
        try {
          return { default: await load() };
        } catch (error) {
          // El navegador también recuerda la descarga fallida y no la vuelve a pedir (y tras publicar una versión nueva
          // el archivo ya no existe): si el servidor responde, se recarga la página. Los cambios sin sincronizar se
          // guardan en el dispositivo, así que no se pierden.
          if (!(await serverReachable())) throw error;
          window.location.reload();
          return new Promise<never>(() => {});
        }
      });
    }
  });
};
