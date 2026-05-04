// ClienteFinanceSummary — Aggregated finance for a cliente.
//
// Sections, top to bottom:
//   1. Header with year selector + mode toggle (Real / Teórico).
//   2. KPI cards: Ingresos, Coste real, Margen €, Margen %.
//   3. Monthly chart: Ingresos vs Coste, 12 month bars.
//   4. Per-project table with health indicator column.
//
// Costs use mode='actual' by default (real time entries) — this matches
// what FinancePanel shows on the per-project view, so numbers reconcile.
//
// The component is loose-coupled from ClienteDetailPage: it only needs
// clienteId. It fetches independently and shows its own loading state.
import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Euro, AlertCircle, X,
  AlertTriangle, AlertOctagon, Pause, CalendarClock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  loadClientePnL,
  type ClientePnL, type ClientePnLProject, type CostMode,
  type MonthlyByProject,
} from '@/services/finance'
import { formatEuro, formatPercent } from '@/lib/format'

interface ClienteFinanceSummaryProps {
  clienteId: string
}

const CURRENT_YEAR = new Date().getFullYear()
// Show last 4 years (current + 3 back). Most projects don't go further;
// expand the range when historical needs grow.
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const today = new Date().toISOString().slice(0, 10)

export function ClienteFinanceSummary({ clienteId }: ClienteFinanceSummaryProps) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [mode, setMode] = useState<CostMode>('actual')
  const [data, setData] = useState<ClientePnL | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Selected month for drill-down. null = no panel shown. Reset to null
  // whenever year/mode changes so the user doesn't see stale data.
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setSelectedMonth(null)
    loadClientePnL(clienteId, year, mode)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError((e as Error).message || 'Error cargando datos financieros') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [clienteId, year, mode])

  return (
    <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-6">
      {/* Header with year + mode selectors */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-sm font-semibold dark:text-revelio-dark-text flex items-center gap-2">
          <Euro className="w-4 h-4 text-revelio-blue" /> Resumen financiero
        </h2>
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-[11px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
          >
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Mode toggle */}
          <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
            <button
              onClick={() => setMode('actual')}
              className={`px-2.5 py-1 text-[10px] font-semibold ${mode === 'actual' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}
              title="Coste real basado en horas fichadas"
            >
              Real
            </button>
            <button
              onClick={() => setMode('theoretical')}
              className={`px-2.5 py-1 text-[10px] font-semibold ${mode === 'theoretical' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}
              title="Coste teórico basado en calendario × dedicación"
            >
              Teórico
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle text-center py-6">
          Calculando...
        </p>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-xs text-revelio-red bg-revelio-red/5 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && data && data.projectCount === 0 && (
        <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle italic py-2">
          No hay proyectos activos del cliente en {year} para calcular el agregado financiero.
        </p>
      )}

      {!loading && !error && data && data.projectCount > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <KpiCard label="Ingresos" value={formatEuro(data.totalRevenue)} accent="blue" />
            <KpiCard label="Coste real" value={formatEuro(data.totalCost)} accent="orange" />
            <KpiCard
              label="Margen"
              value={formatEuro(data.margin)}
              accent={data.margin >= 0 ? 'green' : 'red'}
              icon={data.margin >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            />
            <KpiCard
              label="Margen %"
              value={formatPercent(data.marginPct)}
              accent={data.marginPct >= 0 ? 'green' : 'red'}
            />
          </div>

          {/* Monthly chart */}
          <MonthlyChart
            months={data.months}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />

          {/* Drill-down panel for the selected month */}
          {selectedMonth !== null && (
            <MonthDrillPanel
              month={selectedMonth}
              monthly={data.months[selectedMonth]}
              contributions={data.monthlyByProject[selectedMonth]?.contributions ?? []}
              onClose={() => setSelectedMonth(null)}
            />
          )}

          {/* Per-project breakdown */}
          {data.projects.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-2">
                Por proyecto ({data.projects.length})
              </p>
              <div className="rounded-lg border border-revelio-border dark:border-revelio-dark-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-revelio-bg/40 dark:bg-revelio-dark-border/40">
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Proyecto</th>
                      <th className="px-3 py-1.5 text-center text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Salud</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Ingresos</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Coste</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Margen</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map(p => {
                      const negativeMargin = p.margin < 0
                      return (
                        <tr key={p.slug} className="border-t border-revelio-border/40 dark:border-revelio-dark-border/40">
                          <td className="px-3 py-1.5 dark:text-revelio-dark-text">
                            <Link to={`/project/${p.slug}`} className="hover:text-revelio-blue font-medium">{p.name}</Link>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <HealthCell project={p} />
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-[11px] dark:text-revelio-dark-text">{formatEuro(p.totalRevenue)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle">{formatEuro(p.totalCost)}</td>
                          <td className={`px-3 py-1.5 text-right font-mono text-[11px] font-semibold ${negativeMargin ? 'text-revelio-red' : 'text-revelio-green'}`}>{formatEuro(p.margin)}</td>
                          <td className={`px-3 py-1.5 text-right font-mono text-[11px] ${negativeMargin ? 'text-revelio-red' : 'text-revelio-green'}`}>{formatPercent(p.marginPct)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Monthly chart — Ingresos vs Coste, two bars per month
// ───────────────────────────────────────────────────────────────────────────

interface MonthlyChartProps {
  months: ClientePnL['months']
  /** 0..11 of the month currently selected for drill-down, or null. */
  selectedMonth: number | null
  /**
   * Toggle handler: clicking the same month closes the drill-down,
   * clicking a different one switches to it.
   */
  onSelectMonth: (month: number | null) => void
}

function MonthlyChart({ months, selectedMonth, onSelectMonth }: MonthlyChartProps) {
  // Transform for Recharts: one row per month, two series, plus the
  // 0-indexed month so the click handler can identify which bar.
  const chartData = months.map(m => ({
    month: m.month,
    name: MONTH_LABELS[m.month] ?? '?',
    ingresos: Math.round(m.revenue),
    coste: Math.round(m.cost),
  }))

  const allZero = chartData.every(d => d.ingresos === 0 && d.coste === 0)
  if (allZero) {
    return (
      <p className="text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle italic text-center py-3">
        No hay datos mensuales suficientes para el gráfico.
      </p>
    )
  }

  // Click handler shared by both bar series. Toggles selection: same
  // month again closes the drill-down. Recharts types the onClick payload
  // as BarRectangleItem (without our custom `month` field), so we narrow
  // inside instead of typing the parameter directly.
  const handleBarClick = (entry: unknown) => {
    const m = (entry as { month?: number }).month
    if (typeof m !== 'number') return
    onSelectMonth(selectedMonth === m ? null : m)
  }

  return (
    <div className="mt-1 mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-2">
        Mensual: ingresos vs coste <span className="text-revelio-subtle/60 normal-case font-normal italic">— click en una barra para ver detalle</span>
      </p>
      <div className="w-full" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#86868B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#86868B' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => formatEuroShort(v)} />
            <Tooltip
              formatter={(value) => formatEuro(typeof value === 'number' ? value : Number(value) || 0)}
              labelStyle={{ fontSize: 11, color: '#1D1D1F' }}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E5EA' }}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" iconSize={8} />
            <Bar
              dataKey="ingresos"
              name="Ingresos"
              radius={[3, 3, 0, 0]}
              onClick={handleBarClick}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map(d => (
                <Cell key={`ing-${d.month}`} fill={selectedMonth === d.month ? '#0051A8' : '#007AFF'} />
              ))}
            </Bar>
            <Bar
              dataKey="coste"
              name="Coste"
              radius={[3, 3, 0, 0]}
              onClick={handleBarClick}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map(d => (
                <Cell key={`cost-${d.month}`} fill={selectedMonth === d.month ? '#C46900' : '#FF9500'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Month drill-down panel — projects contributing to the selected month
// ───────────────────────────────────────────────────────────────────────────

interface MonthDrillPanelProps {
  month: number
  monthly: ClientePnL['months'][number] | undefined
  contributions: MonthlyByProject['contributions']
  onClose: () => void
}

const FULL_MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function MonthDrillPanel({ month, monthly, contributions, onClose }: MonthDrillPanelProps) {
  const label = FULL_MONTH_LABELS[month] ?? `Mes ${month + 1}`
  return (
    <div className="mt-3 rounded-lg border border-revelio-blue/20 bg-revelio-blue/5 p-4">
      {/* Header with title + close button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-revelio-blue dark:text-revelio-dark-text">
          Detalle de {label}
        </h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-revelio-blue/10 text-revelio-subtle"
          title="Cerrar"
          aria-label="Cerrar detalle"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Month totals (KPI strip) */}
      {monthly && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <DrillKpi label="Ingresos" value={formatEuro(monthly.revenue)} />
          <DrillKpi label="Coste" value={formatEuro(monthly.cost)} />
          <DrillKpi
            label="Margen"
            value={formatEuro(monthly.margin)}
            tone={monthly.margin >= 0 ? 'green' : 'red'}
          />
        </div>
      )}

      {/* Per-project contributions */}
      {contributions.length === 0 ? (
        <p className="text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle italic text-center py-2">
          No hay contribuciones registradas en este mes.
        </p>
      ) : (
        <div className="rounded-lg bg-white dark:bg-revelio-dark-card border border-revelio-border/40 dark:border-revelio-dark-border/40 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-revelio-bg/40 dark:bg-revelio-dark-border/40">
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Proyecto</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Ingresos</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Coste</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Margen</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map(c => {
                const negative = c.margin < 0
                return (
                  <tr key={c.slug} className="border-t border-revelio-border/30 dark:border-revelio-dark-border/30">
                    <td className="px-3 py-1.5 dark:text-revelio-dark-text">
                      <Link to={`/project/${c.slug}`} className="hover:text-revelio-blue font-medium">{c.name}</Link>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] dark:text-revelio-dark-text">{formatEuro(c.revenue)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle">{formatEuro(c.cost)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono text-[11px] font-semibold ${negative ? 'text-revelio-red' : 'text-revelio-green'}`}>{formatEuro(c.margin)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface DrillKpiProps {
  label: string
  value: string
  tone?: 'green' | 'red'
}

function DrillKpi({ label, value, tone }: DrillKpiProps) {
  const color = tone === 'green' ? 'text-revelio-green' : tone === 'red' ? 'text-revelio-red' : 'dark:text-revelio-dark-text'
  return (
    <div className="rounded-lg bg-white dark:bg-revelio-dark-card border border-revelio-border/40 dark:border-revelio-dark-border/40 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-0.5">{label}</p>
      <p className={`text-xs font-bold ${color}`}>{value}</p>
    </div>
  )
}

/**
 * Compact euro formatter for chart axis ticks. Avoids long labels like
 * "1.234.567 €" which would overlap on small screens.
 */
function formatEuroShort(v: number): string {
  if (!Number.isFinite(v)) return '0€'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M€`
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1000)}k€`
  return `${v}€`
}

// ───────────────────────────────────────────────────────────────────────────
// Health cell — single icon per project, most severe wins
// ───────────────────────────────────────────────────────────────────────────

interface HealthCellProps {
  project: ClientePnLProject
}

/**
 * Health indicators in priority order (most severe first):
 *   1. Margen negativo  → red AlertOctagon
 *   2. Pausado          → orange Pause
 *   3. Fuera de plazo   → orange CalendarClock
 *   4. Margen bajo      → yellow AlertTriangle (under 10%)
 *   5. Saludable        → no icon
 *
 * Only the highest-priority issue is shown, so the column doesn't get
 * crowded with multiple icons per row.
 */
function HealthCell({ project }: HealthCellProps) {
  // 1. Negative margin
  if (project.margin < 0) {
    return (
      <span title="En pérdidas: margen negativo" className="inline-flex">
        <AlertOctagon className="w-3.5 h-3.5 text-revelio-red" />
      </span>
    )
  }
  // 2. Paused
  if (project.status === 'paused') {
    return (
      <span title="Proyecto pausado" className="inline-flex">
        <Pause className="w-3.5 h-3.5 text-revelio-orange" />
      </span>
    )
  }
  // 3. Out-of-schedule (today past the planned end date)
  if (project.plannedEnd && project.plannedEnd < today && project.status !== 'closed') {
    return (
      <span title={`Fuera de plazo (planificado hasta ${project.plannedEnd})`} className="inline-flex">
        <CalendarClock className="w-3.5 h-3.5 text-revelio-orange" />
      </span>
    )
  }
  // 4. Low margin (0..10%)
  if (project.totalRevenue > 0 && project.marginPct < 10) {
    return (
      <span title={`Margen bajo: ${project.marginPct.toFixed(1)}%`} className="inline-flex">
        <AlertTriangle className="w-3.5 h-3.5 text-revelio-orange" />
      </span>
    )
  }
  // 5. Healthy — no icon (visual silence is a feature)
  return <span className="text-revelio-subtle/40">—</span>
}

// ───────────────────────────────────────────────────────────────────────────
// KPI card
// ───────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  accent: 'blue' | 'orange' | 'green' | 'red'
  icon?: React.ReactNode
}

const ACCENT_BG: Record<KpiCardProps['accent'], string> = {
  blue: 'bg-revelio-blue/10',
  orange: 'bg-revelio-orange/10',
  green: 'bg-revelio-green/10',
  red: 'bg-revelio-red/10',
}

const ACCENT_TEXT: Record<KpiCardProps['accent'], string> = {
  blue: 'text-revelio-blue',
  orange: 'text-revelio-orange',
  green: 'text-revelio-green',
  red: 'text-revelio-red',
}

function KpiCard({ label, value, accent, icon }: KpiCardProps) {
  return (
    <div className={`rounded-lg p-3 ${ACCENT_BG[accent]}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-1">
        {label}
      </p>
      <p className={`text-base font-bold flex items-center gap-1 ${ACCENT_TEXT[accent]}`}>
        {icon}{value}
      </p>
    </div>
  )
}
