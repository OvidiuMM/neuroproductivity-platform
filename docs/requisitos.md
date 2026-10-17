# Requisitos del sistema — CLAR

- **Versión:** 0.9.5
- **Última revisión:** 2026-10-17

Este documento describe qué hace CLAR en la versión 0.9.5: sus requisitos funcionales y no funcionales tal como están implementados en el código de esta versión (la SPA de `src/`, las Cloud Functions de `functions/src/`, las reglas de Firestore, la configuración de Firebase Hosting y las pruebas). No recoge planes ni funciones futuras. Donde el README y el código no coinciden, manda el código.

**Convenciones.** RF: requisito funcional. RNF: requisito no funcional. Los identificadores son estables: un requisito nuevo toma el siguiente número libre de su sección y uno retirado no se reutiliza. Los textos entre «» son etiquetas de la interfaz. «Origen» señala los archivos principales de cada sección.

**Roles.**

- **Persona usuaria:** cualquier cuenta con sesión iniciada. Solo usa la app con el acceso aprobado.
- **Persona administradora:** la cuenta cuyo email verificado coincide con el configurado en el despliegue. Decide los accesos y atiende los mensajes de contacto.
- **Servidor:** las Cloud Functions, únicas que escriben los accesos, la configuración y los mensajes de contacto.

---

## 1. Requisitos funcionales

### 1.1 Rueda de la Vida (RF-RUE)

Origen: `src/components/WheelOfLife.tsx`, `src/components/AreasModal.tsx`, `src/services/wheel.ts`.

- **RF-RUE-01.** La app muestra la Rueda como un gráfico polar con las áreas a la vista de la cuenta. Cada área se puntúa de 0 a 10, en números enteros, con un deslizador, y el gráfico se redibuja al momento.
- **RF-RUE-02.** Cada cuenta empieza con 7 áreas: Salud, Carrera Profesional, Finanzas, Familia, Ocio, Relaciones y Espiritualidad.
- **RF-RUE-03.** «Guardar la evaluación» guarda siempre una evaluación nueva, con su fecha en UTC y un nombre opcional. Sin nombre, se llama «Evaluación» seguida de la fecha y la hora.
- **RF-RUE-04.** Una evaluación guarda solo las puntuaciones de las áreas a la vista. Las áreas ocultas conservan las de evaluaciones anteriores.
- **RF-RUE-05.** Las evaluaciones guardadas no se pueden modificar: las reglas de Firestore solo admiten reescribir el mismo contenido. Quien tiene la cuenta sí puede borrarlas (lo usa el borrado de la cuenta), pero la app no ofrece borrarlas una a una.
- **RF-RUE-06.** «Tus evaluaciones» lista cada evaluación con su fecha y su promedio. El promedio es la media de las áreas que puntuó esa evaluación.
- **RF-RUE-07.** «Comparar con una evaluación anterior» superpone en el gráfico la evaluación elegida y muestra la diferencia de cada área. Al abrir la sección está activada, con la evaluación más antigua elegida.
- **RF-RUE-08.** Al abrir la Rueda, los deslizadores parten de la última evaluación. Un área sin puntuación previa empieza en 0.
- **RF-RUE-09.** Cada área indica cuántas metas activas tiene. La tarjeta «Metas» lleva a esa sección con «Ir a Metas».
- **RF-RUE-10.** Primer arranque: si el servidor confirma que la cuenta no tiene evaluaciones y la persona aún no ha cambiado de sección, la app abre en la Rueda. Muestra un aviso de primer paso con un enlace a la Ayuda.
- **RF-RUE-11.** «Editar áreas» permite renombrar cualquier área, añadir áreas propias y ocultar o mostrar cada una («A la vista»).
- **RF-RUE-12.** Cada área necesita un nombre de hasta 30 caracteres, distinto de los demás sin distinguir mayúsculas. Tiene que haber entre 3 y 12 áreas a la vista; «Añadir un área» se desactiva al llegar a 12.
- **RF-RUE-13.** Un área ya guardada no se puede eliminar, solo ocultar. Un área recién añadida se puede quitar antes de guardar.
- **RF-RUE-14.** Un área oculta sale del gráfico, de las sugerencias de área y de las listas para elegir. Conserva sus evaluaciones, sus metas y sus tareas, y sigue elegida en lo que ya la tenía.
- **RF-RUE-15.** Las 7 áreas de partida usan su nombre original como identificador y las añadidas, uno propio, así que renombrar no cambia nada de lo guardado. La lista de áreas se guarda en el perfil de la cuenta.
- **RF-RUE-16.** Los nombres de las áreas de la cuenta se usan en toda la app y en las descargas. En el gráfico, los de más de 16 caracteres se recortan.

### 1.2 Metas (RF-MET)

Origen: `src/components/GoalsView.tsx`, `src/components/GoalModal.tsx`, `src/components/NewGoalInline.tsx`, `src/services/goals.ts`.

- **RF-MET-01.** Una meta tiene nombre (obligatorio, hasta 100 caracteres), área de la Rueda (obligatoria), «para qué» (opcional, hasta 280 caracteres) y fecha objetivo (opcional).
- **RF-MET-02.** Una meta está activa, lograda o archivada. Una activa se puede «Marcar como lograda» o «Archivar»; una lograda o archivada se puede «Reactivar».
- **RF-MET-03.** La sección «Metas» ordena las áreas de la puntuación más baja a la más alta según la última evaluación. En empate, o sin evaluación, sigue el orden de la Rueda.
- **RF-MET-04.** La sección muestra las áreas a la vista y, si tienen metas activas, también las ocultas o ya inexistentes.
- **RF-MET-05.** Sin ninguna evaluación, la sección invita a evaluar la Rueda.
- **RF-MET-06.** «Necesitan atención» lista las áreas con 5 o menos en la última evaluación y sin metas activas. Su botón abre una meta nueva con esa área ya elegida.
- **RF-MET-07.** Cada área tiene su botón «Nueva meta», con el área ya elegida. La sección tiene además un «Nueva meta» general.
- **RF-MET-08.** Cada meta activa muestra su fecha objetivo, su progreso y las tareas que le quedan, primero las de fecha límite más próxima. Pulsar una tarea abre su edición.
- **RF-MET-09.** El progreso de una meta son sus tareas hechas sobre el total de sus tareas, sin contar las canceladas. Incluye las tareas de sus proyectos.
- **RF-MET-10.** «Añadir tarea» abre una tarea nueva ya vinculada a la meta, y «Nuevo proyecto», un proyecto nuevo en esa meta. Cada meta muestra sus proyectos activos con su avance en porcentaje.
- **RF-MET-11.** Las metas logradas y archivadas aparecen plegadas al final, en «Logradas y archivadas».
- **RF-MET-12.** Una tarea vinculada a una meta toma el área de la meta al leerse. Cambiar el área de la meta cambia la de sus tareas sin reescribirlas.
- **RF-MET-13.** Eliminar una meta pide confirmación. Sus tareas se quedan sin meta y con el área que tenía la meta.
- **RF-MET-14.** Una meta con proyectos no se puede eliminar: la app pide eliminar sus proyectos o pasarlos a otra meta antes.
- **RF-MET-15.** El formulario de la tarea ofrece las metas activas, agrupadas por área, y la ya vinculada aunque esté lograda o archivada.
- **RF-MET-16.** «Nueva meta», dentro del formulario de la tarea, crea una meta con nombre y área y la vincula a la tarea. El área propuesta es la de la tarea si está a la vista; si no, la primera. Enter en el nombre o en el área crea la meta sin guardar la tarea, y Escape cierra solo esa parte. La confirmación sale junto al campo «Meta». La meta se guarda al momento, aunque luego no se guarde la tarea. Con un proyecto elegido no se ofrece.
- **RF-MET-17.** Mientras se escribe el título de una tarea sin meta ni proyecto, la app propone «Vincular a «meta»»: la meta activa cuyo nombre y «para qué» comparten más palabras con el título (de cuatro letras o más, sin tildes ni nexos). En empate gana la modificada más recientemente.

