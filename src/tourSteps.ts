import type { TourStep } from './components/ProductTour';
import { messages } from './i18n/locale';

type StepId = 'new-task' | 'lists' | 'top10' | 'filters' | 'agenda' | 'wheel' | 'goals' | 'projects' | 'home' | 'help';
type StepTexts = Record<StepId, Pick<TourStep, 'title' | 'body'>>;

const m = messages<StepTexts>(
  {
    'new-task': {
      title: 'Captura una tarea',
      body: 'Apunta lo que tengas en la cabeza en cuanto aparezca, empezando por un verbo físico: «Llamar…», «Enviar…». Lo demás es opcional.'
    },
    lists: {
      title: 'Dos listas que no se mezclan',
      body: 'Profesional y Personal. Cambia de una a otra aquí; el número dice cuántas tareas activas tiene cada una.'
    },
    top10: {
      title: 'Tu Top 10',
      body: 'Las diez tareas más importantes, por prioridad y plazo. Toca el círculo para marcar una como hecha; si te equivocas, «Deshacer».'
    },
    filters: {
      title: 'Ordena y filtra',
      body: 'Por prioridad, estimación, plazo, estado o área. Los filtros activos quedan a la vista y se quitan con un toque.'
    },
    agenda: {
      title: 'Agenda',
      body: 'Tus tareas con fecha de las dos listas, por semana o por días, con las repeticiones previstas.'
    },
    wheel: {
      title: 'Rueda de la Vida',
      body: 'Puntúa del 0 al 10 cada área de tu vida. Es el punto de partida: muestra qué áreas necesitan atención. En el móvil está en «Más».'
    },
    goals: {
      title: 'Metas',
      body: 'Lo que quieres conseguir en cada área, empezando por las más bajas. Añade tareas a cada meta y verás cómo avanza; si quieres, agrupa las relacionadas en proyectos.'
    },
    projects: {
      title: 'Proyectos (opcional)',
      body: 'Agrupan tareas relacionadas, con fecha de fin, para cumplir una meta o una parte de ella. Una meta puede tener uno o varios, o ninguno. La batería muestra cuánto llevas hecho. En el móvil está en «Más».'
    },
    home: {
      title: 'Tu progreso',
      body: 'En Inicio: tareas hechas, a tiempo o con retraso, velocidad, metas y recomendaciones.'
    },
    help: {
      title: 'Ayuda',
      body: 'La guía de la app (en el móvil, en «Más»). Desde ella puedes repetir este recorrido cuando quieras.'
    }
  },
  {
    'new-task': {
      title: 'Capture a task',
      body: 'Write down whatever’s on your mind as soon as it comes up, starting with a physical verb: “Call…”, “Send…”. The rest is optional.'
    },
    lists: {
      title: 'Two lists that don’t mix',
      body: 'Work and Personal. Switch between them here; the number shows how many active tasks each one has.'
    },
    top10: {
      title: 'Your Top 10',
      body: 'Your ten most important tasks, by priority and deadline. Tap the circle to mark one as done; if you make a mistake, “Undo”.'
    },
    filters: {
      title: 'Sort and filter',
      body: 'By priority, estimate, deadline, status or area. Active filters stay in view and you remove them with a tap.'
    },
    agenda: {
      title: 'Agenda',
      body: 'Your dated tasks from both lists, by week or by day, with upcoming repeats.'
    },
    wheel: {
      title: 'Wheel of Life',
      body: 'Score each area of your life from 0 to 10. It’s the starting point: it shows which areas need attention. On your phone it’s under “More”.'
    },
    goals: {
      title: 'Goals',
      body: 'What you want to achieve in each area, starting with the lowest ones. Add tasks to each goal and watch it move forward; if you like, group related ones into projects.'
    },
    projects: {
      title: 'Projects (optional)',
      body: 'They group related tasks, with an end date, to reach a goal or part of one. A goal can have one, several or none. The battery shows how much you’ve done. On your phone it’s under “More”.'
    },
    home: {
      title: 'Your progress',
      body: 'On Home: tasks done, on time or late, pace, goals and recommendations.'
    },
    help: {
      title: 'Help',
      body: 'The app guide (on your phone, under “More”). From there you can replay this tour whenever you like.'
    }
  }
);

const step = (id: StepId, target: string): TourStep => ({ id, target, ...m[id] });

// Pasos del recorrido guiado. Los elementos llevan `data-tour`; en el móvil algunos están en otro sitio (botón
// flotante, barra inferior, «Más») y el recorrido resalta el que se ve. Empieza en «Listas».
export const TOUR_STEPS: TourStep[] = [
  step('new-task', '[data-tour="new-task"]'),
  step('lists', '[data-tour="lists"]'),
  step('top10', '[data-tour="top10"]'),
  step('filters', '[data-tour="filters"]'),
  step('agenda', '[data-tour="nav-agenda"]'),
  step('wheel', '[data-tour="nav-wheel"], [data-tour="nav-more"]'),
  step('goals', '[data-tour="nav-goals"]'),
  step('projects', '[data-tour="nav-projects"], [data-tour="nav-more"]'),
  step('home', '[data-tour="nav-home"]'),
  step('help', '[data-tour="nav-help"], [data-tour="nav-more"]')
];
