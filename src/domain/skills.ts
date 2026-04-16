// ═══ SKILL MATRIX — Pure calculations ═══
import type { Member, Skill, ProfileSkill, MemberSkill, GapInfo } from '@app-types/index';

export const LEVEL_COLORS: Record<number, string> = { 1: '#FF3B30', 2: '#FF9500', 3: '#34C759', 4: '#007AFF' };
export const LEVEL_LABELS: Record<number, string> = { 1: 'Introducción', 2: 'Asistido', 3: 'Independiente', 4: 'Experto' };
export const LEVEL_ICONS: Record<number, string>  = { 1: '📖', 2: '🤝', 3: '🎯', 4: '⭐' };

export function memberFit(
  memberId: string,
  profileSkills: ProfileSkill[],
  memberSkills: MemberSkill[],
): number | null {
  if (!profileSkills?.length) return null;
  const totalReq = profileSkills.reduce((s, ps) => s + ps.required_level, 0);
  if (totalReq === 0) return null;
  const totalAct = profileSkills.reduce((s, ps) => {
    const ms = memberSkills.find(x => x.member_id === memberId && x.skill_id === ps.skill_id);
    return s + Math.min(ms?.current_level ?? 0, ps.required_level);
  }, 0);
  return Math.round(totalAct / totalReq * 100);
}

export function fitColor(pct: number): string {
  if (pct >= 90) return '#34C759';
  if (pct >= 70) return '#FF9500';
  return '#FF3B30';
}

export interface GapResult {
  gap: number;
  severity: 'ok' | 'minor' | 'critical';
}

export function skillGap(required: number, actual: number): GapResult {
  const gap = required - (actual || 0);
  return { gap, severity: gap <= 0 ? 'ok' : gap === 1 ? 'minor' : 'critical' };
}

export function findAllGaps(
  members: Member[],
  memberProfiles: Array<{ member_id: string; profile_id: string }>,
  profiles: Array<{ id: string; name: string }>,
  profileSkills: ProfileSkill[],
  memberSkills: MemberSkill[],
  skills: Skill[],
): GapInfo[] {
  return members.flatMap(m => {
    const mp = memberProfiles.find(x => x.member_id === m.id);
    if (!mp) return [];
    const profile = profiles.find(p => p.id === mp.profile_id);
    if (!profile) return [];
    return profileSkills
      .filter(ps => ps.profile_id === profile.id)
      .map(r => {
        const ms = memberSkills.find(x => x.member_id === m.id && x.skill_id === r.skill_id);
        const current = ms?.current_level ?? 0;
        const gap = r.required_level - current;
        if (gap <= 0) return null;
        const skill = skills.find(s => s.id === r.skill_id);
        return skill ? { member: m, skill, required: r.required_level, current, gap, profileName: profile.name } : null;
      })
      .filter((x): x is GapInfo => x !== null);
  }).sort((a, b) => b.gap - a.gap);
}

export function suggestActionType(gap: number): string {
  if (gap <= 1) return 'mentoring';
  if (gap === 2) return 'formacion';
  return 'certificacion';
}
