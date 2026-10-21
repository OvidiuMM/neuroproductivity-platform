import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { dictationAvailable, startDictation } from '../services/speech';

// MICRÓFONO para dictar un campo: lo dicho se añade a lo que ya había. Pulsarlo otra vez para el dictado (que si no
// termina al callar, o a los 30 segundos). Solo sale en los navegadores que pueden dictar. `autoStart`: empieza a
// escuchar al abrirse (desde «Nueva tarea por voz»)
export const DictateButton: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoStart?: boolean;
  className?: string;
}> = ({ label, value, onChange, autoStart = false, className = '' }) => {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dictation = useRef<{ stop: () => void; cancel: () => void } | null>(null);

  // `before`: lo que ya había, que se conserva delante (al abrirse con autoStart el formulario es nuevo: nada)
  const start = (before = value.trim()) => {
    dictation.current = startDictation({
      onStart: () => {
        setError(null);
        setListening(true);
      },
      onText: (text) => onChange(before && text ? `${before} ${text}` : before || text),
      onEnd: (message) => {
        dictation.current = null;
        setListening(false);
        setError(message);
      }
    });
  };
  const startOnOpen = useEffectEvent(() => {
    if (autoStart && dictationAvailable()) start('');
  });
  useEffect(() => {
    startOnOpen();
    // Al cerrarse el formulario, se deja de escuchar y lo que llegue después no se escribe
    return () => dictation.current?.cancel();
  }, []);

  if (!dictationAvailable()) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => (listening ? dictation.current?.stop() : start())}
        aria-label={listening ? `Parar de dictar (${label.toLowerCase()})` : label}
        aria-pressed={listening}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          listening
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700'
        } ${className}`}
      >
        {listening ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
      </button>
      {/* Lo que está pasando, para todos (también para los lectores de pantalla) */}
      <span role="status" className="sr-only">
        {listening ? 'Escuchando… Habla ahora (como mucho 30 segundos).' : ''}
      </span>
      {/* En su propia línea (el campo y el micrófono van en una fila que se parte) */}
      {error && (
        <p role="alert" className="basis-full text-[11px] font-medium text-red-600">
          {error}
        </p>
      )}
    </>
  );
};
