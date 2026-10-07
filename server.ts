import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de CORS para permitir solicitudes desde clientes móviles (Android Capacitor / TWA / WebView)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());

// Endpoint Digital Asset Links para validación y certificación de APK nativo de Android (TWA / Trusted Web Activity)
app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_PACKAGE_NAME || 'org.neuroproductividad.app',
        sha256_cert_fingerprints: [
          process.env.ANDROID_SHA256_FINGERPRINT || '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00'
        ]
      }
    }
  ]);
});

// API Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'NeuroProductividad Dr. Benito Sipos API',
    uptime: process.uptime()
  });
});

// Ruta API para inferencia NLP TF-IDF en servidor (Módulo 3)
app.post('/api/nlp/infer', (req: Request, res: Response) => {
  const { title, description } = req.body;
  // Endpoint de fallback para microservicio de vectorización
  res.json({
    message: 'Procesamiento semántico recibido',
    input: { title, description },
    processedAt: new Date().toISOString()
  });
});

// Servir archivos estáticos del build de producción (dist/)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA Fallback para React Router / navegación HTML5
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[NeuroProductividad Server] Servidor ejecutándose en el puerto ${PORT}`);
});
