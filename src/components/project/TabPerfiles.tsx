// ═══ TAB PERFILES — Service profiles with skills from catalog ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { SkillProfile, Skill, ProfileSkill } from '@app-types/index';
import { LEVEL_COLORS, LEVEL_ICONS, LEVEL_LABELS } from '@domain/skills';
import { createOrUpdateProfile } from '@services/skills';
import { deleteSkillProfile, saveProfileSkill, deleteProfileSkill, loadCatalogSkills } from '@data/skills';
import { Icon } from '@components/common/Icon';

interface TabPerfilesProps {
  profiles: SkillProfile[];
  skills: Skill[];
  profSkills: ProfileSkill[];
  categories: string[];
  sala: string;
  onRefresh: () => void;
}

// Load admin roles for profile name suggestions
async function loadAdminRoles(): Promise<string[]> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data } = await supabase.from('admin_roles').select('name').order('name');
    return (data ?? []).map((r: { name: string }) => r.name);
  } catch { return []; }
}

interface CatSkill { id: string; name: string; category: string; icon: string; description: string; }

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 3, textTransform: 'uppercase' as const };
const PROFILE_ICONS = ['🧑‍💻', '👨‍💼', '🧑‍🔬', '🧑‍🎨', '🧑‍🏫', '🛡️', '⚙️', '📋', '🎯', '🔧', '📊', '🧠'];

