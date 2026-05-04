// ClienteFinanceSummary — Aggregated finance for a cliente.
//
// Sections, top to bottom:
//   1. Header with year selector (no Real/Teórico toggle anymore).
//   2. Two KPI rows side by side:
//        a. By contract: revenue, contract cost, contract margin.
//        b. By planning: planning cost, margin vs revenue, % margin.
//   3. Monthly chart with 3 series:
//        - Ingresos (revenue, blue)
//        - Coste contrato (gray)
//        - Coste planning (orange)
//      The gap between gray and orange is what tells the SM whether the
//      project is staying within budget or overrunning.
//   4. Per-project table with both views side by side and the health
//      indicator column.
//   5. Drill-down panel below the chart for a clicked month, showing
//      per-project contributions for both contract and planning.
//
// Why no toggle: a SM needs to see at-a-glance whether the planning is
// inside the offered contract or not. Toggling between two modes hides
// that comparison. Single view + 3 series + 6 KPIs gives full picture.
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
  loadClientePnLDual,
  type ClientePnL, type ClientePnLProject, type ClientePnLDual,
  type MonthlyByProject,
} from '@/services/finance'
import { formatEuro, formatPercent } from '@/lib/format'

interface ClienteFinanceSummaryProps {
  clienteId: string
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const today = new Date().toISOString().slice(0, 10)

export function ClienteFinanceSummary({ clienteId }: ClienteFinanceSummaryProps) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [data, setData] = useState<ClientePnLDual | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Selected month for drill-down. null = no panel shown. Reset on year
  // change so the user doesn't see stale data.
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setSelectedMonth(null)
    loadClientePnLDual(clienteId, year)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError((e as Error).message || 'Error cargando datos financieros') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [clienteId, year])

  return (
    <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-6">
      {/* Header with year selector */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-sm font-semibold dark:text-revelio-dark-text flex items-center gap-2">
          <Euro className="w-4 h-4 text-revelio-blue" /> Resumen financiero
        </h2>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="px-2 py-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-[11px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
        >
          {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
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

      {!loading && !error && data && data.contract.projectCount === 0 && (
        <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle italic py-2">
          No hay proyectos activos del cliente en {year} para calcular el agregado financiero.
        </p>
      )}

      {!loading && !error && data && data.contract.projectCount > 0 && (
        <>
          {/* KPI rows: contract on top, planning below */}
          <div className="space-y-2 mb-5">
            {/* Por contrato */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-1.5">
                Por contrato
              </p>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Ingresos" value={formatEuro(data.contract.totalRevenue)} accent="blue" />
                <KpiCard label="Coste oferta" value={formatEuro(data.contract.totalCost)} accent="gray" />
                <KpiCard
                  label="Margen oferta"
                  value={`${formatEuro(data.contract.margin)} · ${formatPercent(data.contract.marginPct)}`}
                  accent={data.contract.margin >= 0 ? 'green' : 'red'}
                  icon={data.contract.margin >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                />
              </div>
            </div>
            {/* Real */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-1.5">
                Real
              </p>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Coste real" value={formatEuro(data.planning.totalCost)} accent="orange" />
                <KpiCard
                  label="Margen real"
                  value={`${formatEuro(data.planning.margin)} · ${formatPercent(data.planning.marginPct)}`}
                  accent={data.planning.margin >= 0 ? 'green' : 'red'}
                  icon={data.planning.margin >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                />
                <KpiCard
                  label="Desviación vs oferta"
                  value={formatEuro(data.planning.totalCost - data.contract.totalCost)}
                  accent={data.planning.totalCost <= data.contract.totalCost ? 'green' : 'red'}
                  icon={data.planning.totalCost <= data.contract.totalCost ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                />
              </div>
            </div>
          </div>

          {/* Monthly chart */}
          <MonthlyChart
            contractMonths={data.contract.months}
            planningMonths={data.planning.months}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />

          {/* Drill-down panel for the selected month */}
          {selectedMonth !== null && (
            <MonthDrillPanel
              month={selectedMonth}
              contractMonth={data.contract.months[selectedMonth]}
              planningMonth={data.planning.months[selectedMonth]}
              contractContribs={data.contract.monthlyByProject[selectedMonth]?.contributions ?? []}
              planningContribs={data.planning.monthlyByProject[selectedMonth]?.contributions ?? []}
              onClose={() => setSelectedMonth(null)}
            />
          )}

          {/* Per-project breakdown */}
          {data.contract.projects.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-2">
                Por proyecto ({data.contract.projects.length})
              </p>
              <div className="rounded-lg border border-revelio-border dark:border-revelio-dark-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-revelio-bg/40 dark:bg-revelio-dark-border/40">
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Proyecto</th>
                      <th className="px-3 py-1.5 text-center text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Salud</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Ingresos</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Coste oferta</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Margen oferta</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Coste real</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Margen real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contract.projects.map(p => {
                      const planningProject = data.planning.projects.find(pp => pp.slug === p.slug)
                      const planningCost = planningProject?.totalCost ?? 0
                      const planningMargin = p.totalRevenue - planningCost
                      const planningMarginPct = p.totalRevenue > 0 ? (planningMargin / p.totalRevenue) * 100 : 0
                      const contractNeg = p.margin < 0
                      const planningNeg = planningMargin < 0
                      // For health indicator we use the planning view (most realistic)
                      const projectForHealth: ClientePnLProject = {
                        ...p,
                        totalCost: planningCost,
                        margin: planningMargin,
                        marginPct: planningMarginPct,
                      }
                      return (
                        <tr key={p.slug} className="border-t border-revelio-border/40 dark:border-revelio-dark-border/40">
                          <td className="px-3 py-1.5 dark:text-revelio-dark-text">
                            <Link to={`/project/${p.slug}`} className="hover:text-revelio-blue font-medium">{p.name}</Link>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <HealthCell project={projectForHealth} />
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-[11px] dark:text-revelio-dark-text">{formatEuro(p.totalRevenue)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle">{formatEuro(p.totalCost)}</td>
                          <td className={`px-3 py-1.5 text-right font-mono text-[11px] font-semibold ${contractNeg ? 'text-revelio-red' : 'text-revelio-green'}`}>{formatEuro(p.margin)} · {formatPercent(p.marginPct)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-[11px] text-revelio-orange">{formatEuro(planningCost)}</td>
                          <td className={`px-3 py-1.5 text-right font-mono text-[11px] font-semibold ${planningNeg ? 'text-revelio-red' : 'text-revelio-green'}`}>{formatEuro(planningMargin)} · {formatPercent(planningMarginPct)}</td>
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
// Monthly chart — 3 series: Ingresos, Coste contrato, Coste planning
// ───────────────────────────────────────────────────────────────────────────

interface MonthlyChartProps {
  contractMonths: ClientePnL['months']
  planningMonths: ClientePnL['months']
  /** 0..11 of the month currently selected for drill-down, or null. */
  selectedMonth: number | null
  /** Toggle handler: same month closes, different switches. */
  onSelectMonth: (month: number | null) => void
}

function MonthlyChart({ contractMonths, planningMonths, selectedMonth, onSelectMonth }: MonthlyChartProps) {
  // Merge contract and planning by month index. Contract revenue == planning
  // revenue (revenue is the same in both views), so we read it from contract.
  const chartData = contractMonths.map((m, i) => ({
    month: m.month,
    name: MONTH_LABELS[m.month] ?? '?',
    ingresos: Math.round(m.revenue),
    costeContrato: Math.round(m.cost),
    costePlanning: Math.round(planningMonths[i]?.cost ?? 0),
  }))

  const allZero = chartData.every(d => d.ingresos === 0 && d.costeContrato === 0 && d.costePlanning === 0)
  if (allZero) {
    return (
      <p className="text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle italic text-center py-3">
        No hay datos mensuales suficientes para el gráfico.
      </p>
    )
  }

  // Recharts types onClick payload as BarRectangleItem (without our custom
  // `month` field), so we narrow inside instead of typing the parameter.
  const handleBarClick = (entry: unknown) => {
    const m = (entry as { month?: number }).month
    if (typeof m !== 'number') return
    onSelectMonth(selectedMonth === m ? null : m)
  }

  return (
    <div className="mt-1 mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-2">
        Mensual: ingresos, coste contrato y coste real
        <span className="text-revelio-subtle/60 normal-case font-normal italic"> — click en una barra para ver detalle</span>
      </p>
      <div className="w-full" style={{ height: 220 }}>
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
            <Bar dataKey="ingresos" name="Ingresos" fill="#007AFF" radius={[3, 3, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              {chartData.map(d => (
                <Cell key={`ing-${d.month}`} fill={selectedMonth === d.month ? '#0051A8' : '#007AFF'} />
              ))}
            </Bar>
            <Bar dataKey="costeContrato" name="Coste contrato" fill="#86868B" radius={[3, 3, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              {chartData.map(d => (
                <Cell key={`con-${d.month}`} fill={selectedMonth === d.month ? '#525258' : '#86868B'} />
              ))}
            </Bar>
            <Bar dataKey="costePlanning" name="Coste real" fill="#FF9500" radius={[3, 3, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              {chartData.map(d => (
                <Cell key={`plan-${d.month}`} fill={selectedMonth === d.month ? '#C46900' : '#FF9500'} />
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
  contractMonth: ClientePnL['months'][number] | undefined
  planningMonth: ClientePnL['months'][number] | undefined
  contractContribs: MonthlyByProject['contributions']
  planningContribs: MonthlyByProject['contributions']
  onClose: () => void
}

const FULL_MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function MonthDrillPanel({
  month, contractMonth, planningMonth,
  contractContribs, planningContribs, onClose,
}: MonthDrillPanelProps) {
  const label = FULL_MONTH_LABELS[month] ?? `Mes ${month + 1}`

  // Build a unified list of projects: union of slugs in contract+planning.
  // Each row shows what the project contributed to revenue (contract),
  // contract cost, planning cost, both margins.
  const slugs = new Set<string>()
  for (const c of contractContribs) slugs.add(c.slug)
  for (const p of planningContribs) slugs.add(p.slug)
  const contractBySlug = new Map(contractContribs.map(c => [c.slug, c]))
  const planningBySlug = new Map(planningContribs.map(p => [p.slug, p]))
  const rows = Array.from(slugs).map(slug => {
    const c = contractBySlug.get(slug)
    const p = planningBySlug.get(slug)
    const name = c?.name ?? p?.name ?? slug
    const revenue = c?.revenue ?? p?.revenue ?? 0
    const contractCost = c?.cost ?? 0
    const planningCost = p?.cost ?? 0
    const contractMargin = revenue - contractCost
    const planningMargin = revenue - planningCost
    return { slug, name, revenue, contractCost, planningCost, contractMargin, planningMargin }
  }).sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="mt-3 rounded-lg border border-revelio-blue/20 bg-revelio-blue/5 p-4">
      {/* Header */}
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

      {/* Month totals */}
      {(contractMonth || planningMonth) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <DrillKpi label="Ingresos" value={formatEuro(contractMonth?.revenue ?? 0)} />
          <DrillKpi label="Coste oferta" value={formatEuro(contractMonth?.cost ?? 0)} />
          <DrillKpi label="Coste real" value={formatEuro(planningMonth?.cost ?? 0)} />
          <DrillKpi
            label="Margen real"
            value={formatEuro((contractMonth?.revenue ?? 0) - (planningMonth?.cost ?? 0))}
            tone={(contractMonth?.revenue ?? 0) - (planningMonth?.cost ?? 0) >= 0 ? 'green' : 'red'}
          />
        </div>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <p className="text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle italic text-center py-2">
          No hay contribuciones registradas en este mes.
        </p>
      ) : (
        <div className="rounded-lg bg-white dark:bg-revelio-dark-card border border-revelio-border/40 dark:border-revelio-dark-border/40 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-revelio-bg/40 dark:bg-revelio-dark-border/40">
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Proyecto</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Ingresos</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Coste oferta</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Coste real</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Margen oferta</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">Margen real</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const cNeg = r.contractMargin < 0
                const pNeg = r.planningMargin < 0
                return (
                  <tr key={r.slug} className="border-t border-revelio-border/30 dark:border-revelio-dark-border/30">
                    <td className="px-3 py-1.5 dark:text-revelio-dark-text">
                      <Link to={`/project/${r.slug}`} className="hover:text-revelio-blue font-medium">{r.name}</Link>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] dark:text-revelio-dark-text">{formatEuro(r.revenue)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle">{formatEuro(r.contractCost)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] text-revelio-orange">{formatEuro(r.planningCost)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono text-[11px] font-semibold ${cNeg ? 'text-revelio-red' : 'text-revelio-green'}`}>{formatEuro(r.contractMargin)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono text-[11px] font-semibold ${pNeg ? 'text-revelio-red' : 'text-revelio-green'}`}>{formatEuro(r.planningMargin)}</td>
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
 * Compact euro formatter for chart axis ticks.
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

function HealthCell({ project }: HealthCellProps) {
  if (project.margin < 0) {
    return (
      <span title="En pérdidas: margen negativo" className="inline-flex">
        <AlertOctagon className="w-3.5 h-3.5 text-revelio-red" />
      </span>
    )
  }
  if (project.status === 'paused') {
    return (
      <span title="Proyecto pausado" className="inline-flex">
        <Pause className="w-3.5 h-3.5 text-revelio-orange" />
      </span>
    )
  }
  if (project.plannedEnd && project.plannedEnd < today && project.status !== 'closed') {
    return (
      <span title={`Fuera de plazo (planificado hasta ${project.plannedEnd})`} className="inline-flex">
        <CalendarClock className="w-3.5 h-3.5 text-revelio-orange" />
      </span>
    )
  }
  if (project.totalRevenue > 0 && project.marginPct < 10) {
    return (
      <span title={`Margen bajo: ${project.marginPct.toFixed(1)}%`} className="inline-flex">
        <AlertTriangle className="w-3.5 h-3.5 text-revelio-orange" />
      </span>
    )
  }
  return <span className="text-revelio-subtle/40">—</span>
}

// ───────────────────────────────────────────────────────────────────────────
// KPI card
// ───────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  accent: 'blue' | 'orange' | 'green' | 'red' | 'gray'
  icon?: React.ReactNode
}

const ACCENT_BG: Record<KpiCardProps['accent'], string> = {
  blue: 'bg-revelio-blue/10',
  orange: 'bg-revelio-orange/10',
  green: 'bg-revelio-green/10',
  red: 'bg-revelio-red/10',
  gray: 'bg-revelio-subtle/10',
}

const ACCENT_TEXT: Record<KpiCardProps['accent'], string> = {
  blue: 'text-revelio-blue',
  orange: 'text-revelio-orange',
  green: 'text-revelio-green',
  red: 'text-revelio-red',
  gray: 'text-revelio-subtle',
}

function KpiCard({ label, value, accent, icon }: KpiCardProps) {
  return (
    <div className={`rounded-lg p-3 ${ACCENT_BG[accent]}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-1">
        {label}
      </p>
      <p className={`text-sm font-bold flex items-center gap-1 ${ACCENT_TEXT[accent]}`}>
        {icon}{value}
      </p>
    </div>
  )
}
