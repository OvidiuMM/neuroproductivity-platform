import { useEffect, useState } from 'react';

// Cerrar o recargar la pestaña con cambios sin guardar: el navegador pide confirmación (con su propio texto, que no
// se puede cambiar)
export const useUnsavedChangesWarning = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Safari y versiones antiguas de Chrome solo avisan si además se da un valor
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
};

// Cerrar un formulario (X, «Cancelar» o Escape) con cambios sin guardar: primero se pregunta si descartarlos. Escape
// mientras se pregunta es «Seguir editando». Con la pestaña, avisa el navegador.
export const useDiscardGuard = (isDirty: boolean, onClose: () => void) => {
  const [confirming, setConfirming] = useState(false);
  useUnsavedChangesWarning(isDirty);
  return {
    confirming,
    requestClose: () => {
      if (confirming) setConfirming(false);
      else if (isDirty) setConfirming(true);
      else onClose();
    },
    keepEditing: () => setConfirming(false),
    discard: () => {
      setConfirming(false);
      onClose();
    }
  };
};