### 1.3 Proyectos (RF-PRO)

Origen: `src/components/ProjectsView.tsx`, `src/components/ProjectModal.tsx`, `src/components/ProjectProgress.tsx`, `src/services/projects.ts`.

- **RF-PRO-01.** Un proyecto tiene nombre (obligatorio, hasta 100 caracteres), meta (obligatoria), fecha de fin (obligatoria) y descripción (opcional, hasta 280 caracteres).
- **RF-PRO-02.** Solo se puede crear un proyecto si existe alguna meta. Sin metas, la sección lo explica y ofrece «Ir a Metas».
- **RF-PRO-03.** Al elegir la meta del proyecto se ofrecen las activas, agrupadas por área, y la ya elegida aunque esté lograda o archivada.
- **RF-PRO-04.** Un proyecto está activo, terminado o archivado. Uno activo se puede «Marcar como terminado» o «Archivar»; los demás se pueden «Reactivar».
- **RF-PRO-05.** La lista muestra primero los activos, del que termina antes al que termina después. Los terminados y archivados van plegados, los más recientes primero.
- **RF-PRO-06.** Cada proyecto muestra su avance como una batería: el porcentaje de tareas hechas sin contar las canceladas, con «N de M tareas hechas». La carga es roja por debajo del 34 %, ámbar hasta el 66 % y verde desde el 67 %.
- **RF-PRO-07.** Un proyecto activo avisa de que va fuera de plazo si pasó su fecha de fin y le quedan tareas abiertas. La fecha de fin incluye todo ese día.
- **RF-PRO-08.** Un proyecto activo avisa de que termina pronto si le queda menos de una semana y tiene tareas abiertas. Si tiene tareas y ninguna sigue abierta, pide marcarlo como terminado.
- **RF-PRO-09.** El proyecto avisa de las tareas abiertas cuya fecha límite cae después de su fecha de fin.
- **RF-PRO-10.** Un proyecto abierto muestra su meta, su fecha de fin, su estado, su batería y sus avisos. Sus tareas abiertas se manejan con las mismas tarjetas que en «Listas»; las hechas y canceladas van plegadas.
- **RF-PRO-11.** «Añadir tarea», dentro de un proyecto, crea la tarea ya en el proyecto. Al crear un proyecto, la app lo abre.
- **RF-PRO-12.** Las tareas de un proyecto toman la meta del proyecto, y con ella su área, al leerse. En el formulario de la tarea, elegir un proyecto fija la meta y desactiva su selector.
- **RF-PRO-13.** El formulario de la tarea ofrece los proyectos activos y el ya elegido aunque esté terminado o archivado. El campo solo aparece si hay alguno.
- **RF-PRO-14.** Eliminar un proyecto pide confirmación. Sus tareas siguen en la meta del proyecto, sin proyecto.

### 1.4 Tareas y listas (RF-TAR)

Origen: `src/components/TaskList.tsx`, `src/components/TaskCard.tsx`, `src/components/TaskModal.tsx`, `src/services/tasks.ts`, `src/services/taskListing.ts`, `src/services/dependencies.ts`, `src/services/recurrence.ts`, `src/services/calendar.ts`, `src/services/exports.ts`.

**Listas y Top 10**

- **RF-TAR-01.** Cada tarea pertenece a la lista Profesional o a la Personal. La cabecera cambia de lista y muestra cuántas tareas activas tiene cada una.
- **RF-TAR-02.** «Listas» muestra la lista activa en las pestañas «Activas» y «Algún día», con su número de tareas, y da acceso a «Archivadas», que reúne las de las dos listas.
- **RF-TAR-03.** El Top 10 son las 10 primeras tareas activas tras aplicar el orden y los filtros, sin las que esperan a otra tarea. Van destacadas y numeradas; las demás siguen debajo, más discretas, en «El resto de tareas».
- **RF-TAR-04.** La lista se ordena por prioridad, fecha límite, estimación, fecha del último cambio o área. Cada criterio desempata con otros, y lo que no tiene fecha o estimación va al final.
- **RF-TAR-05.** Los filtros son prioridad efectiva, estimación máxima, estado (Pendiente, En progreso o Bloqueada), fecha límite (vencidas, próximos 7 días, con fecha o sin fecha) y área. Con un filtro de estimación, las tareas sin estimación no aparecen.
- **RF-TAR-06.** Los filtros activos se ven como etiquetas que se quitan con un toque, junto con cuántas tareas ocultan. «Quitar filtros» los quita todos.
- **RF-TAR-07.** El orden y los filtros se guardan en cada dispositivo, por cuenta. Un valor guardado desconocido vuelve al de por defecto.
- **RF-TAR-08.** En el móvil, el orden y los filtros se abren en una hoja inferior.
- **RF-TAR-09.** La prioridad es Crítica, Alta, Media (por defecto) o Baja. Con la fecha límite a más de una semana, la tarea cuenta un nivel menos, y la tarjeta lo indica con «plazo > 1 semana».
- **RF-TAR-10.** La estimación es opcional: 15 min, 30 min, 1 h, 2 h, medio día (4 h), 1 día (8 h) o más de 1 día. Se muestra en las tarjetas.
- **RF-TAR-11.** Las tareas de «Algún día» no entran en el Top 10 y tienen su propia pestaña. Una tarea creada desde esa pestaña va a «Algún día».
- **RF-TAR-12.** El título de una tarea abierta se pone violeta si vence en menos de una semana y rojo si ha vencido. Los colores se actualizan cada minuto con la página abierta.
- **RF-TAR-13.** La tarjeta muestra fechas, repetición, alarma, estimación, prioridad, meta (o área, si no tiene meta) y el estado cuando no es «Pendiente».

**Formulario de la tarea**

- **RF-TAR-14.** El título es obligatorio y admite hasta 100 caracteres, con contador. Encima del campo se pide empezar por una acción concreta (Llamar, Enviar, Reservar…).
- **RF-TAR-15.** El analizador de la acción siguiente revisa el título mientras se escribe. Ante un tema abstracto conocido (p. ej. «Marketing», «Coche» o «Finanzas») o una sola palabra sin verbo de acción, pregunta por el primer paso y propone una acción concreta.
- **RF-TAR-16.** Mientras el aviso del analizador esté abierto, la tarea no se puede guardar. Se resuelve con «Usar sugerencia» o «Mantener redacción»; al editar una tarea ya guardada no bloquea.
- **RF-TAR-17.** El formulario tiene dos niveles. A la vista: lista, título, proyecto, meta, fecha y hora límite, alarma y prioridad. En «Más opciones»: descripción, estimación, área, dependencia, inicio, repetición, «Algún día» y notas.
- **RF-TAR-18.** Al salir del campo «Descripción», si la tarea no tiene meta, la app busca el área de la Rueda que más se parece al título y la descripción. Con una similitud del coseno de al menos 0,12 o alguna palabra clave en común, muestra «Sugerencia: ¿Vincular a «área»?» con su porcentaje de confianza y «Usar esta área».
- **RF-TAR-19.** La sugerencia compara el texto con las áreas a la vista: las de partida, con su vocabulario propio (más las palabras de su nombre si se renombraron); las añadidas, con las palabras de su nombre. El cálculo se hace en el navegador.
- **RF-TAR-20.** Con una meta elegida, el área es la de la meta y su selector se desactiva. Sin meta, el área se elige a mano o se acepta la sugerida, y el formulario dice cuál de las dos es.
- **RF-TAR-21.** Las notas son textos cortos que se añaden con «Añadir» o Intro y se quitan una a una.
- **RF-TAR-22.** Cerrar el formulario con cambios sin guardar pregunta «¿Descartar los cambios?», con «Seguir editando» y «Descartar». Una fecha o una hora a medio escribir también cuenta como cambio.
- **RF-TAR-23.** Cerrar o recargar la pestaña con el formulario cambiado hace que el navegador pida confirmación.

