import React from 'react';
import { AppTab } from '../types';
import {
  BookOpen,
  Compass,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  Database,
  Link2,
  CalendarDays,
  LayoutDashboard,
  Target
} from 'lucide-react';

interface HowItWorksProps {
  onNavigate: (tab: AppTab) => void;
  // Volver a ver el recorrido guiado o la bienvenida
  onStartTour: () => void;
  onShowWelcome: () => void;
  onContact: () => void;
}

const SCREENS: { tab: AppTab; title: string; icon: React.ReactNode; points: string[] }[] = [
  {
    tab: 'home',
    title: 'Inicio',
    icon: <LayoutDashboard className="h-5 w-5 text-indigo-600" />,
    points: [
      'El foco de la lista activa (Profesional o Personal) y sus indicadores: Top 10, Índice de la Rueda y reuniones.',
      'Tus estadísticas: tareas hechas por día, semana y mes, cuántas terminas antes o después del plazo, tu velocidad, tu racha y tus pendientes.',
      'Recomendaciones según tus datos, por ejemplo empezar por la tarea vencida más antigua.'
    ]
  },
  {
    tab: 'wheel',
    title: 'Rueda de la Vida',
    icon: <Compass className="h-5 w-5 text-indigo-600" />,
    points: [
      'Puntúa de 0 a 10 tu satisfacción en 7 áreas: Salud, Carrera Profesional, Finanzas, Familia, Ocio, Relaciones y Espiritualidad.',
      'Cada vez que pulsas «Guardar la evaluación» se guarda una evaluación nueva; las anteriores nunca se modifican.',
      'Activa la comparativa histórica para superponer una evaluación anterior y ver qué áreas han mejorado.',
      'Las áreas más bajas son las mejores candidatas para una meta: en «Metas» aparecen las primeras.'
    ]
  },
  {
    tab: 'goals',
    title: 'Metas',
    icon: <Target className="h-5 w-5 text-indigo-600" />,
    points: [
      'Una meta es lo que quieres conseguir en un área de tu Rueda, por ejemplo «Correr una media maratón» en Salud. Puede llevar un para qué y una fecha objetivo.',
      'Las áreas aparecen de la puntuación más baja a la más alta, según tu última evaluación. Las que tienen 5 o menos y aún no tienen metas salen en «Necesitan atención».',
      'Cada meta muestra su progreso (tareas hechas sobre el total) y las tareas que le quedan. Pulsa una para editarla.',
      '«Añadir tarea» crea una tarea ya vinculada a la meta. También puedes vincularla desde el formulario de la tarea; la tarea toma el área de su meta.',
      'Cuando la consigas, márcala como lograda; si deja de interesarte, archívala. Las logradas y archivadas quedan plegadas al final.'
    ]
  },
  {
    tab: 'tasks',
    title: 'Listas',
    icon: <Briefcase className="h-5 w-5 text-indigo-600" />,
    points: [
      'Dos listas separadas, Profesional y Personal, para no mezclar contextos. Cambia entre ellas con el selector de la barra superior.',
      'Las 10 primeras tareas, según el orden y los filtros que elijas (prioridad, fecha límite, estimación, estado o área), forman tu Top 10; el resto queda en segundo plano.',
      'Si la fecha límite está a más de una semana, la tarea cuenta un nivel menos de prioridad. También puedes indicar cuánto te llevará (estimación).',
      'Al crear una tarea, el analizador te pide una acción física concreta (por ejemplo «Llamar al taller…») en lugar de un tema abstracto.',
      'Cada tarea tiene un estado: Pendiente, En progreso, Bloqueada o Hecha. Al marcarla Hecha se archiva; desde «Archivadas» la reactivas cambiando su estado.',
      'Puedes darle una fecha límite o un intervalo, con hora opcional: el título se pone violeta cuando falta menos de una semana y rojo cuando ha vencido. Las fechas se escriben como dd/mm/aaaa o se eligen en el calendario, con la semana empezando en lunes.',
      'Con fecha límite, el botón de calendario la añade a Google Calendar, Outlook o cualquier calendario (archivo .ics).',
      'Alarma: una hora para que CLAR te avise antes del plazo, dentro de las 24 h anteriores (con la tarea a las 11:00, una alarma a las 10:57 suena 3 minutos antes). Sin hora límite, suena la víspera a esa hora; una tarea que se repite necesita hora límite para llevarla.',
      'La alarma avisa mientras CLAR esté abierta: dentro de la app y, si lo permites, con una notificación del sistema (en el móvil, solo dentro de la app). Si abres CLAR después de la hora de la alarma pero antes del plazo, avisa al momento. El archivo .ics del calendario también la lleva.',
      'Las tareas pueden repetirse (cada día, semana, mes o año; por ejemplo, «cada mes, el 2.º lunes»). Al repetir, «Inicio» es desde cuándo se repite y la fecha límite hasta cuándo; cada repetición vence su propio día. Al marcarla Hecha se archiva y se crea la siguiente.',
      'Las ideas sin urgencia van a «Algún día» y no compiten con el Top 10.'
    ]
  },
  {
    tab: 'agenda',
    title: 'Agenda',
    icon: <CalendarDays className="h-5 w-5 text-indigo-600" />,
    points: [
      'Vista semanal (de lunes a domingo) y por días con las tareas con fecha de tus dos listas, los intervalos, las próximas repeticiones de las tareas recurrentes y las reuniones.',
      'En la vista por días, las tareas vencidas aparecen aparte. Pulsa una tarea para editarla.'
    ]
  },
  {
    tab: 'bermudas',
    title: 'Tiempo protegido',
    icon: <ShieldCheck className="h-5 w-5 text-indigo-600" />,
    points: [
      'El «triángulo de las Bermudas» del tiempo son sus tres grandes fugas: reuniones, correo y mensajes. Aquí las controlas.',
      'Reuniones: no se pueden programar antes de las 12:00 h y exigen hora de fin, orden del día y un moderador.',
      'Correo: primero adjuntos y cuerpo del mensaje; los destinatarios se desbloquean al final. De los adjuntos, CLAR apunta solo el nombre y el tamaño: los archivos no salen de tu equipo.',
      'Lo que no termines queda en «Borradores»: al cerrar se guarda solo, y con «Continuar» sigues donde lo dejaste. Los correos guardados también se pueden abrir y editar.',
      'CLAR no envía el correo: «Abrir en mi correo» lo pasa a tu programa de correo con los destinatarios, el asunto y el texto; los adjuntos los añades allí.'
    ]
  }
];

