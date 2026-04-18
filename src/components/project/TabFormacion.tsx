// ═══ TAB FORMACIÓN — Gap detection + training action management ═══
import { useState, useMemo } from 'preact/hooks';
import type { Member, Skill, GapInfo } from '@app-types/index';
import { LEVEL_COLORS, LEVEL_LABELS, suggestActionType } from '@domain/skills';
import { saveSkillAction, deleteSkillAction } from '@data/skills';
import { Icon } from '@components/common/Icon';

interface SkillAction {
  id?: string; member_id: string; skill_id: string; sala: string;
  type: string; description: string; status: string;
  start_date?: string; target_date?: string; created_at?: string;
}

interface TabFormacionProps {
  team: Member[];
  gaps: GapInfo[];
  actions: unknown[];
  catalog: unknown[];
  skills: Skill[];
  sala: string;
  onRefresh: () => void;
}

// Load training catalog from CdC
async function loadTrainingCatalog(): Promise<Array<{ id: string; name: string; category: string; provider: string; duration_hours: number }>> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data } = await supabase.from('training_catalog').select('*').order('category,name');
    return data ?? [];
  } catch { return []; }
}

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 3, textTransform: 'uppercase' as const };
const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pendiente: { bg: '#FF950015', fg: '#FF9500', label: 'Pendiente' },
  en_curso: { bg: '#007AFF10', fg: '#007AFF', label: 'En curso' },
  completada: { bg: '#34C75915', fg: '#34C759', label: 'Completada' },
};
const ACTION_TYPES = ['mentoring', 'curso', 'práctica', 'certificación', 'autoformación', 'formacion'];

