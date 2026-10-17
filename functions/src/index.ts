import { onRequest } from 'firebase-functions/https';
import { app } from './app';

// Firebase Hosting reescribe /.well-known/assetlinks.json hacia esta función (ver firebase.json); Android la lee para
// verificar la APK (TWA)
export const api = onRequest({ region: 'europe-west1', maxInstances: 10 }, app);

// Aprobación de accesos (solicitud, decisión de la administración y avisos por email) y mensajes de contacto, con sus
// respuestas
export { forgetAccess, requestAccess, revokeSessions, setAccess, setAccessMode, syncAccess } from './access';
export { replyToFeedback, submitFeedback } from './feedback';

// Notificaciones push de las alarmas: registro de dispositivos, cola de alarmas y envío cada minuto
export { queueTaskAlarm, registerPushDevice, sendDueAlarms } from './push';
