import React, { useState } from 'react';
import { WheelOfLifeLog, WheelCategory } from '../types';
import { Compass, History, Save, Sparkles, Check, TrendingUp, AlertCircle, Flag, BookOpen } from 'lucide-react';

interface WheelOfLifeProps {
  logs: WheelOfLifeLog[];
  // Primer arranque: la cuenta no tiene ninguna evaluación guardada (confirmado con el servidor)
  showFirstStep: boolean;
  onAppendSnapshot: (scores: Record<WheelCategory, number>, label?: string) => void;
  onOpenHelp: () => void;
}

// Margen del viewBox alrededor del círculo para que quepan las etiquetas de las áreas
const LABEL_MARGIN_X = 100;
const LABEL_MARGIN_Y = 16;

const CATEGORIES: WheelCategory[] = [
  'Salud',
  'Carrera Profesional',
  'Finanzas',
  'Familia',
  'Ocio',
  'Relaciones',
  'Espiritualidad'
];

export const WheelOfLife: React.FC<WheelOfLifeProps> = ({ logs, showFirstStep, onAppendSnapshot, onOpenHelp }) => {
  // Sin evaluaciones guardadas (primer arranque) todas las áreas empiezan en 0
  const latestLog = logs[logs.length - 1] || {
    scores: {
      Salud: 0,
      'Carrera Profesional': 0,
      Finanzas: 0,
      Familia: 0,
      Ocio: 0,
      Relaciones: 0,
      Espiritualidad: 0
    }
  };

  const [currentScores, setCurrentScores] = useState<Record<WheelCategory, number>>({
    ...latestLog.scores
  });

  const [showHistoryOverlay, setShowHistoryOverlay] = useState(true);
  const [selectedHistoricalIndex, setSelectedHistoricalIndex] = useState<number>(0);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // SVG polar coordinates math
  const size = 460;
  const center = size / 2;
  const radius = size * 0.38;
  const numCategories = CATEGORIES.length;
  const angleStep = (Math.PI * 2) / numCategories;

  const getCoordinates = (index: number, score: number) => {
    // Score is 0 to 10
    const normalizedScore = Math.max(0, Math.min(10, score)) / 10;
    const angle = index * angleStep - Math.PI / 2;
    const r = radius * normalizedScore;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const generatePolygonPath = (scores: Record<WheelCategory, number>) => {
    return CATEGORIES.map((cat, i) => {
      const { x, y } = getCoordinates(i, scores[cat] ?? 0);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ') + ' Z';
  };

  const handleScoreChange = (cat: WheelCategory, value: number) => {
    setCurrentScores((prev) => ({
      ...prev,
      [cat]: Math.max(0, Math.min(10, value))
    }));
  };

  const handleConsolidateState = () => {
    onAppendSnapshot(currentScores, snapshotLabel || undefined);
    setSnapshotLabel('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const historicalLog = logs[selectedHistoricalIndex];

  return (
    <div className="space-y-6">

      {/* AVISO DE PRIMER PASO (solo mientras la cuenta no tiene ninguna evaluación guardada) */}
      {showFirstStep && (
        <div
          role="status"
          className="p-5 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-bold text-indigo-950">Primer paso: evalúa tu Rueda de la Vida</h3>
            <p className="text-xs text-indigo-900 leading-relaxed">
              Puntúa de 0 a 10 tu satisfacción actual en cada área y pulsa <strong>Consolidar Estado</strong>. Será tu punto de partida: las tareas que crees se vincularán a estas áreas y podrás comparar tu progreso en cada nueva evaluación.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenHelp}
            className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Cómo funciona la app</span>
          </button>
        </div>
      )}

      {/* Encabezado y explicación metodológica */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-600" />
            Rueda de la Vida & Trazabilidad Temporal Inmutable
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Módulo 1: Evaluación holística de la satisfacción autopercibida (escala 0 a 10). Cada modificación genera una captura inmutable <em>append-only</em> para trazar correlaciones con el esfuerzo diario de neuroplasticidad.
          </p>
        </div>

        {/* Conmutador de Comparativa Histórica (HU-01 Escenario 2) */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={showHistoryOverlay}
              onChange={(e) => setShowHistoryOverlay(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 border-slate-300"
            />
            <History className="w-4 h-4 text-indigo-600" />
            <span>Comparativa Histórica (Superposición)</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: GRÁFICO POLAR INTERACTIVO SVG */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col items-center justify-center">
          
          {/* viewBox con margen para las etiquetas: el gráfico escala al ancho disponible sin desbordar en móvil */}
          <div className="relative w-full max-w-[600px] flex items-center justify-center">
            <svg
              viewBox={`${-LABEL_MARGIN_X} ${-LABEL_MARGIN_Y} ${size + 2 * LABEL_MARGIN_X} ${size + 2 * LABEL_MARGIN_Y}`}
              className="w-full h-auto"
              role="img"
              aria-label="Gráfico de la Rueda de la Vida"
            >
              
              {/* Círculos concéntricos de referencia (Niveles del 0 al 10) */}
              {[2, 4, 6, 8, 10].map((level) => (
                <circle
                  key={level}
                  cx={center}
                  cy={center}
                  r={(radius * level) / 10}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray={level === 10 ? 'none' : '3 3'}
                />
              ))}

              {/* Radios que dividen las categorías */}
              {CATEGORIES.map((cat, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const x2 = center + radius * Math.cos(angle);
                const y2 = center + radius * Math.sin(angle);
                return (
                  <line
                    key={cat}
                    x1={center}
                    y1={center}
                    x2={x2}
                    y2={y2}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                );
              })}

              {/* POLÍGONO HISTÓRICO COMPARATIVO (Translúcido en ámbar) */}
              {showHistoryOverlay && historicalLog && (
                <path
                  d={generatePolygonPath(historicalLog.scores)}
                  fill="rgba(245, 158, 11, 0.22)"
                  stroke="#d97706"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="transition-all duration-300"
                />
              )}

              {/* POLÍGONO ACTUAL VIGENTE (Sólido interactivo en azul/índigo) */}
              <path
                d={generatePolygonPath(currentScores)}
                fill="rgba(79, 70, 229, 0.28)"
                stroke="#4f46e5"
                strokeWidth="2.5"
                className="transition-all duration-150"
              />

              {/* Vértices interactivos para arrastre/clic directo */}
              {CATEGORIES.map((cat, i) => {
                const { x, y } = getCoordinates(i, currentScores[cat]);
                return (
                  <g key={cat}>
                    <circle
                      cx={x}
                      cy={y}
                      r="6"
                      fill="#4f46e5"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-pointer hover:r-8 transition-all"
                    />
                  </g>
                );
              })}

              {/* Etiquetas radiales de las categorías */}
              {CATEGORIES.map((cat, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const labelRadius = radius + 28;
                const lx = center + labelRadius * Math.cos(angle);
                const ly = center + labelRadius * Math.sin(angle);
                return (
                  <text
                    key={cat}
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[11px] font-bold fill-slate-700"
                  >
                    {cat} ({currentScores[cat]}/10)
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Leyenda del gráfico */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
              <span className="font-semibold text-slate-800">Estado Actual (Vigente)</span>
            </div>
            {showHistoryOverlay && historicalLog && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block border border-dashed border-amber-700" />
                <span className="text-slate-600">
                  {historicalLog.label || 'Histórico previo'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: AJUSTE DIRECTO DE RADIOS & SNAPSHOT APPEND-ONLY */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Panel de Sliders / Manipulación Directa (0 al 10) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Puntuaciones por Segmento Vital
              </h3>
              <span className="text-[11px] text-slate-400">Escala ordinal 0-10</span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {CATEGORIES.map((cat) => {
                const currentVal = currentScores[cat];
                const histVal = historicalLog ? historicalLog.scores[cat] : currentVal;
                const delta = currentVal - histVal;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{cat}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-900">{currentVal}/10</span>
                        {showHistoryOverlay && historicalLog && delta !== 0 && (
                          <span className={`text-[10px] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={currentVal}
                      aria-label={`Puntuación de ${cat}`}
                      onChange={(e) => handleScoreChange(cat, parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                );
              })}
            </div>

            {/* FORMULARIO DE CONSOLIDACIÓN APPEND-ONLY (HU-01 Escenario 1) */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Consolidar Snapshot Histórico (Append-Only)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="Etiqueta opcional (ej. Cierre Q4 o Retiro)..."
                  className="min-w-0 flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={handleConsolidateState}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Consolidar Estado</span>
                </button>
              </div>

              {savedSuccess && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>
                    Nuevo snapshot inmutable creado con marca de tiempo UTC. Historial preservado.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* HISTORIAL LONGITUDINAL DE CAPTURAS */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Línea Temporal de Neuroplasticidad ({logs.length} snapshots)</span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {logs.map((log, idx) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedHistoricalIndex(idx)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                    selectedHistoricalIndex === idx
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <span className="block truncate">{log.label || `Captura ${idx + 1}`}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    Promedio: {(
                      Object.values(log.scores).reduce((a, b) => a + b, 0) / CATEGORIES.length
                    ).toFixed(1)}/10
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
