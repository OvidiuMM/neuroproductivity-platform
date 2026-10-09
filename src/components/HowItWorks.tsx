import React from 'react';
import { AppTab } from '../types';
import { BookOpen, Compass, Briefcase, ShieldCheck, CheckCircle2, ArrowRight, Database, Link2 } from 'lucide-react';

interface HowItWorksProps {
  onNavigate: (tab: AppTab) => void;
}

const SCREENS: { tab: AppTab; title: string; icon: React.ReactNode; points: string[] }[] = [
  {
    tab: 'wheel',
    title: 'Rueda de la Vida',
    icon: <Compass className="w-5 h-5 text-indigo-600" />,
    points: [
      'Puntúa de 0 a 10 tu satisfacción en 7 áreas: Salud, Carrera Profesional, Finanzas, Familia, Ocio, Relaciones y Espiritualidad.',
      'Cada vez que pulsas «Consolidar Estado» se guarda una evaluación nueva; las anteriores nunca se modifican.',
      'Activa la comparativa histórica para superponer una evaluación anterior y ver qué áreas han mejorado.'
    ]
  },
  {
    tab: 'tasks',
    title: 'Listas Duales',
    icon: <Briefcase className="w-5 h-5 text-indigo-600" />,
    points: [
      'Dos listas separadas, Profesional y Personal, para no mezclar contextos. Cambia entre ellas con el selector de la barra superior.',
      'Las 10 primeras tareas de la lista (por defecto, ordenada por prioridad) se destacan como tu Top 10; el resto queda en segundo plano.',
      'Al crear una tarea, el analizador te pide una acción física concreta (por ejemplo «Llamar al taller…») en lugar de un tema abstracto.',
      'Cada tarea tiene un estado: Pendiente, En progreso, Bloqueada o Hecha. Al marcarla Hecha se archiva; desde «Archivadas» la reactivas cambiando su estado.',
      'Puedes darle una fecha límite o un intervalo, con hora opcional: el título se pone violeta cuando falta menos de una semana y rojo cuando ha vencido.',
      'Con fecha límite, el botón de calendario la añade a Google Calendar, Outlook o cualquier calendario (archivo .ics).',
      'Las ideas sin urgencia van a «Opciones Futuras» y no compiten con el Top 10.'
    ]
  },
  {
    tab: 'bermudas',
    title: 'Blindaje Bermudas',
    icon: <ShieldCheck className="w-5 h-5 text-indigo-600" />,
    points: [
      'Reuniones: no se pueden programar antes de las 12:00 h y exigen hora de fin, orden del día y un moderador.',
      'Correo: primero adjuntos y cuerpo del mensaje; los destinatarios se desbloquean al final.'
    ]
  },
  {
    tab: 'requirements',
    title: 'Validación de Requisitos',
    icon: <CheckCircle2 className="w-5 h-5 text-indigo-600" />,
    points: ['Especificación técnica de los módulos y un banco de pruebas en vivo del analizador y del motor de sugerencias.']
  }
];

export const HowItWorks: React.FC<HowItWorksProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          Cómo funciona la app
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          NeuroProductividad aplica la metodología del Dr. Jonathan Benito Sipos: primero decides qué áreas de tu vida quieres mejorar, luego conviertes esa intención en acciones concretas y, por último, proteges el tiempo que necesitas para hacerlas.
        </p>
      </div>

      {/* PRIMEROS PASOS */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Primeros pasos</h3>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ['Evalúa tu Rueda de la Vida', 'Es tu punto de partida y muestra qué áreas necesitan atención.'],
            ['Crea tus primeras tareas', 'Acciones físicas concretas en la lista Profesional o Personal.'],
            ['Protege tu agenda', 'Reserva las mañanas y redacta los correos en el orden correcto.']
          ].map(([title, text], i) => (
            <li key={title} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div>
                <span className="block text-sm font-bold text-slate-900">{title}</span>
                <span className="block text-xs text-slate-600 mt-0.5">{text}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* PANTALLAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SCREENS.map((screen) => (
          <section key={screen.tab} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {screen.icon}
              {screen.title}
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed list-disc pl-4 flex-1">
              {screen.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onNavigate(screen.tab)}
              className="self-start text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
            >
              Ir a {screen.title}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </section>
        ))}
      </div>

      {/* RELACIONES ENTRE PANTALLAS */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-indigo-600" />
          Cómo se relacionan
        </h3>
        <ul className="space-y-2 text-sm text-slate-600 leading-relaxed list-disc pl-5">
          <li>
            <strong>Rueda → Tareas:</strong> al escribir una tarea, el motor de sugerencias propone el área de la rueda con la que se relaciona. Así lo que haces cada día queda vinculado a las áreas que quieres mejorar.
          </li>
          <li>
            <strong>Tareas → Blindaje:</strong> las mañanas sin reuniones son el tiempo para trabajar tu Top 10.
          </li>
          <li>
            <strong>Vuelta a la Rueda:</strong> reevalúa la rueda cada cierto tiempo y compárala con evaluaciones anteriores para ver el efecto de tus acciones.
          </li>
        </ul>
      </div>

      {/* DATOS Y PERFILES */}
      <div className="bg-amber-50/70 rounded-2xl p-6 border border-amber-200 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
          <Database className="w-4 h-4" />
          Tus datos
        </h3>
        <p className="text-sm text-amber-950 leading-relaxed">
          Todo se guarda en tu cuenta de Google, en servidores de Google Cloud en la Unión Europea (Bélgica), y solo tú puedes acceder. Se sincroniza entre tus dispositivos y la app sigue funcionando sin conexión: los cambios se envían al recuperarla. Desde el menú de tu cuenta puedes descargar tus datos o eliminar la cuenta con todo su contenido.
        </p>
      </div>
    </div>
  );
};
