// ═══ USER DETAIL — Individual user card (ficha individual) ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member, Room } from '@app-types/index';
import { loadCalendarios, type Calendario } from '@data/calendarios';
import { Icon } from '@components/common/Icon';
import { ABSENCE_TYPES, ANNUAL_VAC_DAYS } from '../../config/absenceTypes';

interface OrgEntry {
  member_id: string;
  sala: string;
  dedication: number;
  start_date: string;
  end_date: string;
}

interface RetroMetricRow {
  sala: string;
  date: string;
  participant_names: string[];
  notes: number;
  actions: number;
  score: number;
}

interface ActionRow {
  id: string;
  text: string;
  status: string;
  owner: string;
  date: string;
  sala: string;
}

interface UserDetailProps {
  member: Member;
  members: Member[];
  rooms: Room[];
  orgData: OrgEntry[];
  onBack: () => void;
  onEdit: (m: Member) => void;
}

const fd = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 };

export function UserDetail({ member, members, rooms, orgData, onBack, onEdit }: UserDetailProps) {
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [retroMetrics, setRetroMetrics] = useState<RetroMetricRow[]>([]);
  const [allActions, setAllActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'projects' | 'vacations' | 'actions' | 'retros'>('info');

  const m = member;
  const today = new Date().toISOString().slice(0, 10);
  const yr = new Date().getFullYear();

  useEffect(() => {
    const load = async () => {
      try {
        const { supabase } = await import('../../data/supabase');
        const [calsR, metricsR, retrosR] = await Promise.all([
          loadCalendarios(),
          supabase.from('retro_metrics').select('sala, date, participant_names, notes, actions, score').order('date', { ascending: false }),
          supabase.from('retros').select('sala, data, created_at').eq('status', 'active'),
        ]);
        setCalendarios(calsR || []);
        // Filter metrics where this member participated
        const allMet = (metricsR.data || []) as RetroMetricRow[];
        setRetroMetrics(allMet.filter(rm => (rm.participant_names || []).includes(m.name)));

        // Extract actions assigned to this member from active retros
        const acts: ActionRow[] = [];
        (retrosR.data || []).forEach((r: any) => {
          const data = r.data || {};
          const actions = Array.isArray(data.actions) ? data.actions : [];
          actions.forEach((a: any) => {
            if (a.owner === m.name || a.owner === m.username) {
              acts.push({ id: a.id, text: a.text || '', status: a.status || 'pending', owner: a.owner || '', date: a.date || '', sala: r.sala });
            }
          });
        });
        setAllActions(acts);
      } catch (e) {
        console.error('UserDetail load error:', e);
      }
      setLoading(false);
    };
    load();
  }, [m.id, m.name]);

  // ── Computed data ──
  const cal = useMemo(() => {
    const cid = (m as Record<string, unknown>).calendario_id as string;
    return cid ? calendarios.find(c => c.id === cid) : null;
  }, [m, calendarios]);

  const manager = useMemo(() => {
    const mid = (m as Record<string, unknown>).manager_id as string;
    return mid ? members.find(x => x.id === mid) : null;
  }, [m, members]);

  const myOrg = useMemo(() => orgData.filter(o => o.member_id === m.id), [orgData, m.id]);

  const activeDedication = useMemo(() => {
    return myOrg.filter(e => {
      const s = e.start_date || '2000-01-01';
      const ed = e.end_date || '2099-12-31';
      return today >= s && today <= ed;
    }).reduce((sum, e) => sum + (e.dedication || 0), 0);
  }, [myOrg, today]);

  const intercontrato = Math.max(0, 1 - activeDedication);

  const vacUsed = useMemo(() => {
    let used = 0;
    (m.vacations || []).filter(v => (v.type || 'vacaciones') === 'vacaciones' && v.from).forEach(v => {
      let d = new Date(v.from);
      const to = new Date(v.to || v.from);
      while (d <= to) {
        if (d.getFullYear() === yr && d.getDay() !== 0 && d.getDay() !== 6) { used++; }
        d.setDate(d.getDate() + 1);
      }
    });
    return used;
  }, [m.vacations, yr]);

  const vacTotal = m.annual_vac_days || ANNUAL_VAC_DAYS;
  const vacPending = Math.max(0, vacTotal + (m.prev_year_pending || 0) - vacUsed);

  const absencesByType = useMemo(() => {
    const map: Record<string, number> = {};
    (m.vacations || []).filter(v => v.from && new Date(v.from).getFullYear() === yr).forEach(v => {
      const t = v.type || 'vacaciones';
      map[t] = (map[t] || 0) + 1;
    });
    return map;
  }, [m.vacations, yr]);

  const pendingActions = allActions.filter(a => a.status !== 'done' && a.status !== 'archived' && a.status !== 'discarded');
  const doneActions = allActions.filter(a => a.status === 'done' || a.status === 'archived');

  // ── Tabs ──
  const TABS = [
    { id: 'info' as const, label: 'Datos', icon: 'User' },
    { id: 'projects' as const, label: 'Proyectos', icon: 'FolderOpen' },
    { id: 'vacations' as const, label: 'Ausencias', icon: 'Calendar' },
    { id: 'actions' as const, label: 'Accionables', icon: 'CheckSquare' },
    { id: 'retros' as const, label: 'Retros', icon: 'RotateCcw' },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando ficha…</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="ArrowLeft" size={16} color="#86868B" />
        </button>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: m.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
          {m.avatar || '👤'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{m.name}</div>
          <div style={{ fontSize: 12, color: '#86868B' }}>
            {m.role_label || 'Sin rol'}{m.company ? ` · ${m.company}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Dedication badge */}
          <div style={{ textAlign: 'center', padding: '6px 12px', borderRadius: 10, background: activeDedication >= 1 ? '#34C75912' : intercontrato > 0.5 ? '#FF3B3012' : '#FF950012' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: activeDedication >= 1 ? '#34C759' : intercontrato > 0.5 ? '#FF3B30' : '#FF9500' }}>
              {Math.round(activeDedication * 100)}%
            </div>
            <div style={{ fontSize: 8, color: '#86868B' }}>Dedicación</div>
          </div>
          {/* Vacation badge */}
          <div style={{ textAlign: 'center', padding: '6px 12px', borderRadius: 10, background: vacPending <= 5 ? '#FF3B3012' : '#34C75912' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: vacPending <= 5 ? '#FF3B30' : '#34C759' }}>{vacPending}</div>
            <div style={{ fontSize: 8, color: '#86868B' }}>Vac. pend.</div>
          </div>
          <button onClick={() => onEdit(m)}
            style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#007AFF', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="Edit" size={13} color="#007AFF" /> Editar
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #F2F2F7', paddingBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500,
              background: activeTab === t.id ? '#1D1D1F' : 'transparent', color: activeTab === t.id ? '#FFF' : '#6E6E73',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}>
            <Icon name={t.icon} size={13} color={activeTab === t.id ? '#FFF' : '#86868B'} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: INFO ═══ */}
      {activeTab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={cardS}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 10 }}>Datos personales</div>
            {([
              { icon: 'User', label: 'Usuario', value: m.username || '—' },
              { icon: 'Mail', label: 'Email', value: m.email || '—' },
              { icon: 'Phone', label: 'Teléfono', value: m.phone || '—' },
              { icon: 'Briefcase', label: 'Empresa', value: m.company || '—' },
              { icon: 'Shield', label: 'Rol', value: m.role_label || '—' },
              { icon: 'Users', label: 'Responsable', value: manager?.name || '—' },
              { icon: 'Calendar', label: 'Incorporación', value: fd((m as Record<string, unknown>).hire_date as string || '') },
            ] as const).map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F9F9FB' }}>
                <Icon name={f.icon as string} size={13} color="#86868B" />
                <span style={{ fontSize: 10, color: '#86868B', minWidth: 80 }}>{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{f.value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Calendar card */}
            <div style={cardS}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 8 }}>Calendario laboral</div>
              {cal ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{cal.name}</div>
                  <div style={{ fontSize: 11, color: '#86868B' }}>{cal.region || '—'} · {(cal.holidays || []).length} festivos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: 10 }}>
                    <div><span style={{ color: '#86868B' }}>H/día L-J:</span> <strong>{cal.daily_hours_lj || 8}h</strong></div>
                    <div><span style={{ color: '#86868B' }}>H/día V:</span> <strong>{cal.daily_hours_v || 7}h</strong></div>
                    <div><span style={{ color: '#86868B' }}>H/día int.:</span> <strong>{cal.daily_hours_intensive || 7}h</strong></div>
                    <div><span style={{ color: '#86868B' }}>Vacaciones:</span> <strong>{vacTotal} días</strong></div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: '#C7C7CC' }}>Sin calendario asignado</p>
              )}
            </div>

            {/* House card */}
            {m.house && (
              <div style={{ ...cardS, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>
                  {m.house === 'gryffindor' ? '🦁' : m.house === 'slytherin' ? '🐍' : m.house === 'ravenclaw' ? '🦅' : m.house === 'hufflepuff' ? '🦡' : ''}
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{m.house}</div>
                  <div style={{ fontSize: 10, color: '#86868B' }}>Casa Hogwarts</div>
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div style={{ ...cardS, display: 'flex', gap: 10 }}>
              {[
                { label: 'Proyectos', value: (m.rooms || []).length, color: '#007AFF' },
                { label: 'Retros', value: retroMetrics.length, color: '#5856D6' },
                { label: 'Accionables', value: allActions.length, color: '#34C759' },
                { label: 'Ausencias', value: (m.vacations || []).length, color: '#FF9500' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#86868B' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: PROJECTS ═══ */}
      {activeTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(m.rooms || []).length === 0 && (
            <p style={{ textAlign: 'center', color: '#C7C7CC', padding: 24, fontSize: 13 }}>Sin proyectos asignados</p>
          )}
          {(m.rooms || []).map(slug => {
            const room = rooms.find(r => r.slug === slug);
            const periods = myOrg.filter(o => o.sala === slug);
            const activePeriod = periods.find(p => {
              const s = p.start_date || '2000-01-01';
              const ed = p.end_date || '2099-12-31';
              return today >= s && today <= ed;
            });
            return (
              <div key={slug} style={cardS}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Icon name="FolderOpen" size={16} color="#007AFF" />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{room?.name || slug}</span>
                  <span style={{ fontSize: 9, color: '#86868B', background: '#F2F2F7', padding: '2px 6px', borderRadius: 5 }}>{room?.tipo || '—'}</span>
                  {activePeriod && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#007AFF' }}>{Math.round(activePeriod.dedication * 100)}%</span>
                  )}
                </div>
                {periods.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 24 }}>
                    {periods.map((p, i) => {
                      const isActive = today >= (p.start_date || '2000-01-01') && today <= (p.end_date || '2099-12-31');
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '3px 8px', borderRadius: 6, background: isActive ? '#007AFF08' : '#F9F9FB' }}>
                          <div style={{ width: 6, height: 6, borderRadius: 3, background: isActive ? '#007AFF' : '#C7C7CC' }} />
                          <span style={{ fontWeight: 600, color: isActive ? '#007AFF' : '#86868B' }}>{Math.round(p.dedication * 100)}%</span>
                          <span style={{ color: '#86868B' }}>{p.start_date ? fd(p.start_date) : 'Inicio'} → {p.end_date ? fd(p.end_date) : 'Indefinido'}</span>
                          {isActive && <span style={{ fontSize: 8, fontWeight: 700, color: '#34C759', marginLeft: 'auto' }}>ACTIVO</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 10, color: '#C7C7CC', paddingLeft: 24 }}>Sin periodos de dedicación configurados</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TAB: VACATIONS ═══ */}
      {activeTab === 'vacations' && (
        <div>
          {/* Summary */}
          <div style={{ ...cardS, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 6 }}>Vacaciones {yr}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <div><span style={{ color: '#86868B' }}>Total:</span> <strong>{vacTotal}</strong></div>
                <div><span style={{ color: '#86868B' }}>Usados:</span> <strong style={{ color: '#007AFF' }}>{vacUsed}</strong></div>
                <div><span style={{ color: '#86868B' }}>Pendientes:</span> <strong style={{ color: vacPending <= 5 ? '#FF3B30' : '#34C759' }}>{vacPending}</strong></div>
                {(m.prev_year_pending || 0) > 0 && (
                  <div><span style={{ color: '#86868B' }}>Año anterior:</span> <strong>{m.prev_year_pending}</strong></div>
                )}
              </div>
              {/* Progress bar */}
              <div style={{ height: 6, background: '#F2F2F7', borderRadius: 3, marginTop: 8 }}>
                <div style={{ width: `${Math.min(100, Math.round(vacUsed / vacTotal * 100))}%`, height: '100%', borderRadius: 3, background: vacUsed / vacTotal >= 0.8 ? '#34C759' : '#007AFF' }} />
              </div>
            </div>
          </div>

          {/* Absences by type */}
          <div style={{ ...cardS, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 8 }}>Ausencias por tipo</div>
            {Object.keys(absencesByType).length === 0 ? (
              <p style={{ fontSize: 11, color: '#C7C7CC' }}>Sin ausencias registradas en {yr}</p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(absencesByType).map(([type, count]) => {
                  const absType = ABSENCE_TYPES.find(t => t.id === type);
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: (absType?.color || '#86868B') + '12' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: absType?.color || '#86868B' }} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{absType?.label || type}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: absType?.color || '#86868B' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Absence list */}
          <div style={cardS}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 8 }}>Historial {yr}</div>
            {(m.vacations || []).filter(v => v.from && new Date(v.from).getFullYear() === yr).length === 0 ? (
              <p style={{ fontSize: 11, color: '#C7C7CC' }}>Sin registros</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(m.vacations || [])
                  .filter(v => v.from && new Date(v.from).getFullYear() === yr)
                  .sort((a, b) => (b.from || '').localeCompare(a.from || ''))
                  .map((v, i) => {
                    const absType = ABSENCE_TYPES.find(t => t.id === (v.type || 'vacaciones'));
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #F9F9FB', fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: absType?.color || '#86868B', flexShrink: 0 }} />
                        <span style={{ minWidth: 100, color: '#86868B' }}>{fd(v.from)} → {fd(v.to || v.from)}</span>
                        <span style={{ fontWeight: 600 }}>{absType?.label || v.type || 'Vacaciones'}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: ACTIONS ═══ */}
      {activeTab === 'actions' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, ...cardS, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FF9500' }}>{pendingActions.length}</div>
              <div style={{ fontSize: 10, color: '#86868B' }}>Pendientes</div>
            </div>
            <div style={{ flex: 1, ...cardS, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#34C759' }}>{doneActions.length}</div>
              <div style={{ fontSize: 10, color: '#86868B' }}>Completados</div>
            </div>
            <div style={{ flex: 1, ...cardS, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#007AFF' }}>{allActions.length}</div>
              <div style={{ fontSize: 10, color: '#86868B' }}>Total</div>
            </div>
          </div>

          {allActions.length === 0 ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 24 }}>
              <Icon name="CheckSquare" size={32} color="#C7C7CC" />
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 8 }}>Sin accionables asignados</p>
            </div>
          ) : (
            <div style={cardS}>
              {allActions.map(a => {
                const isDone = a.status === 'done' || a.status === 'archived';
                const room = rooms.find(r => r.slug === a.sala);
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F9F9FB', fontSize: 11 }}>
                    <Icon name={isDone ? 'CheckCircle2' : 'Circle'} size={14} color={isDone ? '#34C759' : '#C7C7CC'} />
                    <span style={{ flex: 1, fontWeight: 500, color: isDone ? '#86868B' : '#1D1D1F', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {a.text}
                    </span>
                    <span style={{ fontSize: 9, color: '#007AFF', background: '#007AFF10', padding: '1px 5px', borderRadius: 4 }}>{room?.name || a.sala}</span>
                    {a.date && <span style={{ fontSize: 9, color: '#86868B' }}>{fd(a.date)}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: RETROS ═══ */}
      {activeTab === 'retros' && (
        <div>
          {retroMetrics.length === 0 ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 24 }}>
              <Icon name="RotateCcw" size={32} color="#C7C7CC" />
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 8 }}>Sin participación en retrospectivas</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {retroMetrics.map((rm, i) => {
                const room = rooms.find(r => r.slug === rm.sala);
                return (
                  <div key={i} style={cardS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="RotateCcw" size={14} color="#5856D6" />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{room?.name || rm.sala}</span>
                      <span style={{ fontSize: 10, color: '#86868B' }}>{fd(rm.date)}</span>
                      {rm.score > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: rm.score >= 80 ? '#34C759' : rm.score >= 50 ? '#FF9500' : '#FF3B30' }}>
                          {rm.score}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, paddingLeft: 22, fontSize: 10, color: '#86868B' }}>
                      <span><strong style={{ color: '#007AFF' }}>{rm.notes}</strong> notas</span>
                      <span><strong style={{ color: '#34C759' }}>{rm.actions}</strong> acciones</span>
                      <span><strong style={{ color: '#5856D6' }}>{(rm.participant_names || []).length}</strong> participantes</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
