// ═══ CONSULTANT TIMELINE — Daily allocation per person ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member, Room } from '../../types/index';
import { loadTeamMembers, loadOrgChart } from '../../data/team';
import { loadRooms } from '../../data/rooms';
import { loadCalendarios, type Calendario } from '../../data/calendarios';
import { Icon } from '../common/Icon';

interface OrgEntry { member_id: string; sala: string; dedication: number }

const PROJECT_COLORS = ['#007AFF', '#34C759', '#FF9500', '#5856D6', '#FF2D55', '#00C7BE', '#AF52DE', '#FF6482'];
const addDays = (d: string, n: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

export function ConsultantTimeline() {
  const [members, setMembers] = useState<Member[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [orgEntries, setOrgEntries] = useState<OrgEntry[]>([]);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState<'month' | 'quarter'>('month');
  const [filterManager, setFilterManager] = useState<string>('');

  useEffect(() => {
    Promise.all([loadTeamMembers(), loadRooms(), loadCalendarios()]).then(async ([mR, rR, cals]) => {
      const mbrs = mR.ok ? mR.data : [];
      const rms = rR.ok ? rR.data : [];
      setMembers(mbrs);
      setRooms(rms);
      setCalendarios(cals);

      // Load org_chart for all rooms
      const entries: OrgEntry[] = [];
      for (const room of rms) {
        const result = await loadOrgChart(room.slug);
        if (result.ok) {
          result.data.forEach((o: Record<string, unknown>) => {
            entries.push({ member_id: o.member_id as string, sala: room.slug, dedication: (o.dedication as number) || 1 });
          });
        }
      }
      setOrgEntries(entries);
      setLoading(false);
    });
  }, []);

  // Date window
  const { minDate, maxDate, viewDays } = useMemo(() => {
    const now = new Date();
    if (zoom === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { minDate: start.toISOString().slice(0, 10), maxDate: end.toISOString().slice(0, 10), viewDays: end.getDate() };
    } else {
      const start = new Date(now.getFullYear(), now.getMonth() + offset * 3, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
      return { minDate: start.toISOString().slice(0, 10), maxDate: end.toISOString().slice(0, 10), viewDays: daysBetween(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) };
    }
  }, [offset, zoom]);

  // Holiday set from calendarios
  const holidays = useMemo(() => {
    const set = new Set<string>();
    calendarios.forEach(c => (c.holidays || []).forEach(h => set.add(h.date)));
    return set;
  }, [calendarios]);

  // Project color map
  const projectColors = useMemo(() => {
    const map: Record<string, string> = {};
    rooms.forEach((r, i) => { map[r.slug] = PROJECT_COLORS[i % PROJECT_COLORS.length]; });
    return map;
  }, [rooms]);

  // Build per-member allocation data
  const memberData = useMemo(() => {
    const filtered = filterManager
      ? members.filter(m => (m as Record<string, unknown>).manager_id === filterManager)
      : members;
    return filtered.map(m => {
      const memberOrg = orgEntries.filter(e => e.member_id === m.id);
      const vacDays = new Set<string>();
      (m.vacations || []).forEach(v => {
        if (!v.from) return;
        const end = v.to || v.from;
        let d = v.from;
        while (d <= end) { vacDays.add(d); d = addDays(d, 1); }
      });

      // Total dedication
      const totalDed = memberOrg.reduce((s, e) => s + e.dedication, 0);

      // Count working days in window
      let workDays = 0, vacCount = 0, holidayCount = 0;
      for (let i = 0; i < viewDays; i++) {
        const d = addDays(minDate, i);
        const dow = new Date(d).getDay();
        if (dow === 0 || dow === 6) continue;
        if (holidays.has(d)) { holidayCount++; continue; }
        if (vacDays.has(d)) { vacCount++; continue; }
        workDays++;
      }

      const totalAvailable = workDays;
      const assigned = Math.round(workDays * Math.min(totalDed, 1));
      const unassigned = totalAvailable - assigned;

      // Daily breakdown
      const days: Array<{ date: string; type: 'work' | 'vacation' | 'holiday' | 'weekend'; projects: Array<{ sala: string; pct: number }> }> = [];
      for (let i = 0; i < viewDays; i++) {
        const d = addDays(minDate, i);
        const dow = new Date(d).getDay();
        if (dow === 0 || dow === 6) { days.push({ date: d, type: 'weekend', projects: [] }); continue; }
        if (holidays.has(d)) { days.push({ date: d, type: 'holiday', projects: [] }); continue; }
        if (vacDays.has(d)) { days.push({ date: d, type: 'vacation', projects: [] }); continue; }
        days.push({ date: d, type: 'work', projects: memberOrg.map(e => ({ sala: e.sala, pct: e.dedication })) });
      }

      return { member: m, totalDed, totalAvailable, assigned, unassigned, vacCount, holidayCount, days };
    });
  }, [members, orgEntries, holidays, minDate, viewDays, filterManager]);

  const labelW = 260;
  const ROW_H = 36;
  const HEADER_H = 48;
  const dayW = Math.max(8, (typeof window !== 'undefined' ? window.innerWidth - labelW - 80 : 700) / viewDays);

  const monthLabel = new Date(minDate).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Identify managers (anyone who is someone else's manager_id)
  const managers = useMemo(() => {
    const mgrIds = new Set(members.map(m => (m as Record<string, unknown>).manager_id as string).filter(Boolean));
    return members.filter(m => mgrIds.has(m.id));
  }, [members]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando equipo...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Timeline de consultores</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>{memberData.length} personas · {rooms.length} proyectos · {monthLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Manager filter */}
          <select value={filterManager} onChange={e => setFilterManager((e.target as HTMLSelectElement).value)}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 11, outline: 'none', background: filterManager ? '#5856D608' : '#FFF', color: filterManager ? '#5856D6' : '#6E6E73', fontWeight: filterManager ? 600 : 400 }}>
            <option value="">Todos los responsables</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => setOffset(o => o - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ChevronLeft" size={14} color="#86868B" />
          </button>
          <button onClick={() => setOffset(0)} style={{ padding: '4px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', background: offset === 0 ? '#1D1D1F' : '#FFF', color: offset === 0 ? '#FFF' : '#86868B', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Hoy</button>
          <button onClick={() => setOffset(o => o + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ChevronRight" size={14} color="#86868B" />
          </button>
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #E5E5EA', marginLeft: 8 }}>
            {(['month', 'quarter'] as const).map(z => (
              <button key={z} onClick={() => { setZoom(z); setOffset(0); }}
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: zoom === z ? 700 : 500, background: zoom === z ? '#1D1D1F' : '#FFF', color: zoom === z ? '#FFF' : '#6E6E73', border: 'none', cursor: 'pointer' }}>
                {z === 'month' ? 'Mes' : 'Trimestre'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {rooms.map(r => (
          <div key={r.slug} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: projectColors[r.slug] }} />
            <span style={{ fontSize: 10, color: '#6E6E73' }}>{r.name}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#FF9500', opacity: 0.4 }} />
          <span style={{ fontSize: 10, color: '#6E6E73' }}>Vacaciones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#E5E5EA' }} />
          <span style={{ fontSize: 10, color: '#6E6E73' }}>Festivo / Fin de semana</span>
        </div>
      </div>

      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'hidden' }}>
        <div style={{ display: 'flex', overflow: 'auto' }}>
          {/* Left: member info + bars */}
          <div style={{ width: labelW, flexShrink: 0, borderRight: '1px solid #E5E5EA', background: '#FAFAFA' }}>
            <div style={{ height: HEADER_H, borderBottom: '1px solid #E5E5EA', padding: '0 12px', display: 'flex', alignItems: 'flex-end', paddingBottom: 6, fontSize: 10, fontWeight: 700, color: '#86868B' }}>CONSULTOR</div>
            {memberData.map(md => (
              <div key={md.member.id} style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid #F9F9FB' }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: md.member.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                  {md.member.avatar || '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{md.member.name}</div>
                </div>
                {/* Mini summary bar */}
                <div style={{ width: 60, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                  <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: '#F2F2F7' }}>
                    {md.totalAvailable > 0 && (
                      <>
                        <div style={{ width: `${(md.assigned / (md.totalAvailable + md.vacCount)) * 100}%`, background: md.totalDed > 1.05 ? '#FF3B30' : '#007AFF' }} title={`Asignado: ${md.assigned}d`} />
                        <div style={{ width: `${(md.vacCount / (md.totalAvailable + md.vacCount)) * 100}%`, background: '#FF9500' }} title={`Vacaciones: ${md.vacCount}d`} />
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 8, color: md.totalDed > 1.05 ? '#FF3B30' : md.unassigned > 5 ? '#FF9500' : '#86868B', textAlign: 'right' }}>
                    {Math.round(md.totalDed * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: daily grid */}
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <svg width={viewDays * dayW} height={HEADER_H + memberData.length * ROW_H}>
              {/* Day headers */}
              {Array.from({ length: viewDays }, (_, i) => {
                const d = new Date(addDays(minDate, i));
                const dow = d.getDay();
                const isWe = dow === 0 || dow === 6;
                const isToday = addDays(minDate, i) === new Date().toISOString().slice(0, 10);
                const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
                return (
                  <g key={i}>
                    {/* Weekend/today bg */}
                    <rect x={i * dayW} y={0} width={dayW} height={HEADER_H + memberData.length * ROW_H}
                      fill={isToday ? '#FF3B3008' : isWe ? 'rgba(0,0,0,.02)' : 'transparent'} />
                    {/* Day label */}
                    {(zoom === 'month' || (zoom === 'quarter' && d.getDate() === 1)) && (
                      <text x={i * dayW + dayW / 2} y={20} textAnchor="middle" fontSize={zoom === 'month' ? '8' : '7'} fill={isWe ? '#C7C7CC' : isToday ? '#FF3B30' : '#AEAEB2'} fontWeight={isToday ? '700' : '400'}>
                        {zoom === 'month' ? `${dayNames[dow]}` : `${d.getDate()}`}
                      </text>
                    )}
                    {zoom === 'month' && (
                      <text x={i * dayW + dayW / 2} y={32} textAnchor="middle" fontSize="8" fill={isWe ? '#C7C7CC' : isToday ? '#FF3B30' : '#86868B'} fontWeight={isToday ? '700' : '500'}>
                        {d.getDate()}
                      </text>
                    )}
                    {/* Today marker */}
                    {isToday && <line x1={i * dayW + dayW / 2} y1={HEADER_H} x2={i * dayW + dayW / 2} y2={HEADER_H + memberData.length * ROW_H} stroke="#FF3B30" strokeWidth="1" strokeDasharray="3 2" />}
                  </g>
                );
              })}

              {/* Member rows */}
              {memberData.map((md, mi) => (
                <g key={md.member.id}>
                  {md.days.map((day, di) => {
                    const x = di * dayW;
                    const y = HEADER_H + mi * ROW_H + 6;
                    const h = ROW_H - 12;

                    if (day.type === 'weekend') {
                      return <rect key={di} x={x + 1} y={y} width={dayW - 2} height={h} rx={2} fill="#F2F2F7" />;
                    }
                    if (day.type === 'holiday') {
                      return <rect key={di} x={x + 1} y={y} width={dayW - 2} height={h} rx={2} fill="#E5E5EA" />;
                    }
                    if (day.type === 'vacation') {
                      return (
                        <g key={di}>
                          <rect x={x + 1} y={y} width={dayW - 2} height={h} rx={2} fill="#FF950030" />
                          <line x1={x + 2} y1={y + 2} x2={x + dayW - 3} y2={y + h - 2} stroke="#FF950040" strokeWidth="1" />
                        </g>
                      );
                    }
                    // Work day — stack projects
                    if (day.projects.length === 0) {
                      return <rect key={di} x={x + 1} y={y} width={dayW - 2} height={h} rx={2} fill="#F9F9FB" stroke="#E5E5EA" strokeWidth="0.5" />;
                    }
                    const totalPct = day.projects.reduce((s, p) => s + p.pct, 0);
                    let yOffset = 0;
                    return (
                      <g key={di}>
                        {day.projects.map((p, pi) => {
                          const segH = Math.max(2, (p.pct / Math.max(totalPct, 1)) * h);
                          const el = <rect key={pi} x={x + 1} y={y + yOffset} width={dayW - 2} height={segH} rx={pi === 0 ? 2 : 0} fill={projectColors[p.sala] || '#C7C7CC'} opacity={0.7} />;
                          yOffset += segH;
                          return el;
                        })}
                        {/* Unassigned portion */}
                        {totalPct < 1 && (
                          <rect x={x + 1} y={y + yOffset} width={dayW - 2} height={h - yOffset} rx={0} fill="#F9F9FB" stroke="#E5E5EA" strokeWidth="0.3" />
                        )}
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div style={{ marginTop: 14, background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, overflow: 'auto' }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Resumen del periodo</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B' }}>Persona</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B' }}>Asignación</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B' }}>Días lab.</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B' }}>Vacaciones</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B' }}>Festivos</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B' }}>Disponible</th>
              {rooms.map(r => (
                <th key={r.slug} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '2px solid #E5E5EA', fontSize: 9, color: '#86868B', maxWidth: 60 }}>{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberData.map(md => {
              const memberOrg = orgEntries.filter(e => e.member_id === md.member.id);
              return (
                <tr key={md.member.id} style={{ background: md.totalDed > 1.05 ? '#FFF5F5' : md.unassigned > md.totalAvailable * 0.3 ? '#FFF8EB' : undefined }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F2F2F7', fontWeight: 600 }}>
                    {md.member.avatar || '👤'} {md.member.name}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: md.totalDed > 1.05 ? '#FF3B30' : md.totalDed < 0.5 ? '#FF9500' : '#007AFF' }}>
                    {Math.round(md.totalDed * 100)}%
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #F2F2F7' }}>{md.totalAvailable}</td>
                  <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #F2F2F7', color: md.vacCount > 0 ? '#FF9500' : '#C7C7CC' }}>{md.vacCount}</td>
                  <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #F2F2F7', color: '#C7C7CC' }}>{md.holidayCount}</td>
                  <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #F2F2F7', fontWeight: 600, color: md.unassigned > 5 ? '#FF9500' : '#34C759' }}>{md.unassigned}d</td>
                  {rooms.map(r => {
                    const entry = memberOrg.find(e => e.sala === r.slug);
                    return (
                      <td key={r.slug} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid #F2F2F7' }}>
                        {entry ? (
                          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: projectColors[r.slug] + '20', color: projectColors[r.slug] }}>
                            {Math.round(entry.dedication * 100)}%
                          </span>
                        ) : <span style={{ color: '#E5E5EA' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