export function TabPerfiles({ profiles, skills, profSkills, categories, sala, onRefresh }: TabPerfilesProps) {
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [catalogSkills, setCatalogSkills] = useState<CatSkill[]>([]);
  const [editProfile, setEditProfile] = useState<Partial<SkillProfile> | null>(null);
  const [editReqs, setEditReqs] = useState<Array<{ skill_id: string; required_level: number }>>([]);
  const [saving, setSaving] = useState(false);

  // Delete
  const [delTarget, setDelTarget] = useState<SkillProfile | null>(null);
  const [delConfirm, setDelConfirm] = useState('');

  // Search for new profile
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAdminRoles().then(setRoleNames);
    loadCatalogSkills().then(r => { if (r.ok) setCatalogSkills(r.data); });
  }, []);

  const projectProfiles = profiles.filter(p => p.sala === sala);
  const reqs = (pid: string) => profSkills.filter(ps => ps.profile_id === pid);

  // All available skills: catalog + project-specific
  const allSkills = useMemo(() => {
    const seen = new Set(catalogSkills.map(s => s.name));
    const extras = skills.filter(s => !seen.has(s.name));
    return [...catalogSkills.map(s => ({ id: s.id, name: s.name, category: s.category, icon: s.icon })), ...extras];
  }, [catalogSkills, skills]);

  // Skill categories from catalog
  const skillCategories = useMemo(() => [...new Set(allSkills.map(s => s.category))].sort(), [allSkills]);

  const openCreate = (name?: string) => {
    setEditProfile({ name: name || '', description: '', fte: 1, color: '#007AFF', icon: '🧑‍💻' });
    setEditReqs([]);
    setSearch('');
  };

  const openEdit = (p: SkillProfile) => {
    setEditProfile({ ...p });
    setEditReqs(reqs(p.id).map(r => ({ skill_id: r.skill_id, required_level: r.required_level })));
  };

  const handleSave = async () => {
    if (!editProfile?.name?.trim()) return;
    setSaving(true);
    const result = await createOrUpdateProfile(editProfile, sala);
    if (result.ok) {
      const pid = result.data.id;
      // Save all profile_skills
      const oldReqs = editProfile.id ? reqs(editProfile.id) : [];
      // Delete removed
      for (const old of oldReqs) {
        if (!editReqs.some(r => r.skill_id === old.skill_id)) {
          await deleteProfileSkill(pid, old.skill_id);
        }
      }
      // Upsert current
      for (const r of editReqs) {
        await saveProfileSkill({ profile_id: pid, skill_id: r.skill_id, required_level: r.required_level });
      }
    }
    setSaving(false);
    setEditProfile(null);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!delTarget || delConfirm !== delTarget.name) return;
    await deleteSkillProfile(delTarget.id);
    setDelTarget(null); setDelConfirm('');
    onRefresh();
  };

  const setReqLevel = (skillId: string, level: number) => {
    setEditReqs(prev => {
      const existing = prev.find(r => r.skill_id === skillId);
      if (existing) return prev.map(r => r.skill_id === skillId ? { ...r, required_level: level } : r);
      return [...prev, { skill_id: skillId, required_level: level }];
    });
  };

  const removeReq = (skillId: string) => {
    setEditReqs(prev => prev.filter(r => r.skill_id !== skillId));
  };

  // Filtered role suggestions
  const suggestions = search.trim()
    ? roleNames.filter(n => n.toLowerCase().includes(search.toLowerCase()) && !projectProfiles.some(p => p.name === n))
    : [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Perfiles del servicio</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>Roles requeridos y habilidades necesarias</p>
        </div>
        <button onClick={() => openCreate()}
          style={{ padding: '7px 16px', borderRadius: 9, border: 'none', background: '#1D1D1F', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#FFF', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="Plus" size={12} color="#FFF" /> Perfil
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 10, color: '#86868B' }}>
        {[4, 3, 2, 1].map(l => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontWeight: 800, color: LEVEL_COLORS[l], background: LEVEL_COLORS[l] + '15', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{l}</span>
            {LEVEL_LABELS[l]}
          </span>
        ))}
      </div>

      {/* Profile cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {projectProfiles.map(p => {
          const pReqs = reqs(p.id);
          return (
            <div key={p.id} style={{ ...cardS, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: (p.color || '#007AFF') + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {p.icon || '🧑‍💻'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#86868B' }}>{p.description || '—'} · {p.fte} FTE</div>
                </div>
                <button onClick={() => openEdit(p)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Edit" size={12} color="#007AFF" />
                </button>
                <button onClick={() => { setDelTarget(p); setDelConfirm(''); }}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Trash2" size={12} color="#FF3B30" />
                </button>
              </div>

              {pReqs.length === 0 ? (
                <p style={{ fontSize: 11, color: '#C7C7CC', fontStyle: 'italic', padding: '8px 0' }}>Sin habilidades asignadas</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {pReqs.map(r => {
                    const sk = allSkills.find(s => s.id === r.skill_id);
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: '#F9F9FB' }}>
                        <span style={{ fontSize: 13 }}>{sk?.icon || '📘'}</span>
                        <span style={{ fontSize: 12, flex: 1, fontWeight: 500 }}>{sk?.name || '?'}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLORS[r.required_level], background: LEVEL_COLORS[r.required_level] + '15', padding: '2px 8px', borderRadius: 5 }}>
                          {LEVEL_ICONS[r.required_level]} {LEVEL_LABELS[r.required_level]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {projectProfiles.length === 0 && (
        <div style={{ ...cardS, padding: 32, textAlign: 'center' }}>
          <Icon name="Target" size={32} color="#E5E5EA" />
          <p style={{ fontSize: 13, color: '#86868B', marginTop: 8 }}>Sin perfiles. Crea el primero para definir los roles del servicio.</p>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {editProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setEditProfile(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
              {editProfile.id ? 'Editar perfil' : 'Nuevo perfil'}
            </h3>

            {/* Name with role search */}
            <div style={{ marginBottom: 10, position: 'relative' }}>
              <label style={labelS}>Nombre del perfil *</label>
              <input value={editProfile.name || ''} onInput={e => { const v = (e.target as HTMLInputElement).value; setEditProfile({ ...editProfile, name: v }); setSearch(v); }}
                placeholder="Buscar en roles del catálogo…" style={inputS} />
              {suggestions.length > 0 && !editProfile.id && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#FFF', borderRadius: 10, border: '1px solid #E5E5EA', boxShadow: '0 8px 24px #0002', maxHeight: 150, overflowY: 'auto' }}>
                  {suggestions.map(s => (
                    <button key={s} onClick={() => { setEditProfile({ ...editProfile, name: s }); setSearch(''); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelS}>Descripción</label>
              <input value={editProfile.description || ''} onInput={e => setEditProfile({ ...editProfile, description: (e.target as HTMLInputElement).value })}
                placeholder="Opcional" style={inputS} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelS}>FTE</label>
                <input type="number" step="0.25" min="0.25" max="5" value={editProfile.fte || 1}
                  onInput={e => setEditProfile({ ...editProfile, fte: parseFloat((e.target as HTMLInputElement).value) || 1 })} style={inputS} />
              </div>
              <div>
                <label style={labelS}>Color</label>
                <input type="color" value={editProfile.color || '#007AFF'}
                  onChange={e => setEditProfile({ ...editProfile, color: (e.target as HTMLInputElement).value })}
                  style={{ width: '100%', height: 36, border: '1.5px solid #E5E5EA', borderRadius: 10, cursor: 'pointer', background: '#F9F9FB' }} />
              </div>
              <div>
                <label style={labelS}>Icono</label>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {PROFILE_ICONS.map(ic => (
                    <button key={ic} onClick={() => setEditProfile({ ...editProfile, icon: ic })}
                      style={{ width: 28, height: 28, borderRadius: 6, border: (editProfile.icon || '🧑‍💻') === ic ? '2px solid #007AFF' : '1px solid #E5E5EA', background: '#FFF', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Skills + Levels ── */}
            <div style={{ borderTop: '1px solid #F2F2F7', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ ...labelS, margin: 0 }}>Habilidades requeridas</label>
                <div style={{ display: 'flex', gap: 6, fontSize: 9, color: '#86868B' }}>
                  {[1, 2, 3, 4].map(l => <span key={l} style={{ color: LEVEL_COLORS[l], fontWeight: 700 }}>{l}={LEVEL_LABELS[l]}</span>)}
                </div>
              </div>

              {/* Skills grouped by category */}
              {skillCategories.map(cat => {
                const catSkills = allSkills.filter(s => s.category === cat);
                if (catSkills.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 4 }}>{cat}</div>
                    {catSkills.map(sk => {
                      const req = editReqs.find(r => r.skill_id === sk.id);
                      return (
                        <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #F9F9FB' }}>
                          <span style={{ fontSize: 14 }}>{sk.icon || '📘'}</span>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: req ? 600 : 400, color: req ? '#1D1D1F' : '#AEAEB2' }}>{sk.name}</span>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[1, 2, 3, 4].map(l => (
                              <button key={l} onClick={() => req?.required_level === l ? removeReq(sk.id) : setReqLevel(sk.id, l)}
                                style={{
                                  width: 26, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  border: req?.required_level === l ? 'none' : '1.5px solid #E5E5EA',
                                  background: req?.required_level === l ? LEVEL_COLORS[l] : '#FFF',
                                  color: req?.required_level === l ? '#FFF' : '#C7C7CC',
                                }}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {allSkills.length === 0 && (
                <p style={{ fontSize: 11, color: '#C7C7CC', textAlign: 'center', padding: 12 }}>Sin habilidades en el catálogo. Créalas en Centro de Control → Habilidades.</p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {editProfile.id && (
                <button onClick={() => { setDelTarget(editProfile as SkillProfile); setDelConfirm(''); setEditProfile(null); }}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #FF3B30', background: '#FFF', color: '#FF3B30', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Eliminar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setEditProfile(null)}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!editProfile.name?.trim() || saving}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!editProfile.name?.trim() || saving) ? 0.5 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
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
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Icon name="AlertTriangle" size={32} color="#FF3B30" />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Eliminar perfil</h3>
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 6 }}>
                Se eliminará <strong>{delTarget.name}</strong> y todas sus habilidades requeridas.
              </p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Escribe el nombre para confirmar</label>
              <input value={delConfirm} onInput={e => setDelConfirm((e.target as HTMLInputElement).value)}
                placeholder={delTarget.name} style={{ ...inputS, borderColor: delConfirm === delTarget.name ? '#FF3B30' : '#E5E5EA' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDelTarget(null)}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={delConfirm !== delTarget.name}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: delConfirm === delTarget.name ? '#FF3B30' : '#E5E5EA', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
