import React, { useState } from 'react';
import { Goal, GoalStatus, TaskItem, WheelOfLifeLog, WheelCategory } from '../types';
import { activeGoalsByArea } from '../services/goals';
import { WHEEL_CATEGORIES } from '../services/wheel';
import { GoalsPanel } from './GoalsPanel';
import { Compass, History, Save, Check, TrendingUp, Flag, BookOpen } from 'lucide-react';

interface WheelOfLifeProps {
  logs: WheelOfLifeLog[];
  // Primer arranque: la cuenta no tiene ninguna evaluación guardada (confirmado con el servidor)
  showFirstStep: boolean;
  onAppendSnapshot: (scores: Record<WheelCategory, number>, label?: string) => void;
  onOpenHelp: () => void;
  // Metas de cada área (áreas → metas → tareas) y las tareas, para su progreso
  goals: Goal[];
  tasks: TaskItem[];
  onNewGoal: () => void;
  onEditGoal: (goal: Goal) => void;
  onSetGoalStatus: (goal: Goal, status: GoalStatus) => void;
}

// Margen del viewBox alrededor del círculo para que quepan las etiquetas de las áreas
const LABEL_MARGIN_X = 100;
const LABEL_MARGIN_Y = 16;

const CATEGORIES = WHEEL_CATEGORIES;

export const WheelOfLife: React.FC<WheelOfLifeProps> = ({
  logs,
  showFirstStep,
  onAppendSnapshot,
  onOpenHelp,
  goals,
  tasks,
  onNewGoal,
  onEditGoal,
  onSetGoalStatus
}) => {
  const goalsByArea = activeGoalsByArea(goals);
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
    return (
      CATEGORIES.map((cat, i) => {
        const { x, y } = getCoordinates(i, scores[cat] ?? 0);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ') + ' Z'
    );
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
          className="flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:flex-row sm:items-center"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Flag className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-bold text-indigo-950">Primer paso: evalúa tu Rueda de la Vida</h3>
            <p className="text-xs leading-relaxed text-indigo-900">
              Puntúa de 0 a 10 tu satisfacción actual en cada área y pulsa <strong>Guardar la evaluación</strong>. Será
              tu punto de partida: las tareas que crees se vincularán a estas áreas y podrás comparar tu progreso en
              cada nueva evaluación.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold whitespace-nowrap text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Ver la ayuda</span>
          </button>
        </div>
      )}

      {/* Encabezado y explicación metodológica */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Compass className="h-6 w-6 text-indigo-600" />
            Rueda de la Vida
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Puntúa del 0 al 10 cuánto te satisface cada área de tu vida. Cada evaluación queda guardada para que veas
            cómo cambias.
          </p>
        </div>

        {/* Conmutador de Comparativa Histórica (HU-01 Escenario 2) */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showHistoryOverlay}
              onChange={(e) => setShowHistoryOverlay(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <History className="h-4 w-4 text-indigo-600" />
            <span>Comparar con una evaluación anterior</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA: GRÁFICO POLAR INTERACTIVO SVG */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
          {/* viewBox con margen para las etiquetas: el gráfico escala al ancho disponible sin desbordar en móvil */}
          <div className="relative flex w-full max-w-[600px] items-center justify-center">
            <svg
              viewBox={`${-LABEL_MARGIN_X} ${-LABEL_MARGIN_Y} ${size + 2 * LABEL_MARGIN_X} ${size + 2 * LABEL_MARGIN_Y}`}
              className="h-auto w-full"
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
                return <line key={cat} x1={center} y1={center} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />;
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
                      className="hover:r-8 cursor-pointer transition-all"
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
                    className="fill-slate-700 text-[11px] font-bold"
                  >
                    {cat} ({currentScores[cat]}/10)
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Leyenda del gráfico */}
          <div className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-indigo-600" />
              <span className="font-semibold text-slate-800">Ahora</span>
            </div>
            {showHistoryOverlay && historicalLog && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full border border-dashed border-amber-700 bg-amber-500" />
                <span className="text-slate-600">{historicalLog.label || 'Antes'}</span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: AJUSTE DIRECTO DE RADIOS & SNAPSHOT APPEND-ONLY */}
        <div className="space-y-5 lg:col-span-5">
          {/* Panel de Sliders / Manipulación Directa (0 al 10) */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Puntuación por área</h3>
              <span className="text-[11px] text-slate-500">Del 0 al 10</span>
            </div>

            <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
              {CATEGORIES.map((cat) => {
                const currentVal = currentScores[cat];
                const histVal = historicalLog ? historicalLog.scores[cat] : currentVal;
                const delta = currentVal - histVal;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {cat}
                        {goalsByArea[cat] ? (
                          <span className="ml-1.5 font-normal text-indigo-700">
                            · {goalsByArea[cat]} {goalsByArea[cat] === 1 ? 'meta activa' : 'metas activas'}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-900">{currentVal}/10</span>
                        {showHistoryOverlay && historicalLog && delta !== 0 && (
                          <span className={`text-[10px] font-bold ${delta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
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
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600"
                    />
                  </div>
                );
              })}
            </div>

            {/* FORMULARIO DE CONSOLIDACIÓN APPEND-ONLY (HU-01 Escenario 1) */}
            <div className="space-y-2.5 border-t border-slate-100 pt-3">
              <label
                htmlFor="wheel-snapshot-note"
                className="block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                Guardar esta evaluación
              </label>
              <div className="flex gap-2">
                <input
                  id="wheel-snapshot-note"
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="Nombre opcional (p. ej. «Fin de trimestre»)"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleConsolidateState}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold whitespace-nowrap text-white shadow-xs transition-colors hover:bg-slate-800"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Guardar la evaluación</span>
                </button>
              </div>

              {savedSuccess && (
                <div className="animate-in fade-in flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Evaluación guardada.</span>
                </div>
              )}
            </div>
          </div>

          {/* HISTORIAL LONGITUDINAL DE CAPTURAS */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              <span>Tus evaluaciones ({logs.length})</span>
            </h3>

            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {logs.map((log, idx) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedHistoricalIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all ${
                    selectedHistoricalIndex === idx
                      ? 'border-indigo-600 bg-indigo-50/50 font-bold text-indigo-950'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="block truncate">{log.label || `Evaluación ${idx + 1}`}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600">
                    Promedio: {(Object.values(log.scores).reduce((a, b) => a + b, 0) / CATEGORIES.length).toFixed(1)}/10
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* METAS: áreas → metas → tareas */}
      <GoalsPanel
        goals={goals}
        tasks={tasks}
        onNewGoal={onNewGoal}
        onEditGoal={onEditGoal}
        onSetStatus={onSetGoalStatus}
      />
    </div>
  );
};
