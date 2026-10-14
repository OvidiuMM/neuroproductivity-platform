import type { TourStep } from './components/ProductTour';

// Pasos del recorrido guiado. Los elementos llevan `data-tour`; en el móvil algunos están en otro sitio (botón
// flotante, barra inferior, «Más») y el recorrido resalta el que se ve. Empieza en «Listas».
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'new-task',
    target: '[data-tour="new-task"]',
    title: 'Captura una tarea',
    body: 'Apunta lo que tengas en la cabeza en cuanto aparezca, empezando por un verbo físico: «Llamar…», «Enviar…». Lo demás es opcional.'
  },
  {
    id: 'lists',
    target: '[data-tour="lists"]',
    title: 'Dos listas que no se mezclan',
    body: 'Profesional y Personal. Cambia de una a otra aquí; el número dice cuántas tareas activas tiene cada una.'
  },
  {
    id: 'top10',
    target: '[data-tour="top10"]',
    title: 'Tu Top 10',
    body: 'Las diez tareas más importantes, por prioridad y plazo. Toca el círculo para marcar una como hecha; si te equivocas, «Deshacer».'
  },
  {
    id: 'filters',
    target: '[data-tour="filters"]',
    title: 'Ordena y filtra',
    body: 'Por prioridad, estimación, plazo, estado o área. Los filtros activos quedan a la vista y se quitan con un toque.'
  },
  {
    id: 'agenda',
    target: '[data-tour="nav-agenda"]',
    title: 'Agenda',
    body: 'Tus tareas con fecha de las dos listas, por semana o por días, con las repeticiones previstas.'
  },
  {
    id: 'wheel',
    target: '[data-tour="nav-wheel"]',
    title: 'Rueda y metas',
    body: 'Evalúa cada área de tu vida y ponle metas. Vincula tareas a una meta y verás cómo avanza.'
  },
  {
    id: 'home',
    target: '[data-tour="nav-home"]',
    title: 'Tu progreso',
    body: 'En Inicio: tareas hechas, a tiempo o con retraso, velocidad, metas y recomendaciones.'
  },
  {
    id: 'help',
    target: '[data-tour="nav-help"], [data-tour="nav-more"]',
    title: 'Ayuda',
    body: 'La guía de la app, y desde ella puedes repetir este recorrido cuando quieras.'
  }
];
