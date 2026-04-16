// ═══ ADMIN DASHBOARD — Centro de Control global view ═══
// Uses services/dashboard.ts for data loading + domain/health for calculations.

import { useState, useEffect } from 'preact/hooks';
import type { Room, Member } from '@app-types/index';
import { loadDashboardData, type DashboardData } from '@services/dashboard';
import { Loading, ErrorCard } from '@components/common/Feedback';
import { Tooltip } from '@components/common/Tooltip';
import { Icon } from '@components/common/Icon';

interface AdminDashboardProps {
  rooms: Room[];
  filterProject: string[];
}

export function AdminDashboard({ rooms, filterProject }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const slugs = filterProject.length > 0 ? filterProject : undefined;
    loadDashboardData(slugs).then(result => {
      setData(result);
      setError(null);
      setLoading(false);
    }).catch(e => {
      setError('Error cargando dashboard');
      setLoading(false);
    });
  }, [filterProject.join(',')]);

  if (loading) return <Loading message="Cargando dashboard..." />;
  if (error) return <ErrorCard message={error} />;
  if (!data) return null;

  const { health, projectMetrics } = data;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <Tooltip content={`Tareas al día: ${health.components.tareasAlDia}%\nRiesgos controlados: ${health.components.riesgosControlados}%\nEscalados resueltos: ${health.components.escaladosResueltos}%\nEncaje equipo: ${health.components.encajeEquipo}%\nCobertura: ${health.components.coberturaEquipo}%\n────────────\nSalud global: ${health.score}%`}>
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: health.color }}>{health.score}%</div>
            <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>Salud global</div>
          </div>
        </Tooltip>
        <Tooltip content={`${projectMetrics.length} proyectos`}>
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#007AFF' }}>{projectMetrics.length}</div>
            <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>Proyectos</div>
          </div>
        </Tooltip>
        <Tooltip content={`${data.members.length} personas registradas`}>
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1D1D1F' }}>{data.members.length}</div>
            <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>Personas</div>
          </div>
        </Tooltip>
        {(() => {
          const esc = projectMetrics.reduce((s, p) => s + p.risks.escalated, 0);
          return (
            <Tooltip content={`${esc} riesgos escalados`}>
              <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: esc > 0 ? '#FF3B30' : '#34C759' }}>{esc}</div>
                <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>Escalados</div>
              </div>
            </Tooltip>
          );
        })()}
      </div>

      {/* Projects table */}
      <div style={{ background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 8px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Proyectos</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Proyecto', 'Tareas', 'Completadas', 'Vencidas', 'Riesgos', 'Escalados', 'Personas'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Proyecto' ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', borderBottom: '2px solid #E5E5EA', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projectMetrics.map((p, i) => (
                <tr key={p.slug} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2F2F7', fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 700 }}>{p.tasks.total || '—'}</td>
                  <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, color: p.tasks.pctDone >= 75 ? '#34C759' : p.tasks.pctDone >= 40 ? '#FF9500' : '#FF3B30' }}>{p.tasks.pctDone}%</span>
                  </td>
                  <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                    {p.tasks.overdue > 0 ? <span style={{ fontWeight: 700, color: '#FF3B30' }}>{p.tasks.overdue}</span> : <span style={{ color: '#C7C7CC' }}>0</span>}
                  </td>
                  <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                    {p.risks.open > 0 ? <span style={{ fontWeight: 700, color: '#FF9500' }}>{p.risks.open}</span> : <span style={{ color: '#C7C7CC' }}>0</span>}
                  </td>
                  <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                    {p.risks.escalated > 0 ? <span style={{ fontWeight: 800, color: '#FF3B30', background: '#FF3B3012', padding: '2px 7px', borderRadius: 6 }}>{p.risks.escalated}</span> : <span style={{ color: '#C7C7CC' }}>0</span>}
                  </td>
                  <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600 }}>{p.team.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