export function TabFormacion({ team, gaps, actions, catalog, skills, sala, onRefresh }: TabFormacionProps) {
  const [filter, setFilter] = useState<'all' | 'critical'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editAction, setEditAction] = useState<SkillAction | null>(null);
  const [form, setForm] = useState({ description: '', type: 'mentoring', status: 'pendiente', start_date: '', target_date: '', member_id: '', skill_id: '', catalog_id: '' });
  const [trainingCat, setTrainingCat] = useState<Array<{ id: string; name: string; category: string; provider: string; duration_hours: number }>>([]);
  const [delTarget, setDelTarget] = useState<SkillAction | null>(null);

  const actionsList = (actions || []) as SkillAction[];
  const criticalGaps = gaps.filter(g => g.gap >= 2);
  const displayGaps = filter === 'critical' ? criticalGaps : gaps;

  const getActionsForGap = (mid: string, sid: string) => actionsList.filter(a => a.member_id === mid && a.skill_id === sid);
  const getMember = (id: string) => team.find(m => m.id === id);
  const getSkill = (id: string) => skills.find(s => s.id === id);

  const openCreateFromGap = async (gap: GapInfo) => {
    if (!trainingCat.length) setTrainingCat(await loadTrainingCatalog());
    const suggested = suggestActionType(gap.gap);
    setForm({
      description: `${suggested} en ${gap.skill?.name || ''}`,
      type: suggested.toLowerCase().includes('curso') ? 'curso' : 'mentoring',
      status: 'pendiente', start_date: new Date().toISOString().slice(0, 10),
      target_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      member_id: gap.member.id, skill_id: gap.skill?.id || '', catalog_id: '',
    });
    setEditAction(null);
    setShowModal(true);
  };

  const openCreateManual = async () => {
    if (!trainingCat.length) setTrainingCat(await loadTrainingCatalog());
    setForm({ description: '', type: 'mentoring', status: 'pendiente', start_date: '', target_date: '', member_id: team[0]?.id || '', skill_id: '', catalog_id: '' });
    setEditAction(null);
    setShowModal(true);
  };

  const openEdit = async (a: SkillAction) => {
    if (!trainingCat.length) setTrainingCat(await loadTrainingCatalog());
    setForm({ description: a.description, type: a.type, status: a.status, start_date: a.start_date || '', target_date: a.target_date || '', member_id: a.member_id, skill_id: a.skill_id, catalog_id: '' });
    setEditAction(a);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.description.trim()) return;
    const payload: Record<string, unknown> = {
      sala, member_id: form.member_id, skill_id: form.skill_id,
      description: form.description, type: form.type, status: form.status,
      start_date: form.start_date || null, target_date: form.target_date || null,
    };
    if (editAction?.id) payload.id = editAction.id;
    await saveSkillAction(payload);
    setShowModal(false);
    onRefresh();
  };

  const handleStatusChange = async (a: SkillAction, status: string) => {
    await saveSkillAction({ ...a, status });
    onRefresh();
  };

  const handleDelete = async () => {
    if (!delTarget?.id) return;
    await deleteSkillAction(delTarget.id);
    setDelTarget(null);
    onRefresh();
  };

  // Select catalog → fill description
  const onSelectCatalog = (catId: string) => {
    const t = trainingCat.find(c => c.id === catId);
    if (t) setForm({ ...form, catalog_id: catId, description: t.name, type: 'curso' });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Plan de formación</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{gaps.length} gaps detectados · {actionsList.length} acciones · {(catalog as unknown[]).length} cursos</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'critical'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: filter === f ? 'none' : '1.5px solid #E5E5EA', background: filter === f ? '#1D1D1F' : '#FFF', color: filter === f ? '#FFF' : '#6E6E73' }}>
              {f === 'all' ? 'Todos' : 'Críticos'}
            </button>
          ))}
          <button onClick={openCreateManual}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="Plus" size={11} color="#FFF" /> Acción formativa
          </button>
        </div>
      </div>

      {/* ── GAPS ── */}
      <div style={{ ...cardS, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#FF3B30' }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Gaps detectados ({displayGaps.length})</span>
        </div>

        {displayGaps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#34C759' }}>
            <Icon name="CheckCircle2" size={28} color="#34C759" />
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{filter === 'critical' ? 'Sin gaps críticos' : '¡Equipo al 100%!'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {displayGaps.map((g, i) => {
              const existing = getActionsForGap(g.member.id, g.skill?.id || '');
              const hasAction = existing.length > 0;
              const statusColor = hasAction ? STATUS_COLORS[existing[0].status] || STATUS_COLORS.pendiente : null;
              return (
                <div key={`${g.member.id}-${g.skill?.id}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                    background: hasAction ? (statusColor?.bg || '#F9F9FB') : '#FFF',
                    border: `1px solid ${hasAction ? (statusColor?.fg || '#E5E5EA') + '30' : '#E5E5EA'}`,
                  }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: g.member.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {g.member.avatar || '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{g.member.name}</span>
                    <span style={{ fontSize: 11, color: '#007AFF', marginLeft: 6 }}>{g.skill?.name || '?'}</span>
                    <span style={{ fontSize: 10, color: '#86868B', marginLeft: 6 }}>{g.current}→{g.required}</span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: g.gap >= 2 ? '#FF3B3015' : '#FF950015', color: g.gap >= 2 ? '#FF3B30' : '#FF9500' }}>
                    Gap {g.gap}
                  </span>
                  {hasAction ? (
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusColor?.fg, cursor: 'pointer' }} onClick={() => openEdit(existing[0])}>
                      ✓ {statusColor?.label}
                    </span>
                  ) : (
                    <button onClick={() => openCreateFromGap(g)}
                      style={{ fontSize: 10, color: '#FF3B30', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      + Crear acción
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ACTIONS ── */}
      {actionsList.length > 0 && (
        <div style={{ ...cardS, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Icon name="BookOpen" size={14} color="#007AFF" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Acciones formativas ({actionsList.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actionsList.map(a => {
              const m = getMember(a.member_id);
              const sk = getSkill(a.skill_id);
              const st = STATUS_COLORS[a.status] || STATUS_COLORS.pendiente;
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#F9F9FB' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: m?.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {m?.avatar || '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{a.description}</div>
                    <div style={{ fontSize: 10, color: '#86868B' }}>
                      {m?.name || '?'} · {sk?.name || '?'} · {a.type}
                    </div>
                  </div>
                  {/* Status selector */}
                  <select value={a.status} onChange={e => handleStatusChange(a, (e.target as HTMLSelectElement).value)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${st.fg}30`, background: st.bg, color: st.fg, fontSize: 10, fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_curso">En curso</option>
                    <option value="completada">Completada</option>
                  </select>
                  {a.target_date && <span style={{ fontSize: 9, color: '#86868B' }}>📅 {new Date(a.target_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>}
                  <button onClick={() => openEdit(a)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="Edit" size={9} color="#007AFF" />
                  </button>
                  <button onClick={() => setDelTarget(a)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="X" size={9} color="#FF3B30" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{editAction ? 'Editar acción formativa' : 'Nueva acción formativa'}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* From catalog */}
              {trainingCat.length > 0 && (
                <div>
                  <label style={labelS}>Del catálogo (opcional)</label>
                  <select value={form.catalog_id} onChange={e => onSelectCatalog((e.target as HTMLSelectElement).value)} style={inputS}>
                    <option value="">— Seleccionar del catálogo —</option>
                    {trainingCat.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category}{t.provider ? ` · ${t.provider}` : ''}{t.duration_hours ? ` · ${t.duration_hours}h` : ''})</option>)}
                  </select>
                </div>
              )}

              <div><label style={labelS}>Descripción *</label><input value={form.description} onInput={e => setForm({ ...form, description: (e.target as HTMLInputElement).value })} style={inputS} /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Persona</label>
                  <select value={form.member_id} onChange={e => setForm({ ...form, member_id: (e.target as HTMLSelectElement).value })} style={inputS}>
                    {team.map(m => <option key={m.id} value={m.id}>{m.avatar} {m.name}</option>)}
                  </select>
                </div>
                <div><label style={labelS}>Habilidad</label>
                  <select value={form.skill_id} onChange={e => setForm({ ...form, skill_id: (e.target as HTMLSelectElement).value })} style={inputS}>
                    <option value="">— Seleccionar —</option>
                    {skills.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Tipo</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: (e.target as HTMLSelectElement).value })} style={inputS}>
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div><label style={labelS}>Fecha inicio</label><input type="date" value={form.start_date} onInput={e => setForm({ ...form, start_date: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Fecha reevaluación</label><input type="date" value={form.target_date} onInput={e => setForm({ ...form, target_date: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              </div>

              <div><label style={labelS}>Estado</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: (e.target as HTMLSelectElement).value })} style={inputS}>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_curso">En curso</option>
                  <option value="completada">Completada</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleSave} disabled={!form.description.trim()} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: form.description.trim() ? 1 : 0.4 }}>
                {editAction ? 'Guardar' : 'Crear acción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {delTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 15100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDelTarget(null)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 380, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)', textAlign: 'center' }}>
            <Icon name="AlertTriangle" size={28} color="#FF3B30" />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Eliminar acción</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginTop: 6 }}>Se eliminará "{delTarget.description}"</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setDelTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#FF3B30', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
