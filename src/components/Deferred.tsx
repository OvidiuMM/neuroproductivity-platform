import React, { Component, Suspense, useRef, useState, type ReactNode } from 'react';
import { ModalOpenerContext, useModalFocus } from '../hooks/useModalFocus';
import { messages } from '../i18n/locale';

const m = messages(
  {
    sectionFailed: 'No se pudo cargar esta sección. Comprueba la conexión.',
    openFailed: 'No se pudo abrir. Comprueba la conexión.',
    loading: 'Cargando…',
    retry: 'Reintentar',
    cancel: 'Cancelar'
  },
  {
    sectionFailed: "Couldn't load this section. Check your connection.",
    openFailed: "Couldn't open it. Check your connection.",
    loading: 'Loading…',
    retry: 'Retry',
    cancel: 'Cancel'
  }
);

// Si la descarga de una parte de la app falla, se avisa con «Reintentar» en lugar de dejar la app en blanco: el
// fallo no sale de aquí (el resto de la app, la navegación incluida, sigue funcionando)
class LoadErrorBoundary extends Component<
  { onRetry: () => void; fallback: (retry: () => void) => ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Error loading part of the app:', error);
  }

  retry = () => {
    this.props.onRetry();
    this.setState({ failed: false });
  };

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}

const buttonClass = 'min-h-11 rounded-xl px-4 text-sm font-semibold';

// Sección (Agenda, Rueda…): mientras se descarga, «Cargando…»; si falla, aviso y «Reintentar» en su sitio
export const DeferredSection: React.FC<{ retry: () => void; children: ReactNode }> = ({ retry, children }) => (
  <LoadErrorBoundary
    onRetry={retry}
    fallback={(again) => (
      <div role="alert" className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-900">{m.sectionFailed}</p>
        <button type="button" onClick={again} className={`${buttonClass} bg-slate-900 font-bold text-white`}>
          {m.retry}
        </button>
      </div>
    )}
  >
    <Suspense
      fallback={
        <div role="status" className="py-16 text-center text-sm text-slate-500">
          {m.loading}
        </div>
      }
    >
      {children}
    </Suspense>
  </LoadErrorBoundary>
);

// Ventana provisional mientras se descarga la de verdad (o si no se pudo): modal, con el foco dentro y «Cancelar»
const PendingDialog: React.FC<{ failed: boolean; onRetry?: () => void; onCancel: () => void }> = ({
  failed,
  onRetry,
  onCancel
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(true, ref, onCancel);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-dialog-text"
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-2xl"
      >
        <p
          id="pending-dialog-text"
          role={failed ? 'alert' : 'status'}
          className={`text-sm ${failed ? 'text-amber-900' : 'text-slate-600'}`}
        >
          {failed ? m.openFailed : m.loading}
        </p>
        <div className="flex justify-center gap-2">
          {failed && onRetry && (
            <button type="button" onClick={onRetry} className={`${buttonClass} bg-slate-900 font-bold text-white`}>
              {m.retry}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className={`${buttonClass} text-slate-700 hover:bg-slate-100`}
            data-autofocus
          >
            {m.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Ventana que se descarga al abrirse: mientras tanto se ve una provisional que se puede cancelar, y si falla, otra con
// «Reintentar» y «Cancelar». Cancelar cierra lo que se estaba abriendo. Guarda el elemento que la abrió (aún con el
// foco al montarse) para que, al cerrarla, el foco vuelva a él.
export const DeferredDialog: React.FC<{ retry: () => void; onCancel: () => void; children: ReactNode }> = ({
  retry,
  onCancel,
  children
}) => {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  return (
    <ModalOpenerContext.Provider value={opener}>
      <LoadErrorBoundary
        onRetry={retry}
        fallback={(again) => <PendingDialog failed onRetry={again} onCancel={onCancel} />}
      >
        <Suspense fallback={<PendingDialog failed={false} onCancel={onCancel} />}>{children}</Suspense>
      </LoadErrorBoundary>
    </ModalOpenerContext.Provider>
  );
};
