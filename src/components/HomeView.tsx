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
  <section
    aria-label={title}
    className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs ${className}`}
  >
    <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-700 uppercase">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
    <p className="text-[11px] font-semibold break-words text-slate-600">{label}</p>
    <p className="font-mono text-2xl font-extrabold text-slate-900">{value}</p>
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
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="pointer-events-none absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-indigo-50/60 blur-3xl" />
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-700">
              <Brain className="h-4 w-4" aria-hidden="true" />
              <span>Andamiaje Digital para la Corteza Prefrontal</span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-600">
                Contexto Activo:{' '}
                <strong className={activeContext === 'WORK' ? 'text-indigo-600' : 'text-emerald-700'}>
                  {activeContext === 'WORK' ? 'Esfera Profesional' : 'Esfera Personal'}
                </strong>
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={onOpenAccount}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                title="Tu cuenta"
              >
                <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
                <span>Cuenta: {accountName}</span>
              </button>
            </div>
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {activeContext === 'WORK' ? 'Foco de Concentración Profesional' : 'Equilibrio de Esfera Personal & Vital'}
            </h1>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              Gestión neurocientífica sin listas pasivas ni "Tareas Muro" coercitivas. La Jerarquía Visual Gestalt
              destaca tu <strong>Top 10 operativo</strong>, mientras el analizador sintáctico y el motor TF-IDF alinean
              cada acción con tu Rueda de la Vida.
            </p>
          </div>

          <div className="grid min-w-0 shrink-0 grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Top 10 Foco', value: `${top10Count}/10`, hint: 'Máx. prioridad', hintClass: 'text-indigo-600' },
              {
                label: 'Índice Rueda',
                value: `${wheelAverage}/10`,
                hint: `${wheelLogs.length} capturas`,
                hintClass: 'text-emerald-700'
              },
              {
                label: 'Reuniones',
                value: String(meetings.length),
                hint: 'Mañanas libres',
                hintClass: 'text-amber-700'
              }
            ].map(({ label, value, hint, hintClass }) => (
              <div
                key={label}
                className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50 p-2 text-center sm:p-3.5"
              >
                <div className="mb-0.5 text-[10px] font-bold break-words text-slate-500 uppercase sm:tracking-wider">
                  {label}
                </div>
                <div className="font-mono text-base font-extrabold text-slate-900 sm:text-2xl">{value}</div>
                <div className={`mt-0.5 text-[10px] font-semibold ${hintClass}`}>{hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ESTADÍSTICAS DE LA LISTA ACTIVA */}
      <h2 className="px-1 text-lg font-bold text-slate-900">
        Tu rendimiento · {activeContext === 'WORK' ? 'Profesional' : 'Personal'}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Tareas hechas" icon={<CalendarCheck className="h-4 w-4 text-indigo-600" aria-hidden="true" />}>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Hoy" value={String(stats.doneToday)} />
            <Metric label="Esta semana" value={String(stats.doneThisWeek)} />
            <Metric label="Este mes" value={String(stats.doneThisMonth)} />
          </div>
        </Card>

        <Card
          title="Últimos 14 días"
          icon={<ListChecks className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
          className="lg:col-span-2"
        >
          <div
            role="img"
            aria-label={`Tareas hechas por día en los últimos 14 días: ${dailyTotal} en total. El detalle por día está en la tabla siguiente.`}
            className="flex h-28 items-end gap-1.5"
          >
            {stats.daily.map(({ date, count }) => (
              <div
                key={date}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                aria-hidden="true"
              >
                <span className="font-mono text-[10px] text-slate-600">{count || ''}</span>
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

        <Card title="A tiempo o con retraso" icon={<Timer className="h-4 w-4 text-indigo-600" aria-hidden="true" />}>
          {datedDone === 0 ? (
            <p className="text-xs text-slate-600">En el último mes no has terminado tareas con fecha límite.</p>
          ) : (
            <>
              <p className="font-mono text-3xl font-extrabold text-slate-900">
                {Math.round((stats.onTimeRate ?? 0) * 100)} %<span className="sr-only"> a tiempo</span>
              </p>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                <div className="bg-emerald-600" style={{ width: `${(stats.onTime / datedDone) * 100}%` }} />
                <div className="bg-red-600" style={{ width: `${(stats.late / datedDone) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-600">
                {stats.onTime} antes del plazo · {stats.late} después del plazo (último mes)
              </p>
            </>
          )}
        </Card>

        <Card title="Velocidad" icon={<Gauge className="h-4 w-4 text-indigo-600" aria-hidden="true" />}>
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

        <Card title="Constancia y pendientes" icon={<Flame className="h-4 w-4 text-indigo-600" aria-hidden="true" />}>
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Racha"
              value={String(stats.streak)}
              hint={stats.streak === 1 ? 'día seguido' : 'días seguidos'}
            />
            <Metric
              label="Pendientes"
              value={String(stats.open)}
              hint={`${stats.overdue} vencidas · ${stats.dueThisWeek} esta semana`}
            />
          </div>
        </Card>

        <Card
          title="Por área (último mes)"
          icon={<ListChecks className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
        >
          {stats.byArea.length === 0 ? (
            <p className="text-xs text-slate-600">
              Vincula tus tareas a un área de la Rueda para ver en qué inviertes el esfuerzo.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.byArea.map(({ area, count }) => (
                <li key={area} className="text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>{area}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-200" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(count / maxArea) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recomendaciones"
          icon={<Lightbulb className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
          className="md:col-span-2 lg:col-span-3"
        >
          {recommendations.length === 0 ? (
            <p className="text-xs text-slate-600">Vas al día. Sigue con tu Top 10.</p>
          ) : (
            <ul className="space-y-2">
              {recommendations.map((rec) => (
                <li
                  key={rec.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:flex-row sm:items-center"
                >
                  <p className="text-sm text-slate-800">{rec.text}</p>
                  {rec.action && (
                    <button
                      type="button"
                      onClick={() => onNavigate(rec.action!.tab)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      {rec.action.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
