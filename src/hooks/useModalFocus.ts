import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Foco accesible para ventanas modales: al abrir lleva el foco dentro (al elemento con data-autofocus
// o al primero enfocable), lo mantiene dentro con Tab / Mayús+Tab, cierra con Escape y, al cerrar,
// devuelve el foco al elemento que abrió la ventana.
export const useModalFocus = (isOpen: boolean, containerRef: RefObject<HTMLElement | null>, onClose: () => void) => {
  // onClose suele ser una función nueva en cada render; con una ref el efecto no se repite por ello
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const container = containerRef.current;
    if (!isOpen || !container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (container.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, containerRef]);
};
