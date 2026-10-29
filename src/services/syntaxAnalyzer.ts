import { messages } from '../i18n/locale';

// Analizador de la acción siguiente: comprueba que la tarea empieza por un verbo de acción física
// Mitiga la postergación sistemática originada por la ambigüedad en la corteza prefrontal

const PHYSICAL_ACTION_VERBS = [
  // Infinitivos de acción física e inmediata
  'llamar',
  'telefonear',
  'contactar',
  'redactar',
  'escribir',
  'tipear',
  'borrador',
  'enviar',
  'mandar',
  'remitir',
  'despachar',
  'revisar',
  'auditar',
  'leer',
  'inspeccionar',
  'analizar',
  'verificar',
  'comprobar',
  'comprar',
  'adquirir',
  'ordenar',
  'pagar',
  'abonar',
  'transferir',
  'programar',
  'codificar',
  'desarrollar',
  'depurar',
  'testear',
  'diseñar',
  'maquetar',
  'bocetar',
  'dibujar',
  'organizar',
  'clasificar',
  'archivar',
  'ordenar',
  'limpiar',
  'agendar',
  'reservar',
  'planificar',
  'fijar',
  'estudiar',
  'repasar',
  'memorizar',
  'entrenar',
  'correr',
  'caminar',
  'levantar',
  'estirar',
  'ejercitar',
  'preparar',
  'cocinar',
  'elaborar',
  'montar',
  'armar',
  'pedir',
  'solicitar',
  'requerir',
  'firmar',
  'rubricar',
  'sellar',
  'publicar',
  'subir',
  'descargar',
  'exportar',
  'importar',
  'medir',
  'calcular',
  'presupuestar',
  'reunir',
  'conversar',
  'preguntar',
  'consultar'
];

// Raíces y formas conjugadas frecuentes en español
const ACTION_PATTERNS = [
  /^(llamar|llama|llámale|llamá|llamad)\b/i,
  /^(redactar|redacta|redactá|escribir|escribe|escribí)\b/i,
  /^(enviar|envía|enviá|mandar|manda)\b/i,
  /^(revisar|revisa|revisá|leer|lee|leé|analizar|analiza)\b/i,
  /^(comprar|compra|comprá|pagar|paga|pagá)\b/i,
  /^(programar|programa|codificar|desarrollar|depurar)\b/i,
  /^(diseñar|diseña|maquetar|maqueta)\b/i,
  /^(limpiar|limpia|ordenar|ordena|organizar|organiza)\b/i,
  /^(agendar|agenda|reservar|reserva|fijar|fija)\b/i,
  /^(preparar|prepara|elaborar|elabora)\b/i,
  /^(pedir|pide|solicitar|solicita)\b/i,
  /^(firmar|firma|firmá|publicar|publica)\b/i,
  /^(entrenar|entrena|correr|corre)\b/i,
  /^(calcular|calcula|presupuestar)\b/i
];

// Proyectos amorfos o sustantivos comúnmente utilizados que disparan advertencia
const SPANISH_AMORPHOUS_PATTERNS = [
  { match: /^(marketing|mercadeo)$/i, suggestion: 'Redactar plan de anuncios en Google para captación del trimestre' },
  { match: /^(coche|auto|vehículo)$/i, suggestion: 'Llamar al taller para pedir presupuesto de revisión técnica' },
  {
    match: /^(finanzas|contabilidad)$/i,
    suggestion: 'Revisar hoja de cálculo de balance y conciliar extracto bancario'
  },
  { match: /^(salud|médico|doctor)$/i, suggestion: 'Pedir cita con el cardiólogo para analítica rutinaria' },
  {
    match: /^(gimnasio|gym|ejercicio)$/i,
    suggestion: 'Preparar ropa deportiva y realizar 30 min de entrenamiento de fuerza'
  },
  { match: /^(tesis|proyecto|informe)$/i, suggestion: 'Escribir el primer borrador de la introducción metodológica' },
  { match: /^(vacaciones|viaje)$/i, suggestion: 'Buscar vuelos y comparar 3 opciones de alojamiento' },
  { match: /^(casa|mudanza)$/i, suggestion: 'Embalar cajas de la habitación o contactar empresa de fletes' },
  { match: /^(web|sitio web)$/i, suggestion: 'Dibujar un boceto de la pantalla principal' }
];

