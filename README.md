# NeuroProductividad — Plataforma de Gestión del Tiempo y Neurociencia Aplicada

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-0.6.0-indigo.svg)](#)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38bdf8.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Architecture](https://img.shields.io/badge/Architecture-Offline--First-emerald.svg)](#arquitectura-técnica)

Plataforma web de **gestión del tiempo y neuroproductividad** inspirada en la metodología del **Dr. Jonathan Benito Sipos** (profesor e investigador de Neurociencia en la Universidad Autónoma de Madrid, autor de *Gestiona tu tiempo, disfruta de la vida* y *Redefine imposible*).

El sistema rechaza las restricciones coercitivas (como las rotaciones atencionales arbitrarias o las "Tareas Muro" matutinas únicas), sustituyéndolas por un **andamiaje digital para la corteza prefrontal** que combina evaluación holística de la satisfacción vital, jerarquía visual basada en leyes de Gestalt, inferencia léxica TF-IDF y blindaje de la atención frente a interrupciones crónicas.

---

## 🧠 Fundamentos Metodológicos y Módulos del Sistema

### 1. Motor Estratégico: Rueda de la Vida & Trazabilidad Temporal Inmutable (`M1`)
* **Gráfico Polar Interactivo SVG:** Mapeo de 7 dominios vitales (*Salud, Carrera Profesional, Finanzas, Familia, Ocio, Relaciones, Espiritualidad*) evaluados del 0 al 10 con arrastre y redibujado en tiempo real.
* **Cuentas y sincronización:** Inicio de sesión con Google; los datos de cada cuenta se guardan en Firestore (UE), funcionan sin conexión y se sincronizan entre dispositivos. En el primer inicio de sesión se ofrece importar los datos que la versión anterior guardaba solo en el navegador. Desde el menú de la cuenta se pueden descargar los datos o eliminar la cuenta con todo su contenido.
* **Primer arranque guiado:** Una cuenta sin evaluaciones abre directamente la Rueda con todas las áreas a 0 y un aviso de primer paso que enlaza a la guía *Cómo funciona* (pantallas, relaciones entre módulos y dónde se guardan los datos).
* **Persistencia Append-Only:** Prohibición estricta de sobrescritura (`UPDATE`). Cada consolidación genera un nuevo snapshot inmutable con sellos de tiempo precisos en formato UTC (Unix Epoch).
* **Comparativa Histórica de Neuroplasticidad:** Superposición gráfica de polígonos translúcidos (actual vs. 30, 90 o 365 días) para verificar empíricamente el impacto del hábito sostenido y activar circuitos de recompensa dopaminérgicos.

### 2. Gestor Dual de Listas & Jerarquía Visual Gestalt (`M2`)
* **Segregación Estricta:** Separación absoluta entre la **Lista Profesional** y la **Lista Personal** para erradicar el coste metabólico asociado al cambio de contexto (*context-switching*).
* **Algoritmo de Jerarquía Visual (Top 10):** En lugar de limitar artificialmente el inventario, los primeros 10 elementos se destacan visualmente mediante tipografía en negrita (`font-weight: 700`), sombras de elevación paralela (`shadow-md`), colores cálidos y márgenes expandidos. Los elementos 11+ se renderizan con diseño minimalista y desaturado.
* **Sumidero Cognitivo "Quizá" / "Algún día" (HU-03):** Externalización de iniciativas embrionarias sin urgencia operativa, excluidas del Top 10 diario mediante índices parciales pero preservadas en "Opciones Futuras".
* **Estado y archivo:** Cada tarea tiene un estado manual (Pendiente, En progreso, Bloqueada, Hecha). Las tareas hechas se archivan y se consultan en la ventana «Archivadas», desde donde se reactivan cambiando su estado.
* **Fechas y alertas:** Fecha límite o intervalo opcional, con hora opcional. El título se pone violeta cuando falta menos de una semana y rojo cuando ha vencido.
* **Calendario:** Las tareas con fecha límite se añaden a Google Calendar, Outlook.com, Outlook de Microsoft 365 o cualquier calendario (`.ics`), mediante enlaces y sin conectar cuentas.

### 3. Motor NLP de Enlace Cognitivo (`M3`)
* **Vectorización TF-IDF Asíncrona:** Limpieza léxica y cálculo de frecuencia de término ponderada por frecuencia inversa de documento al perder el foco (`onBlur`) en los formularios.
* **Similitud del Coseno:** Comparación del vector resultante contra centroides pre-entrenados de las 7 áreas de la Rueda de la Vida.
* **Insignia Interactiva:** Sugerencia automática (*"¿Vincular a: Finanzas? [Validar]"*) si la confianza estadística supera el umbral empírico $\ge 0.65$.

### 4. Analizador Sintáctico de la Acción Inmediata Siguiente (`M4`)
* **Filtro contra Proyectos Amorfos:** Intercepta descriptores abstractos como *"Marketing"*, *"Coche"* o *"Finanzas"*.
* **Asistente Contextual Prefrontal:** Pregunta activamente *"¿Cuál es el primer paso físico e indivisible? Convierte la meta en una acción (ej. Llamar al taller para pedir presupuesto)"*, exigiendo un verbo transitivo de acción física motora.

### 5. Blindaje del Triángulo de las Bermudas (`M5`)
* **Auditoría y Bloqueo de Reuniones Matutinas:** Bloqueo heurístico inquebrantable de reuniones convocadas antes de las 12:00 h (franja biológica de máxima demanda cognitiva y concentración profunda), sugiriendo su reubicación hacia las 13:00 h (hora valle).
* **Triple Validación Obligatoria:** Toda reunión exige hora de inicio y fin inamovibles (`end_time > start_time`), orden del día cerrado no vacío y un moderador nominal responsable.
* **Redacción Inversa de Correo Electrónico:** Secuencia contra-intuitiva donde los adjuntos y el cuerpo del mensaje deben redactarse primero, manteniendo bloqueado el campo de **Destinatarios** hasta que el contenido esté validado. Alerta en tiempo real si el texto supera la dimensión estándar libre de scroll (*no-scroll*).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Algoritmia** | Motor TF-IDF & Cosine Similarity en TS, Parser sintáctico de verbos en español |
| **Visualización** | SVG interactivo polar / radar, Matemáticas polares de deformación poligonal |
| **Cuentas y datos** | Firebase Authentication (Google) y Cloud Firestore (`europe-west1`) con caché persistente: funciona sin conexión y sincroniza entre dispositivos |
| **Hosting y API** | Firebase Hosting (SPA) y Cloud Functions for Firebase 2.ª gen con Express (`europe-west1`) |
| **Referencia Backend** | PostgreSQL (Esquema DDL relacional con índices parciales B-Tree y tipos JSONB) |

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
* Node.js $\ge 22.12$
* npm (el gestor utilizado por CI y el despliegue)
* Java 21 o superior para el emulador de Firestore (desarrollo local y pruebas)
* La Firebase CLI se instala con `npm ci` (`firebase-tools` en `devDependencies`); `npx firebase …` usa esa versión

### Pasos
```bash
# 1. Clonar el repositorio
git clone https://github.com/OvidiuMM/neuroproductivity-platform.git
cd neuroproductivity-platform

# 2. Instalar dependencias (frontend y Cloud Functions)
npm ci
npm ci --prefix functions

# 3. Iniciar la app en local: arranca los emuladores de Auth y Firestore (proyecto demo, sin tocar producción)
#    y la app conectada a ellos. El inicio de sesión con Google lo simula el emulador.
npm run dev

# 4. Compilar para producción
npm run build

# 5. Ejecutar validación de tipos y linter
npm run lint

# 6. Ejecutar pruebas unitarias, de integración, de reglas de Firestore y de la API
npm run test:unit
npm run test:integration
npm run test:rules
npm --prefix functions test

# 7. Instalar Chromium y ejecutar pruebas E2E
npx playwright install chromium
npm run test:e2e
```

La app estará disponible en `http://localhost:3000` y la interfaz de los emuladores en `http://localhost:4020`. Los emuladores usan puertos distintos de los de por defecto de Firebase (Auth 9399, Firestore 8281, Functions 5021, Hosting 5002) para poder convivir con los de otros proyectos.

### Pruebas automatizadas

El banco de pruebas cubre lógica pura con el test runner de Node, la importación de datos locales, las reglas de seguridad de Firestore contra el emulador y flujos de extremo a extremo en Chromium con Playwright (inicio de sesión con el emulador de Auth, primer arranque, importación y tareas). `npm test` ejecuta todos los niveles; las rutas de la API se prueban aparte con `npm --prefix functions test`. GitHub Actions también valida tipos, compila la aplicación y la función, y ejecuta toda la suite en cada push y pull request.

### Despliegue en Firebase (Hosting + Cloud Functions + Firestore)

Firebase Hosting sirve la SPA compilada (`dist/`), la función `api` (Cloud Functions 2.ª gen, región `europe-west1`) atiende el backend y Firestore guarda los datos de cada cuenta en `users/{uid}/…`. Las reglas (`firestore.rules`) solo permiten a cada persona acceder a sus propios datos y hacen las evaluaciones de la Rueda *append-only*. La app lee su configuración de Firebase de `/__/firebase/init.json`, que sirve el propio Hosting, así que el ID del proyecto no está en el código. Las rutas se definen en `firebase.json`:

| Ruta | Destino |
| :--- | :--- |
| `/api/**` | Función `api` (`functions/src/app.ts`) |
| `/.well-known/assetlinks.json` | Función `api` (Digital Asset Links de la APK Android) |
| `**` | `index.html` (fallback de la SPA) |

Requisitos: un proyecto de Firebase en plan Blaze (Cloud Functions lo exige), una base de datos de Firestore `(default)` en `europe-west1`, el proveedor de inicio de sesión **Google** activado en Authentication y la Firebase CLI con sesión iniciada (`npx firebase login`).

El ID del proyecto no se versiona: `.firebaserc` está en `.gitignore`. En cada clon, selecciona el proyecto una vez:

```bash
firebase use --add
```

La función usa dos parámetros, `ANDROID_PACKAGE_NAME` y `ANDROID_SHA256_FINGERPRINT`. `firebase deploy` los pide la primera vez y los guarda en `functions/.env.<project-id>`, ignorado por git. Para los emuladores, defínelos en `functions/.env.local`.

```bash
# Emuladores locales (proyecto demo): Hosting en http://localhost:5002, Functions, Auth y Firestore
npm run emulators

# Despliegue: compila la SPA y la función antes de subirlas y publica las reglas de Firestore
npm run deploy
```

#### Despliegue automático desde GitHub Actions

Cada push a `main` (por ejemplo, al mergear un pull request) despliega Hosting, la función y las reglas de Firestore si el job `validate` pasa. Los deploys se ejecutan de uno en uno. GitHub se autentica en Google Cloud con Workload Identity Federation: cada ejecución recibe un token temporal y no hay claves de cuenta de servicio guardadas.

El workflow necesita estos valores en el repositorio. Los secrets se ocultan en los logs, así que el ID del proyecto tampoco aparece ahí.

| Tipo | Nombre | Valor |
| :--- | :--- | :--- |
| Secret | `FIREBASE_PROJECT_ID` | ID del proyecto de Firebase |
| Secret | `GCP_SERVICE_ACCOUNT` | Email de la cuenta de servicio `github-deployer` |
| Secret | `GCP_WORKLOAD_IDENTITY_PROVIDER` | Ruta completa del proveedor de identidad |
| Variable | `ANDROID_PACKAGE_NAME` | Package name de la APK |
| Variable | `ANDROID_SHA256_FINGERPRINT` | Huella SHA-256 del certificado de firma de la APK |

Configuración inicial, una sola vez, con una cuenta propietaria del proyecto:

```bash
PROJECT_ID=<project-id>
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="github-deployer@$PROJECT_ID.iam.gserviceaccount.com"
REPO_ID=1408574835  # gh api repos/OvidiuMM/neuroproductivity-platform -q .id

# 1. Cuenta de servicio con los permisos para desplegar Hosting, Functions y las reglas de Firestore
gcloud iam service-accounts create github-deployer --project "$PROJECT_ID" --display-name "GitHub Actions deployer"
for role in roles/firebasehosting.admin roles/cloudfunctions.admin roles/firebaserules.admin roles/datastore.indexAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA" --role "$role" --condition None
done
# Las funciones se ejecutan con la cuenta de servicio de Compute y el CLI comprueba también la de App Engine;
# desplegar exige poder actuar como ellas. Omite la de App Engine si el proyecto no la tiene.
for runtime_sa in "$PROJECT_NUMBER-compute@developer.gserviceaccount.com" "$PROJECT_ID@appspot.gserviceaccount.com"; do
  gcloud iam service-accounts add-iam-policy-binding "$runtime_sa" \
    --project "$PROJECT_ID" --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser
done

# 2. Workload Identity Federation, limitada a este repositorio y a la rama main
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT_ID"
gcloud iam workload-identity-pools create github --project "$PROJECT_ID" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc neuroproductivity-platform --project "$PROJECT_ID" \
  --location global --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository_id == '$REPO_ID' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT_ID" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository_id/$REPO_ID"

# 3. Secrets y variables del repositorio
gh secret set FIREBASE_PROJECT_ID --body "$PROJECT_ID"
gh secret set GCP_SERVICE_ACCOUNT --body "$SA"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER \
  --body "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/neuroproductivity-platform"
gh variable set ANDROID_PACKAGE_NAME --body "<package-name>"
gh variable set ANDROID_SHA256_FINGERPRINT --body "<huella-sha256>"
```

El repositorio utiliza `package-lock.json` (en la raíz y en `functions/`) como únicos archivos de bloqueo; no añadas `bun.lock` ni `pnpm-lock.yaml`. Después de cambiar dependencias, actualiza y confirma `package.json` y `package-lock.json` juntos. Para comprobar la instalación reproducible, ejecuta `npm ci` y `npm ci --prefix functions` antes de compilar y probar.

---

## 📂 Estructura del Proyecto

```text
├── index.html                   # Entry point HTML con tipografía Plus Jakarta Sans
├── package.json                 # Dependencias y scripts
├── vite.config.ts               # Configuración de Vite y Tailwind
├── tsconfig.json                # Configuración de TypeScript estricto
├── firebase.json                # Firebase Hosting (rewrites y caché), Cloud Functions, Firestore y emuladores
├── firestore.rules              # Reglas de seguridad: cada cuenta solo accede a users/{uid}
├── functions/                   # Cloud Functions for Firebase (API)
│   ├── src/
│   │   ├── index.ts             # Función HTTP `api` (región europe-west1)
│   │   └── app.ts               # Rutas Express: /api/health, /api/nlp/infer y assetlinks.json
│   └── test/
│       └── app.test.ts          # Pruebas de las rutas de la API
├── src/
│   ├── main.tsx                 # Montaje de la aplicación React
│   ├── AuthGate.tsx             # Inicio de sesión obligatorio antes de mostrar la app
│   ├── App.tsx                  # Orquestador principal de estado y vistas
│   ├── index.css                # Estilos base con Tailwind CSS
│   ├── types/
│   │   └── index.ts             # Modelos de datos (TaskItem, WheelLog, MeetingGuard, etc.)
│   ├── services/
│   │   ├── nlpEngine.ts         # Motor TF-IDF y Similitud del Coseno
│   │   ├── syntaxAnalyzer.ts    # Analizador de verbos de acción física
│   │   ├── firebase.ts          # Configuración de Firebase, Auth y Firestore con caché sin conexión
│   │   ├── repository.ts        # Lectura en tiempo real y escritura de los datos de cada cuenta
│   │   └── localData.ts         # Importación de los datos de la versión sin cuentas (localStorage)
│   └── components/
│       ├── Navbar.tsx           # Barra superior (Contrato de 3 Zonas)
│       ├── TaskList.tsx         # Jerarquía Visual Gestalt (Top 10 vs Periférico)
│       ├── TaskModal.tsx        # Captura con validación sintáctica y TF-IDF
│       ├── WheelOfLife.tsx      # Rueda de la Vida polar SVG interactiva
│       ├── BermudasShield.tsx   # Blindaje de Agenda y Correo Inverso
│       ├── MeetingModal.tsx     # Agendamiento con bloqueo matutino y triple validación
│       ├── EmailModal.tsx       # Cliente con redacción inversa y alerta no-scroll
│       ├── LoginScreen.tsx      # Inicio de sesión con Google y aviso de privacidad
│       ├── AccountMenu.tsx      # Cerrar sesión, descargar datos y eliminar la cuenta
│       ├── ImportLocalDataModal.tsx # Importación de datos locales en el primer inicio de sesión
│       ├── HowItWorks.tsx       # Guía «Cómo funciona»: pantallas y relaciones entre módulos
│       └── SystemRequirementsViewer.tsx # Banco de pruebas en vivo y specs BDD
```

---

## 📜 Esquema de Base de Datos de Referencia (PostgreSQL)

```sql
-- 1. Histórico Append-Only de la Rueda de la Vida (Módulo 1)
CREATE TABLE wheel_of_life_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  health_score SMALLINT NOT NULL CHECK (health_score BETWEEN 1 AND 10),
  career_score SMALLINT NOT NULL CHECK (career_score BETWEEN 1 AND 10),
  finance_score SMALLINT NOT NULL CHECK (finance_score BETWEEN 1 AND 10),
  family_score SMALLINT NOT NULL CHECK (family_score BETWEEN 1 AND 10),
  spirit_score SMALLINT NOT NULL CHECK (spirit_score BETWEEN 1 AND 10),
  leisure_score SMALLINT NOT NULL CHECK (leisure_score BETWEEN 1 AND 10),
  relationship_score SMALLINT NOT NULL CHECK (relationship_score BETWEEN 1 AND 10)
);
CREATE INDEX idx_wheel_user_time ON wheel_of_life_log(user_id, timestamp DESC);

-- 2. Tareas Multidimensionales con Índice Parcial (Módulo 2)
CREATE TYPE list_context_enum AS ENUM ('WORK', 'PERSONAL');
CREATE TYPE priority_enum AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

CREATE TABLE task_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  list_context list_context_enum NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority priority_enum NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  observations JSONB DEFAULT '[]'::jsonb,
  is_someday BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índice parcial: Excluye el sumidero cognitivo del escrutinio del Top 10 diario
CREATE INDEX active_tasks_idx ON task_item(user_id, priority)
  WHERE is_someday = FALSE;

-- 3. Blindaje de Reuniones (Módulo 5)
CREATE TABLE meeting_guard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(100) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  agenda_points JSONB NOT NULL,
  moderator_id UUID,
  CONSTRAINT chk_time_order CHECK (end_time > start_time),
  CONSTRAINT chk_deep_morning_block CHECK (EXTRACT(HOUR FROM start_time) >= 12)
);
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para contribuir:
1. Haz un Fork del repositorio.
2. Crea una rama para tu funcionalidad (`git checkout -b feature/nueva-funcionalidad`).
3. Realiza tus cambios y verifica la compilación (`npm run build && npm run lint`).
4. Haz Commit de tus cambios (`git commit -m 'feat: añade nueva funcionalidad'`).
5. Haz Push a tu rama (`git push origin feature/nueva-funcionalidad`).
6. Abre un Pull Request describiendo el impacto metodológico y técnico.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT** — consulta el archivo [LICENSE](LICENSE) para más detalles.
