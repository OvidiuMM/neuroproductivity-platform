import { isIOS } from './platform';
import { LOCALE_TAG, messages } from '../i18n/locale';

const m = messages(
  {
    notAllowed: 'Para dictar, da permiso al micrófono en tu navegador.',
    useKeyboardMic: 'Aquí no se puede dictar: usa el micrófono del teclado.',
    turnOnDictation: 'Aquí no se puede dictar. Activa el dictado del dispositivo o prueba en el navegador.',
    noMicrophone: 'No se encuentra el micrófono.',
    needsConnection: 'Para dictar hace falta conexión.',
    noSpeech: 'No se ha oído nada. Pulsa el micrófono y habla.',
    failed: 'No se pudo dictar. Inténtalo de nuevo.',
    unsupported: 'Este navegador no permite dictar.'
  },
  {
    notAllowed: 'To dictate, allow microphone access in your browser.',
    useKeyboardMic: "You can't dictate here: use the keyboard's microphone.",
    turnOnDictation: "You can't dictate here. Turn on dictation on your device or try in the browser.",
    noMicrophone: "Can't find the microphone.",
    needsConnection: 'You need a connection to dictate.',
    noSpeech: "Didn't hear anything. Tap the microphone and speak.",
    failed: "Couldn't dictate. Try again.",
    unsupported: "This browser doesn't support dictation."
  }
);
// DICTAR UNA TAREA: el reconocimiento de voz del navegador (Web Speech API). CLAR no recibe el audio, solo el texto
// que devuelve el navegador, que para pasarlo a texto lo envía a su proveedor (Google en Chrome, Apple en Safari,
// Microsoft en Edge; lo dice la política de privacidad). Firefox no lo tiene, y entonces no se ofrece.

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
  const parts: string[] = [];
  for (let i = 0; i < results.length; i++) parts.push(results[i][0]?.transcript ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

// Lo que se dice si no se pudo dictar, por el código de error de la API
export const dictationErrorMessage = (code: string) => {
  switch (code) {
    case 'not-allowed':
      return m.notAllowed;
    // Safari, con el dictado del dispositivo desactivado (o donde no lo deja usar)
    case 'service-not-allowed':
      return isIOS() ? m.useKeyboardMic : m.turnOnDictation;
    case 'audio-capture':
      return m.noMicrophone;
    case 'network':
      return m.needsConnection;
    case 'no-speech':
      return m.noSpeech;
    case 'aborted':
      return null;
    default:
      return m.failed;
  }
};

// Lo que dura un dictado como mucho, desde que el navegador empieza a escuchar
export const MAX_DICTATION_MS = 30_000;

export interface Dictation {
  // Parar, quedándose con lo dictado
  stop: () => void;
  // Dejarlo (al escribir a mano, o al empezar otro dictado): lo que llegue después no se escribe, y termina como
  // siempre (onEnd, sin error), así su botón vuelve a estar listo
  discard: () => void;
  // Cancelar en silencio, sin onEnd (al cerrar el formulario)
  cancel: () => void;
}

// Un solo dictado a la vez en toda la app: empezar otro cancela el anterior
let active: Dictation | null = null;

// Empieza a dictar en el idioma de la app: `onStart` llega cuando el navegador ya escucha, `onText` recibe el texto según se
// reconoce y `onEnd`, al terminar (con el mensaje si falló), siempre después de volver de aquí. Una frase cada vez:
// al callar termina solo y, si no, a los 30 segundos. Si la página se oculta (otra app), se para sin dar error
export const startDictation = ({
  onStart,
  onText,
  onEnd
}: {
  onStart: () => void;
  onText: (text: string) => void;
  onEnd: (error: string | null) => void;
}): Dictation => {
  active?.discard();
  const Constructor = recognitionConstructor();
  if (!Constructor) {
    queueMicrotask(() => onEnd(m.unsupported));
    return { stop: () => undefined, discard: () => undefined, cancel: () => undefined };
  }
  const recognition = new Constructor();
  // Se dicta en el idioma de la app
  recognition.lang = LOCALE_TAG;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let error: string | null = null;
  let limit: ReturnType<typeof setTimeout> | undefined;
  let hidden = false;
  const onHidden = () => {
    if (document.visibilityState !== 'hidden') return;
    hidden = true;
    recognition.stop();
  };
  const detach = () => {
    clearTimeout(limit);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHidden);
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    if (active === dictation) active = null;
  };
  recognition.onstart = () => {
    // Al llegar al límite se para, quedándose con lo dictado
    limit = setTimeout(() => recognition.stop(), MAX_DICTATION_MS);
    onStart();
  };
  recognition.onresult = (event) => onText(transcriptOf(event.results));
  recognition.onerror = (event) => {
    error = hidden ? null : dictationErrorMessage(event.error);
  };
  recognition.onend = () => {
    const message = error;
    detach();
    onEnd(message);
  };
  const dictation: Dictation = {
    stop: () => recognition.stop(),
    discard: () => {
      detach();
      recognition.abort();
      queueMicrotask(() => onEnd(null));
    },
    cancel: () => {
      detach();
      recognition.abort();
    }
  };
  active = dictation;
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHidden);
  try {
    recognition.start();
  } catch {
    detach();
    queueMicrotask(() => onEnd(m.failed));
  }
  return dictation;
};
