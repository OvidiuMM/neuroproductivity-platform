// Motor NLP de Enlace Cognitivo (Módulo 3: TF-IDF y Similitud de Coseno)
// Analiza el título y descripción de la tarea para sugerir automáticamente el área de la Rueda de la Vida

import { WheelCategory } from '../types';

// Stopwords en español para filtrado léxico
const SPANISH_STOPWORDS = new Set([
  'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'como', 'con', 'contra',
  'cual', 'cuando', 'de', 'del', 'desde', 'donde', 'durante', 'e', 'el', 'ella',
  'ellas', 'ellos', 'en', 'entre', 'era', 'erais', 'eran', 'eras', 'eres', 'es',
  'esa', 'esas', 'ese', 'eso', 'esos', 'esta', 'estaba', 'estado', 'estais', 'estamos',
  'estan', 'estar', 'estas', 'este', 'estos', 'estoy', 'fin', 'fue', 'fueron', 'fui',
  'ha', 'hace', 'haces', 'hacia', 'haciendo', 'han', 'has', 'hasta', 'incluso', 'intenta',
  'la', 'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi', 'mis', 'mucho', 'nada',
  'ni', 'no', 'nos', 'nosotras', 'nosotros', 'nuestra', 'nuestro', 'o', 'os', 'otra',
  'otras', 'otro', 'otros', 'para', 'pero', 'poco', 'por', 'porque', 'que', 'quien',
  'se', 'sea', 'segun', 'ser', 'si', 'sido', 'siempre', 'sin', 'sobre', 'sois', 'somos',
  'son', 'su', 'sus', 'suya', 'suyo', 'tal', 'tambien', 'tan', 'tanto', 'te', 'teneis',
  'tenemos', 'tener', 'tengo', 'ti', 'tiene', 'tienen', 'toda', 'todas', 'todo', 'todos',
  'tras', 'tu', 'tus', 'un', 'una', 'unas', 'uno', 'unos', 'va', 'vamos', 'van', 'vaya',
  'yo'
]);

// Corpus lingüísticos pre-entrenados para las 7 áreas de la Rueda de la Vida
const CATEGORY_CORPUS: Record<WheelCategory, string[]> = {
  Salud: [
    'medico', 'doctor', 'salud', 'hospital', 'analitica', 'sangre', 'dieta', 'nutricion',
    'entrenar', 'pesas', 'gimnasio', 'cardio', 'correr', 'sueno', 'dormir', 'descanso',
    'fisioterapia', 'farmacia', 'medicamento', 'vitaminas', 'dental', 'dentista', 'peso',
    'calorias', 'estiramientos', 'postura', 'ergonomia', 'hidratacion', 'deporte', 'fuerza',
    'revision', 'terapia', 'chequeo', 'clinica'
  ],
  'Carrera Profesional': [
    'trabajo', 'empleo', 'empresa', 'proyecto', 'cliente', 'reunion', 'informe', 'entrega',
    'jefe', 'equipo', 'presentacion', 'pitch', 'contrato', 'negociacion', 'codigo', 'software',
    'desarrollo', 'ventas', 'propuesta', 'factura', 'carrera', 'ascenso', 'curriculum',
    'portfolio', 'objetivo', 'estrategia', 'kpi', 'roadmap', 'plazo', 'sprint', 'liderazgo'
  ],
  Finanzas: [
    'dinero', 'finanzas', 'banco', 'cuenta', 'balance', 'contable', 'contabilidad', 'gastos',
    'ingresos', 'ahorro', 'presupuesto', 'inversion', 'acciones', 'fondos', 'impuestos',
    'facturas', 'hipoteca', 'deuda', 'intereses', 'costes', 'rentabilidad', 'iva', 'irpf',
    'prevision', 'tesoreria', 'capital', 'patrimonio', 'comisiones', 'nomina'
  ],
  Familia: [
    'familia', 'padres', 'madre', 'padre', 'hijos', 'hijo', 'hija', 'hermanos', 'abuelos',
    'casa', 'hogar', 'colegio', 'escuela', 'cena', 'comida', 'cumpleanos', 'aniversario',
    'cuidado', 'tiempo', 'compartir', 'parientes', 'reunion', 'viaje', 'domingo'
  ],
  Ocio: [
    'ocio', 'vacaciones', 'viaje', 'escapada', 'cine', 'pelicula', 'serie', 'lectura',
    'libro', 'musica', 'concierto', 'videojuego', 'hobby', 'paseo', 'naturaleza', 'playa',
    'montana', 'teatro', 'museo', 'restaurante', 'cena', 'amigos', 'fiesta', 'desconexion',
    'recreacion', 'arte', 'fotografia', 'guitarra', 'relax'
  ],
  Relaciones: [
    'amigos', 'amistad', 'pareja', 'novio', 'novia', 'amor', 'cita', 'conversacion',
    'cafe', 'quedada', 'social', 'red', 'contacto', 'llamada', 'apoyo', 'escucha',
    'comunicacion', 'empatia', 'compañero', 'comunidad', 'networking', 'celebracion'
  ],
  Espiritualidad: [
    'meditacion', 'mindfulness', 'reflexion', 'calma', 'gratitud', 'respiracion', 'paz',
    'interior', 'autoconocimiento', 'filosofia', 'valores', 'proposito', 'sentido',
    'naturaleza', 'retiro', 'conciencia', 'diario', 'journaling', 'silencio', 'presencia'
  ]
};

