// Primero las opciones de todas las funciones (ver globalOptions.ts)
import './globalOptions';
import { onRequest } from 'firebase-functions/https';
import { app } from './app';

// Firebase Hosting reescribe /.well-known/assetlinks.json hacia esta función (ver firebase.json); Android la lee para
// verificar la APK (TWA)
export const api = onRequest({ region: 'europe-west1', maxInstances: 10 }, app);

// Aprobación de accesos (solicitud, decisión de la administración y avisos por email) y mensajes de contacto, con sus
// respuestas
export { forgetAccess, requestAccess, revokeSessions, setAccess, setAccessMode, syncAccess } from './access';
export { flushFeedbackNotices, replyToFeedback, submitFeedback } from './feedback';

// Funciones extra que la administración activa a cada cuenta
export { setFeatures } from './features';

// Sincronización con Google Calendar (función extra): conectar y desconectar, cada cambio de una tarea y la desconexión
// al perder la función
export {
  calendarFeatureChanged,
  calendarPrefChanged,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  syncTaskCalendar
} from './calendarSync';

// Notificaciones push de las alarmas: registro de dispositivos, cola de alarmas y envío cada minuto
export { queueTaskAlarm, registerPushDevice, sendDueAlarms, unregisterPushDevice } from './push';
