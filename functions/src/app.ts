import express, { Request, Response } from 'express';

// Función HTTP `api`: solo sirve los Digital Asset Links de la APK Android (lo demás son funciones invocables)
import { defineString } from 'firebase-functions/params';

// Parámetros de Digital Asset Links. `firebase deploy` pide los valores la primera vez
// y los guarda en functions/.env.<project-id> (ignorado por git).
const androidPackageName = defineString('ANDROID_PACKAGE_NAME', {
  // Sin configurar (p. ej. al probar en local), uno de ejemplo: no coincide con ninguna APK
  default: 'com.example.clar',
  description: 'Package name de la APK Android (TWA)'
});
const androidSha256Fingerprint = defineString('ANDROID_SHA256_FINGERPRINT', {
  default: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
  description: 'Huella SHA-256 del certificado de firma de la APK Android'
});

export const app = express();

// Endpoint Digital Asset Links para validación y certificación de APK nativo de Android (TWA / Trusted Web Activity)
app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: androidPackageName.value(),
        sha256_cert_fingerprints: [androidSha256Fingerprint.value()]
      }
    }
  ]);
});