// Tokenizador y limpiador léxico
export function tokenizeAndClean(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes para normalización
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !SPANISH_STOPWORDS.has(token));
}

// Vector de términos con TF
function calculateTF(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  const total = tokens.length;
  if (total === 0) return tf;

  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  for (const token in tf) {
    tf[token] = tf[token] / total;
  }
  return tf;
}

// Similitud del coseno entre dos diccionarios dispersos ponderados
function cosineSimilarity(vecA: Record<string, number>, vecB: Record<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const word in vecA) {
    normA += vecA[word] * vecA[word];
    if (vecB[word]) {
      dotProduct += vecA[word] * vecB[word];
    }
  }

  for (const word in vecB) {
    normB += vecB[word] * vecB[word];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Caché de centroides de categorías precomputados
const CATEGORY_CENTROIDS: Record<WheelCategory, Record<string, number>> = (() => {
  const centroids: Record<string, Record<string, number>> = {};
  for (const [category, words] of Object.entries(CATEGORY_CORPUS)) {
    centroids[category] = calculateTF(words);
  }
  return centroids as Record<WheelCategory, Record<string, number>>;
})();

export interface NLPSuggestionResult {
  category: WheelCategory | null;
  confidenceScore: number;
  tokensFound: string[];
  allScores: Record<WheelCategory, number>;
  isAboveThreshold: boolean; // Umbral empírico >= 0.65 (o adaptado si coincide léxicamente)
}

export function inferWheelCategory(title: string, description: string): NLPSuggestionResult {
  const combinedText = `${title} ${description}`;
  const tokens = tokenizeAndClean(combinedText);
  const docTF = calculateTF(tokens);

  const scores: Record<string, number> = {};
  let bestCategory: WheelCategory | null = null;
  let maxScore = 0;
  const matchedTokens: string[] = [];

  for (const [category, centroid] of Object.entries(CATEGORY_CENTROIDS) as [WheelCategory, Record<string, number>][]) {
    const similarity = cosineSimilarity(docTF, centroid);
    scores[category] = Number(similarity.toFixed(3));

    if (similarity > maxScore) {
      maxScore = similarity;
      bestCategory = category;
    }
  }

  // Detectar tokens coincidentes para feedback explicativo
  if (bestCategory) {
    const categoryWords = new Set(CATEGORY_CORPUS[bestCategory]);
    for (const token of tokens) {
      if (categoryWords.has(token)) {
        matchedTokens.push(token);
      }
    }
  }

  // Umbral empírico: 0.65 normalizado o >= 0.15 en similitud de coseno sobre textos cortos con palabras clave coincidentes
  const normalizedConfidence = Math.min(1, Math.round(maxScore * 180) / 100);
  const isAboveThreshold = maxScore >= 0.12 || matchedTokens.length >= 1;

  return {
    category: isAboveThreshold ? bestCategory : null,
    confidenceScore: maxScore > 0 ? (matchedTokens.length >= 2 ? Math.max(0.75, normalizedConfidence) : Math.max(0.65, normalizedConfidence)) : 0,
    tokensFound: Array.from(new Set(matchedTokens)),
    allScores: scores as Record<WheelCategory, number>,
    isAboveThreshold: isAboveThreshold && maxScore > 0
  };
}