// En español: un patrón de inicio en la primera palabra o la raíz (4 letras) de un verbo en la primera o la segunda
const spanishVerb = (words: string[]): string | null => {
  const firstWord = words[0]?.replace(/[.,;:!?]/g, '');
  // Comprobar patrones de inicio
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(firstWord)) return firstWord;
  }
  // Comprobar lista de verbos en el primer token o segundo token
  for (const verb of PHYSICAL_ACTION_VERBS) {
    if (firstWord.startsWith(verb.slice(0, 4)) || (words[1] && words[1].startsWith(verb.slice(0, 4)))) return verb;
  }
  return null;
};

// EN INGLÉS: verbos de acción en imperativo (la forma con la que se escribe una tarea: «Call…», «Book…»)
const ENGLISH_ACTION_VERBS = new Set([
  'call',
  'phone',
  'ring',
  'text',
  'email',
  'message',
  'contact',
  'reply',
  'answer',
  'write',
  'draft',
  'type',
  'edit',
  'proofread',
  'rewrite',
  'send',
  'mail',
  'post',
  'forward',
  'deliver',
  'submit',
  'share',
  'review',
  'check',
  'read',
  'inspect',
  'analyze',
  'analyse',
  'verify',
  'audit',
  'test',
  'compare',
  'research',
  'look',
  'find',
  'search',
  'buy',
  'purchase',
  'order',
  'pay',
  'transfer',
  'renew',
  'cancel',
  'return',
  'book',
  'reserve',
  'schedule',
  'plan',
  'arrange',
  'set',
  'fix',
  'repair',
  'install',
  'update',
  'upgrade',
  'clean',
  'tidy',
  'wash',
  'sort',
  'organize',
  'organise',
  'file',
  'archive',
  'pack',
  'unpack',
  'move',
  'prepare',
  'prep',
  'cook',
  'bake',
  'make',
  'build',
  'assemble',
  'create',
  'design',
  'sketch',
  'draw',
  'paint',
  'code',
  'program',
  'develop',
  'debug',
  'deploy',
  'implement',
  'study',
  'learn',
  'practice',
  'practise',
  'revise',
  'memorize',
  'train',
  'run',
  'walk',
  'stretch',
  'exercise',
  'swim',
  'lift',
  'ask',
  'request',
  'apply',
  'sign',
  'publish',
  'upload',
  'download',
  'export',
  'import',
  'print',
  'scan',
  'measure',
  'calculate',
  'budget',
  'estimate',
  'meet',
  'discuss',
  'talk',
  'visit',
  'go',
  'pick',
  'collect',
  'drop',
  'take',
  'bring',
  'get',
  'finish',
  'complete',
  'start',
  'record',
  'note',
  'list',
  'outline',
  'summarize',
  'translate',
  'present',
  'pitch',
  'invite',
  'thank',
  'confirm',
  'remind',
  'follow',
  'water',
  'feed',
  'charge',
  'refill',
  'replace',
  'change',
  'register',
  'interview',
  'hire',
  'invoice',
  'reconcile',
  'add',
  'sell',
  'fill',
  'see',
  'tell',
  'open',
  'close',
  'help',
  'decide',
  'choose',
  'remove',
  'delete',
  'mark',
  'vacuum',
  'hoover',
  'mow',
  'iron',
  'shop',
  'summarise',
  'memorise',
  'prioritise',
  'prioritize',
  'finalise',
  'finalize'
]);

const ENGLISH_AMORPHOUS_PATTERNS = [
  { match: /^marketing$/i, suggestion: 'Draft a Google Ads plan to bring in customers this quarter' },
  { match: /^(car|vehicle)$/i, suggestion: 'Call the garage to get a quote for the car service' },
  {
    match: /^(finances?|accounting)$/i,
    suggestion: 'Review the balance spreadsheet and reconcile the bank statement'
  },
  { match: /^(health|doctor)$/i, suggestion: 'Book an appointment with the cardiologist for a routine blood test' },
  {
    match: /^(gym|exercise|workout)$/i,
    suggestion: 'Get your gym clothes ready and do 30 min of strength training'
  },
  { match: /^(thesis|project|report)$/i, suggestion: 'Write the first draft of the methodology introduction' },
  { match: /^(vacation|holidays?|trip)$/i, suggestion: 'Search for flights and compare 3 places to stay' },
  { match: /^(house|home|move|moving)$/i, suggestion: 'Pack the boxes for one room or contact a moving company' },
  { match: /^(web|website)$/i, suggestion: 'Sketch the main screen' }
];

