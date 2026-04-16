// ═══ TAB PERSONAS — Profile assignment + skill evaluation ═══
import { useState } from 'preact/hooks';
import type { Member, SkillProfile, ProfileSkill, MemberSkill, Skill } from '@app-types/index';
import { memberFit, fitColor, LEVEL_COLORS, LEVEL_ICONS, LEVEL_LABELS } from '@domain/skills';
import { assignProfileToMember, evaluateSkill } from '@services/skills';

interface TabPersonasProps {
  team: Member[];
  profiles: SkillProfile[];
  profSkills: ProfileSkill[];
  memSkills: MemberSkill[];
  memProfiles: Array<{ id: string; member_id: string; profile_id: string; sala: string }>;
  skills: Skill[];
  categories: string[];
  sala: string;
  onRefresh: () => void;
}

export function TabPersonas({ team, profiles, profSkills, memSkills, memProfiles, skills, categories, sala, onRefresh }: TabPersonasProps) {
  const [evalMember, setEvalMember] = useState<Member | null>(null);

  const getMemberProfile = (mid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    return mp ? profiles.find(p => p.id === mp.profile_id) : null;
  };

  const getMemberFit = (mid: string): number | null => {
    const mp = memProfiles.find(x => x.member_id === mid);
    if (!mp) return null;
    const reqs = profSkills.filter(ps => ps.profile_id === mp.profile_id);
    return memberFit(mid, reqs, memSkills);
  };

  const handleAssign = async (memberId: string, profileId: string) => {
    await assignProfileToMember(memberId, profileId || null, sala);
    onRefresh();
  };

  const handleEval = async (memberId: string, skillId: string, level: number) => {
    await evaluateSkill(memberId, skillId, level);
    onRefresh();
  };

  // Radar chart SVG for evaluated member
  const renderRadar = (member: Member) => {
    const profile = getMemberProfile(member.id);
    if (!profile) return null;
    const reqs = profSkills.filter(ps => ps.profile_id === profile.id);
    if (reqs.length < 3) return null;

    const n = reqs.length;
    const cx = 100, cy = 100, r = 75;
    const reqPoints: string[] = [];
    const actPoints: string[] = [];

    reqs.forEach((req, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const reqR = (req.required_level / 4) * r;
      const ms = memSkills.find(x => x.member_id === member.id && x.skill_id === req.skill_id);
      const actR = ((ms?.current_level || 0) / 4) * r;
      reqPoints.push(`${cx + Math.cos(angle) * reqR},${cy + Math.sin(angle) * reqR}`);
      actPoints.push(`${cx + Math.cos(angle) * actR},${cy + Math.sin(angle) * actR}`);
    });

    return (
      <svg viewBox="0 0 200 200" style={{ width: 180, height: 180 }}>
        {/* Grid */}
        {[1, 2, 3, 4].map(level => (
          <polygon key={level}
            points={reqs.map((_, i) => {
              const a = (i / n) * Math.PI * 2 - Math.PI / 2;
              const lr = (level / 4) * r;
              return `${cx + Math.cos(a) * lr},${cy + Math.sin(a) * lr}`;
            }).join(' ')}
            fill="none" stroke="#E5E5EA" strokeWidth={0.5} />
        ))}
        {/* Required (dashed blue) */}
        <polygon points={reqPoints.join(' ')} fill="rgba(0,122,255,.08)" stroke="#007AFF" strokeWidth={1.5} strokeDasharray="4 3" />
        {/* Actual (solid purple) */}
        <polygon points={actPoints.join(' ')} fill="rgba(88,86,214,.12)" stroke="#5856D6" strokeWidth={2} />
        {/* Labels */}
        {reqs.map((req, i) => {
          const sk = skills.find(s => s.id === req.skill_id);
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + Math.cos(angle) * (r + 18);
          const ly = cy + Math.sin(angle) * (r + 18);
          return <text key={req.id} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={6} fill="#86868B">{sk?.name?.slice(0, 12) || '?'}</text>;
        })}
      </svg>
    );
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Personas del equipo</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {team.map(m => {
          const profile = getMemberProfile(m.id);
          const fit = getMemberFit(m.id);
          return (
            <div key={m.id}
              onClick={() => setEvalMember(m)}
              style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14, cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#007AFF')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '#E5E5EA')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {m.avatar || '👤'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#86868B' }}>{m.role_label || '—'}</div>
                </div>
                {fit !== null && (
                  <span style={{ fontSize: 14, fontWeight: 800, color: fitColor(fit) }}>{fit}%</span>
                )}
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  value={profile?.id || ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => handleAssign(m.id, (e.target as HTMLSelectElement).value)}
                  style={{ flex: 1, border: '1.5px solid #E5E5EA', borderRadius: 8, padding: '5px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none', background: '#FFF' }}
                >
                  <option value="">— Sin perfil —</option>
                  {profiles.filter(p => p.sala !== '__maestro__').map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Evaluation modal */}
      {evalMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={() => setEvalMember(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.18)', backdropFilter: 'blur(8px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,.12)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: evalMember.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {evalMember.avatar || '👤'}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{evalMember.name}</div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{getMemberProfile(evalMember.id)?.name || 'Sin perfil'}</div>
              </div>
              <button onClick={() => setEvalMember(null)} style={{ marginLeft: 'auto', border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#86868B' }}>✕</button>
            </div>

            {/* Radar */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {renderRadar(evalMember)}
            </div>

            {/* Skill evaluation grid */}
            {(() => {
              const profile = getMemberProfile(evalMember.id);
              if (!profile) return <p style={{ fontSize: 12, color: '#C7C7CC', textAlign: 'center' }}>Asigna un perfil primero</p>;
              const reqs = profSkills.filter(ps => ps.profile_id === profile.id);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reqs.map(req => {
                    const sk = skills.find(s => s.id === req.skill_id);
                    const cur = memSkills.find(x => x.member_id === evalMember.id && x.skill_id === req.skill_id)?.current_level || 0;
                    const gap = req.required_level - cur;
                    return (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F2F2F7' }}>
                        <span style={{ fontSize: 12, flex: 1 }}>{sk?.icon || '📘'} {sk?.name || '?'}</span>
                        <span style={{ fontSize: 9, color: '#86868B' }}>req: {req.required_level}</span>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[1, 2, 3, 4].map(level => (
                            <button key={level}
                              onClick={() => handleEval(evalMember.id, req.skill_id, level)}
                              style={{
                                width: 28, height: 28, borderRadius: 7, border: 'none',
                                background: cur >= level ? LEVEL_COLORS[level] + '20' : '#F2F2F7',
                                color: cur >= level ? LEVEL_COLORS[level] : '#C7C7CC',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                outline: cur === level ? `2px solid ${LEVEL_COLORS[level]}` : 'none',
                              }}
                            >
                              {LEVEL_ICONS[level]}
                            </button>
                          ))}
                        </div>
                        {gap > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: gap >= 2 ? '#FF3B30' : '#FF9500' }}>▼{gap}</span>}
                        {gap <= 0 && cur > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#34C759' }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
