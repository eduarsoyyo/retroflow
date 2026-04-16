// ═══ TAB FTEs — Annual FTE calendar + dedication configuration ═══
import { useState, useEffect } from 'preact/hooks';
import type { Member, Vacation, OrgChartRow } from '../../types/index';
import { loadOrgChart, updateOrgField } from '../../data/team';

interface TabFTEsProps {
  team: Member[];
  sala: string;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function TabFTEs({ team, sala }: TabFTEsProps) {
  const [orgData, setOrgData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayStr = today.toISOString().slice(0, 10);

  useEffect(() => {
    loadOrgChart(sala).then(result => {
      if (result.ok) setOrgData(result.data);
      setLoading(false);
    });
  }, [sala]);

  const isWeekend = (d: number) => { const w = new Date(viewYear, viewMonth, d).getDay(); return w === 0 || w === 6; };
  const isOnVac = (memberId: string, d: number) => {
    const m = team.find(x => x.id === memberId); if (!m) return false;
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return (m.vacations || []).some((v: Vacation) => v.from <= ds && (!v.to || v.to >= ds));
  };
  const isActive = (row: OrgChartRow, d: number) => {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return ds >= (row.start_date || '2000-01-01') && ds <= (row.end_date || '2099-12-31');
  };
  const fteDay = (d: number) => isWeekend(d) ? 0 : orgData.reduce((s, r) => {
    if (!isActive(r, d) || isOnVac(r.member_id, d)) return s;
    return s + (r.dedication ?? 1);
  }, 0);
  const maxFTE = Math.max(1, ...days.map(d => fteDay(d)));

  const handleUpdateOrgField = async (memberId: string, managerId: string | null, field: string, val: unknown) => {
    await updateOrgField(sala, memberId, managerId, field, val);
    setOrgData(prev => {
      const exists = prev.some(r => r.member_id === memberId);
      if (exists) return prev.map(r => r.member_id === memberId ? { ...r, [field]: val } : r);
      return [...prev, { sala, member_id: memberId, manager_id: managerId, [field]: val }];
    });
  };

  // Annual months: -3 to +12
  const annualMonths = Array.from({ length: 16 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 3 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📊 FTEs del proyecto</h3>
      <p style={{ fontSize: 11, color: '#86868B', marginBottom: 12 }}>Vista anual + configuración de dedicación</p>

      {/* Daily FTE bar chart */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, fontWeight: 700, color: '#86868B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          FTEs totales · {MONTH_NAMES[viewMonth]}
        </h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72 }}>
          {days.map(d => {
            const wknd = isWeekend(d);
            const fte = fteDay(d);
            const isT = todayStr === `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const h = wknd ? 3 : Math.max(3, Math.round((fte / maxFTE) * 64));
            return (
              <div key={d} title={wknd ? 'Fin semana' : `${fte.toFixed(2)} FTEs`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1, minWidth: 12 }}>
                {!wknd && fte > 0 && <span style={{ fontSize: 6, color: '#86868B' }}>{fte.toFixed(1)}</span>}
                <div style={{
                  width: '80%', height: `${h}px`, borderRadius: '3px 3px 0 0',
                  background: wknd ? '#E5E5EA' : isT ? '#007AFF' : fte > 0 ? '#34C759' : '#F2F2F7',
                }} />
                <span style={{ fontSize: 6, color: isT ? '#007AFF' : '#C7C7CC' }}>{d}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Annual table */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#F9F9FB', borderBottom: '2px solid #E5E5EA' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#86868B', minWidth: 130, position: 'sticky', left: 0, background: '#F9F9FB', zIndex: 2 }}>Miembro</th>
              {annualMonths.map(({ year, month }) => {
                const isNow = year === today.getFullYear() && month === today.getMonth();
                return (
                  <th key={`${year}-${month}`} style={{
                    padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                    color: isNow ? '#007AFF' : '#86868B', background: isNow ? '#EEF5FF' : '#F9F9FB',
                    minWidth: 52, borderBottom: isNow ? '2px solid #007AFF' : 'none',
                  }}>
                    {MONTH_NAMES[month].slice(0, 3)}<br /><span style={{ fontSize: 9, fontWeight: 400 }}>{year}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {team.map((m, mi) => {
              const row = orgData.find(r => r.member_id === m.id) || {};
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #F2F2F7', background: mi % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  <td style={{ padding: '8px 14px', position: 'sticky', left: 0, background: mi % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{m.avatar || '👤'}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{m.name}</div>
                        {m.role_label && <div style={{ fontSize: 9, color: '#86868B' }}>{m.role_label}</div>}
                      </div>
                    </div>
                  </td>
                  {annualMonths.map(({ year, month }) => {
                    const start = row.start_date || '2000-01-01';
                    const end = row.end_date || '2099-12-31';
                    const ms = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                    const me = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
                    const active = me >= start && ms <= end;
                    const ded = row.dedication ?? 1;
                    const isNow = year === today.getFullYear() && month === today.getMonth();
                    return (
                      <td key={`${year}-${month}`} style={{ padding: '6px', textAlign: 'center', background: isNow ? (active ? '#EEF5FF' : '#F8FAFF') : (active ? '#FFF' : '#F9F9FB') }}>
                        {active ? (
                          <div style={{
                            padding: '3px 4px', borderRadius: 6,
                            background: isNow ? '#007AFF' : ded >= 1 ? '#34C75920' : '#FF950015',
                            border: `1px solid ${isNow ? 'transparent' : ded >= 1 ? '#34C75930' : '#FF950030'}`,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: isNow ? '#FFF' : ded >= 1 ? '#34C759' : '#FF9500' }}>{ded}</div>
                            <div style={{ fontSize: 8, color: isNow ? 'rgba(255,255,255,.8)' : '#86868B' }}>FTE</div>
                          </div>
                        ) : <span style={{ color: '#E5E5EA', fontSize: 10 }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Total row */}
            <tr style={{ background: '#F0F7FF', borderTop: '2px solid #007AFF20' }}>
              <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#007AFF', position: 'sticky', left: 0, background: '#F0F7FF' }}>Total FTEs</td>
              {annualMonths.map(({ year, month }) => {
                const total = team.reduce((sum, m) => {
                  const row = orgData.find(r => r.member_id === m.id) || {};
                  const start = row.start_date || '2000-01-01';
                  const end = row.end_date || '2099-12-31';
                  const ms = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                  const me = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
                  return me >= start && ms <= end ? sum + (row.dedication ?? 1) : sum;
                }, 0);
                return (
                  <td key={`${year}-${month}`} style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: total > 0 ? '#007AFF' : '#C7C7CC' }}>{total > 0 ? total.toFixed(1) : '—'}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Configuration table */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr style={{ background: '#F9F9FB', borderBottom: '2px solid #E5E5EA' }}>
              {['Miembro', 'Inicio', 'Fin', 'Dedicación', 'FTE·días'].map(h => (
                <th key={h} style={{ padding: '10px', textAlign: h === 'Miembro' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: '#86868B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((m, mi) => {
              const row = orgData.find(r => r.member_id === m.id) || { member_id: m.id };
              const workdays = days.filter(d => !isWeekend(d) && isActive(row, d) && !isOnVac(m.id, d)).length;
              const mFTE = (workdays * (row.dedication ?? 1)).toFixed(1);
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #F2F2F7', background: mi % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{m.avatar || '👤'}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                        {m.role_label && <div style={{ fontSize: 9, color: '#86868B' }}>{m.role_label}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input type="date" value={row.start_date || ''} onInput={e => handleUpdateOrgField(m.id, row.manager_id, 'start_date', (e.target as HTMLInputElement).value || null)}
                      style={{ border: '1px solid #E5E5EA', borderRadius: 6, padding: '3px 5px', fontSize: 10, outline: 'none', width: 110 }} />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input type="date" value={row.end_date || ''} onInput={e => handleUpdateOrgField(m.id, row.manager_id, 'end_date', (e.target as HTMLInputElement).value || null)}
                      style={{ border: '1px solid #E5E5EA', borderRadius: 6, padding: '3px 5px', fontSize: 10, outline: 'none', width: 110 }} />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input type="number" min="0.1" max="1" step="0.1" value={row.dedication ?? 1}
                      onInput={e => handleUpdateOrgField(m.id, row.manager_id, 'dedication', parseFloat((e.target as HTMLInputElement).value) || 1)}
                      style={{ width: 44, border: '1px solid #E5E5EA', borderRadius: 6, padding: '3px 6px', fontSize: 12, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: parseFloat(mFTE) > 0 ? '#34C759' : '#C7C7CC' }}>{mFTE}</span>
                    <span style={{ fontSize: 9, color: '#86868B', display: 'block' }}>{workdays}d</span>
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
