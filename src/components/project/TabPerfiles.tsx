// ═══ TAB PERFILES — Profile CRUD + skill-level requirements ═══
import { useState } from 'preact/hooks';
import type { SkillProfile, Skill, ProfileSkill } from '@app-types/index';
import { LEVEL_COLORS, LEVEL_ICONS, LEVEL_LABELS } from '@domain/skills';
import { createOrUpdateProfile, createOrUpdateSkill } from '@services/skills';
import { deleteSkillProfile } from '@data/skills';
import { Icon } from '@components/common/Icon';

interface TabPerfilesProps {
  profiles: SkillProfile[];
  skills: Skill[];
  profSkills: ProfileSkill[];
  categories: string[];
  sala: string;
  onRefresh: () => void;
}

export function TabPerfiles({ profiles, skills, profSkills, categories, sala, onRefresh }: TabPerfilesProps) {
  const [editProfile, setEditProfile] = useState<Partial<SkillProfile> | null>(null);
  const [editSkill, setEditSkill] = useState<Partial<Skill> | null>(null);

  const projectProfiles = profiles.filter(p => p.sala === sala || !(p as any)._fromMaestro);

  const handleSaveProfile = async () => {
    if (!editProfile?.name) return;
    await createOrUpdateProfile(editProfile, sala);
    setEditProfile(null);
    onRefresh();
  };

  const handleDeleteProfile = async (id: string) => {
    await deleteSkillProfile(id);
    onRefresh();
  };

  const handleSaveSkill = async () => {
    if (!editSkill?.name) return;
    await createOrUpdateSkill(editSkill, sala);
    setEditSkill(null);
    onRefresh();
  };

  const reqs = (pid: string) => profSkills.filter(ps => ps.profile_id === pid);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Perfiles del servicio</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>Roles requeridos y habilidades necesarias</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setEditSkill({ name: '', category: categories[0] || 'técnica', icon: '📘' })}
            style={{ padding: '7px 14px', borderRadius: 9, border: '1.5px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
            + Habilidad
          </button>
          <button onClick={() => setEditProfile({ name: '', description: '', fte: 1, color: '#007AFF', icon: '🧑‍💻' })}
            style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: '#1D1D1F', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#FFF' }}>
            + Perfil
          </button>
        </div>
      </div>

      {/* Profile cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {projectProfiles.map(p => {
          const pReqs = reqs(p.id);
          return (
            <div key={p.id} style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {p.icon || '🧑‍💻'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#86868B' }}>{p.description || '—'} · {p.fte} FTE</div>
                </div>
                <button onClick={() => setEditProfile({ ...p })}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#86868B' }}>✏️</button>
                <button onClick={() => handleDeleteProfile(p.id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#FF3B30' }}>🗑</button>
              </div>

              {/* Required skills */}
              {pReqs.length === 0 ? (
                <p style={{ fontSize: 11, color: '#C7C7CC', fontStyle: 'italic', padding: '8px 0' }}>Sin habilidades asignadas</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {pReqs.map(r => {
                    const sk = skills.find(s => s.id === r.skill_id);
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                        <span style={{ fontSize: 11, flex: 1 }}>{sk?.icon || '📘'} {sk?.name || '?'}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLORS[r.required_level], background: LEVEL_COLORS[r.required_level] + '15', padding: '2px 6px', borderRadius: 5 }}>
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

      {/* Edit Profile Modal */}
      {editProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={() => setEditProfile(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.18)', backdropFilter: 'blur(8px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 12px 48px rgba(0,0,0,.12)', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editProfile.id ? 'Editar perfil' : 'Nuevo perfil'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={editProfile.name || ''} onInput={e => setEditProfile({ ...editProfile, name: (e.target as HTMLInputElement).value })}
                placeholder="Nombre del perfil"
                style={{ border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <input value={editProfile.description || ''} onInput={e => setEditProfile({ ...editProfile, description: (e.target as HTMLInputElement).value })}
                placeholder="Descripción (opcional)"
                style={{ border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#86868B', display: 'block', marginBottom: 3 }}>FTE</label>
                  <input type="number" step="0.25" min="0.25" max="2" value={editProfile.fte || 1}
                    onInput={e => setEditProfile({ ...editProfile, fte: parseFloat((e.target as HTMLInputElement).value) || 1 })}
                    style={{ width: '100%', border: '1.5px solid #E5E5EA', borderRadius: 9, padding: '8px', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#86868B', display: 'block', marginBottom: 3 }}>Color</label>
                  <input type="color" value={editProfile.color || '#007AFF'}
                    onChange={e => setEditProfile({ ...editProfile, color: (e.target as HTMLInputElement).value })}
                    style={{ width: '100%', height: 34, border: '1.5px solid #E5E5EA', borderRadius: 9, cursor: 'pointer' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setEditProfile(null)}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
                Cancelar
              </button>
              <button onClick={handleSaveProfile}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