**Estados y archivo**

- **RF-TAR-24.** Cada tarea tiene un estado manual: Pendiente, En progreso, Bloqueada, Hecha o Cancelada. Una tarea nueva empieza en Pendiente.
- **RF-TAR-25.** Hecha y Cancelada archivan la tarea con la fecha del cambio. Cualquier otro estado la devuelve a su lista.
- **RF-TAR-26.** Una tarea cancelada no cuenta como hecha en las estadísticas ni en el avance de metas y proyectos.
- **RF-TAR-27.** El círculo de la tarjeta marca la tarea como hecha con un toque. El aviso ofrece «Deshacer» durante 5 s.
- **RF-TAR-28.** «Deshacer» comprueba en el servidor, en una transacción, que la tarea no ha cambiado entretanto. Si no hay conexión en 5 s o la tarea cambió, no deshace y lo avisa.
- **RF-TAR-29.** El lápiz de la tarjeta o su título abren la edición. El menú «⋯» reúne el estado, «Añadir al calendario», «Descargar (JSON)» y «Eliminar».
- **RF-TAR-30.** Eliminar desde el menú «⋯» no pide confirmación y ofrece «Deshacer». La tarea solo se recupera si nadie la ha vuelto a crear entretanto.
- **RF-TAR-31.** «Archivadas» muestra las tareas hechas y canceladas de las dos listas, de la cerrada más recientemente a la más antigua, con un buscador por título y descripción. Desde ahí se reactivan cambiando su estado o se eliminan, previa confirmación.

**Dependencias**

- **RF-TAR-32.** «Empieza después de» hace que una tarea espere a otra, de cualquiera de las dos listas. Una tarea solo puede esperar a una.
- **RF-TAR-33.** Solo se puede elegir una tarea abierta que no sea la misma ni espere ya a esta, directa o indirectamente. Al guardar se vuelve a comprobar que no se forma un ciclo.
- **RF-TAR-34.** Mientras la tarea esperada siga abierta, la dependiente muestra un candado y «Bloqueada: espera a «tarea»». No entra en el Top 10 y no se puede marcar como Hecha ni En progreso.
- **RF-TAR-35.** Al marcar como hecha o cancelada la tarea esperada, sus dependientes se desbloquean solas y el aviso dice cuáles se pueden empezar. Varias tareas pueden esperar a la misma.
- **RF-TAR-36.** Una tarea eliminada no bloquea a nadie. El formulario de una tarea indica qué tareas esperan a ella.

**Fechas, horas y repetición**

- **RF-TAR-37.** Una tarea puede tener fecha límite (plazo) o fecha de inicio y fecha límite (intervalo), cada una con hora opcional. Un intervalo exige fecha límite, y el inicio no puede ser posterior a ella.
- **RF-TAR-38.** Sin hora límite, el plazo vence al final del día. Una hora sin su fecha no se guarda.
- **RF-TAR-39.** Los campos de fecha usan un calendario propio con la semana empezando en lunes, sea cual sea el idioma del navegador. La fecha se escribe como dd/mm/aaaa (también con guiones, puntos o espacios, con año de dos cifras, como ddmmaaaa o como aaaa-mm-dd), entre los años 1900 y 2100.
- **RF-TAR-40.** El calendario se maneja con el teclado (flechas, Inicio, Fin, Re Pág y Av Pág, con Mayús para cambiar de año) y tiene «Hoy». Una fecha imposible bloquea el envío del formulario.
- **RF-TAR-41.** Todas las horas de la app se escriben en 24 h, de 00:00 a 23:59, en un campo propio que acepta 9:30, 09:30, 9.30, 9h30, 930 o 0930. Lo que no es una hora válida no se guarda y bloquea el envío.
- **RF-TAR-42.** Una tarea se puede repetir cada N días, semanas, meses o años, con N entre 1 y 99. Cada semana permite elegir los días; cada mes, el día del mes, el N.º día de la semana (del 1.º al 4.º) o el último día de la semana del mes.
- **RF-TAR-43.** Al repetir, «Inicio» es desde cuándo se repite (hoy, si se deja vacío) y la fecha límite, hasta cuándo (opcional). Cada repetición vence su propio día, a la hora límite, y nunca es un intervalo.
- **RF-TAR-44.** El formulario describe la regla, la primera repetición y la siguiente. Avisa si el fin es anterior al inicio, si no cabe ninguna repetición o si la hora de inicio es posterior a la límite.
- **RF-TAR-45.** En los meses que no tienen el día elegido (p. ej. el 31), la repetición mensual cae el último día del mes.
- **RF-TAR-46.** Al marcar una repetición como Hecha o Cancelada, se archiva y se crea la siguiente en la misma escritura. Cancelar una repetición no termina la serie.
- **RF-TAR-47.** La siguiente repetición tiene un identificador derivado de la anterior, así que marcarla desde dos pestañas o dispositivos no la duplica. Las repeticiones ya vencidas, hora límite incluida, se saltan, y no se crea ninguna después del fin de la serie.
- **RF-TAR-48.** La siguiente repetición empieza pendiente, sin fecha de inicio y sin esperar a ninguna tarea. Hereda la alarma.
- **RF-TAR-49.** «Deshacer» sobre una repetición recién cerrada la restaura y borra la siguiente que se acababa de crear.

**Calendario y descargas**

- **RF-TAR-50.** «Añadir al calendario», en el menú «⋯», ofrece Google Calendar, Outlook.com, Outlook / Microsoft 365 y un archivo .ics. Funciona con enlaces, sin conectar ninguna cuenta, y exige fecha límite.
- **RF-TAR-51.** Sin horas, el evento es de día completo (de varios días si la tarea es un intervalo). Con solo hora límite, el evento dura 30 minutos desde esa hora. Con hora de inicio y sin hora límite, dura una hora desde la de inicio; si la fecha límite es otro día, la descripción la indica. La descripción del evento lleva la de la tarea, sus notas (las de lista, con su casilla marcada o no) y el enlace a CLAR.
- **RF-TAR-52.** Una tarea recurrente se exporta como serie (RRULE, con la semana empezando en lunes) a Google Calendar y al .ics; los enlaces de Outlook no la admiten. El .ics incluye la alarma de la tarea.
- **RF-TAR-53.** «Descargar (JSON)» descarga una tarea, una meta o un proyecto con todos sus datos y los nombres de lo relacionado. La tarea incluye su área, su meta, su proyecto y las tareas a las que espera o que esperan a ella; la meta, su avance, sus proyectos y sus tareas; el proyecto, su avance, el estado de su plazo y sus tareas.
- **RF-TAR-54.** El archivo se genera en el navegador y se llama `clar-<tipo>-<nombre>-<fecha>.json`. Incluye la versión de la app y la fecha de la descarga.

### 1.5 Alarmas (RF-ALA)

Origen: `src/services/alarms.ts`, `src/services/notifications.ts`, `src/hooks/useTaskAlarms.ts`, `src/components/AlarmAlerts.tsx`.

