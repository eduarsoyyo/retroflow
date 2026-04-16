// ═══ CROSS-PROJECT — Overload alerts + resource allocation matrix ═══
import { useState, useEffect } from 'preact/hooks';
import { loadCrossProjectData, type CrossProjectData, type OverloadAlert } from '../../services/crossProject';
import { Icon } from '../common/Icon';

export function CrossProject() {
  const [data, setData] = useState<CrossProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCrossProjectData().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando datos cross-proyecto...</div>;
  if (!data) return null;

  const { overloads, crossRisks, memberProjects } = data;
  const allProjects = [...new Set(memberProjects.flatMap(mp => mp.projects.map(p => p.sala)))];
  const projectNames: Record<string, string> = {};
  memberProjects.forEach(mp => mp.projects.forEach(p => { projectNames[p.sala] = p.name; }));

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cross-proyecto</h3>
      <p style={{ fontSize: 12, color: '#86868B', marginBottom: 16 }}>Alertas de sobrecarga y riesgos cruzados entre proyectos</p>

      {/* Overload alerts */}
      {overloads.length > 0 && (
        <div style={{ background: '#FFF5F5', borderRadius: 14, border: '1.5px solid #FF3B3020', padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="AlertTriangle" size={16} color="#FF3B30" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#FF3B30' }}>Sobrecarga detectada ({overloads.length})</span>
          </div>
          {overloads.map(o => (
            <div key={o.memberId} class="card-hover" style={{ background: '#FFF', borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <span style={{ fontSize: 20 }}>{o.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{o.memberName}</div>
                <div style={{ fontSize: 11, color: '#86868B' }}>
                  {o.projects.map(p => `${p.name} (${Math.round(p.dedication * 100)}%)`).join(' + ')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: o.totalDedication > 1.2 ? '#FF3B30' : '#FF9500' }}>
                  {Math.round(o.totalDedication * 100)}%
                </div>
                <div style={{ fontSize: 9, color: '#FF3B30' }}>Asignación total</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {overloads.length === 0 && (
        <div style={{ background: '#F0FFF4', borderRadius: 14, border: '1.5px solid #34C75920', padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="CheckCircle2" size={16} color="#34C759" />
          <span style={{ fontSize: 13, color: '#34C759', fontWeight: 600 }}>Sin sobrecargas — equipo equilibrado</span>
        </div>
      )}

      {/* Cross-risk alerts */}
      {crossRisks.length > 0 && (
        <div style={{ background: '#FFF8EB', borderRadius: 14, border: '1.5px solid #FF950020', padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="TrendingUp" size={16} color="#FF9500" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#FF9500' }}>Riesgos cruzados ({crossRisks.length})</span>
          </div>
          <p style={{ fontSize: 11, color: '#86868B', marginBottom: 10 }}>Personas con riesgos escalados en más de un proyecto</p>
          {crossRisks.map(cr => (
            <div key={cr.memberName} style={{ background: '#FFF', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{cr.memberName}</div>
              {cr.risks.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: '#007AFF', minWidth: 80 }}>{r.roomName}</span>
                  <span style={{ color: '#6E6E73', flex: 1 }}>{r.riskText}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#FF9500', background: '#FF950015', padding: '2px 6px', borderRadius: 4 }}>{r.level}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Resource allocation matrix */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="Grid3X3" size={16} color="#5856D6" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Matriz de asignación</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #E5E5EA', fontSize: 11, color: '#86868B', fontWeight: 700 }}>Persona</th>
              {allProjects.map(p => (
                <th key={p} style={{ textAlign: 'center', padding: '8px 6px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B', fontWeight: 700, maxWidth: 80 }}>
                  {projectNames[p] || p}
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '2px solid #E5E5EA', fontSize: 11, color: '#86868B', fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {memberProjects.map(mp => {
              const total = mp.projects.reduce((s, p) => s + p.dedication, 0);
              const isOver = total > 1.05;
              return (
                <tr key={mp.member.id} style={{ background: isOver ? '#FFF5F5' : undefined }}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #F2F2F7', fontWeight: 600 }}>
                    <span style={{ marginRight: 6 }}>{mp.member.avatar || '👤'}</span>
                    {mp.member.name.split(' ')[0]}
                  </td>
                  {allProjects.map(sala => {
                    const proj = mp.projects.find(p => p.sala === sala);
                    const ded = proj ? proj.dedication : 0;
                    return (
                      <td key={sala} style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7' }}>
                        {ded > 0 ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: ded >= 1 ? '#007AFF15' : ded >= 0.5 ? '#34C75915' : '#F2F2F7',
                            color: ded >= 1 ? '#007AFF' : ded >= 0.5 ? '#34C759' : '#86868B',
                          }}>
                            {Math.round(ded * 100)}%
                          </span>
                        ) : (
                          <span style={{ color: '#E5E5EA' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #F2F2F7', fontWeight: 800, color: isOver ? '#FF3B30' : '#1D1D1F' }}>
                    {Math.round(total * 100)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
