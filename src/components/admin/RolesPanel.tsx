// ═══ ROLES PANEL — Roles, Skills & Training management ═══
import { useState, useEffect } from 'preact/hooks';
import type { Member } from '@app-types/index';
import { loadTeamMembers, saveTeamMember } from '@data/team';
import { Icon } from '@components/common/Icon';

// ── Data helpers ──
async function sb() { return (await import('../../data/supabase')).supabase; }

async function loadRoles(): Promise<Array<{ id: string; name: string }>> {
  try { const s = await sb(); const { data } = await s.from('admin_roles').select('*').order('name'); return data ?? []; } catch { return []; }
}
async function saveRole(name: string) { try { const s = await sb(); await s.from('admin_roles').insert({ name }); } catch {} }
async function deleteRole(name: string) { try { const s = await sb(); await s.from('admin_roles').delete().eq('name', name); } catch {} }

// Training catalog
interface Training { id: string; name: string; provider: string; duration_hours: number; type: string; category: string; }
async function loadTraining(): Promise<Training[]> {
  try { const s = await sb(); const { data } = await s.from('training_catalog').select('*').order('name'); return data ?? []; } catch { return []; }
}
async function saveTraining(t: Partial<Training>): Promise<Training | null> {
  try {
    const s = await sb();
    if (t.id) { const { data } = await s.from('training_catalog').update(t).eq('id', t.id).select().single(); return data; }
    const { data } = await s.from('training_catalog').insert(t).select().single(); return data;
  } catch { return null; }
}
async function deleteTraining(id: string) { try { const s = await sb(); await s.from('training_catalog').delete().eq('id', id); } catch {} }

// Role ↔ Training
interface RoleTraining { id: string; role_label: string; training_id: string; is_mandatory: boolean; }
async function loadRoleTraining(): Promise<RoleTraining[]> {
  try { const s = await sb(); const { data } = await s.from('role_training').select('*'); return data ?? []; } catch { return []; }
}
async function addRoleTraining(role_label: string, training_id: string, is_mandatory: boolean) {
  try { const s = await sb(); await s.from('role_training').insert({ role_label, training_id, is_mandatory }); } catch {}
}
async function removeRoleTraining(id: string) { try { const s = await sb(); await s.from('role_training').delete().eq('id', id); } catch {} }

// ── Styles ──
const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: 0.3 };
const BUILTIN_ROLES = ['Service Manager', 'Jefe de proyecto', 'Scrum Master', 'Product Owner', 'Consultor', 'Analista Funcional', 'Desarrollador/a', 'QA / Tester', 'DevOps', 'Tech Lead', 'Diseñador/a'];
const ROLE_COLORS: Record<string, string> = { 'Service Manager': '#FF3B30', 'Jefe de proyecto': '#FF9500', 'Scrum Master': '#007AFF', 'Product Owner': '#5856D6', 'Consultor': '#34C759', 'Analista Funcional': '#AF52DE', 'Desarrollador/a': '#00C7BE', 'QA / Tester': '#FF2D55', 'DevOps': '#5AC8FA', 'Tech Lead': '#FF6482' };

type SubTab = 'roles' | 'skills' | 'training';
type ViewMode = 'grid' | 'table';

