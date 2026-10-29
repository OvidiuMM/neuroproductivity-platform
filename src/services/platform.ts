// En qué dispositivo y cómo se abre CLAR, para lo que la web no hace igual en todos (avisos, inicio de sesión)
interface PlatformInfo {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}

const current = (): PlatformInfo => ({
  userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
  standalone:
    typeof window !== 'undefined' &&
    ((typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
});

// iPhone o iPad (el iPad se presenta como un Mac, pero con pantalla táctil)
export const isIOS = ({ userAgent, maxTouchPoints }: PlatformInfo = current()) =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
export const isAndroid = ({ userAgent }: PlatformInfo = current()) => /Android/.test(userAgent);
// Abierta como app instalada (desde el icono), no en una pestaña del navegador
export const isStandalone = ({ standalone }: PlatformInfo = current()) => standalone;

// En el iPhone, las alarmas con CLAR cerrada solo llegan a la app añadida a la pantalla de inicio (iOS 16.4 o posterior)
export const needsHomeScreenForPush = (info: PlatformInfo = current()) => isIOS(info) && !isStandalone(info);
// En la app de la pantalla de inicio del iPhone, las ventanas emergentes (Google) no devuelven el resultado
export const popupsUnreliable = (info: PlatformInfo = current()) => isIOS(info) && isStandalone(info);

// Ahí, para eliminar una cuenta de Google vale haber entrado en esta sesión hace menos de 4 minutos (el servidor pide
// menos de 5). Se mide con las horas del token recién renovado, las dos del servidor: no depende del reloj del
// dispositivo ni de otras sesiones
const RECENT_SIGN_IN_MS = 4 * 60 * 1000;
export const signedInRecently = ({ authTime, issuedAtTime }: { authTime: string; issuedAtTime: string }) =>
  Date.parse(issuedAtTime) - Date.parse(authTime) < RECENT_SIGN_IN_MS;
export const IPHONE_DELETE_HELP =
  'Para eliminar la cuenta desde la app del iPhone, cierra sesión, vuelve a entrar y elimínala en los 4 minutos siguientes.';
