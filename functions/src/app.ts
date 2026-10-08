import express, { Request, Response } from 'express';
import { defineString } from 'firebase-functions/params';

// Parámetros de Digital Asset Links. `firebase deploy` pide los valores la primera vez
// y los guarda en functions/.env.<project-id> (ignorado por git).
const androidPackageName = defineString('ANDROID_PACKAGE_NAME', {
  description: 'Package name de la APK Android (TWA)',
});
const androidSha256Fingerprint = defineString('ANDROID_SHA256_FINGERPRINT', {
  default: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
  description: 'Huella SHA-256 del certificado de firma de la APK Android',
});

export const app = express();

app.use(express.json());

// Endpoint Digital Asset Links para validación y certificación de APK nativo de Android (TWA / Trusted Web Activity)
app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: androidPackageName.value(),
        sha256_cert_fingerprints: [androidSha256Fingerprint.value()],
      },
    },
  ]);
});

// API Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'NeuroProductividad Dr. Benito Sipos API',
    uptime: process.uptime(),
  });
});

// Ruta API para inferencia NLP TF-IDF en servidor (Módulo 3)
app.post('/api/nlp/infer', (req: Request, res: Response) => {
  // Express 5 deja req.body como undefined cuando la petición no trae JSON
  const { title, description } = req.body ?? {};
  // Endpoint de fallback para microservicio de vectorización
  res.json({
    message: 'Procesamiento semántico recibido',
    input: { title, description },
    processedAt: new Date().toISOString(),
  });
});
