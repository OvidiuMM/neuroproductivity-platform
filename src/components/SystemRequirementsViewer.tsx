import React, { useState } from 'react';
import { analyzeImmediateActionSyntax } from '../services/syntaxAnalyzer';
import { inferWheelCategory } from '../services/nlpEngine';
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  Database,
  Code2,
  FileCheck,
  ShieldCheck,
  Brain,
  Sliders,
  Sparkles,
  Lock,
  Clock
} from 'lucide-react';

export const SystemRequirementsViewer: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'tester' | 'specs' | 'schema' | 'bdd'>('tester');

  // Estados del Banco de Pruebas Interactivo
  const [testTaskTitle, setTestTaskTitle] = useState('Marketing');
  const [testTaskDesc, setTestTaskDesc] = useState('Revisar la hoja de cálculo de balance contable y previsión de gastos de la corporación');
  const [testMeetingTime, setTestMeetingTime] = useState('09:30');
  const [testEmailBody, setTestEmailBody] = useState(
    'Estimado equipo, quería comentarles ampliamente todos los detalles acumulados del proyecto a lo largo de las últimas cuatro semanas, analizando minuciosamente cada posible desviación presupuestaria, cada cambio de alcance imprevisto y cada pequeña reunión que tuvimos con los interesados externos durante los últimos meses sin una agenda fija...'
  );
  const [hasAttachments, setHasAttachments] = useState(false);

  // Resultados en vivo del probador
  const syntaxTestResult = analyzeImmediateActionSyntax(testTaskTitle);
  const nlpTestResult = inferWheelCategory(testTaskTitle, testTaskDesc);
  const isMeetingBlocked = parseInt(testMeetingTime.split(':')[0], 10) < 12;
  const isEmailRecipientUnlocked = (hasAttachments || false) && testEmailBody.trim().length > 15;
  const isEmailBodyTooLong = testEmailBody.split(/\s+/).length > 35;

  return (
    <div className="space-y-6">
      
      {/* Cabecera */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-indigo-600" />
            Especificación Técnica y Banco de Pruebas de Validación
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Verificación algorítmica de los 5 subsistemas de neuroproductividad definidos en la metodología de Jonathan Benito Sipos.
          </p>
        </div>

        {/* Sub-pestañas */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setActiveSubTab('tester')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'tester'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-indigo-600" />
            <span>Probador en Vivo</span>
          </button>
          <button
            onClick={() => setActiveSubTab('specs')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'specs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Requisitos RF/RNF</span>
          </button>
          <button
            onClick={() => setActiveSubTab('schema')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'schema'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Esquema PostgreSQL</span>
          </button>
          <button
            onClick={() => setActiveSubTab('bdd')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'bdd'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Escenarios BDD (Gherkin)</span>
          </button>
        </div>
      </div>

      {/* SUB-PESTAÑA 1: PROBADOR EN VIVO DE VALIDACIONES DE ENTRADA */}
      {activeSubTab === 'tester' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* TEST 1: ANALIZADOR SINTÁCTICO DE ACCIÓN INMEDIATA (Módulo 4) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                <span>Test 1: Analizador Sintáctico (Verbos Físicos)</span>
              </h3>
              <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Módulo 4
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Prueba entradas abstractas vs verbos transitivos para observar cómo el interceptor mitiga la postergación por ambigüedad.
            </p>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Texto de Entrada de la Tarea:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testTaskTitle}
                  onChange={(e) => setTestTaskTitle(e.target.value)}
                  className="min-w-0 flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                />
              </div>

              {/* Botones de prueba rápida */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setTestTaskTitle('Marketing')}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700"
                >
                  Probar "Marketing"
                </button>
                <button
                  type="button"
                  onClick={() => setTestTaskTitle('Coche')}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700"
                >
                  Probar "Coche"
                </button>
                <button
                  type="button"
                  onClick={() => setTestTaskTitle('Llamar al taller para pedir presupuesto')}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700"
                >
                  Probar acción física válida
                </button>
              </div>
            </div>

            {/* Resultado del analizador en vivo */}
            <div
              className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                syntaxTestResult.isValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  {syntaxTestResult.isValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span>Estado: {syntaxTestResult.isValid ? 'Acción Válida' : 'Interceptado por Ambigüedad'}</span>
                </span>
                {syntaxTestResult.detectedVerb && (
                  <span className="text-[10px] font-mono bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                    Verbo: {syntaxTestResult.detectedVerb}
                  </span>
                )}
              </div>

              {!syntaxTestResult.isValid && (
                <div className="space-y-1 pt-1 border-t border-amber-200/60">
                  <p className="text-[11px] font-semibold">{syntaxTestResult.warning}</p>
                  <p className="text-[11px] text-amber-800">{syntaxTestResult.assistantQuestion}</p>
                  {syntaxTestResult.suggestion && (
                    <p className="text-[11px] font-mono bg-white/80 p-1.5 rounded text-amber-950">
                      Sugerencia: "{syntaxTestResult.suggestion}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* TEST 2: MOTOR NLP TF-IDF Y SIMILITUD DE COSENOS (Módulo 3) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Test 2: Motor NLP TF-IDF (Módulo 3)</span>
              </h3>
              <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Módulo 3
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Evaluación semántica de vectores contra el corpus de las 7 áreas de la Rueda de la Vida.
            </p>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Texto a Vectorizar (Nombre + Descripción):
              </label>
              <textarea
                rows={2}
                value={testTaskDesc}
                onChange={(e) => setTestTaskDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
              />

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTestTaskDesc('Revisar la hoja de cálculo de balance contable y previsión de gastos')}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700"
                >
                  "Balance y gastos contables"
                </button>
                <button
                  type="button"
                  onClick={() => setTestTaskDesc('Planificar dieta con nutricionista y rutina de pesas en gimnasio')}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700"
                >
                  "Dieta y pesas en gimnasio"
                </button>
                <button
                  type="button"
                  onClick={() => setTestTaskDesc('Sesión de 30 minutos de meditación mindfulness y respiración')}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700"
                >
                  "Meditación mindfulness"
                </button>
              </div>
            </div>

            {/* Resultado TF-IDF */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>
                    Categoría Predicha:{' '}
                    <strong>{nlpTestResult.category || 'Sin confianza suficiente'}</strong>
                  </span>
                </span>
                <span className="text-[11px] font-mono bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded font-bold">
                  Confianza: {Math.round(nlpTestResult.confidenceScore * 100)}%
                </span>
              </div>

              {nlpTestResult.tokensFound.length > 0 && (
                <p className="text-[11px] text-indigo-800">
                  Tokens críticos coincidentes:{' '}
                  <span className="font-mono font-bold">
                    {nlpTestResult.tokensFound.join(', ')}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* TEST 3: BLOQUEO HEURÍSTICO DE REUNIONES MATUTINAS (Módulo 5) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Test 3: Bloqueo Matutino de Reuniones (MEETING_GUARD)</span>
              </h3>
              <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Módulo 5
              </span>
            </div>

            <p className="text-xs text-slate-600">
              La regla de negocio prohíbe reuniones antes de las 12:00 h para proteger la concentración profunda.
            </p>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Hora de Inicio Solicitada:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={testMeetingTime}
                  onChange={(e) => setTestMeetingTime(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setTestMeetingTime('09:30')}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 rounded font-mono"
                >
                  Probar 09:30 h
                </button>
                <button
                  type="button"
                  onClick={() => setTestMeetingTime('13:00')}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 rounded font-mono"
                >
                  Probar 13:00 h
                </button>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                isMeetingBlocked
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  {isMeetingBlocked ? (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    {isMeetingBlocked
                      ? 'BLOQUEO HEURÍSTICO ACTIVO'
                      : 'HORA VALLE AUTORIZADA'}
                  </span>
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {isMeetingBlocked
                  ? 'La franja matutina impacta el momento biológico de máxima demanda cognitiva. El sistema sugiere reubicar a las 13:00 h.'
                  : 'Hora de reunión compatible con la protección de la mañana profunda.'}
              </p>
            </div>
          </div>

          {/* TEST 4: REDACCIÓN INVERSA Y ALERTA NO-SCROLL (Módulo 5) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Test 4: Redacción Inversa de Correo</span>
              </h3>
              <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Módulo 5
              </span>
            </div>

            <p className="text-xs text-slate-600">
              El campo destinatario está cerrado con candado hasta que los adjuntos y cuerpo estén listos. Alerta activa ante mensajes que superen el tamaño sin scroll.
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={hasAttachments}
                  onChange={(e) => setHasAttachments(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Paso 1: Archivos adjuntos o confirmación explícita</span>
              </label>

              <label className="block text-[11px] font-bold uppercase text-slate-500 pt-1">
                Paso 2: Cuerpo ({testEmailBody.split(/\s+/).length} palabras):
              </label>
              <textarea
                rows={2}
                value={testEmailBody}
                onChange={(e) => setTestEmailBody(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-medium"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  {isEmailRecipientUnlocked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    Campo Destinatario:{' '}
                    {isEmailRecipientUnlocked ? 'DESBLOQUEADO' : 'BLOQUEADO'}
                  </span>
                </span>
              </div>

              {isEmailBodyTooLong && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                  ⚠️ Alerta No-Scroll activa: El mensaje es extenso y fragmentará la atención ajena.
                </p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* SUB-PESTAÑA 2: MATRIZ DE REQUISITOS DEL SISTEMA (RF & RNF) */}
      {activeSubTab === 'specs' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              1. Matriz de Requisitos Funcionales por Módulo
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Módulo</th>
                    <th className="py-2.5 px-3">Requisito Funcional</th>
                    <th className="py-2.5 px-3">Regla de Validación / Restricción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-01</td>
                    <td className="py-2 px-3 font-medium">M1: Rueda de la Vida</td>
                    <td className="py-2 px-3">Gráfico polar SVG interactivo con 7 categorías vitales.</td>
                    <td className="py-2 px-3">Escala 0 a 10 con arrastre y redibujado en tiempo real.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-02</td>
                    <td className="py-2 px-3 font-medium">M1: Rueda de la Vida</td>
                    <td className="py-2 px-3">Trazabilidad inmutable append-only (Snapshots).</td>
                    <td className="py-2 px-3">Prohibido sobrescribir con UPDATE. Cada guardado es un nuevo nodo UTC.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-03</td>
                    <td className="py-2 px-3 font-medium">M2: Gestor Dual</td>
                    <td className="py-2 px-3">Segregación inquebrantable de Trabajo vs Personal.</td>
                    <td className="py-2 px-3">Prohibido cruce simultáneo en pantalla; selector global excluyente.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-04</td>
                    <td className="py-2 px-3 font-medium">M2: Jerarquía Gestalt</td>
                    <td className="py-2 px-3">Top 10 Operativo con elevación visual vs periférico.</td>
                    <td className="py-2 px-3">Índices 0-9 con font-weight 700 y z-shadow; índice 11+ desaturado.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-05</td>
                    <td className="py-2 px-3 font-medium">M2: Sumidero Cognitivo</td>
                    <td className="py-2 px-3">Campo booleano "Quizá" / "Algún día".</td>
                    <td className="py-2 px-3">Exclusión automática de la vista diaria sin borrado físico de la BD.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-06</td>
                    <td className="py-2 px-3 font-medium">M3: Motor NLP TF-IDF</td>
                    <td className="py-2 px-3">Inferencia y etiquetado automático en onBlur.</td>
                    <td className="py-2 px-3">Similitud del coseno ≥ 0.65; propuesta interactiva de un clic.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-07</td>
                    <td className="py-2 px-3 font-medium">M4: Analizador Sintáctico</td>
                    <td className="py-2 px-3">Filtro contra proyectos amorfos sin verbo motor.</td>
                    <td className="py-2 px-3">Intercepta "Marketing" o "Coche" instando al primer paso indivisible.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-08</td>
                    <td className="py-2 px-3 font-medium">M5: Bermudas (Agenda)</td>
                    <td className="py-2 px-3">Triple validación y bloqueo matutino de reuniones.</td>
                    <td className="py-2 px-3">Bloqueo antes de 12:00 h; fin &gt; inicio; agenda cerrada; moderador.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-700">RF-09</td>
                    <td className="py-2 px-3 font-medium">M5: Bermudas (Correo)</td>
                    <td className="py-2 px-3">Redacción inversa con alerta no-scroll.</td>
                    <td className="py-2 px-3">Destinatarios bloqueados hasta completar adjuntos y cuerpo sintético.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              2. Matriz de Requisitos No Funcionales (RNF)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">Latencia de Reordenación (P95)</span>
                <span className="text-indigo-700 font-mono font-bold text-sm block">&lt; 150 ms</span>
                <p className="text-slate-500 text-[11px]">
                  Virtualización en React y consultas en cliente sobre IndexedDB con índices B-Tree.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">Inferencia NLP TF-IDF</span>
                <span className="text-indigo-700 font-mono font-bold text-sm block">&lt; 350 ms</span>
                <p className="text-slate-500 text-[11px]">
                  Modelos dispersos pre-calculados en memoria RAM.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">Accesibilidad & Contraste</span>
                <span className="text-indigo-700 font-mono font-bold text-sm block">WCAG 2.1 AA (4.5:1)</span>
                <p className="text-slate-500 text-[11px]">
                  Ratio de contraste mínimo en texto del Top 10 y 3:1 en encabezados.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 3: ESQUEMA POSTGRESQL */}
      {activeSubTab === 'schema' && (
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 font-mono text-xs overflow-x-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400">
            <span className="text-emerald-400 font-bold">PostgreSQL Schema Definition (DDL)</span>
            <span>Relational & Inmutable Model</span>
          </div>

          <pre className="text-slate-300 leading-relaxed">
{`-- 1. ALMACÉN HISTÓRICO APPEND-ONLY DE LA RUEDA DE LA VIDA (MÓDULO 1)
CREATE TABLE wheel_of_life_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  health_score SMALLINT NOT NULL CHECK (health_score BETWEEN 1 AND 10),
  career_score SMALLINT NOT NULL CHECK (career_score BETWEEN 1 AND 10),
  finance_score SMALLINT NOT NULL CHECK (finance_score BETWEEN 1 AND 10),
  family_score SMALLINT NOT NULL CHECK (family_score BETWEEN 1 AND 10),
  spirit_score SMALLINT NOT NULL CHECK (spirit_score BETWEEN 1 AND 10),
  leisure_score SMALLINT NOT NULL CHECK (leisure_score BETWEEN 1 AND 10),
  relationship_score SMALLINT NOT NULL CHECK (relationship_score BETWEEN 1 AND 10)
);
CREATE INDEX idx_wheel_user_time ON wheel_of_life_log(user_id, timestamp DESC);

-- 2. TAREAS MULTIDIMENSIONALES (MÓDULO 2)
CREATE TYPE list_context_enum AS ENUM ('WORK', 'PERSONAL');
CREATE TYPE priority_enum AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

CREATE TABLE task_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  list_context list_context_enum NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority priority_enum NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  observations JSONB DEFAULT '[]'::jsonb,
  is_someday BOOLEAN NOT NULL DEFAULT FALSE
);

-- ÍNDICE PARCIAL ESPECIALIZADO: Omite sumidero cognitivo en consultas del Top 10
CREATE INDEX active_tasks_idx ON task_item(user_id, priority)
  WHERE is_someday = FALSE;

-- 3. BLINDAJE DE REUNIONES - TRIÁNGULO DE LAS BERMUDAS (MÓDULO 5)
CREATE TABLE meeting_guard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(100) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  agenda_points JSONB NOT NULL,
  moderator_id UUID,
  CONSTRAINT chk_time_order CHECK (end_time > start_time),
  CONSTRAINT chk_deep_morning_block CHECK (EXTRACT(HOUR FROM start_time) >= 12)
);`}
          </pre>
        </div>
      )}

      {/* SUB-PESTAÑA 4: ESCENARIOS BDD GHERKIN */}
      {activeSubTab === 'bdd' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 text-xs font-mono">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 font-sans text-sm">
              Escenarios de Aceptación Behavior-Driven Development (BDD Gherkin)
            </h3>
            <span className="text-slate-400">Especificación Oficial Benito Sipos</span>
          </div>

          <div className="space-y-4 text-slate-800">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-indigo-600 font-bold block">
                Feature: HU-01 Registro Histórico y Estampado Temporal Inmutable
              </span>
              <p className="text-slate-600 pl-4">
                <strong>Scenario:</strong> Generación de nueva captura temporal (Snapshot append-only)<br />
                <strong>Given</strong> que el usuario visualiza su Rueda de la Vida interactiva SVG<br />
                <strong>When</strong> arrastra el valor de "Salud" de 5 a 7 y presiona "Consolidar Estado"<br />
                <strong>Then</strong> el motor PostgreSQL NO sobrescribe con UPDATE, sino que crea un nuevo registro inmutable con timestamp UTC.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-indigo-600 font-bold block">
                Feature: HU-02 Destacado Inteligente del Top 10 en Repositorios Extensos
              </span>
              <p className="text-slate-600 pl-4">
                <strong>Scenario:</strong> Enfoque visual mediado por psicología Gestalt<br />
                <strong>Given</strong> que la lista contiene 45 tareas operativas activas<br />
                <strong>When</strong> React procesa la estructura de la vista en el DOM<br />
                <strong>Then</strong> los ítems en los índices 0 al 9 se muestran con font-weight 700 y elevación z-index (elevation-2)<br />
                <strong>And</strong> los ítems del índice 10 al 44 se agrupan en diseño minimalista sin profundidad ni sombras.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-indigo-600 font-bold block">
                Feature: HU-03 Delegación Cognitiva mediante la Condición "Quizá"
              </span>
              <p className="text-slate-600 pl-4">
                <strong>Scenario:</strong> Filtrado y exclusión automática desde la capa de persistencia<br />
                <strong>Given</strong> que el usuario introduce "Estudiar viabilidad de posgrado" con is_someday = true<br />
                <strong>When</strong> la lista operativa es refrescada<br />
                <strong>Then</strong> la tarea es excluida del Top 10 diario mediante el índice parcial y reside en "Opciones Futuras".
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
