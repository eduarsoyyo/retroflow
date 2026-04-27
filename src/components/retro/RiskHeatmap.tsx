import { useMemo } from 'react'
import { Shield } from 'lucide-react'

interface Risk {
  id: string
  text?: string
  title?: string
  prob?: string
  impact?: string
  status?: string
  type?: string
  owner?: string
}

interface RiskHeatmapProps {
  risks: Risk[]
  onRiskClick?: (risk: Risk) => void
}

const PROB_LEVELS = ['alta', 'media', 'baja'] as const
const IMPACT_LEVELS = ['bajo', 'medio', 'alto'] as const
const PROB_LABELS: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
const IMPACT_LABELS: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }

// Cell color based on criticality (prob × impact)
const CELL_COLORS: Record<string, string> = {
  'alta-alto': 'bg-red-500/20 dark:bg-red-500/30',
  'alta-medio': 'bg-orange-400/20 dark:bg-orange-400/30',
  'alta-bajo': 'bg-yellow-400/15 dark:bg-yellow-400/20',
  'media-alto': 'bg-orange-400/20 dark:bg-orange-400/30',
  'media-medio': 'bg-yellow-400/15 dark:bg-yellow-400/20',
  'media-bajo': 'bg-green-400/10 dark:bg-green-400/15',
  'baja-alto': 'bg-yellow-400/15 dark:bg-yellow-400/20',
  'baja-medio': 'bg-green-400/10 dark:bg-green-400/15',
  'baja-bajo': 'bg-green-400/5 dark:bg-green-400/10',
}

const CELL_BORDER: Record<string, string> = {
  'alta-alto': 'border-red-300/40 dark:border-red-500/40',
  'alta-medio': 'border-orange-300/30 dark:border-orange-400/30',
  'alta-bajo': 'border-yellow-300/30 dark:border-yellow-400/30',
  'media-alto': 'border-orange-300/30 dark:border-orange-400/30',
  'media-medio': 'border-yellow-300/30 dark:border-yellow-400/30',
  'media-bajo': 'border-green-300/20 dark:border-green-400/20',
  'baja-alto': 'border-yellow-300/30 dark:border-yellow-400/30',
  'baja-medio': 'border-green-300/20 dark:border-green-400/20',
  'baja-bajo': 'border-green-300/10 dark:border-green-400/10',
}

const TYPE_COLOR: Record<string, string> = {
  riesgo: '#FF9500',
  problema: '#FF3B30',
  oportunidad: '#34C759',
}

function normalizeProb(p?: string): string {
  if (!p) return 'media'
  const l = p.toLowerCase()
  if (l === 'alto' || l === 'alta') return 'alta'
  if (l === 'bajo' || l === 'baja') return 'baja'
  return 'media'
}

function normalizeImpact(i?: string): string {
  if (!i) return 'medio'
  const l = i.toLowerCase()
  if (l === 'alto' || l === 'alta') return 'alto'
  if (l === 'bajo' || l === 'baja') return 'bajo'
  return 'medio'
}

export function RiskHeatmap({ risks, onRiskClick }: RiskHeatmapProps) {
  const openRisks = useMemo(() => risks.filter(r => r.status !== 'mitigated'), [risks])

  const grid = useMemo(() => {
    const g: Record<string, Risk[]> = {}
    PROB_LEVELS.forEach(p => IMPACT_LEVELS.forEach(i => { g[`${p}-${i}`] = [] }))
    openRisks.forEach(r => {
      const key = `${normalizeProb(r.prob)}-${normalizeImpact(r.impact)}`
      if (g[key]) g[key]!.push(r)
    })
    return g
  }, [openRisks])

  if (openRisks.length === 0) {
    return (
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-6 text-center">
        <Shield className="w-8 h-8 text-revelio-green mx-auto mb-2" />
        <p className="text-xs text-revelio-green font-medium dark:text-revelio-dark-text">Sin riesgos abiertos</p>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-revelio-orange" />
        <span className="text-sm font-semibold dark:text-revelio-dark-text">Heatmap de riesgos</span>
        <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle ml-auto">{openRisks.length} abiertos</span>
      </div>

      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center mr-2">
          <span className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">Probabilidad</span>
        </div>

        <div className="flex-1">
          {/* Grid */}
          <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-0">
            {/* Header row */}
            <div />
            {IMPACT_LEVELS.map(i => (
              <div key={i} className="text-center pb-1.5">
                <span className="text-[9px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase">{IMPACT_LABELS[i]}</span>
              </div>
            ))}

            {/* Data rows (alta first = top) */}
            {PROB_LEVELS.map(prob => (
              <>
                <div key={`label-${prob}`} className="flex items-center pr-2">
                  <span className="text-[9px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase">{PROB_LABELS[prob]}</span>
                </div>
                {IMPACT_LEVELS.map(impact => {
                  const key = `${prob}-${impact}`
                  const items = grid[key] || []
                  return (
                    <div key={key}
                      className={`min-h-[70px] border rounded-lg p-1.5 m-0.5 transition-colors ${CELL_COLORS[key] || ''} ${CELL_BORDER[key] || 'border-transparent'}`}>
                      <div className="flex flex-wrap gap-1">
                        {items.map(r => (
                          <button key={r.id} onClick={() => onRiskClick?.(r)}
                            title={r.title || r.text || ''}
                            className="group relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm hover:scale-125 transition-transform cursor-pointer"
                            style={{ background: TYPE_COLOR[r.type || 'riesgo'] || '#FF9500' }}>
                            {(r.title || r.text || '?')[0]?.toUpperCase()}
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg bg-[#1D1D1F] text-white text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 max-w-[150px] truncate">
                              {r.title || r.text}
                            </div>
                          </button>
                        ))}
                      </div>
                      {items.length === 0 && (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[9px] text-revelio-border dark:text-revelio-dark-border">—</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            ))}
          </div>

          {/* X-axis label */}
          <div className="text-center mt-2">
            <span className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-widest">Impacto</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 pt-3 border-t border-revelio-border dark:border-revelio-dark-border">
        {[
          { type: 'riesgo', label: 'Riesgo' },
          { type: 'problema', label: 'Problema' },
          { type: 'oportunidad', label: 'Oportunidad' },
        ].map(t => (
          <div key={t.type} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: TYPE_COLOR[t.type] }} />
            <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