- **RF-ALA-01.** Cada tarea puede llevar una alarma: una hora (hh:mm) para avisar antes del plazo. Exige fecha límite y, en una tarea que se repite, también hora límite.
- **RF-ALA-02.** Con hora límite, la alarma suena dentro de las 24 h anteriores: el mismo día si su hora es anterior a la límite y, si no, la víspera. Sin hora límite, suena la víspera a esa hora.
- **RF-ALA-03.** El momento de la alarma se calcula en la zona horaria del dispositivo. Si esa hora no existe por el cambio al horario de verano, se adelanta para mantener la antelación pedida.
- **RF-ALA-04.** El formulario dice cuándo sonará («Sonará el … a las …» o «Sonará la víspera, …») y permite «Quitar» la alarma.
- **RF-ALA-05.** La alarma avisa solo con CLAR abierta: con un aviso dentro de la app («Alarma · hh:mm», con «Ver tarea» y un botón para cerrarlo) y, si hay permiso, con una notificación del sistema.
- **RF-ALA-06.** Con una alarma puesta, el formulario ofrece «Activar también las notificaciones del sistema» si el navegador las admite. En Android y en el iPhone sin la app instalada, el aviso sale solo dentro de CLAR.
- **RF-ALA-07.** Una alarma que pasó con la app cerrada avisa al abrirla, si la tarea aún no ha vencido. Si el aviso llega más de 2 minutos tarde, dice a qué hora era.
- **RF-ALA-08.** Cada alarma avisa una sola vez aunque haya varias pestañas abiertas: una pestaña lanza la notificación del sistema y todas muestran el aviso. Cambiar la hora de la alarma o la fecha límite la vuelve a armar.
- **RF-ALA-09.** Las tareas archivadas o en «Algún día» no avisan. Un aviso desaparece si su tarea se archiva, y espera mientras haya una ventana abierta.
- **RF-ALA-10.** La app revisa las alarmas al menos una vez por minuto y al volver a la pestaña.

### 1.6 Agenda (RF-AGE)

Origen: `src/components/AgendaView.tsx`, `src/services/agenda.ts`.

- **RF-AGE-01.** La Agenda tiene vista «Semana», de lunes a domingo, y vista «Por días», de 14 días seguidos, también los vacíos. En la semana actual, la vista por días empieza hoy.
- **RF-AGE-02.** Se navega por semanas con anterior, siguiente y «Hoy», y se muestra el rango de fechas visible.
- **RF-AGE-03.** La Agenda muestra las tareas abiertas con fecha límite de las dos listas. Un plazo sale el día en que vence («Vence»); un intervalo, los días en que empieza, sigue «En curso» y vence.
- **RF-AGE-04.** Muestra las repeticiones previstas de las tareas recurrentes («Repetición prevista»), hasta el fin de cada serie.
- **RF-AGE-05.** Muestra las reuniones de «Tiempo protegido» con su hora de inicio y de fin.
- **RF-AGE-06.** Dentro de cada día van primero los elementos sin hora y después los demás, por hora. Cada tarea lleva el color de su lista y el de su plazo.
- **RF-AGE-07.** En la vista por días, las tareas vencidas salen aparte, en «Vencidas», y no se repiten en su día.
- **RF-AGE-08.** Pulsar una tarea de la Agenda abre su edición.

### 1.7 Tiempo protegido (RF-TIE)

Origen: `src/components/BermudasShield.tsx`, `src/components/MeetingModal.tsx`, `src/components/EmailModal.tsx`, `src/services/email.ts`.

- **RF-TIE-01.** «Tiempo protegido» reúne herramientas contra dos de las tres grandes fugas de tiempo: las reuniones mal planteadas y el correo reactivo.
- **RF-TIE-02.** «Planificar una reunión» exige título (hasta 100 caracteres), fecha, hora de inicio y hora de fin posterior a la de inicio, el mismo día. Por defecto propone de 13:00 a 13:45.
- **RF-TIE-03.** Una reunión que empieza antes de las 12:00 no se puede guardar. La app lo explica y ofrece «Pasarla a las 13:00» (de 13:00 a 13:45).
- **RF-TIE-04.** La reunión exige un orden del día con al menos un punto, que empieza con dos puntos de ejemplo que se pueden quitar, y el nombre de quien la modera. El email de la persona moderadora es opcional.
- **RF-TIE-05.** Las reuniones guardadas se listan con su hora, su duración, la persona moderadora y su orden del día. También salen en la Agenda y en el contador de Inicio.
- **RF-TIE-06.** «Escribir un correo» sigue la redacción inversa: primero los adjuntos o «Sin archivos adjuntos», después el cuerpo (al menos 15 caracteres), el asunto (al menos 4) y, al final, los destinatarios.
- **RF-TIE-07.** El campo de destinatarios está bloqueado hasta completar los adjuntos y el cuerpo. Los destinatarios se separan con comas, puntos y comas o espacios, y todos tienen que ser direcciones válidas.
- **RF-TIE-08.** Si el cuerpo pasa de 100 palabras o de 550 caracteres, la app avisa de que es largo.
- **RF-TIE-09.** «Elegir archivos» abre el selector del sistema. De cada adjunto se guardan solo el nombre y el tamaño, y un archivo ya elegido (mismo nombre y tamaño) se ignora.
- **RF-TIE-10.** «Guardar el correo» exige los cuatro pasos. «Guardar borrador» guarda lo escrito sin exigirlos.
- **RF-TIE-11.** Cerrar el editor con cambios los guarda como borrador. Un correo nuevo y vacío no se guarda.
- **RF-TIE-12.** La sección separa «Borradores», que se abren con «Continuar», y «Guardados», que se abren con «Abrir». Al abrir uno se sigue editando el mismo documento.
- **RF-TIE-13.** Un correo o un borrador se elimina con «Eliminar» y se recupera con «Deshacer», salvo que se haya vuelto a guardar entretanto.
- **RF-TIE-14.** «Abrir en mi correo» abre el programa de correo con los destinatarios válidos, el asunto y el texto. CLAR no envía el correo; los adjuntos se añaden en el programa de correo.

### 1.8 Inicio y estadísticas (RF-INI)

Origen: `src/components/HomeView.tsx`, `src/services/stats.ts`.

- **RF-INI-01.** La app abre en «Inicio», salvo en el primer arranque (RF-RUE-10). Inicio muestra el foco de la lista activa con tres indicadores: tareas en el Top 10 (sobre 10), promedio de la última evaluación de la Rueda con el número de evaluaciones, y número de reuniones.
- **RF-INI-02.** Las estadísticas son de la lista activa. Solo cuentan como hechas las tareas en estado Hecha.
- **RF-INI-03.** Inicio muestra las tareas hechas hoy, esta semana (de lunes a domingo) y este mes, y avisa de las canceladas en el mes.
- **RF-INI-04.** Muestra un gráfico de barras con las tareas hechas en cada uno de los últimos 14 días, acompañado de una tabla con los mismos datos.
- **RF-INI-05.** Muestra cuántas tareas con plazo se terminaron antes y después de él en los últimos 30 días.
- **RF-INI-06.** Muestra la velocidad: tareas y horas estimadas por semana, de media en las 4 últimas semanas completas y la actual. Si hay datos, añade los días que se tarda de media en terminar una tarea desde que se crea (últimos 30 días).
- **RF-INI-07.** Muestra la racha de días seguidos con alguna tarea hecha (contando hoy, o desde ayer si hoy aún no hay ninguna) y las pendientes, con las vencidas, las que vencen esta semana y las bloqueadas.
- **RF-INI-08.** Una tarea cuenta como bloqueada si está en estado Bloqueada o espera a otra tarea abierta. Las tareas de «Algún día» no cuentan como pendientes.
- **RF-INI-09.** «Por área (último mes)» reparte las tareas hechas en los últimos 30 días entre las áreas de la Rueda, con los nombres de la cuenta.
- **RF-INI-10.** Inicio muestra hasta 6 metas activas con su progreso y hasta 6 proyectos activos con su batería y su fecha de fin, además de cuántos proyectos van fuera de plazo. Metas y proyectos incluyen las dos listas.
- **RF-INI-11.** Inicio muestra como mucho 3 recomendaciones, de más a menos urgente. Todas salvo la de las tareas terminadas a tiempo llevan un botón a la sección que corresponde. Pueden ser, en este orden:
  - un proyecto fuera de plazo;
  - tareas vencidas, empezando por la más antigua;
  - 5 o más tareas que vencen esta semana;
  - menos del 60 % de tareas terminadas a tiempo, con al menos 5 tareas con plazo en el último mes;
  - ninguna tarea hecha esta semana, con tareas pendientes;
  - el área más baja de la última evaluación (5 o menos) sin metas;
  - la Rueda sin evaluar, o sin evaluar desde hace más de 30 días.