// En inglés: la primera o la segunda palabra («Please call…») es un verbo de la lista
const englishVerb = (words: string[]): string | null =>
  words
    .slice(0, 2)
    .map((word) => word.replace(/[.,;:!?]/g, ''))
    .find((word) => ENGLISH_ACTION_VERBS.has(word)) ?? null;

// Lo que depende del idioma: cómo se reconoce el verbo, los proyectos amorfos y los textos
const language = messages(
  {
    detectVerb: spanishVerb,
    amorphous: SPANISH_AMORPHOUS_PATTERNS,
    empty: 'El nombre de la tarea no puede estar vacío.',
    emptyQuestion: 'Escribe una acción física concreta e inmediata.',
    looksLikeProject: (title: string) => `«${title}» parece un proyecto, no una acción concreta.`,
    firstStep: '¿Cuál es el primer paso? Conviértelo en algo que puedas hacer ya.',
    missingVerb: 'Falta un verbo de acción.',
    missingVerbQuestion:
      '¿Cuál es el primer paso? Empieza por un verbo de acción (p. ej. «Llamar a…», «Redactar…», «Comprar…»).',
    missingVerbSuggestion: (title: string) => `Llamar o redactar respecto a ${title}`,
    startWithVerb:
      'Recomendación: Comienza con un verbo de acción en infinitivo o imperativo para reducir el umbral de activación motora.',
    unambiguous: '¿Es esta acción inmediatamente ejecutable sin ambigüedad?',
    doIt: (title: string) => `Ejecutar: ${title}`
  },
  {
    detectVerb: englishVerb,
    amorphous: ENGLISH_AMORPHOUS_PATTERNS,
    empty: "The task name can't be empty.",
    emptyQuestion: 'Write a concrete physical action you can do right away.',
    looksLikeProject: (title) => `“${title}” looks like a project, not a concrete action.`,
    firstStep: "What's the first step? Turn it into something you can do right away.",
    missingVerb: 'It needs an action verb.',
    missingVerbQuestion: "What's the first step? Start with an action verb (e.g. “Call…”, “Draft…”, “Buy…”).",
    missingVerbSuggestion: (title) => `Call or write about ${title}`,
    startWithVerb: 'Tip: start with an action verb, so it takes less effort to get going.',
    unambiguous: 'Can you do this right away, with no doubt about what it means?',
    doIt: (title) => `Do: ${title}`
  }
);

export interface SyntaxAnalysisResult {
  isValid: boolean;
  detectedVerb: string | null;
  warning?: string;
  assistantQuestion?: string;
  suggestion?: string;
}

export function analyzeImmediateActionSyntax(title: string): SyntaxAnalysisResult {
  const trimmed = title.trim();

  if (!trimmed) {
    return {
      isValid: false,
      detectedVerb: null,
      warning: language.empty,
      assistantQuestion: language.emptyQuestion
    };
  }

  // Comprobar si es un proyecto amorfo conocido
  for (const item of language.amorphous) {
    if (item.match.test(trimmed)) {
      return {
        isValid: false,
        detectedVerb: null,
        warning: language.looksLikeProject(trimmed),
        assistantQuestion: language.firstStep,
        suggestion: item.suggestion
      };
    }
  }

  // Tokenizar para buscar verbos de acción
  const words = trimmed.toLowerCase().split(/\s+/);
  const detectedVerb = language.detectVerb(words);
  if (detectedVerb) {
    return {
      isValid: true,
      detectedVerb
    };
  }

  // Si no se detectó verbo de acción física
  if (words.length <= 2 && !trimmed.includes(' ')) {
    return {
      isValid: false,
      detectedVerb: null,
      warning: language.missingVerb,
      assistantQuestion: language.missingVerbQuestion,
      suggestion: language.missingVerbSuggestion(trimmed.toLowerCase())
    };
  }

  // Si tiene varias palabras pero empieza con un sustantivo
  return {
    isValid: true,
    detectedVerb: null,
    warning: language.startWithVerb,
    assistantQuestion: language.unambiguous,
    suggestion: language.doIt(trimmed)
  };
}
