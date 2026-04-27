/** Tiny inline sparkline SVG for KPI trends */

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showDot?: boolean
}

export function Sparkline({ data, width = 60, height = 20, color = '#007AFF', showDot = true }: SparklineProps) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x},${y}`
  }).join(' ')

  const last = data[data.length - 1]!
  const prev = data[data.length - 2]!
  const trend = last > prev ? 'up' : last < prev ? 'down' : 'flat'
  const lastX = width
  const lastY = height - ((last - min) / range) * (height - 2) - 1

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {showDot && <circle cx={lastX} cy={lastY} r={2} fill={trend === 'up' ? '#34C759' : trend === 'down' ? '#FF3B30' : color} />}
    </svg>
  )
}

/** Trend badge showing % change */
export function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return null
  const up = pct > 0
  return (
    <span className={`text-[8px] font-bold ${up ? 'text-revelio-green' : 'text-revelio-red'}`}>
      {up ? '↑' : '↓'}{Math.abs(pct)}%
    </span>
  )
}