export function RolesPanel() {
  const [subTab, setSubTab] = useState<SubTab>('roles');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [training, setTraining] = useState<Training[]>([]);
  const [roleTraining, setRoleTraining] = useState<RoleTraining[]>([]);
  const [loading, setLoading] = useState(true);

  // Role CRUD
  const [newRole, setNewRole] = useState('');
  const [editRole, setEditRole] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Training CRUD
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [editTraining, setEditTraining] = useState<Training | null>(null);
  const [tForm, setTForm] = useState({ name: '', provider: '', duration_hours: 0, type: 'recommended', category: 'technical' });

  // Link training to role
  const [linkRole, setLinkRole] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadTeamMembers(), loadRoles(), loadTraining(), loadRoleTraining()]).then(([mR, r, t, rt]) => {
      if (mR.ok) setMembers(mR.data);
      setRoles(r);
      setTraining(t);
      setRoleTraining(rt);
      setLoading(false);
    });
  }, []);

  const allRoleNames = [...new Set([...BUILTIN_ROLES, ...roles.map(r => r.name), ...members.map(m => m.role_label).filter(Boolean) as string[]])];
  const byRole = (role: string) => members.filter(m => m.role_label === role);
  const roleColor = (role: string) => ROLE_COLORS[role] || '#5856D6';
  const trainingForRole = (role: string) => roleTraining.filter(rt => rt.role_label === role).map(rt => ({ ...rt, training: training.find(t => t.id === rt.training_id) })).filter(rt => rt.training);

  const handleAddRole = async () => {
    const t = newRole.trim();
    if (!t || allRoleNames.includes(t)) return;
    await saveRole(t);
    setRoles(prev => [...prev, { id: t, name: t }]);
    setNewRole('');
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget) return;
    await deleteRole(deleteTarget);
    setRoles(prev => prev.filter(r => r.name !== deleteTarget));
    setDeleteTarget(null); setDeleteConfirm('');
  };

  const handleEditRole = async (oldName: string) => {
    if (!editRoleName.trim() || editRoleName === oldName) { setEditRole(null); return; }
    await deleteRole(oldName);
    await saveRole(editRoleName.trim());
    setRoles(prev => prev.map(r => r.name === oldName ? { ...r, name: editRoleName.trim() } : r));
    // Update members with this role
    for (const m of members.filter(x => x.role_label === oldName)) {
      const u = { ...m, role_label: editRoleName.trim() };
      await saveTeamMember(u);
      setMembers(prev => prev.map(x => x.id === m.id ? u : x));
    }
    setEditRole(null);
  };

  const handleSaveTraining = async () => {
    if (!tForm.name.trim()) return;
    const saved = await saveTraining(editTraining ? { ...tForm, id: editTraining.id } : tForm);
    if (saved) {
      if (editTraining) setTraining(prev => prev.map(t => t.id === editTraining.id ? saved : t));
      else setTraining(prev => [...prev, saved]);
    }
    setShowTrainingForm(false); setEditTraining(null);
    setTForm({ name: '', provider: '', duration_hours: 0, type: 'recommended', category: 'technical' });
  };

  const handleDeleteTraining = async (id: string) => {
    await deleteTraining(id);
    setTraining(prev => prev.filter(t => t.id !== id));
    setRoleTraining(prev => prev.filter(rt => rt.training_id !== id));
  };

  const handleLinkTraining = async (trainingId: string, isMandatory: boolean) => {
    if (!linkRole) return;
    await addRoleTraining(linkRole, trainingId, isMandatory);
    const updated = await loadRoleTraining();
    setRoleTraining(updated);
  };

  const handleUnlinkTraining = async (rtId: string) => {
    await removeRoleTraining(rtId);
    setRoleTraining(prev => prev.filter(rt => rt.id !== rtId));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      {/* Header + sub-tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Roles, Habilidades y Formación</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['roles', 'training'] as SubTab[]).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: subTab === t ? '#1D1D1F' : '#F2F2F7', color: subTab === t ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {t === 'roles' ? 'Roles' : 'Formación'}
            </button>
          ))}
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Icon name={viewMode === 'grid' ? 'List' : 'Grid3X3'} size={13} color="#86868B" />
          </button>
        </div>
      </div>

      {/* ═══ ROLES ═══ */}
      {subTab === 'roles' && (
        <div>
          {/* Add role */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={newRole} onInput={e => setNewRole((e.target as HTMLInputElement).value)} onKeyDown={e => e.key === 'Enter' && handleAddRole()}
              placeholder="Nombre del nuevo rol…" style={{ ...inputS, flex: 1 }} />
            <button onClick={handleAddRole} disabled={!newRole.trim()}
              style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: newRole.trim() ? 1 : 0.4, whiteSpace: 'nowrap' }}>
              <Icon name="Plus" size={12} color="#FFF" /> Añadir rol
            </button>
          </div>

          {/* Grid / Table view */}
          {viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
              {allRoleNames.map(role => {
                const mems = byRole(role);
                const color = roleColor(role);
                const isBuiltin = BUILTIN_ROLES.includes(role);
                const isExp = expanded === role;
                const rTraining = trainingForRole(role);
                return (
                  <div key={role} style={{ ...cardS, borderColor: isExp ? color : '#E5E5EA', overflow: 'hidden' }}>
                    <div onClick={() => setExpanded(isExp ? null : role)}
                      style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color }}>{role.charAt(0)}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editRole === role ? (
                          <input value={editRoleName} onInput={e => setEditRoleName((e.target as HTMLInputElement).value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleEditRole(role); if (e.key === 'Escape') setEditRole(null); }}
                            onBlur={() => handleEditRole(role)} autoFocus
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 13, fontWeight: 700, border: '1px solid #007AFF', borderRadius: 6, padding: '2px 6px', outline: 'none', width: '100%' }} />
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</div>
                        )}
                        <div style={{ fontSize: 11, color: mems.length > 0 ? color : '#C7C7CC', fontWeight: 600, marginTop: 1 }}>
                          {mems.length} persona{mems.length !== 1 ? 's' : ''}
                          {rTraining.length > 0 && <span style={{ color: '#86868B', fontWeight: 400 }}> · {rTraining.length} formación</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        {!isBuiltin && (
                          <>
                            <button onClick={() => { setEditRole(role); setEditRoleName(role); }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="Edit" size={10} color="#007AFF" />
                            </button>
                            <button onClick={() => { setDeleteTarget(role); setDeleteConfirm(''); }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="Trash2" size={10} color="#FF3B30" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ borderTop: '1px solid #F2F2F7', padding: '10px 14px' }}>
                        {/* Members with this role */}
                        {mems.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>Personas</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {mems.map(m => (
                                <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: color + '10', color, padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                                  {m.avatar || '👤'} {m.name.split(' ')[0]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Training for this role */}
                        {rTraining.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>Formación</div>
                            {rTraining.map(rt => (
                              <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: rt.is_mandatory ? '#FF3B30' : '#34C759', background: rt.is_mandatory ? '#FF3B3012' : '#34C75912', padding: '1px 5px', borderRadius: 4 }}>
                                  {rt.is_mandatory ? 'Oblig.' : 'Recom.'}
                                </span>
                                <span style={{ flex: 1 }}>{rt.training?.name}</span>
                                <button onClick={() => handleUnlinkTraining(rt.id)} style={{ border: 'none', background: 'none', color: '#C7C7CC', cursor: 'pointer', fontSize: 10 }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Link training button */}
                        <button onClick={() => setLinkRole(linkRole === role ? null : role)}
                          style={{ fontSize: 10, color: '#007AFF', background: '#007AFF10', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                          + Vincular formación
                        </button>
                        {linkRole === role && (
                          <div style={{ marginTop: 8, padding: 8, background: '#F9F9FB', borderRadius: 8 }}>
                            {training.filter(t => !rTraining.some(rt => rt.role_label === role && rt.training_id === t.id)).map(t => (
                              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                                <span style={{ flex: 1 }}>{t.name}</span>
                                <button onClick={() => handleLinkTraining(t.id, true)} style={{ fontSize: 9, border: '1px solid #FF3B3030', borderRadius: 4, background: '#FFF', padding: '2px 6px', cursor: 'pointer', color: '#FF3B30' }}>Oblig.</button>
                                <button onClick={() => handleLinkTraining(t.id, false)} style={{ fontSize: 9, border: '1px solid #34C75930', borderRadius: 4, background: '#FFF', padding: '2px 6px', cursor: 'pointer', color: '#34C759' }}>Recom.</button>
                              </div>
                            ))}
                            {training.filter(t => !rTraining.some(rt => rt.role_label === role && rt.training_id === t.id)).length === 0 && (
                              <p style={{ fontSize: 10, color: '#C7C7CC', textAlign: 'center' }}>Toda la formación ya está vinculada</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table view */
            <div style={{ ...cardS, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {['Rol', 'Personas', 'Formaciones', 'Tipo', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', borderBottom: '2px solid #E5E5EA', textAlign: h === 'Rol' ? 'left' : 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRoleNames.map((role, i) => {
                    const mems = byRole(role);
                    const color = roleColor(role);
                    const isBuiltin = BUILTIN_ROLES.includes(role);
                    const rT = trainingForRole(role);
                    return (
                      <tr key={role} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #F2F2F7', fontWeight: 700 }}>
                          <span style={{ color }}>{role.charAt(0)}</span> {role}
                        </td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600, color }}>{mems.length}</td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>{rT.length || '—'}</td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                          <span style={{ fontSize: 9, color: isBuiltin ? '#86868B' : '#5856D6', background: isBuiltin ? '#F2F2F7' : '#5856D610', padding: '2px 6px', borderRadius: 4 }}>{isBuiltin ? 'Builtin' : 'Custom'}</span>
                        </td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                          {!isBuiltin && (
                            <button onClick={() => { setDeleteTarget(role); setDeleteConfirm(''); }}
                              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                              <Icon name="Trash2" size={10} color="#FF3B30" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ TRAINING ═══ */}
      {subTab === 'training' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: '#86868B' }}>{training.length} formaciones en catálogo</p>
            <button onClick={() => { setTForm({ name: '', provider: '', duration_hours: 0, type: 'recommended', category: 'technical' }); setEditTraining(null); setShowTrainingForm(true); }}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="Plus" size={12} color="#FFF" /> Nueva formación
            </button>
          </div>

          <div style={{ ...cardS, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Formación', 'Proveedor', 'Horas', 'Tipo', 'Categoría', 'Roles vinculados', ''].map(h => (
                    <th key={h} style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', borderBottom: '2px solid #E5E5EA', textAlign: h === 'Formación' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {training.map((t, i) => {
                  const linkedRoles = roleTraining.filter(rt => rt.training_id === t.id);
                  return (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #F2F2F7', fontWeight: 600 }}>{t.name}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', color: '#6E6E73', fontSize: 11 }}>{t.provider || '—'}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600 }}>{t.duration_hours || '—'}h</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: t.type === 'mandatory' ? '#FF3B30' : '#34C759', background: t.type === 'mandatory' ? '#FF3B3012' : '#34C75912', padding: '2px 6px', borderRadius: 4 }}>
                          {t.type === 'mandatory' ? 'Obligatoria' : 'Recomendada'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 10, color: '#6E6E73' }}>{t.category}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                        {linkedRoles.length > 0 ? (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {linkedRoles.map(rt => (
                              <span key={rt.id} style={{ fontSize: 8, background: '#007AFF10', color: '#007AFF', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>{rt.role_label}</span>
                            ))}
                          </div>
                        ) : <span style={{ color: '#D1D1D6' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                          <button onClick={() => { setTForm({ name: t.name, provider: t.provider, duration_hours: t.duration_hours, type: t.type, category: t.category }); setEditTraining(t); setShowTrainingForm(true); }}
                            style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="Edit" size={10} color="#007AFF" />
                          </button>
                          <button onClick={() => handleDeleteTraining(t.id)}
                            style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="Trash2" size={10} color="#FF3B30" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {training.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#C7C7CC' }}>
                <Icon name="BookOpen" size={24} color="#E5E5EA" />
                <p style={{ fontSize: 12, marginTop: 6 }}>Sin formaciones. Crea la primera.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Training form modal ── */}
      {showTrainingForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowTrainingForm(false)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editTraining ? 'Editar formación' : 'Nueva formación'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={labelS}>Nombre *</label><input value={tForm.name} onInput={e => setTForm({ ...tForm, name: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Proveedor</label><input value={tForm.provider} onInput={e => setTForm({ ...tForm, provider: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Horas</label><input type="number" value={tForm.duration_hours} onInput={e => setTForm({ ...tForm, duration_hours: parseInt((e.target as HTMLInputElement).value) || 0 })} style={inputS} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Tipo</label>
                  <select value={tForm.type} onChange={e => setTForm({ ...tForm, type: (e.target as HTMLSelectElement).value })} style={inputS}>
                    <option value="recommended">Recomendada</option>
                    <option value="mandatory">Obligatoria</option>
                  </select>
                </div>
                <div><label style={labelS}>Categoría</label>
                  <select value={tForm.category} onChange={e => setTForm({ ...tForm, category: (e.target as HTMLSelectElement).value })} style={inputS}>
                    <option value="technical">Técnica</option>
                    <option value="functional">Funcional</option>
                    <option value="soft">Soft skill</option>
                    <option value="tool">Herramienta</option>
                    <option value="certification">Certificación</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowTrainingForm(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleSaveTraining} disabled={!tForm.name.trim()} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: tForm.name.trim() ? 1 : 0.4 }}>
                {editTraining ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete role modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteTarget(null)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Icon name="AlertTriangle" size={32} color="#FF3B30" />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Eliminar rol</h3>
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 6 }}>
                Se eliminará <strong>{deleteTarget}</strong>. {byRole(deleteTarget).length > 0 && `${byRole(deleteTarget).length} persona(s) con este rol se quedarán sin rol asignado.`}
                {trainingForRole(deleteTarget).length > 0 && ` ${trainingForRole(deleteTarget).length} formación(es) vinculadas se desvincularán.`}
              </p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Escribe el nombre del rol para confirmar</label>
              <input value={deleteConfirm} onInput={e => setDeleteConfirm((e.target as HTMLInputElement).value)}
                placeholder={deleteTarget} style={{ ...inputS, borderColor: deleteConfirm === deleteTarget ? '#FF3B30' : '#E5E5EA' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleDeleteRole} disabled={deleteConfirm !== deleteTarget}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: deleteConfirm === deleteTarget ? '#FF3B30' : '#E5E5EA', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
