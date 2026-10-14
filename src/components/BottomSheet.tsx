import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from '../hooks/useModalFocus';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  // Adónde vuelve el foco si el botón que la abrió ya no está
  returnFocusTo?: () => HTMLElement | null;
  children: React.ReactNode;
}

// Hoja inferior del móvil: diálogo modal pegado abajo, al alcance del pulgar. Se cierra con Escape, con «Cerrar» o
// tocando fuera, y devuelve el foco al botón que la abrió.
export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, returnFocusTo, children }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(isOpen, sheetRef, onClose, returnFocusTo);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!sheetRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // Por encima de los avisos, que de otro modo taparían las opciones mientras duran
    <div className="fixed inset-0 z-[60] flex items-end bg-slate-900/50">
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-in slide-in-from-bottom max-h-[85vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-sm font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