### 1.9 Navegación y ayuda (RF-NAV)

Origen: `src/navigation.ts`, `src/components/Navbar.tsx`, `src/components/BottomNav.tsx`, `src/components/MoreSheet.tsx`, `src/components/SyncIndicator.tsx`, `src/components/HowItWorks.tsx`.

- **RF-NAV-01.** Las secciones son Inicio, Listas, Agenda, Rueda de la Vida, Metas, Proyectos, Tiempo protegido y Ayuda. Administración solo aparece para la persona administradora, delante de Ayuda.
- **RF-NAV-02.** Desde 768 px de ancho, la cabecera lleva las secciones, las dos listas, el indicador de sincronización y la cuenta. «Nueva tarea» va debajo de la cabecera.
- **RF-NAV-03.** Por debajo de 768 px, una barra inferior lleva Inicio, Listas, Agenda, Metas y «Más», que abre una hoja con las demás secciones, la sincronización y la cuenta. Un botón flotante abre «Nueva tarea».
- **RF-NAV-04.** El indicador de sincronización está verde cuando todo está confirmado por el servidor y naranja con cambios pendientes, sin conexión o mientras sincroniza.
- **RF-NAV-05.** Pulsar el indicador fuerza la sincronización: reabre la conexión y espera la confirmación del servidor, como mucho 15 s. Un aviso dice si lo consiguió.
- **RF-NAV-06.** Cada acción que guarda, elimina o cambia algo muestra un aviso breve. Los avisos con «Deshacer» duran 5 s; los demás, 4 s.
- **RF-NAV-07.** Al arrancar, la app muestra una pantalla de inicio que se cierra sola en 1,6 s o al tocarla.
- **RF-NAV-08.** «Ayuda» explica cada sección con un botón «Ir a…», los primeros pasos, cómo se relacionan las secciones, dónde se guardan los datos y la accesibilidad.
- **RF-NAV-09.** Desde «Ayuda» se puede «Repetir el recorrido», «Ver la introducción» y abrir «Escríbenos».
- **RF-NAV-10.** El pie muestra la versión de la app, «Ver la ayuda» y los enlaces a los textos legales, que se abren en otra pestaña.
- **RF-NAV-11.** Si una sección o ventana no se puede descargar, la app muestra un aviso con «Reintentar» en su lugar y el resto sigue funcionando. Una ventana que aún se está descargando se puede cancelar.

### 1.10 Cuentas y acceso (RF-CUE)

Origen: `src/AuthGate.tsx`, `src/AccessGate.tsx`, `src/services/auth.ts`, `src/services/account.ts`, `src/components/AccountMenu.tsx`, `src/components/AccessRequestScreen.tsx`, `functions/src/access.ts`.

**Inicio de sesión y alta**

- **RF-CUE-01.** La app solo muestra datos con una sesión iniciada. Se entra con Google o con email y contraseña.
- **RF-CUE-02.** «Continuar con Google» abre una ventana para elegir la cuenta. Si el navegador bloquea la ventana o no la admite (p. ej. dentro de la APK), usa una redirección.
- **RF-CUE-03.** «Crear una cuenta» pide nombre (opcional), email y una contraseña de al menos 8 caracteres, y envía un email para confirmar la dirección. Los emails de la cuenta van en español.
- **RF-CUE-04.** Una cuenta con contraseña tiene que confirmar su email antes de solicitar acceso. Su pantalla ofrece «Ya lo he confirmado», «Reenviar el email» y «Cerrar sesión».
- **RF-CUE-05.** Al entrar, un email desconocido y una contraseña incorrecta dan el mismo mensaje: «Email o contraseña incorrectos.».
- **RF-CUE-06.** «¿Olvidaste tu contraseña?» envía un enlace para crear otra. La respuesta es la misma tanto si el email tiene cuenta como si no.

**Solicitud de acceso**

- **RF-CUE-07.** La app solo se abre con el acceso aprobado. El estado llega en vivo: al aprobarse, rechazarse o retirarse el acceso, la pantalla cambia sin recargar.
- **RF-CUE-08.** Sin acceso, la app muestra una pantalla según el estado: «Solicita acceso», «Solicitud enviada», «Solicitud no aprobada», «Acceso retirado» o «Cuenta bloqueada». Si no puede consultar el servidor, muestra «No se pudo comprobar tu acceso» con «Reintentar».
- **RF-CUE-09.** La solicitud admite un mensaje opcional de hasta 500 caracteres para la persona administradora. El servidor exige que la cuenta tenga el email confirmado.
- **RF-CUE-10.** Tras un rechazo o una retirada se puede volver a solicitar acceso pasado un día. Una cuenta bloqueada no puede solicitarlo.
- **RF-CUE-11.** La persona recibe un email cuando la persona administradora aprueba su solicitud, también al desactivar la aprobación obligatoria.
- **RF-CUE-12.** Sin acceso aprobado se pueden descargar los datos, eliminar la cuenta, escribir con «Escríbenos» y cerrar la sesión.
- **RF-CUE-13.** Con el acceso aprobado, la app guarda en el perfil el nombre, el email, la foto, la fecha de alta y la del último acceso.

**Gestión de la cuenta**

- **RF-CUE-14.** El menú de la cuenta muestra el nombre, la foto o las iniciales y cómo se entra (Google o email). Da acceso a «Accesibilidad», «Descargar mis datos (JSON)», «Importar datos (JSON)», «Escríbenos», la seguridad, «Cerrar sesión» y la eliminación de la cuenta.
- **RF-CUE-15.** «Descargar mis datos (JSON)» descarga los datos de la app: tareas, evaluaciones, reuniones, correos, metas, proyectos, áreas de la Rueda, nombre y email. No incluye el resto del perfil, la solicitud de acceso ni los mensajes de «Escríbenos».
- **RF-CUE-16.** Una cuenta con contraseña puede «Cambiar la contraseña» escribiendo la actual y una nueva de al menos 8 caracteres.
- **RF-CUE-17.** «Cerrar sesión en todos los dispositivos» invalida las sesiones de la cuenta y cierra la de este dispositivo. Los demás pierden el acceso en menos de una hora.
- **RF-CUE-18.** «Cerrar sesión» borra la copia local de los datos del dispositivo. Si hay otras pestañas de la app abiertas, la copia se queda hasta cerrar sesión con una sola.
- **RF-CUE-19.** «Eliminar mi cuenta y todos mis datos» pide la contraseña o, en las cuentas de Google, volver a entrar con Google. Borra los datos de la cuenta, su perfil, su solicitud de acceso y sus mensajes de «Escríbenos», y después la cuenta.

**Primera vez**

