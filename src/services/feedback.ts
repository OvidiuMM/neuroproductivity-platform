// Contacto y sugerencias: tipos de mensaje, límites y la información técnica que se puede adjuntar

export type FeedbackType = 'suggestion' | 'bug' | 'general';

export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'suggestion', label: 'Sugerencia' },
  { value: 'bug', label: 'Error o fallo' },
  { value: 'general', label: 'Mensaje general' }
];

export const FEEDBACK_SUBJECT_MAX = 120;
export const FEEDBACK_DESCRIPTION_MAX = 2000;
export const REPLY_MAX_LENGTH = 5000;

// Respuesta de la administración tal como la guarda replyToFeedback: sin caracteres de control (salvo tabuladores y
// saltos de línea), recortada y con su límite. Se envía ya así, para poder compararla con la que devuelve
// eslint-disable-next-line no-control-regex -- justo lo que se busca: caracteres de control
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const cleanReply = (text: string) => text.replace(CONTROL, '').trim().slice(0, REPLY_MAX_LENGTH);

export type DeviceClass = 'móvil' | 'tableta' | 'escritorio';

// Información técnica opcional y anónima: familia y versión del sistema y del navegador, nunca el user-agent completo
export interface FeedbackContext {
  appVersion: string;
  os: string;
  browser: string;
  deviceClass: DeviceClass;
  language: string;
  online: boolean;
}

const match = (ua: string, pattern: RegExp) => ua.match(pattern)?.[1];

// Android, iOS y iPadOS dan su versión mayor. Windows, macOS, ChromeOS y Linux van sin versión a propósito: sus
// navegadores la congelan en el user-agent (Windows 10 y 11 dicen los dos «NT 10.0»; macOS, «10_15_7» desde hace años),
// así que el número sería falso
export const describeOs = (ua: string, maxTouchPoints = 0) => {
  const android = match(ua, /Android (\d+)/);
  if (android) return `Android ${android}`;
  const iphone = match(ua, /iPhone OS (\d+)/);
  if (iphone) return `iOS ${iphone}`;
  const ipad = match(ua, /iPad.*?OS (\d+)/);
  if (ipad) return `iPadOS ${ipad}`;
  // Desde iPadOS 13 el iPad dice ser un Mac; lo delata la pantalla táctil
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return 'iPadOS';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Desconocido';
};

export const describeBrowser = (ua: string) => {
  const rules: [RegExp, string][] = [
    [/Edg(?:A|iOS)?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
    [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
    [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari/, 'Safari']
  ];
  for (const [pattern, name] of rules) {
    const version = match(ua, pattern);
    if (version) return `${name} ${version}`;
  }
  return 'Desconocido';
};

export const deviceClassFor = (width: number): DeviceClass =>
  width < 768 ? 'móvil' : width < 1024 ? 'tableta' : 'escritorio';

export const describeDevice = (
  appVersion: string,
  nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints' | 'language' | 'onLine'> = navigator,
  width = window.innerWidth
): FeedbackContext => ({
  appVersion,
  os: describeOs(nav.userAgent, nav.maxTouchPoints),
  browser: describeBrowser(nav.userAgent),
  deviceClass: deviceClassFor(width),
  language: nav.language,
  online: nav.onLine
});
