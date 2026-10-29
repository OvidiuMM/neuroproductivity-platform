import React, { useState } from 'react';
import { Goal, WheelOfLifeLog, WheelCategory } from '../types';
import { activeGoalsByArea } from '../services/goals';
import { logAverage } from '../services/wheel';
import { useAreas } from '../hooks/useAreas';
import { Compass, History, Save, Check, TrendingUp, Flag, BookOpen, Target, ArrowRight, Pencil } from 'lucide-react';
import { LOCALE_TAG, messages } from '../i18n/locale';

const m = messages(
  {
    firstStepTitle: 'Primer paso: evalúa tu Rueda de la Vida',
    firstStepBefore: 'Puntúa de 0 a 10 tu satisfacción actual en cada área y pulsa ',
    firstStepAfter:
      '. Será tu punto de partida: en «Metas» verás primero las áreas más bajas para ponerles metas, y podrás comparar tu progreso en cada nueva evaluación.',
    viewHelp: 'Ver la ayuda',
    wheel: 'Rueda de la Vida',
    intro:
      'Puntúa del 0 al 10 cuánto te satisface cada área de tu vida. Las más bajas son el punto de partida de tus metas, y cada evaluación queda guardada para que veas cómo cambias.',
    editAreas: 'Editar áreas',
    compare: 'Comparar con una evaluación anterior',
    chart: 'Gráfico de la Rueda de la Vida',
    now: 'Ahora',
    before: 'Antes',
    scoreByArea: 'Puntuación por área',
    range: 'Del 0 al 10',
    activeGoals: (n: number) => `· ${n} ${n === 1 ? 'meta activa' : 'metas activas'}`,
    scoreOf: (area: string) => `Puntuación de ${area}`,
    saveThis: 'Guardar esta evaluación',
    notePlaceholder: 'Nombre opcional (p. ej. «Fin de trimestre»)',
    save: 'Guardar la evaluación',
    saved: 'Evaluación guardada.',
    yourEvaluations: (n: number) => `Tus evaluaciones (${n})`,
    evaluation: (n: number) => `Evaluación ${n}`,
    average: (value: string) => `Promedio: ${value}/10`,
    goals: 'Metas',
    nextStep: 'El siguiente paso: ponles metas a las áreas que más quieres mejorar y añádeles tareas.',
    goToGoals: 'Ir a Metas'
  },
  {
    firstStepTitle: 'First step: assess your Wheel of Life',
    firstStepBefore: 'Rate from 0 to 10 how satisfied you are now with each area and press ',
    firstStepAfter:
      '. It will be your starting point: “Goals” shows the lowest areas first so you can set goals for them, and you can compare your progress with each new assessment.',
    viewHelp: 'View help',
    wheel: 'Wheel of Life',
    intro:
      'Rate from 0 to 10 how satisfied you are with each area of your life. The lowest ones are the starting point for your goals, and each assessment is saved so you can see how you change.',
    editAreas: 'Edit areas',
    compare: 'Compare with an earlier assessment',
    chart: 'Wheel of Life chart',
    now: 'Now',
    before: 'Before',
    scoreByArea: 'Score by area',
    range: 'From 0 to 10',
    activeGoals: (n) => `· ${n} ${n === 1 ? 'active goal' : 'active goals'}`,
    scoreOf: (area) => `Score for ${area}`,
    saveThis: 'Save this assessment',
    notePlaceholder: 'Optional name (e.g. “End of quarter”)',
    save: 'Save assessment',
    saved: 'Assessment saved.',
    yourEvaluations: (n) => `Your assessments (${n})`,
    evaluation: (n) => `Assessment ${n}`,
    average: (value) => `Average: ${value}/10`,
    goals: 'Goals',
    nextStep: 'Next step: set goals for the areas you most want to improve and add tasks to them.',
    goToGoals: 'Go to Goals'
  }
);

interface WheelOfLifeProps {
  logs: WheelOfLifeLog[];
  // Primer arranque: la cuenta no tiene ninguna evaluación guardada (confirmado con el servidor)
  showFirstStep: boolean;
  onAppendSnapshot: (scores: Record<WheelCategory, number>, label?: string) => void;
  onOpenHelp: () => void;
  // Metas activas de cada área (áreas → metas → tareas); se gestionan en «Metas»
  goals: Goal[];
  onOpenGoals: () => void;
  // Renombrar, ocultar o añadir áreas
  onEditAreas: () => void;
}

// Margen del viewBox alrededor del círculo para que quepan las etiquetas de las áreas
const LABEL_MARGIN_X = 100;
const LABEL_MARGIN_Y = 16;

// En el gráfico, los nombres largos se recortan (completos en la lista de puntuaciones)
const CHART_LABEL_MAX = 16;
const chartLabel = (label: string) =>
  label.length > CHART_LABEL_MAX ? `${label.slice(0, CHART_LABEL_MAX - 1)}…` : label;

