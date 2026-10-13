import React from 'react';
import { ArrowRight, Brain, CalendarCheck, Flame, Gauge, Lightbulb, ListChecks, Timer } from 'lucide-react';
import { AppTab, ListContext, MeetingGuard, TaskItem, WheelOfLifeLog } from '../types';
import { computeStats, recommendationsFor } from '../services/stats';
import { toLocalDate } from '../services/tasks';

interface HomeViewProps {
  tasks: TaskItem[];
  activeContext: ListContext;
  accountName: string;
  top10Count: number;
  wheelLogs: WheelOfLifeLog[];
  wheelAverage: string;
  meetings: MeetingGuard[];
  now: Date;
  onOpenAccount: () => void;
  onNavigate: (tab: AppTab) => void;
}

const dayLetter = new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' });
const dayLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  icon,
  children,
  className = ''
}) => (
  <section aria-label={title} className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 ${className}`}>
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="min-w-0 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
    <p className="text-[11px] font-semibold text-slate-600 break-words">{label}</p>
    <p className="text-2xl font-extrabold text-slate-900 font-mono">{value}</p>
    {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
  </div>
);

// Pantalla de Inicio: el foco de la lista activa, estadísticas de las tareas y recomendaciones
export const HomeView: React.FC<HomeViewProps> = ({
  tasks,
  activeContext,
  accountName,
  top10Count,
  wheelLogs,
  wheelAverage,
  meetings,
  now,
  onOpenAccount,
  onNavigate
}) => {
  const contextTasks = tasks.filter((t) => t.listContext === activeContext);
  // `now` (reloj por minutos) hace que la pantalla se actualice sola; para calcular se usa la hora exacta, o una
  // tarea recién hecha quedaría fuera hasta el minuto siguiente (las estadísticas solo cuentan lo hecho hasta ahora)
  const at = new Date(Math.max(now.getTime(), Date.now()));
  const stats = computeStats(contextTasks, at);
  const recommendations = recommendationsFor(stats, contextTasks, wheelLogs, at);
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.count));
  const datedDone = stats.onTime + stats.late;
  const maxArea = Math.max(1, ...stats.byArea.map((a) => a.count));
  const dailyTotal = stats.daily.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-5">
      {/* FOCO DE LA LISTA ACTIVA */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-700">
              <Brain className="w-4 h-4" aria-hidden="true" />
              <span>Andamiaje Digital para la Corteza Prefrontal</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-slate-600">
                Contexto Activo:{' '}
                <strong className={activeContext === 'WORK' ? 'text-indigo-600' : 'text-emerald-700'}>
                  {activeContext === 'WORK' ? 'Esfera Profesional' : 'Esfera Personal'}
                </strong>
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenAccount}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-semibold transition-colors"
                title="Tu cuenta"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500" aria-hidden="true" />
                <span>Cuenta: {accountName}</span>
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {activeContext === 'WORK' ? 'Foco de Concentración Profesional' : 'Equilibrio de Esfera Personal & Vital'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Gestión neurocientífica sin listas pasivas ni "Tareas Muro" coercitivas. La Jerarquía Visual Gestalt destaca tu{' '}
              <strong>Top 10 operativo</strong>, mientras el analizador sintáctico y el motor TF-IDF alinean cada acción con tu Rueda de la Vida.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0 min-w-0">
            {[
              { label: 'Top 10 Foco', value: `${top10Count}/10`, hint: 'Máx. prioridad', hintClass: 'text-indigo-600' },
              { label: 'Índice Rueda', value: `${wheelAverage}/10`, hint: `${wheelLogs.length} capturas`, hintClass: 'text-emerald-700' },
              { label: 'Reuniones', value: String(meetings.length), hint: 'Mañanas libres', hintClass: 'text-amber-700' }
            ].map(({ label, value, hint, hintClass }) => (
              <div key={label} className="min-w-0 p-2 sm:p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                <div className="text-[10px] font-bold uppercase sm:tracking-wider text-slate-500 mb-0.5 break-words">{label}</div>
                <div className="text-base sm:text-2xl font-extrabold text-slate-900 font-mono">{value}</div>
                <div className={`text-[10px] font-semibold mt-0.5 ${hintClass}`}>{hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ESTADÍSTICAS DE LA LISTA ACTIVA */}
      <h2 className="text-lg font-bold text-slate-900 px-1">
        Tu rendimiento · {activeContext === 'WORK' ? 'Profesional' : 'Personal'}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Tareas hechas" icon={<CalendarCheck className="w-4 h-4 text-indigo-600" aria-hidden="true" />}>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Hoy" value={String(stats.doneToday)} />
            <Metric label="Esta semana" value={String(stats.doneThisWeek)} />
            <Metric label="Este mes" value={String(stats.doneThisMonth)} />
          </div>
        </Card>

        <Card title="Últimos 14 días" icon={<ListChecks className="w-4 h-4 text-indigo-600" aria-hidden="true" />} className="lg:col-span-2">
          <div
            role="img"
            aria-label={`Tareas hechas por día en los últimos 14 días: ${dailyTotal} en total. El detalle por día está en la tabla siguiente.`}
            className="flex items-end gap-1.5 h-28"
          >
            {stats.daily.map(({ date, count }) => (
              <div key={date} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1 h-full" aria-hidden="true">
                <span className="text-[10px] font-mono text-slate-600">{count || ''}</span>
                <div
                  className={`w-full rounded-t-md ${count ? 'bg-indigo-500' : 'bg-slate-200'}`}
                  style={{ height: `${Math.max(4, (count / maxDaily) * 80)}px` }}
                />
                <span className="text-[10px] text-slate-600 uppercase">{dayLetter.format(toLocalDate(date))}</span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Tareas hechas por día</caption>
            <tbody>
              {stats.daily.map(({ date, count }) => (
                <tr key={date}>
                  <th scope="row">{dayLong.format(toLocalDate(date))}</th>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="A tiempo o con retraso" icon={<Timer className="w-4 h-4 text-indigo-600" aria-hidden="true" />}>
          {datedDone === 0 ? (
            <p className="text-xs text-slate-600">En el último mes no has terminado tareas con fecha límite.</p>
          ) : (
            <>
              <p className="text-3xl font-extrabold text-slate-900 font-mono">
                {Math.round((stats.onTimeRate ?? 0) * 100)} %<span className="sr-only"> a tiempo</span>
              </p>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-200" aria-hidden="true">
                <div className="bg-emerald-600" style={{ width: `${(stats.onTime / datedDone) * 100}%` }} />
                <div className="bg-red-600" style={{ width: `${(stats.late / datedDone) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-600">
                {stats.onTime} antes del plazo · {stats.late} después del plazo (último mes)
              </p>
            </>
          )}
        </Card>

        <Card title="Velocidad" icon={<Gauge className="w-4 h-4 text-indigo-600" aria-hidden="true" />}>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Tareas por semana" value={decimal.format(stats.weeklyVelocity)} />
            <Metric label="Horas estimadas por semana" value={decimal.format(stats.weeklyEstimatedHours)} />
          </div>
          <p className="text-xs text-slate-600">
            {stats.avgCycleDays === null
              ? 'Media de las últimas cuatro semanas.'
              : `De media tardas ${decimal.format(stats.avgCycleDays)} días desde que creas una tarea hasta que la terminas.`}
          </p>
        </Card>

        <Card title="Constancia y pendientes" icon={<Flame className="w-4 h-4 text-indigo-600" aria-hidden="true" />}>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Racha" value={String(stats.streak)} hint={stats.streak === 1 ? 'día seguido' : 'días seguidos'} />
            <Metric label="Pendientes" value={String(stats.open)} hint={`${stats.overdue} vencidas · ${stats.dueThisWeek} esta semana`} />
          </div>
        </Card>

        <Card title="Por área (último mes)" icon={<ListChecks className="w-4 h-4 text-indigo-600" aria-hidden="true" />}>
          {stats.byArea.length === 0 ? (
            <p className="text-xs text-slate-600">Vincula tus tareas a un área de la Rueda para ver en qué inviertes el esfuerzo.</p>
          ) : (
            <ul className="space-y-2">
              {stats.byArea.map(({ area, count }) => (
                <li key={area} className="text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>{area}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 mt-1" aria-hidden="true">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(count / maxArea) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recomendaciones" icon={<Lightbulb className="w-4 h-4 text-indigo-600" aria-hidden="true" />} className="md:col-span-2 lg:col-span-3">
          {recommendations.length === 0 ? (
            <p className="text-xs text-slate-600">Vas al día. Sigue con tu Top 10.</p>
          ) : (
            <ul className="space-y-2">
              {recommendations.map((rec) => (
                <li key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <p className="text-sm text-slate-800">{rec.text}</p>
                  {rec.action && (
                    <button
                      type="button"
                      onClick={() => onNavigate(rec.action!.tab)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      {rec.action.label}
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
