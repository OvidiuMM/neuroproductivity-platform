# CLAR — Plataforma de Gestión del Tiempo y Neurociencia Aplicada

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-0.9.3-indigo.svg)](#)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38bdf8.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Architecture](https://img.shields.io/badge/Architecture-Offline--First-emerald.svg)](#arquitectura-técnica)

Plataforma web de **gestión del tiempo y neuroproductividad**, publicada en https://clar.life. Hasta la versión 0.7 se llamaba NeuroProductividad.

> Algunas ideas de esta app se inspiran en el libro _Gestiona tu tiempo, disfruta de la vida_, de Jonathan Benito Sipos. Este proyecto no está afiliado ni respaldado por el autor.

El sistema rechaza las restricciones coercitivas (como las rotaciones atencionales arbitrarias o las "Tareas Muro" matutinas únicas), sustituyéndolas por un **andamiaje digital para la corteza prefrontal** que combina evaluación holística de la satisfacción vital, jerarquía visual basada en leyes de Gestalt, inferencia léxica TF-IDF y blindaje de la atención frente a interrupciones crónicas.

---

## 🎨 Marca

- **Nombre:** CLAR, como «claro» sin la O: ver con claridad qué hacer ahora. Se escribe siempre en mayúsculas y con algo de espacio entre letras.
- **Símbolo:** una lente enfocada, un anillo índigo sobre un cuadrado pizarra con un brillo blanco. Está en `src/components/BrandMark.tsx` y `public/icon.svg`. Los PNG para Android e iOS (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` y `apple-touch-icon.png`) salen del mismo dibujo.
- **Colores:**

  | Uso                                         | Color                 | Tailwind                              |
  | :------------------------------------------ | :-------------------- | :------------------------------------ |
  | Fondo de marca, botones principales y texto | `#0f172a`             | `slate-900`                           |
  | Anillo del símbolo y acento                 | `#818cf8` · `#4f46e5` | `indigo-400` · `indigo-600`           |
  | Lista Profesional                           | `#4f46e5`             | `indigo-600`                          |
  | Lista Personal                              | `#059669` · `#047857` | `emerald-600` · `emerald-700` (texto) |
  | Plazo cercano · vencido                     | `#7c3aed` · `#dc2626` | `violet-600` · `red-600`              |
  | Pendiente de sincronizar o de aprobar       | `#ea580c` · `#c2410c` | `orange-600` · `orange-700`           |

  Los textos pequeños usan como mínimo `slate-500` sobre blanco para cumplir el contraste WCAG AA.

- **Tipografía:** la del sistema de cada dispositivo. No se cargan fuentes externas: no se envía la IP de nadie a terceros al abrir la app.
- **Lema:** «Decide qué hacer ahora, con claridad».

---

## 🧭 El método: de lo que te importa a lo que haces hoy

1. **Rueda de la Vida:** puntúas de 0 a 10 tu satisfacción en 7 áreas. Es el punto de partida.
2. **Metas:** lo que quieres conseguir en cada área, empezando por las más bajas. Las áreas con 5 o menos y sin metas salen en «Necesitan atención».
3. **Tareas:** acciones físicas concretas, en la lista Profesional o Personal. Cada meta tiene «Añadir tarea», y una tarea vinculada toma el área de su meta. Lo que tiene fecha de fin y varias tareas se agrupa en un **proyecto** de la meta.
4. **Top 10 y Agenda:** qué hacer hoy y cuándo, con alarmas antes del plazo.
5. **Tiempo protegido:** mañanas sin reuniones y correos escritos en orden.

Al volver a evaluar la Rueda se ve el efecto de las acciones, y las áreas cambian de orden en «Metas».

**Navegación:** en tableta y escritorio, la cabecera lleva las secciones (Inicio, Listas, Agenda, Rueda de la Vida, Metas, Proyectos, Tiempo protegido, Ayuda y, para la administración, Administración), las dos listas, la sincronización y la cuenta. En el móvil, la barra inferior lleva Inicio, Listas, Agenda, Metas y «Más» (Rueda de la Vida, Proyectos, Tiempo protegido, Ayuda, Administración, la sincronización y la cuenta), con un botón flotante «Nueva tarea».

---

## 🧠 Fundamentos Metodológicos y Módulos del Sistema

### 1. Rueda de la Vida y trazabilidad (`M1`)

- **Gráfico polar SVG:** 7 áreas (_Salud, Carrera Profesional, Finanzas, Familia, Ocio, Relaciones, Espiritualidad_) evaluadas del 0 al 10 con deslizadores; el gráfico se redibuja al momento. Cada área indica cuántas metas activas tiene, y la tarjeta «Metas» lleva al paso siguiente.
- **Primer arranque guiado:** una cuenta sin evaluaciones abre directamente la Rueda con todas las áreas a 0 y un aviso de primer paso que enlaza a la «Ayuda» (pantallas, cómo se relacionan y dónde se guardan los datos).
- **Persistencia append-only:** cada evaluación se guarda como una nueva, con su fecha en UTC (ISO 8601); las anteriores no se modifican, y las reglas de Firestore lo impiden.
- **Comparativa histórica:** superpone a la evaluación actual cualquiera de las anteriores para ver qué áreas han mejorado.

### 2. Metas (`M6`)

- **Metas por área** (`users/{uid}/goals`): nombre, área de la Rueda, para qué y fecha objetivo; activas, logradas o archivadas.
- **Sección «Metas»:** las áreas van de la puntuación más baja a la más alta según la última evaluación (sin evaluación, en el orden de la Rueda), cada una con sus metas activas, su progreso (tareas hechas sobre el total) y las tareas que les quedan. Las áreas con 5 o menos y sin metas salen en «Necesitan atención», con un botón que abre la meta con esa área elegida. «Añadir tarea» crea una tarea ya vinculada a la meta. Las logradas y archivadas quedan plegadas al final.
- **Vínculo con las tareas** (`goalId`): la tarea toma el área de su meta al leerse, así cambiar el área de una meta no reescribe sus tareas. Al eliminar una meta, sus tareas se quedan sin meta y con su área.
- **Inicio:** una tarjeta con las metas activas y su progreso, y una recomendación cuando el área más baja de la última evaluación (5 o menos) no tiene metas.
- **Proyectos** (`users/{uid}/projects`, sección «Proyectos»): nombre, meta (obligatoria), fecha de fin y descripción; activos, terminados o archivados. Las tareas de un proyecto (`projectId`) toman su meta al leerse (`applyProjectGoals`) y cuentan en el avance de la meta. Cada proyecto muestra su avance como una batería (tareas hechas sobre el total, sin las canceladas) y avisa si va fuera de plazo (pasó la fecha de fin con tareas abiertas), si termina en menos de una semana, si todas sus tareas están hechas y si alguna vence después del fin. En su vista, las tareas se manejan con las mismas tarjetas que en «Listas». Cada meta muestra sus proyectos activos; una meta con proyectos no se puede eliminar, y al eliminar un proyecto sus tareas siguen en la meta (`src/services/projects.ts`).

### 3. Listas y jerarquía visual (`M2`)

- **Segregación Estricta:** Separación absoluta entre la **Lista Profesional** y la **Lista Personal** para erradicar el coste metabólico asociado al cambio de contexto (_context-switching_).
- **Jerarquía visual (Top 10):** en lugar de limitar el inventario, las 10 primeras tareas se destacan con tipografía más marcada, elevación y más espacio; de la 11 en adelante se muestran planas y más discretas.
- **Orden y filtros del Top 10:** por prioridad efectiva, fecha límite, estimación, actualización o área, y filtros por prioridad, estimación máxima, estado, plazo y área. Se guardan en cada dispositivo y el resumen «Top 10» cuenta lo mismo que muestra la lista.
- **Prioridad efectiva y estimación:** si la fecha límite está a más de una semana, la tarea cuenta un nivel menos de prioridad (las tareas sin fecha mantienen la suya). Cada tarea puede llevar una estimación de duración, visible en todas las listas.
- **Verbo físico:** el campo de la acción indica encima que empiece por una acción concreta (Llamar, Enviar, Reservar…).
- **Meta:** el formulario de la tarea permite vincularla a una meta activa (aparece cuando hay metas); la tarjeta muestra la meta en lugar del área.
- **«Algún día» (HU-03):** las ideas sin urgencia van a su propia pestaña y no compiten con el Top 10.
- **Tareas dependientes:** una tarea puede esperar a otra (`dependsOn`, una sola; «Empieza después de», en «Más opciones»). Mientras esa siga abierta, la dependiente sale con un candado, no entra en el Top 10 (va con el resto) y no se puede marcar como hecha ni en progreso; al hacerse o cancelarse la otra se desbloquea sola, y el aviso lo dice. Varias tareas pueden esperar a la misma, en paralelo. No se pueden crear ciclos, una tarea eliminada no bloquea y la siguiente repetición de una recurrente no hereda la espera (`src/services/dependencies.ts`).
- **Estado y archivo:** Cada tarea tiene un estado manual (Pendiente, En progreso, Bloqueada, Hecha, Cancelada). Marcarla como hecha es un toque, con «Deshacer». Las tareas hechas y las canceladas se archivan y se consultan en la ventana «Archivadas», desde donde se reactivan cambiando su estado. Una cancelada no cuenta como hecha: ni en las estadísticas ni en el avance de las metas.
- **Cambios sin guardar:** cerrar el formulario de una tarea o de una meta con cambios pregunta antes de descartarlos («Seguir editando» o «Descartar»); cerrar o recargar la pestaña con un formulario cambiado, también el de un correo, lo avisa el navegador.
- **Fechas y colores del plazo:** Fecha límite o intervalo opcional, con hora opcional. El título se pone violeta cuando falta menos de una semana y rojo cuando ha vencido. Los campos de fecha usan un calendario propio con la semana empezando en lunes (se escriben como dd/mm/aaaa y se manejan con el teclado), sea cual sea el idioma del navegador.
- **Alarmas:** una hora para avisar antes del plazo (ver [Alarmas](#alarmas-092)).
- **Tareas recurrentes:** cada día, semana (eligiendo los días), mes (día del mes, «el 2.º lunes» o «el último viernes») o año, cada N periodos. Al repetir, «Inicio» es desde cuándo se repite y la fecha límite hasta cuándo (opcional); cada repetición vence su propio día, nunca como un intervalo. Al marcar una repetición como Hecha o Cancelada se archiva y se crea la siguiente en la misma operación (cancelar una repetición no termina la serie) (sin duplicados aunque se marque desde dos dispositivos); las ya vencidas, hora límite incluida, se saltan si se completa con retraso.
- **Calendario:** «Añadir al calendario», en el menú «⋯» de la tarea, la lleva a Google Calendar, Outlook.com, Outlook de Microsoft 365 o cualquier calendario (`.ics`, con la alarma), mediante enlaces y sin conectar cuentas. Las recurrentes exportan la serie (RRULE con semanas que empiezan en lunes y el último día del mes cuando el día no existe); las de un intervalo de varios días exportan solo la repetición actual.

### 4. Motor de sugerencias (`M3`)

- **Vectorización TF-IDF:** limpieza léxica y frecuencia de término ponderada por frecuencia inversa de documento, al salir del campo Descripción (en «Más opciones»).
- **Similitud del Coseno:** Comparación del vector resultante contra centroides pre-entrenados de las 7 áreas de la Rueda de la Vida.
- **Sugerencia de área:** «Sugerencia: ¿Vincular a Finanzas? (82 % de confianza)», con «Usar esta área», si la confianza supera el umbral $\ge 0.65$ y la tarea no tiene meta.
- **Sugerencia de meta:** mientras se escribe el título, «Vincular a «meta»» propone la meta activa que más palabras comparte con él (`suggestGoal`).

### 5. Analizador de la acción siguiente (`M4`)

- **Filtro contra Proyectos Amorfos:** Intercepta descriptores abstractos como _"Marketing"_, _"Coche"_ o _"Finanzas"_.
- **Asistente:** pregunta «¿Cuál es el primer paso? Conviértelo en algo que puedas hacer ya.» y propone una acción concreta (por ejemplo «Llamar al taller para pedir presupuesto»), con un verbo de acción física.

### 6. Tiempo protegido: el triángulo de las Bermudas (`M5`)

- **Auditoría y Bloqueo de Reuniones Matutinas:** Bloqueo heurístico inquebrantable de reuniones convocadas antes de las 12:00 h (franja biológica de máxima demanda cognitiva y concentración profunda), sugiriendo su reubicación hacia las 13:00 h (hora valle).
- **Triple Validación Obligatoria:** Toda reunión exige hora de inicio y fin inamovibles (`end_time > start_time`), orden del día cerrado no vacío y un moderador nominal responsable.
- **Redacción Inversa de Correo Electrónico:** Secuencia contra-intuitiva donde los adjuntos y el cuerpo del mensaje deben redactarse primero, manteniendo bloqueado el campo de **Destinatarios** hasta que el contenido esté validado. Alerta en tiempo real si el texto supera la dimensión estándar libre de scroll (_no-scroll_).
- **CLAR no envía correos:** los guarda (también a medias, como borradores), apunta de los adjuntos solo el nombre y el tamaño y, con «Abrir en mi correo», los pasa al programa de correo (ver [Borradores de correo](#borradores-de-correo-092)).

### Cuentas, Inicio, Agenda y accesibilidad

- **Cuentas y sincronización:** Inicio de sesión con Google o con email y contraseña (con verificación del email antes de solicitar acceso y recuperación de la contraseña por email); los datos de cada cuenta se guardan en Firestore (UE), funcionan sin conexión y se sincronizan entre dispositivos. En el primer inicio de sesión se ofrece importar los datos que la versión anterior guardaba solo en el navegador. Un indicador en la cabecera está verde cuando todo está guardado en el servidor y naranja cuando hay cambios pendientes o no hay conexión; al pulsarlo se fuerza la sincronización.
- **Cuenta autogestionada:** desde el menú de la cuenta se cambia la contraseña, se cierra la sesión en todos los dispositivos (los demás pierden el acceso en menos de una hora), se descargan los datos y se elimina la cuenta con todo su contenido, confirmándolo con la contraseña o con Google.
- **Acceso:** la administración puede exigir la aprobación de cada cuenta (por defecto) o desactivarla; también puede retirar el acceso o bloquear una cuenta junto con su email. Sin acceso se ve una pantalla para solicitarlo con un mensaje opcional, desde la que también se pueden descargar o eliminar los datos guardados. La administración decide en **Administración** → **Solicitudes** y recibe un email por cada solicitud; la persona recibe otro cuando se aprueba (detalles en [Aprobación de accesos](#aprobación-de-accesos)).
- **Accesibilidad:** panel propio (menú de la cuenta y pantallas de inicio de sesión y acceso) con tamaño del texto, alto contraste, reducir animaciones y foco muy visible, guardados en cada dispositivo. Toda la app se usa con el teclado (los diálogos atrapan y devuelven el foco, enlace para saltar al contenido) y una auditoría automática WCAG 2.1 AA revisa cada pantalla en CI.
- **Inicio:** el foco de la lista activa, las metas activas con su progreso y estadísticas de las tareas (hechas por día, semana y mes; antes o después del plazo; velocidad en tareas y horas estimadas por semana; tiempo medio hasta completarlas; racha; pendientes y vencidas; reparto por área), con recomendaciones según esos datos.
- **Agenda:** vista semanal (de lunes a domingo) y por días (14 días, también los vacíos) con las tareas con fecha de las dos listas, los intervalos, las repeticiones previstas de las tareas recurrentes y las reuniones. En la vista por días las tareas vencidas aparecen aparte; al pulsar una tarea se edita.
- **Contacto:** «Escríbenos» (en la Ayuda, en «Tu cuenta» y en la pantalla de acceso) envía ideas, fallos o dudas; la administración los lee y los responde por email desde la app.
- **Textos legales:** política de privacidad (`/privacidad`), condiciones de uso (`/condiciones`) y aviso legal (`/aviso-legal`), públicos y sin iniciar sesión (`src/Root.tsx` elige la página por la ruta, sin cargar Firebase). Están enlazados desde las pantallas de inicio de sesión y de acceso, el pie, el menú de la cuenta y la Ayuda; al entrar se acepta tener al menos 14 años y las condiciones. El contenido está en `src/components/LegalTexts.tsx`, y el titular, el email de contacto y la fecha de la versión, en `src/services/legal.ts`: al cambiar el contenido, cambia también la fecha. Una prueba unitaria falla si falta el titular o el email.

## 🗒️ Novedades por versión

### Metas, bienvenida, recorrido y contacto (0.9)

- **Metas:** objetivos concretos dentro de un área de la Rueda (`users/{uid}/goals`). Las tareas se vinculan con `goalId` y toman el área de su meta al leerse; el progreso de cada meta son sus tareas hechas sobre el total.
- **Sección «Metas» (0.9.1):** el paso entre la Rueda y las tareas. Las áreas van de la puntuación más baja a la más alta según la última evaluación, cada una con sus metas activas, su progreso y las tareas que les quedan. «Añadir tarea» crea una tarea ya vinculada a la meta. Las áreas con 5 o menos y sin metas salen en «Necesitan atención».
- **Navegación móvil:** barra inferior (Inicio, Listas, Agenda, Metas y «Más», con la Rueda, Proyectos, Tiempo protegido, la Ayuda, la sincronización y la cuenta), botón flotante «Nueva tarea» y hojas inferiores para «Más» y para ordenar y filtrar.
- **Tareas:** completar de un toque con «Deshacer» (comprobado en una transacción), menú «⋯» y formulario en dos niveles.
- **Bienvenida y recorrido guiado:** se muestran una vez por cuenta (`hasSeenOnboarding` en el perfil, con copia local) y se repiten desde Ayuda.
- **Contacto:** «Escríbenos» envía el mensaje a la Cloud Function `submitFeedback` (email confirmado, 5 por hora), que lo guarda en `feedback_tickets` y avisa por email. La administración lo lee en «Administración» → «Mensajes».

### Alarmas (0.9.2)

- **Una hora por tarea** (`alarmTime`, HH:mm). El momento en que suena se calcula al leer, en la zona horaria del dispositivo (`src/services/alarms.ts`): con hora límite, dentro de las 24 h anteriores (el mismo día si es antes; si no, la víspera); solo con fecha, la víspera a esa hora. Una tarea que se repite necesita hora límite, y cada repetición hereda la alarma.
- **Avisa con la app abierta** (`useTaskAlarms`): un aviso dentro de CLAR con «Ver tarea» y, con permiso, una notificación del sistema (sin service worker; en Android y en Safari del iPhone sin instalar, solo el aviso dentro de la app). Las alarmas que pasaron con la app cerrada avisan al abrirla si la tarea aún no ha vencido. Cada alarma avisa una sola vez, también con varias pestañas (`localStorage` y Web Locks).
- **Calendario:** el archivo .ics incluye la alarma (`VALARM`).

### Borradores de correo (0.9.2)

- **Borradores:** un correo de «Tiempo protegido» se puede guardar sin terminar (`status: 'draft'`) con «Guardar borrador» o, solo, al cerrar el editor con cambios. «Borradores» y «Guardados» se abren para continuar o editar (se guarda sobre el mismo documento) y se eliminan con «Deshacer».
- **Adjuntos:** «Elegir archivos» abre el selector del sistema; se guardan solo el nombre y el tamaño, como lista de lo que adjuntar al enviarlo.
- **Abrir en mi correo:** enlace `mailto:` con los destinatarios válidos, el asunto y el texto. CLAR no envía correos.

### Respuestas a los mensajes de contacto (0.9.2)

- En **Administración** → **Mensajes**, «Responder» envía la respuesta por email a quien escribió, desde el buzón de `SMTP_USER` y con su mensaje citado; si contesta, le llega a ese buzón. La Cloud Function `replyToFeedback` (solo la administración) guarda la respuesta en el mensaje (`replies`) únicamente si el envío sale, y un mensaje nuevo pasa a leído. Desde la app nadie puede escribir respuestas directamente (las reglas solo dejan cambiar el estado).
- «Desde mi correo» sigue abriendo el programa de correo, para responder desde otra cuenta.

### Proyectos, dependencias, «Cancelada» y descargas (0.9.3)

- **Estado «Cancelada»:** archiva la tarea como «Hecha», con su fecha y «Deshacer», pero no cuenta como hecha: ni en las estadísticas ni en el avance de metas y proyectos. Cancelar una repetición crea la siguiente.
- **Cambios sin guardar:** cerrar el formulario de una tarea, una meta o un proyecto con cambios pregunta antes de descartarlos; cerrar la pestaña, lo avisa el navegador (`useDiscardGuard`).
- **Tareas dependientes** (`dependsOn`): una tarea espera a otra y queda bloqueada hasta que esa esté hecha o cancelada; varias pueden esperar a la misma, en paralelo (ver [Listas](#3-listas-y-jerarquía-visual-m2)).
- **Proyectos** (`users/{uid}/projects`): tareas con fecha de fin dentro de una meta, con su avance como una batería y avisos de plazo (ver [Metas](#2-metas-m6)).
- **Descargas en JSON:** una tarea («⋯» → «Descargar (JSON)»), una meta o un proyecto, con todos sus datos y los nombres de lo relacionado (`src/services/exports.ts`).

---

## 🛠️ Stack Tecnológico

| Capa                   | Tecnologías                                                                                                                                                                                      |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**           | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons                                                                                                                                        |
| **Algoritmia**         | Motor TF-IDF & Cosine Similarity en TS, Parser sintáctico de verbos en español                                                                                                                   |
| **Visualización**      | SVG interactivo polar / radar, Matemáticas polares de deformación poligonal                                                                                                                      |
| **Cuentas y datos**    | Firebase Authentication (Google y email con contraseña) y Cloud Firestore (`europe-west1`) con caché persistente: funciona sin conexión y sincroniza entre dispositivos                          |
| **Hosting y API**      | Firebase Hosting (SPA, en https://clar.life) y Cloud Functions for Firebase 2.ª gen (`europe-west1`): Express para la API y funciones de acceso y contacto, con avisos por email (SMTP de IONOS) |
| **Referencia Backend** | PostgreSQL (Esquema DDL relacional con índices parciales B-Tree y tipos JSONB)                                                                                                                   |

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos

- Node.js $\ge 22.12$
- npm (el gestor utilizado por CI y el despliegue)
- Java 21 o superior para el emulador de Firestore (desarrollo local y pruebas)
- La Firebase CLI se instala con `npm ci` (`firebase-tools` en `devDependencies`); `npx firebase …` usa esa versión

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/OvidiuMM/neuroproductivity-platform.git
cd neuroproductivity-platform

# 2. Instalar dependencias (frontend y Cloud Functions)
npm ci
npm ci --prefix functions
npm ci --prefix tools/eslint   # ESLint con su propio TypeScript 5.9 (typescript-eslint aún no admite TypeScript 7)

# 3. Iniciar la app en local: arranca los emuladores de Auth, Firestore y Functions (proyecto demo, sin tocar
#    producción) y la app conectada a ellos. El inicio de sesión con Google lo simula el emulador; entra con
#    admin@example.com para aprobar los accesos de las demás cuentas.
npm run dev

# 4. Compilar para producción
npm run build

# 5. Comprobar tipos, linter y formato (`npm run format` y `npm run lint:fix` corrigen lo automático).
#    Al hacer commit, un hook formatea y pasa el linter a los archivos del commit.
npm run typecheck
npm run lint
npm run format:check

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

El banco de pruebas cubre lógica pura con el test runner de Node, la importación de datos locales, las reglas de seguridad de Firestore contra el emulador, flujos de extremo a extremo en Chromium con Playwright (inicio de sesión con el emulador de Auth, primer arranque, bienvenida y recorrido, importación, tareas y repeticiones, Top 10, agenda, metas, alarmas, borradores de correo, contacto y respuestas, aprobación de accesos, navegación móvil y tamaños de pantalla) y una auditoría automática de accesibilidad WCAG 2.1 A y AA con axe-core en cada pantalla, también con alto contraste y texto muy grande (`tests/e2e/a11y.spec.ts`). `npm test` ejecuta todos los niveles; las Cloud Functions (rutas de la API y lógica de accesos y contacto) se prueban aparte con `npm --prefix functions test`. GitHub Actions también valida tipos, compila la aplicación y la función, y ejecuta toda la suite en cada push y pull request.

### Despliegue en Firebase (Hosting + Cloud Functions + Firestore)

Firebase Hosting sirve la SPA compilada (`dist/`), la función `api` (Cloud Functions 2.ª gen, región `europe-west1`) atiende el backend y Firestore guarda los datos de cada cuenta en `users/{uid}/…`. Las reglas (`firestore.rules`) solo permiten a cada persona acceder a sus propios datos (crear y modificar exige el acceso aprobado; leer y borrar no, para que una cuenta sin acceso pueda llevarse o eliminar lo suyo) y hacen las evaluaciones de la Rueda _append-only_. La app lee su configuración de Firebase de `/__/firebase/init.json`, que sirve el propio Hosting, así que el ID del proyecto no está en el código. Las rutas se definen en `firebase.json`:

| Ruta                           | Destino                                               |
| :----------------------------- | :---------------------------------------------------- |
| `/api/**`                      | Función `api` (`functions/src/app.ts`)                |
| `/.well-known/assetlinks.json` | Función `api` (Digital Asset Links de la APK Android) |
| `**`                           | `index.html` (fallback de la SPA)                     |

Todas las respuestas llevan cabeceras de seguridad, definidas en `firebase.json`: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (sin cámara, micrófono, ubicación, pagos ni USB) y una política de seguridad de contenidos (CSP) que solo permite el propio dominio, el inicio de sesión de Google, las APIs de Firebase (`*.googleapis.com`), las Cloud Functions (`*.cloudfunctions.net`) y las fotos de perfil de Google. Por ahora la CSP y la `Cross-Origin-Opener-Policy` van en modo «solo informar» (`…-Report-Only`): no bloquean nada y avisan en la consola del navegador. Un servicio externo nuevo hay que añadirlo a la CSP.

Requisitos: un proyecto de Firebase en plan Blaze (Cloud Functions lo exige), una base de datos de Firestore `(default)` en `europe-west1`, los proveedores de inicio de sesión **Google** y **Correo electrónico/contraseña** activados en Authentication y la Firebase CLI con sesión iniciada (`npx firebase login`).

El ID del proyecto no se versiona: `.firebaserc` está en `.gitignore`. En cada clon, selecciona el proyecto una vez:

```bash
firebase use --add
```

Las funciones usan los parámetros `ANDROID_PACKAGE_NAME` y `ANDROID_SHA256_FINGERPRINT` (la función `api`), `ADMIN_EMAIL` y `SMTP_USER` (accesos y contacto) y, opcionales, `SMTP_HOST` (el servidor SMTP; por defecto `smtp.ionos.es`) y `APP_URL` (la dirección de la app en los emails). `firebase deploy` pide los que faltan y los guarda en `functions/.env.<project-id>`, ignorado por git; en CI salen de las variables y los secretos del repositorio. Para los emuladores, defínelos en `functions/.env.local`.

#### Aprobación de accesos

Por defecto, cada cuenta necesita la aprobación de la administración antes de usar la app, también las que ya existían. Al entrar sin acceso, la persona ve una pantalla para solicitarlo con un mensaje opcional; la administración decide en **Administración** → **Solicitudes** (aprobar, rechazar, retirar o bloquear) y el cambio se aplica al momento. Tras un rechazo o una retirada se puede volver a solicitar pasado un día.

- **Aprobación obligatoria:** un interruptor en **Solicitudes** (`settings/access.approvalRequired`; sin el documento, la aprobación es obligatoria). Al desactivarlo, tras confirmarlo, se aprueban al momento las solicitudes pendientes y cada persona recibe su email; mientras siga desactivado, las cuentas nuevas con el email confirmado entran sin esperar.
- **Lista negra:** «Bloquear» deja la cuenta en estado bloqueado y guarda su email en `blocked_emails`. Una cuenta bloqueada no puede volver a solicitar acceso, y una cuenta nueva con el mismo email empieza bloqueada, con la aprobación activada o no. La lista se conserva aunque la cuenta se elimine. «Desbloquear» deja la cuenta como retirada y libera el email.

- Las Cloud Functions `syncAccess`, `requestAccess`, `setAccess`, `setAccessMode`, `forgetAccess` y `revokeSessions` (esta última cierra las sesiones de la cuenta en todos los dispositivos) (`functions/src/access.ts`) son las únicas que escriben `access/{uid}`, `admins/{uid}`, `settings/access` y `blocked_emails`; desde la app solo la administración lee `settings`, y nadie lee ni escribe `blocked_emails`. Las reglas consultan `access/{uid}` para dejar crear y modificar en `users/{uid}/…`, y la marca `admins/{uid}` (con el email de la administración, que debe coincidir con el de quien lee) para la lista de solicitudes.
- La administración es la cuenta (de Google, o con email confirmado) cuyo email coincide con el parámetro `ADMIN_EMAIL`; se aprueba sola al entrar. En los emuladores (proyecto demo) es `admin@example.com`.
- Avisos por email, por SMTP con TLS (puerto 465) desde un buzón de IONOS, proveedor de la UE con contrato de encargado del tratamiento: a la administración por cada solicitud nueva y por cada mensaje de contacto, a la persona cuando se aprueba su acceso, y las respuestas de la administración a los mensajes. Los avisos a la administración no llevan datos de quien escribe ni su mensaje: se leen en la app. Los envía el buzón del parámetro `SMTP_USER` (en producción, `info@clar.life`), que también recibe lo que contesten; la contraseña está en Secret Manager como `SMTP_PASSWORD` y nunca en el repositorio ni en los `.env`. En los emuladores no se envía nada.

Configuración, una sola vez, con las variables `PROJECT_ID`, `PROJECT_NUMBER` y `SA` del despliegue automático (más abajo):

```bash
# 1. Un buzón del dominio en IONOS (p. ej. info@clar.life) y el contrato de encargado del tratamiento aceptado en el
#    panel de IONOS. Los registros MX, SPF, DKIM y DMARC los crea IONOS al crear el buzón
# 2. Guardar la contraseña del buzón en Secret Manager; el CLI la pide por teclado y no queda en el historial
npx firebase functions:secrets:set SMTP_PASSWORD --project "$PROJECT_ID"
# 3. Permisos: la cuenta de servicio de las funciones lee el secreto y la de GitHub Actions lo puede consultar al desplegar
gcloud secrets add-iam-policy-binding SMTP_PASSWORD --project "$PROJECT_ID" \
  --member "serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA" --role roles/secretmanager.viewer --condition None
# 4. Email de la administración, como secreto del repositorio (gh lo pide por teclado), y el buzón que envía
gh secret set ADMIN_EMAIL
gh variable set SMTP_USER --body "info@clar.life"
```

```bash
# Emuladores locales (proyecto demo): Hosting en http://localhost:5002, Functions, Auth y Firestore
npm run emulators

# Despliegue: compila la SPA y la función antes de subirlas y publica las reglas de Firestore
npm run deploy
```

#### Dominio propio (clar.life)

La dirección principal de la app es `https://clar.life` (la de Firebase Hosting sigue funcionando). Servida desde ese dominio, el inicio de sesión usa el mismo dominio (`authDomain`, en `src/services/authDomain.ts`), así el navegador no bloquea la ventana de Google por ser de otro sitio. Configuración, una sola vez:

1. **Firebase Hosting** → «Añadir dominio personalizado»: `clar.life`, y `www.clar.life` redirigido a `clar.life`. Hosting da los registros DNS (TXT para verificar y A para servir) que hay que añadir en el proveedor del dominio. El certificado HTTPS llega solo, en unas horas.
2. **Authentication** → Configuración → Dominios autorizados: `clar.life` y `www.clar.life`.
3. **Google Cloud** → APIs y servicios → Credenciales → el cliente OAuth web que usa Firebase: origen `https://clar.life` y URI de redirección `https://clar.life/__/auth/handler`.
4. Opcional: en **Authentication** → Plantillas, la URL de acción de los emails (verificación y contraseña) `https://clar.life/__/auth/action`.
5. Los enlaces de los emails (accesos, contacto y respuestas) apuntan al dominio con la variable `APP_URL`, configurada con `https://clar.life`; sin ella, usan la dirección de Firebase Hosting. Para cambiarla (el siguiente despliegue la aplica):

```bash
gh variable set APP_URL --body "https://clar.life"
```

#### Despliegue automático desde GitHub Actions

Cada push a `main` (por ejemplo, al mergear un pull request) despliega Hosting, la función y las reglas de Firestore si el job `validate` pasa. Los deploys se ejecutan de uno en uno. GitHub se autentica en Google Cloud con Workload Identity Federation: cada ejecución recibe un token temporal y no hay claves de cuenta de servicio guardadas.

El workflow necesita estos valores en el repositorio. Los secrets se ocultan en los logs, así que el ID del proyecto tampoco aparece ahí.

| Tipo     | Nombre                           | Valor                                                                         |
| :------- | :------------------------------- | :---------------------------------------------------------------------------- |
| Secret   | `FIREBASE_PROJECT_ID`            | ID del proyecto de Firebase                                                   |
| Secret   | `GCP_SERVICE_ACCOUNT`            | Email de la cuenta de servicio `github-deployer`                              |
| Secret   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | Ruta completa del proveedor de identidad                                      |
| Variable | `ANDROID_PACKAGE_NAME`           | Package name de la APK                                                        |
| Variable | `ANDROID_SHA256_FINGERPRINT`     | Huella SHA-256 del certificado de firma de la APK                             |
| Secret   | `ADMIN_EMAIL`                    | Email de la administración: aprueba los accesos y lee y responde los mensajes |
| Variable | `SMTP_USER`                      | Buzón que envía los avisos y las respuestas, y recibe lo que contesten        |
| Variable | `SMTP_HOST`                      | Opcional: servidor SMTP del buzón (por defecto `smtp.ionos.es`)               |
| Variable | `APP_URL`                        | Opcional: dirección de la app en los emails (`https://clar.life`)             |

Configuración inicial, una sola vez, con una cuenta propietaria del proyecto:

```bash
PROJECT_ID=<project-id>
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="github-deployer@$PROJECT_ID.iam.gserviceaccount.com"
REPO_ID=1408574835  # gh api repos/OvidiuMM/neuroproductivity-platform -q .id

# 1. Cuenta de servicio con los permisos para desplegar Hosting, Functions y las reglas de Firestore
#    (secretmanager.viewer: el CLI comprueba el secreto SMTP_PASSWORD al desplegar)
gcloud iam service-accounts create github-deployer --project "$PROJECT_ID" --display-name "GitHub Actions deployer"
for role in roles/firebasehosting.admin roles/cloudfunctions.admin roles/firebaserules.admin roles/datastore.indexAdmin roles/secretmanager.viewer; do
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
├── index.html                   # Entry point HTML (lang="es")
├── package.json                 # Dependencias y scripts
├── vite.config.ts               # Configuración de Vite y Tailwind
├── tsconfig.json                # Configuración de TypeScript estricto
├── playwright.config.ts         # Pruebas E2E (proyectos chromium y global-settings)
├── firebase.json                # Firebase Hosting (rewrites y caché), Cloud Functions, Firestore y emuladores
├── firestore.rules              # Reglas: users/{uid} (crear y modificar exige acceso aprobado), access, admins,
│                                #   settings y feedback_tickets (solo la administración, y solo su estado)
├── public/                      # Manifiesto, iconos y pantalla de inicio
├── tools/eslint/                # ESLint con su propio TypeScript 5.9
├── .github/workflows/ci.yml     # Validación (tipos, linter, pruebas) y despliegue desde main
├── functions/                   # Cloud Functions for Firebase (región europe-west1)
│   ├── src/
│   │   ├── index.ts             # Exporta la función HTTP `api`, las de acceso y las de contacto
│   │   ├── app.ts               # Rutas Express: /api/health, /api/nlp/infer y assetlinks.json
│   │   ├── adminApp.ts          # Firebase Admin compartido
│   │   ├── access.ts            # syncAccess, requestAccess, setAccess, setAccessMode, forgetAccess, revokeSessions
│   │   │                        #   y avisos por email (SMTP)
│   │   ├── accessLogic.ts       # Reglas puras del acceso (estados, esperas, modo de aprobación, correos)
│   │   ├── feedback.ts          # submitFeedback y replyToFeedback (mensajes de contacto y sus respuestas)
│   │   ├── feedbackLogic.ts     # Validación, límite por hora y correos del contacto
│   │   └── feedbackCleanup.ts   # Borrado de los mensajes al eliminar la cuenta
│   └── test/                    # API, Admin, lógica de acceso y de contacto
├── src/
│   ├── main.tsx                 # Montaje de React y preferencias de accesibilidad antes del primer render
│   ├── Root.tsx                 # Textos legales públicos según la ruta; si no, la app
│   ├── AuthGate.tsx             # Inicio de sesión obligatorio
│   ├── AccessGate.tsx           # La app solo se abre con el acceso aprobado (estado en vivo)
│   ├── App.tsx                  # Orquestador principal de estado y vistas
│   ├── navigation.ts            # Secciones, barra inferior del móvil y «Más»
│   ├── tourSteps.ts             # Pasos del recorrido guiado
│   ├── lazy.tsx                 # Carga bajo demanda con reintento
│   ├── index.css                # Tailwind CSS y estilos de accesibilidad (texto, contraste, movimiento, foco)
│   ├── types/index.ts           # Modelos de datos (TaskItem, Goal, Project, Recurrence, WheelOfLifeLog, EmailDraft…)
│   ├── hooks/
│   │   ├── useModalFocus.ts     # Foco de los diálogos: entra, se queda dentro y vuelve al cerrar
│   │   ├── useDiscardGuard.ts   # Preguntar antes de descartar cambios sin guardar (y al cerrar la pestaña)
│   │   ├── useMediaQuery.ts     # Tamaño de pantalla (móvil o no)
│   │   ├── useNow.ts            # Reloj por minutos para plazos y prioridad efectiva
│   │   └── useTaskAlarms.ts     # Alarmas de las tareas mientras la app está abierta
│   ├── services/
│   │   ├── firebase.ts          # Firebase (Auth, Firestore con caché sin conexión, Functions) y sincronización forzada
│   │   ├── authDomain.ts        # Inicio de sesión en el dominio propio (clar.life)
│   │   ├── repository.ts        # Lectura en tiempo real y escritura de los datos de cada cuenta
│   │   ├── access.ts            # Solicitudes de acceso, modo de aprobación y llamadas a las Cloud Functions
│   │   ├── auth.ts              # Email y contraseña: alta con verificación, acceso, recuperación y cambio
│   │   ├── account.ts           # Descarga de los datos, eliminación de la cuenta y cierre de todas las sesiones
│   │   ├── wheel.ts · goals.ts  # Áreas de la Rueda; metas, su orden por puntuación y su progreso
│   │   ├── projects.ts          # Proyectos: avance, plazo, meta de sus tareas y orden
│   │   ├── dependencies.ts      # Tareas que esperan a otra: bloqueos, ciclos y candidatas
│   │   ├── exports.ts · download.ts # Descargas en JSON de una tarea, una meta o un proyecto
│   │   ├── tasks.ts             # Estados, plazos y prioridad efectiva
│   │   ├── taskListing.ts       # Orden, filtros y estimación del Top 10
│   │   ├── recurrence.ts        # Tareas recurrentes y su exportación RRULE
│   │   ├── alarms.ts · notifications.ts # Cuándo suena cada alarma; notificaciones del sistema
│   │   ├── agenda.ts            # Agenda por días: plazos, intervalos, repeticiones y reuniones
│   │   ├── calendar.ts          # Enlaces de Google y Outlook y archivos .ics (con la alarma)
│   │   ├── email.ts             # Correos: destinatarios, adjuntos, borradores y enlace mailto
│   │   ├── dateInput.ts         # Fechas dd/mm/aaaa y meses de lunes a domingo
│   │   ├── stats.ts             # Estadísticas y recomendaciones de la pantalla de Inicio
│   │   ├── onboarding.ts        # Bienvenida vista, por cuenta
│   │   ├── feedback.ts · feedbackApi.ts # Contacto: información técnica, envío, mensajes y respuestas
│   │   ├── a11yPrefs.ts         # Preferencias del panel de accesibilidad
│   │   ├── legal.ts             # Textos legales: rutas, titular, edad mínima y fecha de la versión
│   │   ├── nlpEngine.ts         # Motor TF-IDF y Similitud del Coseno
│   │   ├── syntaxAnalyzer.ts    # Analizador de verbos de acción física
│   │   └── localData.ts         # Importación de los datos de la versión sin cuentas (localStorage)
│   └── components/
│       ├── Navbar.tsx · NavParts.tsx · BottomNav.tsx · MoreSheet.tsx · BottomSheet.tsx # Cabecera, barra
│       │                        #   inferior y hojas del móvil
│       ├── BrandMark.tsx        # Símbolo de CLAR (lente), nombre y lema
│       ├── HomeView.tsx         # Inicio: foco de la lista, metas, estadísticas y recomendaciones
│       ├── WheelOfLife.tsx      # Rueda de la Vida polar SVG
│       ├── GoalsView.tsx · GoalModal.tsx · GoalProgress.tsx # Metas: por área, editor y progreso
│       ├── ProjectsView.tsx · ProjectModal.tsx · ProjectProgress.tsx # Proyectos: lista, vista, editor y batería
│       ├── DiscardChangesPrompt.tsx # «¿Descartar los cambios?»
│       ├── TaskList.tsx · TaskCard.tsx · TaskActionsMenu.tsx # Top 10 y resto, tarjeta y menú «⋯»
│       ├── TaskModal.tsx        # Captura con validación sintáctica, meta, sugerencias, fechas, alarma y repetición
│       ├── DateField.tsx · TaskDates.tsx · TaskStatusSelect.tsx · ArchivedTasksModal.tsx
│       ├── AlarmAlerts.tsx · NotificationPermission.tsx # Avisos de alarma y permiso de notificaciones
│       ├── AgendaView.tsx       # Agenda semanal y por días
│       ├── BermudasShield.tsx · MeetingModal.tsx · EmailModal.tsx # Tiempo protegido: reuniones y correos
│       ├── LoginScreen.tsx · EmailAuthForm.tsx · EmailVerificationScreen.tsx # Inicio de sesión (Google o email)
│       ├── AccessRequestScreen.tsx # Solicitud de acceso, su estado y los datos de la cuenta
│       ├── AdminView.tsx · AccessAdminView.tsx · FeedbackAdminView.tsx # Administración: solicitudes y mensajes
│       ├── FeedbackDialog.tsx   # «Escríbenos»
│       ├── AccountMenu.tsx · AccessibilityPanel.tsx · DeleteAccountPanel.tsx
│       ├── ImportLocalDataModal.tsx # Importación de datos locales en el primer inicio de sesión
│       ├── WelcomeDialog.tsx · ProductTour.tsx # Bienvenida y recorrido guiado
│       ├── HowItWorks.tsx       # Ayuda
│       ├── LegalPage.tsx · LegalTexts.tsx · LegalLinks.tsx # Privacidad, condiciones y aviso legal
│       ├── Deferred.tsx         # Secciones y ventanas que se cargan al abrirlas
│       ├── SyncIndicator.tsx    # Indicador de sincronización (pulsar fuerza la sincronización)
│       └── SplashScreen.tsx     # Pantalla de arranque
└── tests/
    ├── unit/ · integration/     # Lógica pura e importación de datos locales (node:test)
    ├── rules/                   # Reglas de Firestore contra el emulador
    └── e2e/                     # Playwright: flujos completos y auditoría WCAG (axe-core)
```

---

## 📜 Esquema de Base de Datos de Referencia (PostgreSQL)

Modelo relacional equivalente a lo que la app guarda en Firestore (`users/{uid}/wheelLogs`, `goals`, `tasks`, `meetings` y `emails`), como referencia para un backend propio.

```sql
-- 1. Histórico append-only de la Rueda de la Vida (M1)
CREATE TABLE wheel_of_life_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label VARCHAR(100),
  health_score SMALLINT NOT NULL CHECK (health_score BETWEEN 0 AND 10),
  career_score SMALLINT NOT NULL CHECK (career_score BETWEEN 0 AND 10),
  finance_score SMALLINT NOT NULL CHECK (finance_score BETWEEN 0 AND 10),
  family_score SMALLINT NOT NULL CHECK (family_score BETWEEN 0 AND 10),
  spirit_score SMALLINT NOT NULL CHECK (spirit_score BETWEEN 0 AND 10),
  leisure_score SMALLINT NOT NULL CHECK (leisure_score BETWEEN 0 AND 10),
  relationship_score SMALLINT NOT NULL CHECK (relationship_score BETWEEN 0 AND 10)
);
CREATE INDEX idx_wheel_user_time ON wheel_of_life_log(user_id, timestamp DESC);

-- 2. Metas por área de la Rueda (M6)
CREATE TYPE wheel_area_enum AS ENUM ('Salud', 'Carrera Profesional', 'Finanzas', 'Familia', 'Ocio', 'Relaciones', 'Espiritualidad');
CREATE TYPE goal_status_enum AS ENUM ('ACTIVE', 'ACHIEVED', 'ARCHIVED');

CREATE TABLE goal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(100) NOT NULL,
  area wheel_area_enum NOT NULL,
  why VARCHAR(280),
  target_date DATE,
  status goal_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proyectos: tareas con fecha de fin dentro de una meta
CREATE TYPE project_status_enum AS ENUM ('ACTIVE', 'FINISHED', 'ARCHIVED');

CREATE TABLE project (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(100) NOT NULL,
  goal_id UUID NOT NULL REFERENCES goal(id) ON DELETE RESTRICT,  -- una meta con proyectos no se elimina
  end_date DATE NOT NULL,
  description VARCHAR(280),
  status project_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tareas (M2): una tarea vinculada a una meta toma su área al leerse; la de un proyecto, la meta del proyecto
CREATE TYPE list_context_enum AS ENUM ('WORK', 'PERSONAL');
CREATE TYPE priority_enum AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE task_status_enum AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

CREATE TABLE task_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  list_context list_context_enum NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority priority_enum NOT NULL,
  status task_status_enum NOT NULL DEFAULT 'PENDING',
  done_at TIMESTAMPTZ,                                 -- cuándo pasó a hecha o cancelada
  is_someday BOOLEAN NOT NULL DEFAULT FALSE,           -- «Algún día»
  goal_id UUID REFERENCES goal(id) ON DELETE SET NULL,
  project_id UUID REFERENCES project(id) ON DELETE SET NULL,  -- sus tareas siguen en la meta
  depends_on UUID REFERENCES task_item(id) ON DELETE SET NULL, -- bloqueada mientras esa siga abierta
  wheel_category wheel_area_enum,                      -- sin meta: elegida o sugerida (TF-IDF)
  wheel_category_confidence REAL,
  linked_by VARCHAR(16),                               -- MANUAL o AUTO_TFIDF
  start_date DATE,
  start_time TIME,
  due_date DATE,                                       -- en una serie, la de la repetición actual
  due_time TIME,
  estimate_minutes INTEGER,
  alarm_time TIME,                                     -- 24 h antes como mucho; sin hora límite, la víspera
  recurrence JSONB,                                    -- frecuencia, intervalo, días, modo mensual y fin
  next_occurrence_id UUID,
  observations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial: «Algún día», las hechas y las canceladas no compiten por el Top 10
CREATE INDEX active_tasks_idx ON task_item(user_id, priority)
  WHERE is_someday = FALSE AND status NOT IN ('DONE', 'CANCELLED');

-- 4. Tiempo protegido: reuniones (M5)
CREATE TABLE meeting_guard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(100) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  agenda_points JSONB NOT NULL,
  moderator_name VARCHAR(100) NOT NULL,
  moderator_email VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_time_order CHECK (end_time > start_time),
  CONSTRAINT chk_deep_morning_block CHECK (EXTRACT(HOUR FROM start_time) >= 12)
);

-- 5. Tiempo protegido: correos (M5). CLAR no los envía; de los adjuntos guarda solo nombre y tamaño
CREATE TYPE email_status_enum AS ENUM ('draft', 'saved');

CREATE TABLE email_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{ name, size, bytes }]
  no_attachments_declared BOOLEAN NOT NULL DEFAULT FALSE,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  status email_status_enum NOT NULL DEFAULT 'saved',
  sent_at TIMESTAMPTZ,                                 -- cuándo se guardó terminado
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para contribuir:

1. Haz un Fork del repositorio.
2. Crea una rama para tu funcionalidad (`git checkout -b feature/nueva-funcionalidad`).
3. Realiza tus cambios y verifica la compilación (`npm run build && npm run typecheck && npm run lint && npm run format:check`).
4. Haz Commit de tus cambios (`git commit -m 'feat: añade nueva funcionalidad'`).
5. Haz Push a tu rama (`git push origin feature/nueva-funcionalidad`).
6. Abre un Pull Request describiendo el impacto metodológico y técnico.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT** — consulta el archivo [LICENSE](LICENSE) para más detalles.
