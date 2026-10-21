// DICTAR UNA TAREA: el reconocimiento de voz del navegador (Web Speech API). CLAR no recibe el audio, solo el texto
// que devuelve el navegador. En Chrome, el audio va a los servidores de Google para pasarlo a texto (lo dice la
// política de privacidad); Firefox no lo tiene, y entonces no se ofrece.

// Lo que se usa de la API (los navegadores la exponen como SpeechRecognition o, con prefijo, webkitSpeechRecognition)
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}
export interface SpeechResults {
  readonly length: number;
  [index: number]: SpeechResult;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: SpeechResults }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionConstructor = new () => Recognition;

const recognitionConstructor = (): RecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const dictationAvailable = () => recognitionConstructor() !== null;

// El texto dictado hasta ahora (lo definitivo y lo que aún se está reconociendo), en una línea
export const transcriptOf = (results: SpeechResults) => {
  let text = '';
  for (let i = 0; i < results.length; i++) text += results[i][0]?.transcript ?? '';
  return text.replace(/\s+/g, ' ').trim();
};

// Lo que se dice si no se pudo dictar, por el código de error de la API
export const dictationErrorMessage = (code: string) => {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Para dictar, da permiso al micrófono en tu navegador.';
    case 'audio-capture':
      return 'No se encuentra el micrófono.';
    case 'network':
      return 'Para dictar hace falta conexión.';
    case 'no-speech':
      return 'No se ha oído nada. Pulsa el micrófono y habla.';
    case 'aborted':
      return null;
    default:
      return 'No se pudo dictar. Inténtalo de nuevo.';
  }
};

// Lo que dura un dictado como mucho
export const MAX_DICTATION_MS = 30_000;

// Empieza a dictar en español: `onStart` llega cuando el navegador ya escucha, `onText` recibe el texto según se
// reconoce y `onEnd`, al terminar (con el mensaje si falló). Devuelve cómo pararlo (`stop`, quedándose con lo dictado) o cancelarlo (`cancel`, al cerrar el formulario).
// Una frase cada vez: al callar termina solo y, si no, a los 30 segundos
export const startDictation = ({
  onStart,
  onText,
  onEnd
}: {
  onStart: () => void;
  onText: (text: string) => void;
  onEnd: (error: string | null) => void;
}) => {
  const Constructor = recognitionConstructor();
  if (!Constructor) {
    onEnd('Este navegador no permite dictar.');
    return { stop: () => undefined, cancel: () => undefined };
  }
  const recognition = new Constructor();
  recognition.lang = 'es-ES';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let error: string | null = null;
  // Al llegar al límite se para, quedándose con lo dictado
  const limit = setTimeout(() => recognition.stop(), MAX_DICTATION_MS);
  recognition.onstart = onStart;
  recognition.onresult = (event) => onText(transcriptOf(event.results));
  recognition.onerror = (event) => {
    error = dictationErrorMessage(event.error);
  };
  recognition.onend = () => {
    clearTimeout(limit);
    onEnd(error);
  };
  try {
    recognition.start();
  } catch {
    clearTimeout(limit);
    onEnd('No se pudo dictar. Inténtalo de nuevo.');
  }
  return {
    stop: () => recognition.stop(),
    cancel: () => {
      clearTimeout(limit);
      recognition.onresult = null;
      recognition.onend = null;
      recognition.abort();
    }
  };
};
