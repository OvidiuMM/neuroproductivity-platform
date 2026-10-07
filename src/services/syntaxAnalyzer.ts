// Analizador Sintáctico de la Acción Inmediata Siguiente (Módulo 4)
// Mitiga la postergación sistemática originada por la ambigüedad en la corteza prefrontal

const PHYSICAL_ACTION_VERBS = [
  // Infinitivos de acción física e inmediata
  'llamar', 'telefonear', 'contactar',
  'redactar', 'escribir', 'tipear', 'borrador',
  'enviar', 'mandar', 'remitir', 'despachar',
  'revisar', 'auditar', 'leer', 'inspeccionar', 'analizar', 'verificar', 'comprobar',
  'comprar', 'adquirir', 'ordenar', 'pagar', 'abonar', 'transferir',
  'programar', 'codificar', 'desarrollar', 'depurar', 'testear',
  'diseñar', 'maquetar', 'bocetar', 'dibujar',
  'organizar', 'clasificar', 'archivar', 'ordenar', 'limpiar',
  'agendar', 'reservar', 'planificar', 'fijar',
  'estudiar', 'repasar', 'memorizar',
  'entrenar', 'correr', 'caminar', 'levantar', 'estirar', 'ejercitar',
  'preparar', 'cocinar', 'elaborar', 'montar', 'armar',
  'pedir', 'solicitar', 'requerir',
  'firmar', 'rubricar', 'sellar',
  'publicar', 'subir', 'descargar', 'exportar', 'importar',
  'medir', 'calcular', 'presupuestar',
  'reunir', 'conversar', 'preguntar', 'consultar'
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
const AMORPHOUS_PROJECT_PATTERNS = [
  { match: /^(marketing|mercadeo)$/i, suggestion: 'Redactar plan de anuncios en Google para captación del trimestre' },
  { match: /^(coche|auto|vehículo)$/i, suggestion: 'Llamar al taller para pedir presupuesto de revisión técnica' },
  { match: /^(finanzas|contabilidad)$/i, suggestion: 'Revisar hoja de cálculo de balance y conciliar extracto bancario' },
  { match: /^(salud|médico|doctor)$/i, suggestion: 'Pedir cita con el cardiólogo para analítica rutinaria' },
  { match: /^(gimnasio|gym|ejercicio)$/i, suggestion: 'Preparar ropa deportiva y realizar 30 min de entrenamiento de fuerza' },
  { match: /^(tesis|proyecto|informe)$/i, suggestion: 'Escribir el primer borrador de la introducción metodológica' },
  { match: /^(vacaciones|viaje)$/i, suggestion: 'Buscar vuelos y comparar 3 opciones de alojamiento' },
  { match: /^(casa|mudanza)$/i, suggestion: 'Embalar cajas de la habitación o contactar empresa de fletes' },
  { match: /^(web|sitio web)$/i, suggestion: 'Diseñar wireframe de la pantalla principal en Figma' }
];

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
      warning: 'El nombre de la tarea no puede estar vacío.',
      assistantQuestion: 'Escribe una acción física concreta e inmediata.',
    };
  }

  // Comprobar si es un proyecto amorfo conocido
  for (const item of AMORPHOUS_PROJECT_PATTERNS) {
    if (item.match.test(trimmed)) {
      return {
        isValid: false,
        detectedVerb: null,
        warning: `"${trimmed}" representa un proyecto abstracto o etiqueta amorfa, no una acción física indivisible.`,
        assistantQuestion: '¿Cuál es el primer paso físico e indivisible? Convierte la meta en una acción motora.',
        suggestion: item.suggestion
      };
    }
  }

  // Tokenizar para buscar verbos de acción
  const words = trimmed.toLowerCase().split(/\s+/);
  const firstWord = words[0]?.replace(/[.,;:!?]/g, '');

  // Comprobar patrones de inicio
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(firstWord)) {
      return {
        isValid: true,
        detectedVerb: firstWord,
      };
    }
  }

  // Comprobar lista de verbos en el primer token o segundo token
  for (const verb of PHYSICAL_ACTION_VERBS) {
    if (firstWord.startsWith(verb.slice(0, 4)) || (words[1] && words[1].startsWith(verb.slice(0, 4)))) {
      return {
        isValid: true,
        detectedVerb: verb,
      };
    }
  }

  // Si no se detectó verbo de acción física
  if (words.length <= 2 && !trimmed.includes(' ')) {
    return {
      isValid: false,
      detectedVerb: null,
      warning: 'Carencia de verbo transitivo de acción física motora.',
      assistantQuestion: '¿Cuál es el primer paso físico e indivisible? Inicia con un verbo de acción (ej. "Llamar a...", "Redactar...", "Comprar...").',
      suggestion: `Llamar o redactar respecto a ${trimmed.toLowerCase()}`
    };
  }

  // Si tiene varias palabras pero empieza con un sustantivo
  return {
    isValid: true,
    detectedVerb: null,
    warning: 'Recomendación: Comienza con un verbo de acción en infinitivo o imperativo para reducir el umbral de activación motora.',
    assistantQuestion: '¿Es esta acción inmediatamente ejecutable sin ambigüedad?',
    suggestion: `Ejecutar: ${trimmed}`
  };
}