export const WheelOfLife: React.FC<WheelOfLifeProps> = ({
  logs,
  showFirstStep,
  onAppendSnapshot,
  onOpenHelp,
  goals,
  onOpenGoals,
  onEditAreas
}) => {
  const goalsByArea = activeGoalsByArea(goals);
  // Las áreas a la vista de la cuenta, en su orden
  const { visible, label } = useAreas();
  const CATEGORIES = visible.map((area) => area.id);
  // Sin evaluaciones guardadas (primer arranque) todas las áreas empiezan en 0; un área añadida después de la última
  // evaluación, también
  const latestLog = logs[logs.length - 1];
  const [currentScores, setCurrentScores] = useState<Record<WheelCategory, number>>({ ...latestLog?.scores });
  const scoreOf = (cat: WheelCategory) => currentScores[cat] ?? 0;

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

  // Se guardan las áreas a la vista (las ocultas conservan sus evaluaciones anteriores)
  const handleConsolidateState = () => {
    onAppendSnapshot(Object.fromEntries(CATEGORIES.map((cat) => [cat, scoreOf(cat)])), snapshotLabel || undefined);
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
            <h3 className="text-sm font-bold text-indigo-950">{m.firstStepTitle}</h3>
            <p className="text-xs leading-relaxed text-indigo-900">
              {m.firstStepBefore}
              <strong>{m.save}</strong>
              {m.firstStepAfter}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold whitespace-nowrap text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>{m.viewHelp}</span>
          </button>
        </div>
      )}

      {/* Encabezado y explicación metodológica */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Compass className="h-6 w-6 text-indigo-600" />
            {m.wheel}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{m.intro}</p>
        </div>

        {/* Comparar con una evaluación anterior y editar las áreas */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onEditAreas}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            {m.editAreas}
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showHistoryOverlay}
              onChange={(e) => setShowHistoryOverlay(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <History className="h-4 w-4 text-indigo-600" />
            <span>{m.compare}</span>
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
              aria-label={m.chart}
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
                const { x, y } = getCoordinates(i, scoreOf(cat));
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
                    {chartLabel(label(cat))} ({scoreOf(cat)}/10)
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Leyenda del gráfico */}
          <div className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-indigo-600" />
              <span className="font-semibold text-slate-800">{m.now}</span>
            </div>
            {showHistoryOverlay && historicalLog && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full border border-dashed border-amber-700 bg-amber-500" />
                <span className="text-slate-600">{historicalLog.label || m.before}</span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: AJUSTE DIRECTO DE RADIOS & SNAPSHOT APPEND-ONLY */}
        <div className="space-y-5 lg:col-span-5">
          {/* Panel de Sliders / Manipulación Directa (0 al 10) */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">{m.scoreByArea}</h3>
              <span className="text-[11px] text-slate-500">{m.range}</span>
            </div>

            <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
              {CATEGORIES.map((cat) => {
                const currentVal = scoreOf(cat);
                // Una evaluación anterior a un área añadida no tiene su puntuación: sin diferencia
                const histVal = historicalLog?.scores[cat] ?? currentVal;
                const delta = currentVal - histVal;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {label(cat)}
                        {goalsByArea[cat] ? (
                          <span className="ml-1.5 font-normal text-indigo-700">{m.activeGoals(goalsByArea[cat])}</span>
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
                      aria-label={m.scoreOf(label(cat))}
                      onChange={(e) => handleScoreChange(cat, parseInt(e.target.value, 10))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600"
                    />
                  </div>
                );
              })}
            </div>

            {/* GUARDAR LA EVALUACIÓN: siempre una nueva, las anteriores no cambian */}
            <div className="space-y-2.5 border-t border-slate-100 pt-3">
              <label
                htmlFor="wheel-snapshot-note"
                className="block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                {m.saveThis}
              </label>
              <div className="flex gap-2">
                <input
                  id="wheel-snapshot-note"
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder={m.notePlaceholder}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleConsolidateState}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold whitespace-nowrap text-white shadow-xs transition-colors hover:bg-slate-800"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{m.save}</span>
                </button>
              </div>

              {savedSuccess && (
                <div className="animate-in fade-in flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>{m.saved}</span>
                </div>
              )}
            </div>
          </div>

          {/* HISTORIAL LONGITUDINAL DE CAPTURAS */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              <span>{m.yourEvaluations(logs.length)}</span>
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
                    <span className="block truncate">{log.label || m.evaluation(idx + 1)}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleDateString(LOCALE_TAG, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600">
                    {m.average(logAverage(log.scores).toFixed(1))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* METAS: el siguiente paso, en su propia sección (áreas → metas → tareas) */}
      <section
        aria-labelledby="wheel-goals-title"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div>
          <h3
            id="wheel-goals-title"
            className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-700 uppercase"
          >
            <Target className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            {m.goals}
          </h3>
          <p className="mt-1 text-xs text-slate-600">{m.nextStep}</p>
        </div>
        <button
          type="button"
          onClick={onOpenGoals}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
        >
          {m.goToGoals}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
};
