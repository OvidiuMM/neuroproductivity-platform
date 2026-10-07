import React, { useEffect, useState } from 'react';
import { Brain, Sparkles, CheckCircle2 } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  version?: string;
  autoDismissMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  version = '0.2.0',
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
    <div
      onClick={() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setIsVisible(false);
          if (onFinish) onFinish();
        }, 200);
      }}
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-8 select-none transition-all duration-300 ${
        isFadingOut ? 'opacity-0 scale-98 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Luz ambiental radial de fondo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18)_0%,transparent_70%)] pointer-events-none" />

      {/* Espacio superior */}
      <div className="pt-6 w-full flex justify-end">
        <span className="text-[11px] font-mono text-slate-500 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">
          v{version}
        </span>
      </div>

      {/* Contenido central: Logotipo e Identidad Visual */}
      <div className="flex flex-col items-center text-center space-y-6 max-w-sm z-10 my-auto">
        
        {/* Isotipo con pulso y halo */}
        <div className="relative">
          <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-slate-900 p-0.5 shadow-2xl shadow-indigo-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Brain className="w-12 h-12 text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Título de la Plataforma */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            NeuroProductividad
          </h1>
          <p className="text-xs text-indigo-300 font-medium tracking-wide">
            Basado en la metodología de Dr. Jonathan Benito Sipos
          </p>
          <p className="text-[11px] text-slate-400 pt-1 leading-relaxed max-w-xs mx-auto">
            Andamiaje neurocognitivo para la corteza prefrontal y mitigación del estrés
          </p>
        </div>

        {/* Barra de progreso de arranque */}
        <div className="w-48 space-y-2 pt-2">
          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150 ease-out rounded-full"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Iniciando estado offline</span>
            <span>{Math.min(100, progress)}%</span>
          </div>
        </div>

      </div>

      {/* Pie de pantalla de inicio */}
      <div className="pb-4 text-center z-10 space-y-1">
        <p className="text-[10px] text-slate-500 tracking-wider uppercase font-semibold">
          Universidad Autónoma de Madrid
        </p>
        <span className="text-[9px] text-slate-600">
          Toca cualquier punto para omitir
        </span>
      </div>

    </div>
  );
};
