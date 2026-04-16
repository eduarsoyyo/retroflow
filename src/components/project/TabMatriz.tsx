// ═══ TAB MATRIZ — Team skill heatmap table ═══
import type { Member, SkillProfile, Skill, ProfileSkill, MemberSkill } from '@app-types/index';
import { memberFit, fitColor, LEVEL_COLORS } from '@domain/skills';

interface TabMatrizProps {
  team: Member[];
  profiles: SkillProfile[];
  skills: Skill[];
  profSkills: ProfileSkill[];
  memSkills: MemberSkill[];
  memProfiles: Array<{ member_id: string; profile_id: string }>;
  categories: string[];
}

export function TabMatriz({ team, profiles, skills, profSkills, memSkills, memProfiles, categories }: TabMatrizProps) {
  // Only skills that have requirements in some profile
  const usedSkillIds = new Set(profSkills.map(ps => ps.skill_id));
  const usedSkills = skills.filter(s => usedSkillIds.has(s.id)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const usedCategories = [...new Set(usedSkills.map(s => s.category))];

  const getMemberProfile = (mid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    return mp ? profiles.find(p => p.id === mp.profile_id) : null;
  };

  const getFit = (mid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    if (!mp) return null;
    const reqs = profSkills.filter(ps => ps.profile_id === mp.profile_id);
    return memberFit(mid, reqs, memSkills);
  };

  const getRequired = (mid: string, sid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    if (!mp) return 0;
    const ps = profSkills.find(x => x.profile_id === mp.profile_id && x.skill_id === sid);
    return ps?.required_level || 0;
  };

  const getActual = (mid: string, sid: string) => {
    return memSkills.find(x => x.member_id === mid && x.skill_id === sid)?.current_level || 0;
  };

  if (usedSkills.length === 0) {
    return <p style={{ fontSize: 13, color: '#C7C7CC', padding: 24, textAlign: 'center' }}>Define habilidades en los perfiles para ver la matriz</p>;
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Matriz de habilidades</h3>
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1.5px solid #E5E5EA' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, background: '#FFF' }}>
          <thead>
            {/* Category row */}
            <tr style={{ background: '#FAFAFA' }}>
              <th style={{ padding: '6px 10px', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, minWidth: 140 }} />
              {usedCategories.map(cat => {
                const count = usedSkills.filter(s => s.category === cat).length;
                return <th key={cat} colSpan={count} style={{ padding: '4px 6px', fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid #E5E5EA', borderLeft: '1px solid #E5E5EA' }}>{cat}</th>;
              })}
              <th style={{ padding: '4px 8px', fontSize: 9, fontWeight: 700, color: '#86868B', borderBottom: '1px solid #E5E5EA', borderLeft: '1px solid #E5E5EA' }}>Encaje</th>
            </tr>
            {/* Skill names row */}
            <tr style={{ background: '#FAFAFA' }}>
              <th style={{ padding: '6px 10px', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6E6E73' }}>Persona</th>
              {usedSkills.map(sk => (
                <th key={sk.id} style={{ padding: '4px 4px', fontSize: 8, fontWeight: 600, color: '#86868B', textAlign: 'center', borderBottom: '2px solid #E5E5EA', borderLeft: '1px solid #F2F2F7', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={sk.name}>
                  {sk.icon || ''} {sk.name.slice(0, 10)}
                </th>
              ))}
              <th style={{ borderBottom: '2px solid #E5E5EA', borderLeft: '1px solid #E5E5EA' }} />
            </tr>
          </thead>
          <tbody>
            {team.map((m, ri) => {
              const profile = getMemberProfile(m.id);
              const fit = getFit(m.id);
              return (
                <tr key={m.id} style={{ background: ri % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  {/* Sticky first column */}
                  <td style={{ padding: '6px 10px', position: 'sticky', left: 0, background: ri % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderBottom: '1px solid #F2F2F7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                        {m.avatar || '👤'}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{m.name.split(' ')[0]}</div>
                        {profile && <div style={{ fontSize: 8, color: '#86868B' }}>{profile.icon} {profile.name}</div>}
                      </div>
                    </div>
                  </td>
                  {/* Skill cells */}
                  {usedSkills.map(sk => {
                    const req = getRequired(m.id, sk.id);
                    const act = getActual(m.id, sk.id);
                    const gap = req - act;
                    const bgColor = act === 0 ? 'transparent' : LEVEL_COLORS[act] + '18';
                    return (
                      <td key={sk.id} style={{ textAlign: 'center', padding: '4px 2px', borderLeft: '1px solid #F2F2F7', borderBottom: '1px solid #F2F2F7', background: bgColor }}>
                        {act > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLORS[act] }}>{act}</span>}
                        {req > 0 && gap > 0 && <span style={{ fontSize: 8, color: '#FF3B30', display: 'block' }}>▼{gap}</span>}
                        {req > 0 && gap < 0 && <span style={{ fontSize: 8, color: '#34C759', display: 'block' }}>▲{Math.abs(gap)}</span>}
                      </td>
                    );
                  })}
                  {/* Fit column */}
                  <td style={{ textAlign: 'center', padding: '4px 8px', borderLeft: '1px solid #E5E5EA', borderBottom: '1px solid #F2F2F7', fontWeight: 700 }}>
                    {fit !== null ? (
                      <span style={{ color: fitColor(fit) }}>{fit}%</span>
                    ) : (
                      <span style={{ color: '#C7C7CC' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 10, fontSize: 10, color: '#86868B' }}>
        {[1, 2, 3, 4].map(l => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: LEVEL_COLORS[l] }} />
            {l}
          </span>
        ))}
        <span style={{ color: '#FF3B30' }}>▼ Gap</span>
        <span style={{ color: '#34C759' }}>▲ Excede</span>
      </div>
    </div>
  );
}
