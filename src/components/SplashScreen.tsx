import React, { useEffect, useState } from 'react';
import { BRAND_NAME, BRAND_TAGLINE, BrandMark } from './BrandMark';

interface SplashScreenProps {
  onFinish?: () => void;
  version?: string;
  autoDismissMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  version = __APP_VERSION__,
  autoDismissMs = 1600
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progreso suave de la barra de carga
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 12;
      });
    }, 120);

    // Animación de salida (fade out)
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsVisible(false);
        if (onFinish) onFinish();
      }, 350);
    }, autoDismissMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [autoDismissMs, onFinish]);

  if (!isVisible) return null;

  return (
    // Tocar para saltarla es solo un atajo: se cierra sola en menos de dos segundos
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      onClick={() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setIsVisible(false);
          if (onFinish) onFinish();
        }, 200);
      }}
      role="status"
      aria-label={`Cargando ${BRAND_NAME}`}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950 p-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] transition-all duration-300 select-none ${
        isFadingOut ? 'pointer-events-none scale-98 opacity-0' : 'scale-100 opacity-100'
      }`}
    >
      {/* Luz ambiental radial de fondo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18)_0%,transparent_70%)]" />

      {/* Espacio superior */}
      <div className="flex w-full justify-end pt-6">
        <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 font-mono text-[11px] text-slate-500">
          v{version}
        </span>
      </div>

      {/* Contenido central: Logotipo e Identidad Visual */}
      <div className="z-10 my-auto flex max-w-sm flex-col items-center space-y-6 text-center">
        {/* Isotipo con pulso y halo */}
        <div className="relative">
          <div className="absolute -inset-4 animate-pulse rounded-full bg-indigo-500/20 blur-xl" />
          <div className="relative rounded-3xl shadow-2xl shadow-indigo-500/30">
            <BrandMark size={96} />
          </div>
        </div>

        {/* Título de la Plataforma */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-[0.3em] text-white">{BRAND_NAME}</h1>
          <p className="text-xs font-medium tracking-wide text-indigo-300">{BRAND_TAGLINE}</p>
          <p className="mx-auto max-w-xs pt-1 text-[11px] leading-relaxed text-slate-400">
            Andamiaje neurocognitivo para la corteza prefrontal y mitigación del estrés
          </p>
        </div>

        {/* Barra de progreso de arranque */}
        <div className="w-48 space-y-2 pt-2">
          <div className="h-1 w-full overflow-hidden rounded-full border border-slate-800/80 bg-slate-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150 ease-out"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>Iniciando estado offline</span>
            <span>{Math.min(100, progress)}%</span>
          </div>
        </div>
      </div>

      {/* Pie de pantalla de inicio */}
      <div className="z-10 space-y-1 pb-4 text-center">
        <span className="text-[9px] text-slate-600">Toca cualquier punto para omitir</span>
      </div>
    </div>
  );
};
