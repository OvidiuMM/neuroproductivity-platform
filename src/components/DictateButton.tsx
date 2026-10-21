import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { dictationAvailable, startDictation, type Dictation } from '../services/speech';

// MICRÓFONO para dictar un campo: lo dicho se añade a lo que ya había. Pulsarlo otra vez para el dictado (que si no
// termina al callar, o a los 30 segundos), y escribir a mano lo cancela. Solo sale en los navegadores que pueden
// dictar. `autoStart`: empieza a escuchar al abrirse (desde «Nueva tarea por voz»). `pause`: se deja de escuchar
// mientras es true (p. ej. con la pregunta de descartar los cambios abierta). `typed`: cambia cada vez que la persona
// escribe en el campo (no cuando escribe el dictado): entonces el dictado se deja, para no tapar lo escrito
export const DictateButton: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoStart?: boolean;
  pause?: boolean;
  typed?: number;
}> = ({ label, value, onChange, autoStart = false, pause = false, typed = 0 }) => {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El dictado en marcha (también mientras el navegador aún no escucha, p. ej. con la pregunta del permiso)
  const dictation = useRef<Dictation | null>(null);
  // El onChange de ahora (el texto llega después, en las respuestas del navegador)
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  });
  const write = (text: string) => latestOnChange.current(text);

  const start = (before: string) => {
    const current = startDictation({
      onStart: () => {
        if (dictation.current !== current) return;
        setError(null);
        setListening(true);
      },
      onText: (text) => {
        if (dictation.current === current) write(before && text ? `${before} ${text}` : before || text);
      },
      onEnd: (message) => {
        if (dictation.current !== current) return;
        dictation.current = null;
        setListening(false);
        setError(message);
      }
    });
    dictation.current = current;
  };
  const toggle = () => {
    if (dictation.current) {
      dictation.current.stop();
      return;
    }
    setError(null);
    start(value.trim());
  };
  const startOnOpen = useEffectEvent(() => {
    // Al abrirse desde el acceso directo el formulario es nuevo: no hay nada delante
    if (autoStart && dictationAvailable()) start('');
  });
  useEffect(() => {
    startOnOpen();
    // Al cerrarse el formulario, se deja de escuchar y lo que llegue después no se escribe
    return () => {
      dictation.current?.cancel();
      dictation.current = null;
    };
  }, []);
  // Escribir a mano mientras se dicta lo deja (si no, lo siguiente que se oyera taparía lo escrito)
  const lastTyped = useRef(typed);
  useEffect(() => {
    if (typed === lastTyped.current) return;
    lastTyped.current = typed;
    dictation.current?.discard();
  }, [typed]);
  useEffect(() => {
    if (pause) dictation.current?.stop();
  }, [pause]);

  if (!dictationAvailable()) return null;
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={listening}
        title={listening ? 'Parar de dictar' : label}
        data-autofocus={autoStart ? '' : undefined}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          listening
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700'
        }`}
      >
        {listening ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
      </button>
      {/* Lo que está pasando, también para los lectores de pantalla */}
      <span role="status" className="sr-only">
        {listening ? 'Escuchando… Habla ahora (como mucho 30 segundos).' : ''}
      </span>
      {/* En su propia línea, al final de la fila (el campo y el micrófono van en una fila que se parte) */}
      {error && (
        <p role="alert" className="order-last basis-full text-[11px] font-medium text-red-600">
          {error}
        </p>
      )}
    </>
  );
};