- **RF-CUE-20.** La bienvenida se muestra una sola vez por cuenta, en tres pantallas («Por qué», «El método» y «Cómo empezar»). Se salta en cualquier momento con «Saltar» o Escape.
- **RF-CUE-21.** Que la bienvenida ya se vio se guarda en el perfil y en el dispositivo, así no se repite sin conexión ni en otro dispositivo. Mientras el perfil no llega del servidor, la bienvenida espera.
- **RF-CUE-22.** Al terminar la bienvenida empieza un recorrido guiado de 9 pasos por los elementos principales, que empieza en «Listas». Se maneja con las flechas y Escape, y salta los pasos cuyo elemento no se ve.
- **RF-CUE-23.** Al acabar el recorrido de la primera vez, la app abre la Rueda si la cuenta aún no tiene evaluaciones.
- **RF-CUE-24.** Si el navegador guarda datos de la versión anterior sin cuentas, la app ofrece importarlos en el primer inicio de sesión, antes de la bienvenida. Se eligen los perfiles que importar (con sus tareas, evaluaciones, reuniones y correos); los datos de demostración nunca se importan.
- **RF-CUE-25.** Importar borra del navegador todos los datos locales antiguos, también los de los perfiles no marcados. «Descartar» los borra sin importar, previa confirmación, y «Más tarde» deja la decisión para otro momento.
- **RF-CUE-26.** «Importar datos (JSON)», en el menú de la cuenta, acepta el archivo de «Descargar mis datos (JSON)» (de hasta 5 MB, también de versiones anteriores) y rechaza, con el motivo, cualquier otro, incluidas las descargas de una sola tarea, meta o proyecto. Pide conexión.
- **RF-CUE-27.** Antes de importar, la app muestra la fecha de la descarga y, por cada tipo de dato, cuántos registros son nuevos, cuántos ya están en la cuenta (mismo identificador) y cuántos no son válidos, y qué áreas de la Rueda se añadirán.
- **RF-CUE-28.** Solo se guarda lo que falta: lo que ya está en la cuenta no se modifica, así importar dos veces el mismo archivo no duplica nada. Cada registro se comprueba campo a campo y se guardan solo los campos conocidos, con la cuenta actual como propietaria. Las áreas que faltan se añaden al final; un nombre repetido lleva un número y, pasado el máximo de áreas a la vista, entran ocultas.
- **RF-CUE-29.** La importación muestra su avance y no se puede cerrar mientras escribe. Si falla a medias, dice cuántos registros entraron; volver a importar el archivo completa el resto.

### 1.11 Administración (RF-ADM)

Origen: `src/components/AdminView.tsx`, `src/components/AccessAdminView.tsx`, `src/components/FeedbackAdminView.tsx`, `src/services/adminAlerts.ts`, `functions/src/access.ts`, `functions/src/accessLogic.ts`, `functions/src/feedback.ts`.

- **RF-ADM-01.** La cuenta de la persona administradora se aprueba sola al entrar, siempre que su email esté verificado. Si cambia el email configurado, la marca de la cuenta anterior se borra la próxima vez que alguien entra en la app o la administración actúa.
- **RF-ADM-02.** «Administración» tiene dos pestañas: «Solicitudes» y «Mensajes».
- **RF-ADM-03.** «Aprobación obligatoria» activa o desactiva la aprobación de cuentas. Sin configuración guardada, está activada.
- **RF-ADM-04.** Desactivarla pide confirmación y aprueba las solicitudes pendientes cuyo email no esté bloqueado. Cada persona aprobada recibe su email, y un aviso dice cuántas se aprobaron.
- **RF-ADM-05.** Con la aprobación desactivada, una cuenta nueva o pendiente con el email confirmado entra sola. Las rechazadas, retiradas y bloqueadas siguen igual.
- **RF-ADM-06.** «Solicitudes» agrupa las cuentas en «Pendientes», «Con acceso», «Rechazadas o retiradas» y «Bloqueadas». Cada una muestra nombre, email, foto, estado, fechas de solicitud y de decisión, y el mensaje.
- **RF-ADM-07.** Las acciones dependen del estado: pendiente, «Aprobar», «Rechazar» y «Bloquear»; con acceso, «Retirar acceso» y «Bloquear»; rechazada o retirada, «Aprobar» y «Bloquear»; bloqueada, «Desbloquear», que la deja retirada. El servidor admite además aprobar una cuenta bloqueada, que la interfaz no ofrece, y rechaza cualquier otro cambio.
- **RF-ADM-08.** La persona administradora no puede cambiar su propio acceso.
- **RF-ADM-09.** «Bloquear» guarda también el email en una lista negra, que se conserva aunque la cuenta se elimine. Una cuenta nueva con ese email empieza bloqueada, y «Desbloquear» o «Aprobar» la cuenta bloqueada libera el email.
- **RF-ADM-10.** Cada solicitud pendiente nueva genera un email a la persona administradora, sin datos de quien la envía.
- **RF-ADM-11.** Un aviso rojo en «Administración» y en sus pestañas cuenta las solicitudes pendientes, los mensajes sin leer y las cuentas nuevas con acceso. Son cuentas nuevas las aprobadas cuya solicitud es posterior a la última vez que se miraron las solicitudes en ese dispositivo, y salen marcadas como «Nueva».
- **RF-ADM-12.** Mirar la pestaña «Solicitudes» da por vistas las cuentas nuevas en ese dispositivo.
- **RF-ADM-13.** «Mensajes» muestra en vivo los mensajes abiertos (nuevos y leídos), del más reciente al más antiguo. Los cerrados se cargan bajo demanda, por páginas, con «Ver los cerrados» y «Cargar más».
- **RF-ADM-14.** Cada mensaje muestra tipo, estado, asunto, descripción, nombre, email, la información técnica si se adjuntó y las respuestas enviadas.
- **RF-ADM-15.** «Responder» envía por email a quien escribió una respuesta de hasta 5000 caracteres, desde el buzón de CLAR y con su mensaje citado. La respuesta se guarda en el mensaje solo si el envío sale, y un mensaje nuevo pasa a leído.
- **RF-ADM-16.** Una respuesta nunca se envía dos veces: lleva un identificador que se repite en los reintentos. Si un envío quedó a medias sin saber si salió, no se reenvía y la app lo avisa.
- **RF-ADM-17.** «Desde mi correo» abre el programa de correo para responder desde otra cuenta. «Marcar como leído», «Cerrar» y «Reabrir» cambian el estado del mensaje; reabrir lo deja leído.
- **RF-ADM-18.** Cada mensaje nuevo de «Escríbenos» genera un email a la persona administradora, sin el contenido ni los datos de quien escribe.

### 1.12 Contacto (RF-CON)

Origen: `src/components/FeedbackDialog.tsx`, `src/services/feedback.ts`, `functions/src/feedback.ts`, `functions/src/feedbackLogic.ts`.

- **RF-CON-01.** «Escríbenos» se abre desde la Ayuda, el menú de la cuenta y la pantalla de acceso. Funciona también sin acceso aprobado.
- **RF-CON-02.** El mensaje tiene tipo («Sugerencia», «Error o fallo» o «Mensaje general»), asunto obligatorio de hasta 120 caracteres y descripción obligatoria de hasta 2000, con contador.
- **RF-CON-03.** Se puede adjuntar información técnica, de forma opcional y viéndola antes de enviarla: versión de CLAR, sistema, navegador con su versión mayor, tipo de dispositivo, idioma y conexión.
- **RF-CON-04.** Del sistema solo se da la versión de Android, iOS e iPadOS; de Windows, macOS, ChromeOS y Linux, solo el nombre. El dispositivo es móvil por debajo de 768 px, tableta por debajo de 1024 px y escritorio a partir de ahí.
- **RF-CON-05.** Para enviar hace falta el email confirmado. Cada cuenta puede enviar como mucho 5 mensajes por hora.
- **RF-CON-06.** El servidor quita los caracteres de control y recorta el texto a sus límites. Descarta la información técnica si no tiene el formato esperado.
- **RF-CON-07.** El mensaje se guarda con el nombre y el email de la cuenta para poder responder. Al enviarlo, la app confirma «¡Gracias! Hemos recibido tu mensaje.».
- **RF-CON-08.** Los mensajes de una cuenta se borran al eliminarla.

### 1.13 Textos legales (RF-LEG)

Origen: `src/Root.tsx`, `src/components/LegalPage.tsx`, `src/components/LegalTexts.tsx`, `src/services/legal.ts`.

