// ═══ SKILL MATRIX SERVICE — Orchestrates CRUD + domain logic ═══
// Components call this layer. Never data/ directly.

import {
  loadSkillProfiles, saveSkillProfile, deleteSkillProfile,
  loadSkills, saveSkill,
  loadAllProfileSkills,
  loadMemberSkills, saveMemberSkill,
  loadMemberProfiles, saveMemberProfile, deleteMemberProfile,
  loadSkillActions, saveSkillAction, deleteSkillAction,
  loadTrainingCatalog, saveTraining, deleteTraining,
} from '@data/skills';
import { loadTeamMembers, loadOrgChart } from '@data/team';
import { memberFit, findAllGaps, suggestActionType } from '@domain/skills';
import { createLogger } from '@lib/logger';
import type { Result } from '@lib/errors';
import { ok, err, DataError } from '@lib/errors';
import type { SkillProfile, Skill, ProfileSkill, MemberSkill, Member, GapInfo } from '@app-types/index';

const log = createLogger('service:skills');

// ── Composite data for the entire Skill Matrix module ──

export interface SkillMatrixData {
  team: Member[];
  profiles: SkillProfile[];
  skills: Skill[];
  profSkills: ProfileSkill[];
  memSkills: MemberSkill[];
  memProfiles: Array<{ id: string; member_id: string; profile_id: string; sala: string }>;
  catalog: unknown[];
  actions: unknown[];
  orgChart: Record<string, string | null>;
  gaps: GapInfo[];
  categories: string[];
}

/**
 * Load all data needed for the Skill Matrix module.
 * Single call — components never load data piecemeal.
 */
export async function loadSkillMatrixData(sala: string): Promise<Result<SkillMatrixData>> {
  log.info('Loading skill matrix data', { sala });

  try {
    // Parallel load: project + maestro data
    const [teamR, orgR, profsR, mProfsR, sksR, mSksR, msR, mpR, catR, actsR] = await Promise.all([
      loadTeamMembers(),
      loadOrgChart(sala),
      loadSkillProfiles(sala),
      loadSkillProfiles('__maestro__'),
      loadSkills(sala),
      loadSkills('__maestro__'),
      loadMemberSkills(),
      loadMemberProfiles(sala),
      loadTrainingCatalog(),
      loadSkillActions(sala),
    ]);

    const allMembers = teamR.ok ? teamR.data : [];
    const team = allMembers.filter(m => (m.rooms || []).includes(sala));
    const salaTeam = team.length > 0 ? team : allMembers;

    // Org chart as map
    const orgData = orgR.ok ? orgR.data : [];
    const orgChart: Record<string, string | null> = {};
    orgData.forEach(n => { orgChart[n.member_id] = n.manager_id || null; });

    // Merge maestro + project (project overrides)
    const profs = profsR.ok ? profsR.data : [];
    const mProfs = mProfsR.ok ? mProfsR.data : [];
    const profiles = [...profs, ...mProfs.filter(mp => !profs.some(p => p.name === mp.name))];

    const sks = sksR.ok ? sksR.data : [];
    const mSks = mSksR.ok ? mSksR.data : [];
    const seen = new Set(sks.map(s => s.name + '|' + s.category));
    const skills = [...sks, ...mSks.filter(s => !seen.has(s.name + '|' + s.category))];

    // Load profile_skills for all profiles
    const profileIds = profiles.map(p => p.id);
    const psR = await loadAllProfileSkills(profileIds);
    const profSkills = psR.ok ? psR.data : [];

    const memSkills = msR.ok ? msR.data : [];
    const memProfiles = mpR.ok ? mpR.data : [];
    const catalog = catR.ok ? catR.data : [];
    const actions = actsR.ok ? actsR.data : [];

    // Compute gaps using domain logic
    const gaps = findAllGaps(salaTeam, memProfiles, profiles, profSkills, memSkills, skills);
    const categories = [...new Set(skills.map(s => s.category))].sort();

    return ok({
      team: salaTeam, profiles, skills, profSkills, memSkills, memProfiles,
      catalog, actions, orgChart, gaps, categories,
    });
  } catch (e) {
    log.error('loadSkillMatrixData failed', e);
    return err(new DataError('Failed to load skill matrix'));
  }
}

// ── CRUD operations (used by components via callbacks) ──

export async function createOrUpdateProfile(profile: Partial<SkillProfile>, sala: string): Promise<Result<SkillProfile>> {
  const result = await saveSkillProfile({ ...profile, sala });
  if (!result.ok) return result;
  // Feed back to maestro for new profiles
  if (!profile.id) {
    saveSkillProfile({ name: profile.name, description: profile.description, fte: profile.fte, color: profile.color, icon: profile.icon, sala: '__maestro__' }).catch(() => {});
  }
  return result;
}

export async function createOrUpdateSkill(skill: Partial<Skill>, sala: string): Promise<Result<Skill>> {
  const result = await saveSkill({ ...skill, sala });
  if (!result.ok) return result;
  if (!skill.id) {
    saveSkill({ name: skill.name, category: skill.category, icon: skill.icon, sala: '__maestro__' }).catch(() => {});
  }
  return result;
}

export async function assignProfileToMember(memberId: string, profileId: string | null, sala: string): Promise<Result<void>> {
  try {
    // Remove existing
    const existingR = await loadMemberProfiles(sala);
    if (existingR.ok) {
      const old = existingR.data.find(x => x.member_id === memberId);
      if (old) await deleteMemberProfile(old.id);
    }
    if (!profileId) return ok(undefined);
    await saveMemberProfile({ member_id: memberId, profile_id: profileId, sala });
    return ok(undefined);
  } catch {
    return err(new DataError('Failed to assign profile'));
  }
}

export async function evaluateSkill(memberId: string, skillId: string, level: number): Promise<Result<MemberSkill>> {
  return saveMemberSkill({
    member_id: memberId,
    skill_id: skillId,
    current_level: level as 1 | 2 | 3 | 4,
    assessed_at: new Date().toISOString(),
    notes: '',
  }) as Promise<Result<MemberSkill>>;
}

/**
 * Get fit percentage for a member against their assigned profile.
 * Delegates to domain/skills.memberFit()
 */
export function getMemberFit(
  memberId: string,
  memProfiles: Array<{ member_id: string; profile_id: string }>,
  profiles: Array<{ id: string }>,
  profSkills: ProfileSkill[],
  memSkills: MemberSkill[],
): number | null {
  const mp = memProfiles.find(x => x.member_id === memberId);
  if (!mp) return null;
  const reqs = profSkills.filter(ps => ps.profile_id === mp.profile_id);
  return memberFit(memberId, reqs, memSkills);
}

/**
 * Suggest training items from catalog for a skill gap.
 */
export function suggestTrainingForGap(gap: GapInfo, catalog: Array<{ name: string; category: string; subcategory?: string }>): typeof catalog {
  const q = (gap.skill?.name || '').toLowerCase();
  const qc = (gap.skill?.category || '').toLowerCase();
  return catalog.filter(t =>
    t.name.toLowerCase().includes(q) ||
    (t.subcategory || '').toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(qc),
  ).slice(0, 5);
}
