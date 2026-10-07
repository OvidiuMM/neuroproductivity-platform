# NeuroProductividad — Plataforma de Gestión del Tiempo y Neurociencia Aplicada

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-0.1.0-indigo.svg)](#)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38bdf8.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Architecture](https://img.shields.io/badge/Architecture-Offline--First-emerald.svg)](#arquitectura-técnica)

Plataforma web de **gestión del tiempo y neuroproductividad** fundamentada en los preceptos neurocientíficos desarrollados por el **Dr. Jonathan Benito Sipos** (profesor e investigador de Neurociencia en la Universidad Autónoma de Madrid, autor de *Gestiona tu tiempo, disfruta de la vida* y *Redefine imposible*).

El sistema rechaza las restricciones coercitivas (como las rotaciones atencionales arbitrarias o las "Tareas Muro" matutinas únicas), sustituyéndolas por un **andamiaje digital para la corteza prefrontal** que combina evaluación holística de la satisfacción vital, jerarquía visual basada en leyes de Gestalt, inferencia léxica TF-IDF y blindaje de la atención frente a interrupciones crónicas.

---

## 🧠 Fundamentos Metodológicos y Módulos del Sistema

### 1. Motor Estratégico: Rueda de la Vida & Trazabilidad Temporal Inmutable (`M1`)
* **Gráfico Polar Interactivo SVG:** Mapeo de 7 dominios vitales (*Salud, Carrera Profesional, Finanzas, Familia, Ocio, Relaciones, Espiritualidad*) evaluados del 1 al 10 con arrastre y redibujado en tiempo real.
* **Persistencia Append-Only:** Prohibición estricta de sobrescritura (`UPDATE`). Cada consolidación genera un nuevo snapshot inmutable con sellos de tiempo precisos en formato UTC (Unix Epoch).
* **Comparativa Histórica de Neuroplasticidad:** Superposición gráfica de polígonos translúcidos (actual vs. 30, 90 o 365 días) para verificar empíricamente el impacto del hábito sostenido y activar circuitos de recompensa dopaminérgicos.

### 2. Gestor Dual de Listas & Jerarquía Visual Gestalt (`M2`)
* **Segregación Estricta:** Separación absoluta entre la **Lista Profesional** y la **Lista Personal** para erradicar el coste metabólico asociado al cambio de contexto (*context-switching*).
* **Algoritmo de Jerarquía Visual (Top 10):** En lugar de limitar artificialmente el inventario, los primeros 10 elementos se destacan visualmente mediante tipografía en negrita (`font-weight: 700`), sombras de elevación paralela (`shadow-md`), colores cálidos y márgenes expandidos. Los elementos 11+ se renderizan con diseño minimalista y desaturado.
* **Sumidero Cognitivo "Quizá" / "Algún día" (HU-03):** Externalización de iniciativas embrionarias sin urgencia operativa, excluidas del Top 10 diario mediante índices parciales pero preservadas en "Opciones Futuras".

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
| **Almacenamiento** | Arquitectura *Offline-First* con IndexedDB y almacenamiento persistente local |
| **Referencia Backend** | PostgreSQL (Esquema DDL relacional con índices parciales B-Tree y tipos JSONB) |

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
* Node.js $\ge 18$ o $\ge 22$
* npm o pnpm o yarn

### Pasos
```bash
# 1. Clonar el repositorio
git clone https://github.com/OvidiuMM/neuroproductivity-platform.git
cd neuroproductivity-platform

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo local
npm run dev

# 4. Compilar para producción
npm run build

# 5. Ejecutar validación de tipos y linter
npm run lint
```

El servidor estará disponible en `http://localhost:3000` o `http://localhost:5173`.

---

## 📂 Estructura del Proyecto

```text
├── index.html                   # Entry point HTML con tipografía Plus Jakarta Sans
├── package.json                 # Dependencias y scripts
├── vite.config.ts               # Configuración de Vite y Tailwind
├── tsconfig.json                # Configuración de TypeScript estricto
├── src/
│   ├── main.tsx                 # Montaje de la aplicación React
│   ├── App.tsx                  # Orquestador principal de estado y vistas
│   ├── index.css                # Estilos base con Tailwind CSS
│   ├── types/
│   │   └── index.ts             # Modelos de datos (TaskItem, WheelLog, MeetingGuard, etc.)
│   ├── services/
│   │   ├── nlpEngine.ts         # Motor TF-IDF y Similitud del Coseno
│   │   ├── syntaxAnalyzer.ts    # Analizador de verbos de acción física
│   │   └── storage.ts           # Servicio Offline-First y snapshots append-only
│   └── components/
│       ├── Navbar.tsx           # Barra superior (Contrato de 3 Zonas)
│       ├── TaskList.tsx         # Jerarquía Visual Gestalt (Top 10 vs Periférico)
│       ├── TaskModal.tsx        # Captura con validación sintáctica y TF-IDF
│       ├── WheelOfLife.tsx      # Rueda de la Vida polar SVG interactiva
│       ├── BermudasShield.tsx   # Blindaje de Agenda y Correo Inverso
│       ├── MeetingModal.tsx     # Agendamiento con bloqueo matutino y triple validación
│       ├── EmailModal.tsx       # Cliente con redacción inversa y alerta no-scroll
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