- **RF-LEG-01.** La política de privacidad (`/privacidad`), las condiciones de uso (`/condiciones`) y el aviso legal (`/aviso-legal`) son páginas públicas. Se ven sin iniciar sesión y sin cargar Firebase.
- **RF-LEG-02.** Las rutas admiten barra final y mayúsculas. Cada página muestra su título, enlaces a las otras dos, la fecha de su última actualización y «Volver a CLAR».
- **RF-LEG-03.** Los textos legales se enlazan desde las pantallas de inicio de sesión, confirmación del email y solicitud de acceso, el pie, el menú de la cuenta y la Ayuda.
- **RF-LEG-04.** La pantalla de inicio de sesión indica que, al continuar, se confirma tener al menos 14 años y se aceptan las condiciones de uso. La app no pide ni comprueba la edad.
- **RF-LEG-05.** La política de privacidad trata el responsable, los datos y sus fines, la base jurídica, los destinatarios, la ubicación y las transferencias, la conservación, los derechos, los menores, las decisiones automatizadas, la seguridad y los cambios.
- **RF-LEG-06.** Las condiciones de uso tratan el servicio, la edad mínima, la cuenta, el uso aceptable, el contenido, la disponibilidad, la baja, los cambios, el contacto y la ley aplicable. El aviso legal trata el titular, la propiedad intelectual y los enlaces.
- **RF-LEG-07.** Una prueba unitaria falla si los textos legales no tienen titular o email de contacto.

---

## 2. Requisitos no funcionales

### 2.1 Seguridad (RNF-SEG)

Origen: `firestore.rules`, `firebase.json`, `functions/src/access.ts`, `functions/src/feedback.ts`, `tests/rules/firestore.rules.test.ts`.