export const HowItWorks: React.FC<HowItWorksProps> = ({ onNavigate, onStartTour, onShowWelcome, onContact }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          Ayuda
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          CLAR sigue cuatro pasos: decides qué áreas de tu vida quieres mejorar, les pones metas, conviertes cada meta
          en acciones concretas y proteges el tiempo que necesitas para hacerlas.
        </p>
      </div>

      {/* RECORRIDO Y BIENVENIDA: se pueden repetir cuando se quiera */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Guía rápida</h3>
          <p className="text-xs text-slate-700">
            Un recorrido de un minuto por lo esencial, la introducción al método, o escríbenos con una idea o un fallo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStartTour}
            className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            Repetir el recorrido
          </button>
          <button
            type="button"
            onClick={onShowWelcome}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Ver la introducción
          </button>
          <button
            type="button"
            onClick={onContact}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Escríbenos
          </button>
        </div>
      </div>

      {/* PRIMEROS PASOS */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Primeros pasos</h3>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Evalúa tu Rueda de la Vida', 'Es tu punto de partida y muestra qué áreas necesitan atención.'],
            ['Ponle una meta a un área', 'En «Metas», empieza por las áreas más bajas.'],
            ['Añade tareas a tus metas', 'Acciones físicas concretas en la lista Profesional o Personal.'],
            ['Protege tu agenda', 'Reserva las mañanas y redacta los correos en el orden correcto.']
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <span className="block text-sm font-bold text-slate-900">{title}</span>
                <span className="mt-0.5 block text-xs text-slate-600">{text}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* PANTALLAS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SCREENS.map((screen) => (
          <section
            key={screen.tab}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              {screen.icon}
              {screen.title}
            </h3>
            <ul className="flex-1 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
              {screen.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onNavigate(screen.tab)}
              className="flex items-center gap-1 self-start text-xs font-bold text-indigo-700 hover:text-indigo-900"
            >
              Ir a {screen.title}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        ))}
      </div>

      {/* RELACIONES ENTRE PANTALLAS */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
          <Link2 className="h-4 w-4 text-indigo-600" />
          Cómo se relacionan
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
          <li>
            <strong>Rueda → Tareas:</strong> al escribir una tarea, el motor de sugerencias propone el área de la rueda
            con la que se relaciona. Así lo que haces cada día queda vinculado a las áreas que quieres mejorar.
          </li>
          <li>
            <strong>Tareas → Tiempo protegido:</strong> las mañanas sin reuniones son el tiempo para trabajar tu Top 10.
          </li>
          <li>
            <strong>Vuelta a la Rueda:</strong> reevalúa la rueda cada cierto tiempo y compárala con evaluaciones
            anteriores para ver el efecto de tus acciones.
          </li>
        </ul>
      </div>

      {/* DATOS Y PERFILES */}
      <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
        <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-900 uppercase">
          <Database className="h-4 w-4" />
          Tus datos
        </h3>
        <p className="text-sm leading-relaxed text-amber-950">
          Todo se guarda en tu cuenta de CLAR, en servidores de Google Cloud en la Unión Europea (Bélgica), y solo tú
          puedes acceder. La administración aprueba cada cuenta antes de su primer uso; para ello ve tu nombre, tu
          email, tu foto de perfil (si entras con Google) y el mensaje de la solicitud, nunca tus datos. Se sincroniza
          entre tus dispositivos y la app sigue funcionando sin conexión: los cambios se envían al recuperarla. El
          indicador de la cabecera está verde cuando todo está guardado en el servidor y naranja cuando hay cambios
          pendientes o no hay conexión; púlsalo para forzar la sincronización. Desde el menú de tu cuenta puedes
          descargar tus datos, cambiar la contraseña (si entras con email), cerrar la sesión en todos tus dispositivos o
          eliminar la cuenta con todo su contenido.
        </p>
      </div>

      {/* ACCESIBILIDAD */}
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Accesibilidad</h3>
        <p className="text-sm leading-relaxed text-slate-600">
          En el menú de tu cuenta, <strong>Accesibilidad</strong> permite agrandar el texto, activar el alto contraste,
          reducir las animaciones y hacer más visible el foco del teclado. Las preferencias se guardan en cada
          dispositivo. Toda la app se puede usar con el teclado y se revisa automáticamente con las pautas WCAG 2.1 AA.
        </p>
      </div>

      {/* CRÉDITOS: única mención al autor, como cita de la fuente y sin dar a entender respaldo */}
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Créditos</h3>
        <p className="text-sm leading-relaxed text-slate-600">
          Algunas ideas de esta app se inspiran en el libro <em>Gestiona tu tiempo, disfruta de la vida</em>, de
          Jonathan Benito Sipos. Esta app no está afiliada ni respaldada por el autor.
        </p>
      </div>
    </div>
  );
};
