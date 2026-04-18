// ═══ TAB FTEs — Unified: FTEs + Vacaciones + Ausencias (annual/monthly/weekly) ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member } from '@app-types/index';
import { loadOrgChart } from '@data/team';
import { Icon } from '@components/common/Icon';
import { ANNUAL_VAC_DAYS, ABSENCE_TYPES, getAbsenceType } from '../../config/absenceTypes';

interface TabFTEsProps { team: Member[]; sala: string; }

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MO_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DY = ['L','M','X','J','V','S','D'];

type ViewMode = 'anual' | 'mensual' | 'semanal';

export function TabFTEs({ team, sala }: TabFTEsProps) {
  const [orgData, setOrgData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('anual');
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0, 10);
  });

  useEffect(() => { loadOrgChart(sala).then(r => { if (r.ok) setOrgData(r.data); setLoading(false); }); }, [sala]);

  // Helpers
  const getOrg = (mid: string) => orgData.find(r => r.member_id === mid) || {};
  const isWk = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const fmtD = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

  // Vacation stats per member for a year
  const vacStats = useMemo(() => {
    return team.map(m => {
      const vacs = m.vacations || [];
      let usedVac = 0, ausCount = 0;
      vacs.forEach(v => {
        if (!v.from) return;
        const isVac = (v.type || 'vacaciones') === 'vacaciones';
        let d = new Date(v.from); const to = new Date(v.to || v.from);
        while (d <= to) {
          if (d.getFullYear() === yr && !isWk(d)) { if (isVac) usedVac++; else ausCount++; }
          d.setDate(d.getDate() + 1);
        }
      });
      const annual = m.annual_vac_days || ANNUAL_VAC_DAYS;
      const prev = m.prev_year_pending || 0;
      const total = annual + prev;
      return { id: m.id, annual, prev, total, used: usedVac, remaining: Math.max(0, total - usedVac), ausencias: ausCount };
    });
  }, [team, yr]);

  // Get absence for a specific date
  const getAbsence = (mid: string, ds: string) => {
    const m = team.find(x => x.id === mid); if (!m) return null;
    return (m.vacations || []).find(v => v.from <= ds && (!v.to || v.to >= ds)) || null;
  };

  // Hours per day for a member (from org dedication * 8h standard)
  const hoursDay = (mid: string) => { const o = getOrg(mid); return (o.dedication ?? 1) * 8; };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>FTEs, Vacaciones y Ausencias</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{team.length} personas · Cada persona gestiona sus vacaciones desde Mi Perfil</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['anual', 'mensual', 'semanal'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: view === v ? '#1D1D1F' : '#F2F2F7', color: view === v ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ VISTA ANUAL ═══ */}
      {view === 'anual' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setYr(y => y - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronLeft" size={13} color="#6E6E73" /></button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{yr}</span>
            <button onClick={() => setYr(y => y + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronRight" size={13} color="#6E6E73" /></button>
          </div>

          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#86868B', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, minWidth: 160, borderRight: '2px solid #E5E5EA' }}>Persona</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Días/año</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Año ant.</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Total</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Consum.</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Restantes</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Ausencias</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>FTE</th>
                  <th style={{ padding: '6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>H/día</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m, i) => {
                  const vs = vacStats.find(v => v.id === m.id)!;
                  const org = getOrg(m.id);
                  const ded = org.dedication ?? 1;
                  const hd = (ded * 8).toFixed(1);
                  return (
                    <tr key={m.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                      <td style={{ padding: '8px 10px', position: 'sticky', left: 0, background: i % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderRight: '2px solid #E5E5EA' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 7, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{m.avatar || '👤'}</div>
                          <div><div style={{ fontSize: 11, fontWeight: 600 }}>{m.name}</div>{m.role_label && <div style={{ fontSize: 8, color: '#86868B' }}>{m.role_label}</div>}</div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', fontWeight: 600 }}>{vs.annual}</td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', color: vs.prev > 0 ? '#007AFF' : '#D1D1D6' }}>{vs.prev}</td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', fontWeight: 700 }}>{vs.total}</td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', fontWeight: 600, color: '#FF9500' }}>{vs.used}</td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: vs.remaining <= 5 ? '#FF3B30' : vs.remaining <= 10 ? '#FF9500' : '#34C759' }}>{vs.remaining}</td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', color: vs.ausencias > 0 ? '#FF9500' : '#D1D1D6' }}>{vs.ausencias}</td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: '#007AFF' }}>{ded}</td>
                      <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', color: '#6E6E73' }}>{hd}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ VISTA MENSUAL ═══ */}
      {view === 'mensual' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => { if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronLeft" size={13} color="#6E6E73" /></button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{MO_FULL[mo]} {yr}</span>
            <button onClick={() => { if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronRight" size={13} color="#6E6E73" /></button>
          </div>

          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
            {(() => {
              const daysN = new Date(yr, mo + 1, 0).getDate();
              const days = Array.from({ length: daysN }, (_, i) => i + 1);
              const todayS = now.toISOString().slice(0, 10);
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#86868B', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, minWidth: 140, borderRight: '2px solid #E5E5EA' }}>Persona</th>
                      {days.map(d => {
                        const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const wk = isWk(new Date(yr, mo, d));
                        const td = ds === todayS;
                        return <th key={d} style={{ padding: '4px 1px', textAlign: 'center', fontSize: 8, fontWeight: td ? 800 : 500, color: wk ? '#D1D1D6' : td ? '#007AFF' : '#86868B', background: td ? '#007AFF10' : wk ? '#F9F9FB' : '#FAFAFA', borderBottom: '2px solid #E5E5EA', minWidth: 18 }}>{d}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m, i) => (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                        <td style={{ padding: '5px 8px', position: 'sticky', left: 0, background: i % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderRight: '2px solid #E5E5EA' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 12 }}>{m.avatar || '👤'}</span>
                            <span style={{ fontSize: 10, fontWeight: 600 }}>{m.name.split(' ')[0]}</span>
                          </div>
                        </td>
                        {days.map(d => {
                          const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const wk = isWk(new Date(yr, mo, d));
                          const abs = getAbsence(m.id, ds);
                          const at = abs ? getAbsenceType(abs.type || 'vacaciones') : null;
                          return (
                            <td key={d} title={at ? `${at.label}${abs?.note ? ': ' + abs.note : ''}` : undefined}
                              style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', borderLeft: '1px solid #F9F9FB', padding: 0, background: wk ? '#F9F9FB' : abs ? (at?.color || '#FF950020') : 'transparent' }}>
                              {abs && !wk && <span style={{ fontSize: 8, fontWeight: 700, color: '#FFF' }}>{at?.initial || 'V'}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 9, color: '#86868B' }}>
            {ABSENCE_TYPES.slice(0, 8).map(at => (
              <span key={at.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: at.color }} />
                {at.initial} {at.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ VISTA SEMANAL ═══ */}
      {view === 'semanal' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toISOString().slice(0, 10)); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronLeft" size={13} color="#6E6E73" /></button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Semana del {fmtD(weekStart)}</span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toISOString().slice(0, 10)); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronRight" size={13} color="#6E6E73" /></button>
            <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); setWeekStart(d.toISOString().slice(0, 10)); }}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#007AFF' }}>Hoy</button>
          </div>

          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
            {(() => {
              const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
              const todayS = now.toISOString().slice(0, 10);
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#86868B', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, minWidth: 150, borderRight: '2px solid #E5E5EA' }}>Persona</th>
                      {weekDays.map(d => {
                        const ds = d.toISOString().slice(0, 10);
                        const wk = isWk(d);
                        const td = ds === todayS;
                        return (
                          <th key={ds} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: td ? 800 : 600, color: wk ? '#D1D1D6' : td ? '#007AFF' : '#6E6E73', background: td ? '#007AFF08' : wk ? '#F9F9FB' : '#FAFAFA', borderBottom: '2px solid #E5E5EA', minWidth: 70 }}>
                            {DY[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}/{d.getMonth() + 1}
                          </th>
                        );
                      })}
                      <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Total h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m, i) => {
                      const hd = hoursDay(m.id);
                      let totalH = 0;
                      return (
                        <tr key={m.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                          <td style={{ padding: '6px 10px', position: 'sticky', left: 0, background: i % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderRight: '2px solid #E5E5EA' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 22, height: 22, borderRadius: 6, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{m.avatar || '👤'}</div>
                              <div style={{ fontSize: 11, fontWeight: 600 }}>{m.name.split(' ')[0]}</div>
                            </div>
                          </td>
                          {weekDays.map(d => {
                            const ds = d.toISOString().slice(0, 10);
                            const wk = isWk(d);
                            const abs = getAbsence(m.id, ds);
                            const at = abs ? getAbsenceType(abs.type || 'vacaciones') : null;
                            const h = wk ? 0 : abs ? 0 : hd;
                            if (!wk && !abs) totalH += hd;
                            return (
                              <td key={ds} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid #F2F2F7', background: wk ? '#F9F9FB' : abs ? (at?.color || '#FF950020') : 'transparent' }}>
                                {wk ? <span style={{ color: '#E5E5EA' }}>—</span> : abs ? (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#FFF' }}>{at?.initial || 'V'}</span>
                                ) : (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#34C759' }}>{h.toFixed(1)}</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: '#007AFF' }}>{totalH.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