- **RNF-SEG-01.** Las reglas de Firestore solo dejan a cada cuenta leer y escribir en `users/{uid}` y sus subcolecciones. Lo que no coincide con ninguna regla queda denegado.
- **RNF-SEG-02.** Crear y modificar datos exige el acceso aprobado. Leer y borrar los propios datos se permite siempre, para que una cuenta sin acceso pueda llevárselos o eliminarlos.
- **RNF-SEG-03.** Las subcolecciones permitidas son seis: tareas, evaluaciones, reuniones, correos, metas y proyectos. El perfil solo admite sus campos conocidos (datos de la cuenta, bienvenida y áreas de la Rueda).
- **RNF-SEG-04.** Las solicitudes de acceso, las marcas de administración, la configuración, la lista negra y el contador de mensajes solo los escriben las Cloud Functions. Ningún cliente puede escribirlos, tampoco la persona administradora.
- **RNF-SEG-05.** Cada cuenta lee solo su propia solicitud de acceso, y la persona administradora, todas. Nadie lee desde la app la lista negra ni el contador de mensajes.
- **RNF-SEG-06.** Las reglas reconocen a la persona administradora solo si existe su marca y el email guardado en ella coincide con el del token de quien lee.
- **RNF-SEG-07.** La persona administradora solo puede leer los mensajes de contacto y cambiar su estado a nuevo, leído o cerrado. No puede escribir su contenido ni sus respuestas desde la app.
- **RNF-SEG-08.** Las funciones invocables exigen sesión iniciada. Las de administración comprueban además que el email verificado del token es el configurado.
- **RNF-SEG-09.** Las funciones validan y recortan lo que reciben: estados permitidos, longitudes, formato de los identificadores y caracteres de control. Los cambios de acceso van en transacciones: al entrar y al solicitar acceso se leen también el modo de aprobación y la lista negra; una decisión de la administración comprueba el estado actual.
- **RNF-SEG-10.** Hosting añade a todas las respuestas `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y una `Permissions-Policy` que deniega cámara, micrófono, ubicación, pagos, USB y `browsing-topics`.
- **RNF-SEG-11.** La política de seguridad de contenidos (CSP) y la `Cross-Origin-Opener-Policy` están en modo solo informar (`Report-Only`): avisan en la consola del navegador, pero no bloquean.
- **RNF-SEG-12.** Eliminar la cuenta exige volver a autenticarse, y cambiar la contraseña exige la actual.
- **RNF-SEG-13.** La app descarga su configuración de Firebase del propio Hosting al arrancar, así que el identificador del proyecto no está en el código. La contraseña del buzón de correo está en Secret Manager.
- **RNF-SEG-14.** Los correos salen por SMTP con TLS (puerto 465).
- **RNF-SEG-15.** El despliegue desde CI se autentica con Workload Identity Federation, sin claves de cuenta de servicio guardadas.

### 2.2 Privacidad (RNF-PRI)

Origen: `functions/src/accessLogic.ts`, `functions/src/feedbackLogic.ts`, `functions/src/feedbackCleanup.ts`, `src/services/feedback.ts`, `src/components/LegalTexts.tsx`.

- **RNF-PRI-01.** Los datos de cada cuenta solo son accesibles para ella (RNF-SEG-01). Para revisar una solicitud, la persona administradora solo ve el nombre, el email, la foto de perfil y el mensaje de la solicitud.
- **RNF-PRI-02.** Las Cloud Functions se ejecutan en la región `europe-west1` (Bélgica). La app informa de que los datos se guardan en Google Cloud en la Unión Europea (Bélgica).
- **RNF-PRI-03.** Los emails de aviso a la persona administradora no llevan datos de quien escribe ni el contenido: se leen en la app. Los emails que envían las Cloud Functions son de texto plano.
- **RNF-PRI-04.** Los registros (logs) de las funciones no incluyen datos personales ni el identificador de la cuenta.
- **RNF-PRI-05.** La información técnica de un mensaje de contacto es opcional, se ve antes de enviarla y no incluye el identificador completo del navegador (user-agent).
- **RNF-PRI-06.** De los adjuntos de un correo solo se guardan el nombre y el tamaño. Los archivos no salen del dispositivo.
- **RNF-PRI-07.** Las descargas (JSON e .ics) se generan en el navegador, sin pasar por ningún servidor. Los enlaces al calendario no conectan ninguna cuenta.
- **RNF-PRI-08.** El Top 10, las sugerencias, las estadísticas y las recomendaciones se calculan en el navegador.
- **RNF-PRI-09.** La app no carga fuentes externas: usa la tipografía del sistema. No incluye herramientas de analítica ni de seguimiento.
- **RNF-PRI-10.** Las fotos de perfil se cargan sin enviar la página de origen (`referrerPolicy="no-referrer"`).
- **RNF-PRI-11.** Al eliminar la cuenta se borran sus datos, su solicitud de acceso y sus mensajes. Solo se conservan el email, si estaba bloqueado (con el identificador interno de la cuenta y la fecha del bloqueo), y las horas de los envíos de la última hora, ligadas solo al identificador interno, para que el límite de mensajes siga aplicándose. Ese registro de envíos no se borra después.
- **RNF-PRI-12.** Al cerrar sesión se borra la copia local de los datos (RF-CUE-18).
- **RNF-PRI-13.** Cada cuenta puede descargar sus datos de la app en JSON en cualquier momento, también sin acceso aprobado (ver RF-CUE-15).

### 2.3 Accesibilidad (RNF-ACC)

Origen: `tests/e2e/a11y.spec.ts`, `src/hooks/useModalFocus.ts`, `src/components/AccessibilityPanel.tsx`, `src/services/a11yPrefs.ts`, `src/index.css`.

- **RNF-ACC-01.** Una auditoría automática con axe-core comprueba las pautas WCAG 2.0 y 2.1, niveles A y AA, en cada pantalla, formulario y ventana. Se repite con alto contraste y texto muy grande, y con la disposición del móvil.
- **RNF-ACC-02.** Toda la app se usa con el teclado. Al principio de la página hay un enlace «Saltar al contenido».
- **RNF-ACC-03.** Las ventanas modales llevan el foco dentro, lo mantienen dentro con Tab, se cierran con Escape y devuelven el foco al elemento que las abrió. Mientras hay una abierta, el resto de la página queda inerte.
- **RNF-ACC-04.** El panel «Accesibilidad» ofrece tamaño del texto (Normal, Grande o Muy grande: 100 %, 112,5 % y 125 %), alto contraste, reducir animaciones y foco muy visible. Los cambios se aplican al momento.
- **RNF-ACC-05.** Las preferencias se guardan en cada dispositivo y se aplican antes de dibujar la página. El panel está también en las pantallas de inicio de sesión, confirmación del email y solicitud de acceso.
- **RNF-ACC-06.** La app reduce las animaciones también cuando lo pide el sistema (`prefers-reduced-motion`).
- **RNF-ACC-07.** Los avisos se anuncian a los lectores de pantalla: los normales en una región viva educada y las alarmas en una asertiva.
- **RNF-ACC-08.** Los gráficos y las barras de progreso tienen alternativa en texto: el gráfico de 14 días tiene una tabla equivalente y las barras usan el rol `progressbar` con su valor descrito.
- **RNF-ACC-09.** Los botones de solo icono tienen nombre accesible. El documento declara el idioma español (`lang="es"`).
- **RNF-ACC-10.** La pregunta antes de descartar cambios pone el foco en «Seguir editando», la opción que no pierde nada.

### 2.4 Funcionamiento sin conexión y sincronización (RNF-OFF)

Origen: `src/services/firebase.ts`, `src/services/repository.ts`, `src/lazy.tsx`.

- **RNF-OFF-01.** Firestore usa una caché persistente en el dispositivo, compartida entre pestañas. Con la app abierta, se puede leer y escribir sin conexión.
- **RNF-OFF-02.** Las escrituras se aplican al momento en la copia local y se envían al servidor en segundo plano. Al volver la conexión, se sincronizan con el servidor y con los demás dispositivos y pestañas.
- **RNF-OFF-03.** Los datos llegan en tiempo real: un cambio hecho en otro dispositivo aparece sin recargar.
- **RNF-OFF-04.** Necesitan conexión: iniciar sesión, comprobar un acceso que aún no está en la caché, «Deshacer», las funciones del servidor (solicitar acceso, contacto y administración) y eliminar la cuenta.
- **RNF-OFF-05.** La app no registra un service worker. Al arrancar descarga su configuración de Firebase del Hosting; si no puede, muestra un error en lugar de la app.
- **RNF-OFF-06.** Si sin conexión falla la descarga de una parte de la app, la app no se recarga: sigue en pie con los datos y ofrece «Reintentar».
- **RNF-OFF-07.** Los cambios simultáneos desde varios dispositivos no duplican ni pisan datos. La siguiente repetición tiene un identificador fijo, «Deshacer» comprueba en una transacción que nada cambió, y al eliminar una meta o un proyecto cada tarea se desvincula en su propia transacción, solo si sigue vinculada.

### 2.5 Rendimiento (RNF-REN)

Origen: `src/App.tsx`, `src/Root.tsx`, `src/lazy.tsx`, `vite.config.ts`, `firebase.json`.

- **RNF-REN-01.** Las secciones y ventanas que no se ven al arrancar se descargan la primera vez que se abren: Agenda, Rueda, Metas, Proyectos, Tiempo protegido, Ayuda, Administración, los editores de metas, proyectos y áreas, la bienvenida y el recorrido.
- **RNF-REN-02.** Las páginas legales se cargan sin Firebase ni el resto de la app.
- **RNF-REN-03.** Las librerías van en paquetes aparte (Firebase, React y el resto), que el navegador conserva entre versiones. Los archivos de `/assets/` se sirven con caché de un año, como inmutables.
- **RNF-REN-04.** Los cálculos (Top 10, estadísticas, sugerencias, agenda y alarmas) se hacen en el navegador sobre los datos ya cargados. Los estados que dependen de la hora se recalculan cada minuto.
- **RNF-REN-05.** Los mensajes cerrados de administración se cargan por páginas: se leen de 50 en 50 hasta reunir al menos 20 cerrados, así que una página trae entre 20 y 69 (o menos, al final). Solo los abiertos llegan en vivo.
- **RNF-REN-06.** Las escrituras masivas (importación y borrado de la cuenta o de sus mensajes) van en lotes de hasta 450 operaciones. Las desvinculaciones y aprobaciones en bloque van de 10 en 10, y los emails en bloque comparten como mucho 3 conexiones.
- **RNF-REN-07.** La función HTTP `api` admite como mucho 10 instancias. El cambio del modo de aprobación puede tardar hasta 300 s.

### 2.6 Compatibilidad y plataformas (RNF-COM)

Origen: `index.html`, `public/manifest.json`, `functions/src/app.ts`, `src/services/authDomain.ts`, `tests/e2e/responsive.spec.ts`, `playwright.config.ts`.

- **RNF-COM-01.** La interfaz se adapta al ancho de la pantalla. Las pruebas comprueban que no hay desbordamiento horizontal a 360, 375, 768 y 1280 px, y que la cabecera cabe en una línea a 360 px con el texto ampliado.
- **RNF-COM-02.** La disposición del móvil se usa por debajo de 768 px. La app respeta las zonas seguras de la pantalla (muesca y barras del sistema).
- **RNF-COM-03.** La app tiene un manifiesto web (nombre, iconos, también adaptables, modo `standalone` y orientación vertical) y las etiquetas para añadirla a la pantalla de inicio en iOS.
- **RNF-COM-04.** La función HTTP `api` sirve `/.well-known/assetlinks.json` para verificar la app Android (APK de tipo Trusted Web Activity).
- **RNF-COM-05.** Las fechas y horas no dependen del idioma ni de la configuración del navegador: la semana empieza en lunes y las horas son de 24 h.
- **RNF-COM-06.** La interfaz está en español, y las fechas y los números usan el formato `es-ES`.
- **RNF-COM-07.** Servida desde su dominio propio, la app inicia sesión en ese mismo dominio, para que el navegador no bloquee la ventana de Google.
- **RNF-COM-08.** Las pruebas de extremo a extremo se ejecutan en Chromium, con el perfil de Chrome de escritorio.

### 2.7 Mantenibilidad y pruebas (RNF-MAN)

Origen: `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`, `tests/`, `functions/test/`.

- **RNF-MAN-01.** El código es TypeScript en modo estricto. ESLint no admite avisos y Prettier fija el formato; un hook de pre-commit los aplica a los archivos del commit.
- **RNF-MAN-02.** La lógica pura está separada de la interfaz y de Firebase (`src/services/`, `functions/src/accessLogic.ts`, `functions/src/feedbackLogic.ts`) y tiene pruebas unitarias con el test runner de Node.
- **RNF-MAN-03.** Hay pruebas de integración de la importación de datos locales y pruebas de las reglas de Firestore contra el emulador.
- **RNF-MAN-04.** Las pruebas de extremo a extremo (Playwright), un archivo por función de la app, usan los emuladores de Auth, Firestore y Functions con un proyecto de demostración.
- **RNF-MAN-05.** En cada push y pull request, CI comprueba el formato, el linter, los tipos, la compilación de la app y de las funciones, y todas las pruebas. Solo despliega desde la rama principal, si todo pasa, y de un despliegue en uno.
- **RNF-MAN-06.** La app toma la versión de `package.json`; `public/manifest.json` la repite y se actualiza a mano. Se muestra en la cabecera, el inicio de sesión y el pie, y va en las descargas y en la información técnica del contacto.
- **RNF-MAN-07.** La app sigue leyendo los datos de versiones anteriores: tareas sin estado (con `completed`), correos sin estado, adjuntos sin bytes y repeticiones con fecha de inicio.

---

## 3. Fuera de alcance

Lo que el código no hace y un lector podría esperar:

- CLAR no envía correos ni sube adjuntos: los guarda y los pasa al programa de correo.
- No se conecta a cuentas de calendario: solo exporta con enlaces y archivos .ics.
- No avisa con la app cerrada: no hay notificaciones push ni service worker.
- «Tiempo protegido» no tiene herramienta para la tercera fuga de tiempo, los mensajes.
- Las reuniones no se pueden editar ni eliminar desde la app.
- Las evaluaciones de la Rueda no se editan ni se borran una a una, y las áreas no se eliminan ni se reordenan.
- No hay listas compartidas ni colaboración: cada cuenta solo ve lo suyo.
- La interfaz solo está en español.
