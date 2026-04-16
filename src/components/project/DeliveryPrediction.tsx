// ═══ DELIVERY PREDICTION — Velocity chart + delivery forecast ═══
import { useState, useMemo } from 'preact/hooks';
import type { Task } from '../../types/index';
import { predictDelivery, extractVelocities, type PredictionResult, type SprintVelocity } from '../../domain/prediction';
import { Icon } from '../common/Icon';

interface DeliveryPredictionProps {
  actions: Task[];
}

const fd = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const TREND_CONFIG = {
  improving: { icon: 'TrendingUp', color: '#34C759', label: 'Mejorando' },
  stable: { icon: 'Minus', color: '#007AFF', label: 'Estable' },
  declining: { icon: 'TrendingDown', color: '#FF3B30', label: 'Declinando' },
};

export function DeliveryPrediction({ actions }: DeliveryPredictionProps) {
  const [sprintDays, setSprintDays] = useState(14);

  const velocities = useMemo(() => extractVelocities(actions as Array<Record<string, unknown>>), [actions]);

  const remaining = useMemo(() => {
    return (actions || [])
      .filter(a => a.status !== 'done' && a.status !== 'discarded' && a.status !== 'cancelled')
      .reduce((sum, a) => sum + ((a as Record<string, unknown>).hours as number || 1), 0);
  }, [actions]);

  const prediction = useMemo(() => predictDelivery(velocities, remaining, sprintDays), [velocities, remaining, sprintDays]);

  // Velocity chart dimensions
  const chartW = 600, chartH = 160, padL = 40, padR = 10, padT = 10, padB = 24;
  const plotW = chartW - padL - padR, plotH = chartH - padT - padB;

  const maxVel = velocities.length > 0 ? Math.max(...velocities.map(v => Math.max(v.planned, v.completed)), 1) : 10;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Predicción de entrega</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>Basada en velocidad histórica del equipo</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#86868B' }}>Sprint:</span>
          {[7, 14, 21].map(d => (
            <button key={d} onClick={() => setSprintDays(d)}
              style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: sprintDays === d ? 'none' : '1px solid #E5E5EA', background: sprintDays === d ? '#1D1D1F' : '#FFF', color: sprintDays === d ? '#FFF' : '#86868B' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {velocities.length < 2 ? (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 32, textAlign: 'center' }}>
          <Icon name="BarChart3" size={36} color="#C7C7CC" />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73', marginTop: 8 }}>Datos insuficientes</p>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 4 }}>Necesitas al menos 2 sprints con tareas asignadas y horas para generar predicciones.</p>
        </div>
      ) : prediction && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Velocidad media', value: prediction.avgVelocity, unit: 'h/sprint', color: '#007AFF' },
              { label: 'Horas restantes', value: prediction.remaining, unit: 'h', color: '#5856D6' },
              { label: 'Sprints estimados', value: prediction.sprintsNeeded, unit: '', color: '#FF9500' },
              { label: 'Probabilidad', value: `${prediction.probability}%`, unit: '', color: prediction.probability >= 70 ? '#34C759' : prediction.probability >= 40 ? '#FF9500' : '#FF3B30' },
            ].map(k => (
              <div key={k.label} class="card-hover" style={{ background: '#FFF', borderRadius: 12, border: '1.5px solid #E5E5EA', padding: '12px 14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 9, color: '#86868B' }}>{k.label}{k.unit ? ` (${k.unit})` : ''}</div>
              </div>
            ))}
          </div>

          {/* Forecast + Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {/* Delivery dates */}
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 16px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Fechas estimadas</h4>
              {([
                { label: 'Optimista', date: prediction.estimatedDate.optimistic, sprints: prediction.confidence.optimistic, color: '#34C759' },
                { label: 'Esperada', date: prediction.estimatedDate.expected, sprints: prediction.confidence.expected, color: '#007AFF' },
                { label: 'Pesimista', date: prediction.estimatedDate.pessimistic, sprints: prediction.confidence.pessimistic, color: '#FF3B30' },
              ]).map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F9F9FB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: r.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{fd(r.date)}</div>
                    <div style={{ fontSize: 9, color: '#86868B' }}>{r.sprints} sprint{r.sprints !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Trend + stats */}
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 16px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Tendencia</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: TREND_CONFIG[prediction.trend].color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={TREND_CONFIG[prediction.trend].icon} size={20} color={TREND_CONFIG[prediction.trend].color} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TREND_CONFIG[prediction.trend].color }}>{TREND_CONFIG[prediction.trend].label}</div>
                  <div style={{ fontSize: 11, color: '#86868B' }}>Desviación: ±{prediction.stdDev} pts</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#6E6E73', lineHeight: 1.5 }}>
                {prediction.trend === 'improving' && 'El equipo está acelerando. La velocidad reciente supera el historial.'}
                {prediction.trend === 'stable' && 'La velocidad es consistente. Las estimaciones son fiables.'}
                {prediction.trend === 'declining' && 'La velocidad está bajando. Revisar bloqueos o sobrecarga del equipo.'}
              </div>
            </div>
          </div>

          {/* Velocity chart */}
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 16px' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Velocidad por sprint</h4>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', maxHeight: 200 }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const y = padT + plotH * (1 - pct);
                return (
                  <g key={pct}>
                    <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#F2F2F7" strokeWidth="1" />
                    <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#C7C7CC">{Math.round(maxVel * pct)}</text>
                  </g>
                );
              })}

              {/* Average line */}
              {(() => {
                const avgY = padT + plotH * (1 - prediction.avgVelocity / maxVel);
                return <line x1={padL} y1={avgY} x2={chartW - padR} y2={avgY} stroke="#007AFF" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />;
              })()}

              {/* Bars */}
              {velocities.map((v, i) => {
                const barW = Math.min(40, (plotW / velocities.length) * 0.7);
                const gap = plotW / velocities.length;
                const x = padL + gap * i + (gap - barW * 2 - 3) / 2;

                const plannedH = (v.planned / maxVel) * plotH;
                const completedH = (v.completed / maxVel) * plotH;

                return (
                  <g key={v.sprint}>
                    {/* Planned */}
                    <rect x={x} y={padT + plotH - plannedH} width={barW} height={plannedH} rx="3" fill="#E5E5EA" />
                    {/* Completed */}
                    <rect x={x + barW + 3} y={padT + plotH - completedH} width={barW} height={completedH} rx="3" fill="#007AFF" />
                    {/* Label */}
                    <text x={x + barW} y={chartH - 4} textAnchor="middle" fontSize="8" fill="#86868B">{v.sprint.replace('Sprint ', 'S')}</text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#86868B' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#E5E5EA' }} /> Planificado
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#86868B' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#007AFF' }} /> Completado
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#86868B' }}>
                <div style={{ width: 10, height: 2, background: '#007AFF', opacity: 0.5 }} /> Media
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
