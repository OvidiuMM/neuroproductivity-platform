import { onRequest } from 'firebase-functions/https';
import { app } from './app';

// Firebase Hosting reescribe /api/** y /.well-known/assetlinks.json hacia esta función (ver firebase.json).
// cors: true mantiene el acceso desde clientes móviles (Android Capacitor / TWA / WebView).
export const api = onRequest({ region: 'europe-west1', cors: true, maxInstances: 10 }, app);
