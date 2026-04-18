// ═══ TAB MATRIZ — Full competency heatmap ═══
import { useMemo } from 'preact/hooks';
import type { Member, SkillProfile, Skill, ProfileSkill, MemberSkill } from '@app-types/index';
import { memberFit, fitColor, LEVEL_COLORS, LEVEL_LABELS } from '@domain/skills';

interface TabMatrizProps {
  team: Member[];
  profiles: SkillProfile[];
  skills: Skill[];
  profSkills: ProfileSkill[];
  memSkills: MemberSkill[];
  memProfiles: Array<{ member_id: string; profile_id: string }>;
  categories: string[];
}

const CAT_COLORS = ['#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#00C7BE', '#FF2D55'];
const BG = { 1: '#FF3B3018', 2: '#FF950018', 3: '#34C75918', 4: '#007AFF18' };
const BORDER_BG = { 1: '#FF3B3030', 2: '#FF950030', 3: '#34C75930', 4: '#007AFF30' };

export function TabMatriz({ team, profiles, skills, profSkills, memSkills, memProfiles, categories }: TabMatrizProps) {
  // Only skills used in any profile
  const usedSkillIds = new Set(profSkills.map(ps => ps.skill_id));
  const usedSkills = useMemo(() =>
    skills.filter(s => usedSkillIds.has(s.id)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  [skills, profSkills]);
  const usedCategories = useMemo(() => [...new Set(usedSkills.map(s => s.category))], [usedSkills]);
  const catColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    usedCategories.forEach((c, i) => { m[c] = CAT_COLORS[i % CAT_COLORS.length]; });
    return m;
  }, [usedCategories]);

  const getMemberProfile = (mid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    return mp ? profiles.find(p => p.id === mp.profile_id) : null;
  };
  const getFit = (mid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    if (!mp) return null;
    return memberFit(mid, profSkills.filter(ps => ps.profile_id === mp.profile_id), memSkills);
  };
  const getReq = (mid: string, sid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    if (!mp) return 0;
    return profSkills.find(x => x.profile_id === mp.profile_id && x.skill_id === sid)?.required_level || 0;
  };
  const getAct = (mid: string, sid: string) => memSkills.find(x => x.member_id === mid && x.skill_id === sid)?.current_level || 0;

  // Sort team: with profile first, then by fit desc
  const sorted = useMemo(() => {
    return [...team].sort((a, b) => {
      const pa = getMemberProfile(a.id);
      const pb = getMemberProfile(b.id);
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      const fa = getFit(a.id) ?? -1;
      const fb = getFit(b.id) ?? -1;
      return fb - fa;
    });
  }, [team, memProfiles, memSkills]);

  if (usedSkills.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#86868B' }}>
        <p style={{ fontSize: 13 }}>Define habilidades en los perfiles para ver la matriz.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Matriz de competencias</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{team.length} personas · {usedSkills.length} habilidades · {usedCategories.length} categorías</p>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#86868B', flexWrap: 'wrap' }}>
          {[4, 3, 2, 1].map(l => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: BG[l as keyof typeof BG], border: `1px solid ${BORDER_BG[l as keyof typeof BORDER_BG]}`, textAlign: 'center', lineHeight: '16px', fontSize: 9, fontWeight: 800, color: LEVEL_COLORS[l] }}>{l}</span>
              {LEVEL_LABELS[l]}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#FF3B30', fontSize: 10 }}>▾</span> Gap
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1.5px solid #E5E5EA' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, background: '#FFF' }}>
          <thead>
            {/* Category headers */}
            <tr>
              <th rowSpan={2} style={{ padding: '8px 12px', position: 'sticky', left: 0, background: '#FFF', zIndex: 3, minWidth: 180, textAlign: 'left', borderBottom: '2px solid #E5E5EA', borderRight: '2px solid #E5E5EA' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F' }}>Equipo</span>
              </th>
              {usedCategories.map(cat => {
                const count = usedSkills.filter(s => s.category === cat).length;
                const color = catColorMap[cat];
                return (
                  <th key={cat} colSpan={count}
                    style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, color, textAlign: 'center', borderBottom: `2px solid ${color}`, borderLeft: '1px solid #E5E5EA', background: color + '08' }}>
                    {cat}
                  </th>
                );
              })}
            </tr>
            {/* Skill name headers (vertical) */}
            <tr>
              {usedSkills.map(sk => {
                const color = catColorMap[sk.category] || '#86868B';
                return (
                  <th key={sk.id} title={sk.name}
                    style={{ padding: '4px 2px', borderBottom: '2px solid #E5E5EA', borderLeft: '1px solid #F2F2F7', height: 80, verticalAlign: 'bottom', minWidth: 32 }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9, fontWeight: 600, color: '#6E6E73', maxHeight: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sk.name}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, ri) => {
              const profile = getMemberProfile(m.id);
              const fit = getFit(m.id);
              const hasProfile = !!profile;
              return (
                <tr key={m.id} style={{ background: ri % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  {/* Sticky name column */}
                  <td style={{ padding: '6px 10px', position: 'sticky', left: 0, background: ri % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderBottom: '1px solid #F2F2F7', borderRight: '2px solid #E5E5EA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                        {m.avatar || '👤'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                        {profile && <div style={{ fontSize: 8, color: '#86868B' }}>{profile.icon} {profile.name}</div>}
                      </div>
                      {fit !== null ? (
                        <span style={{ fontSize: 11, fontWeight: 800, color: fitColor(fit), minWidth: 32, textAlign: 'right' }}>{fit}%</span>
                      ) : (
                        <span style={{ fontSize: 9, color: '#D1D1D6' }}>—</span>
                      )}
                    </div>
                  </td>

                  {/* Skill cells */}
                  {usedSkills.map(sk => {
                    const req = getReq(m.id, sk.id);
                    const act = getAct(m.id, sk.id);
                    const gap = req > 0 ? req - act : 0;

                    if (!hasProfile || req === 0) {
                      return <td key={sk.id} style={{ borderLeft: '1px solid #F2F2F7', borderBottom: '1px solid #F2F2F7' }} />;
                    }

                    return (
                      <td key={sk.id} style={{
                        textAlign: 'center', padding: '3px 2px',
                        borderLeft: '1px solid #F2F2F7', borderBottom: '1px solid #F2F2F7',
                        background: act > 0 ? (BG[act as keyof typeof BG] || 'transparent') : (req > 0 ? '#FFF5F5' : 'transparent'),
                        position: 'relative',
                      }}>
                        {act > 0 && (
                          <span style={{ fontSize: 13, fontWeight: 800, color: LEVEL_COLORS[act] }}>{act}</span>
                        )}
                        {gap > 0 && (
                          <span style={{ position: 'absolute', top: 1, right: 2, fontSize: 8, color: '#FF3B30' }}>▾</span>
                        )}
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
