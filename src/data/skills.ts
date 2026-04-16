// ═══ SKILLS — Data access ═══
import { supabase } from './supabase';
import { ok, err, type Result, DataError } from '@lib/errors';
import type { SkillProfile, Skill, ProfileSkill, MemberSkill } from '@app-types/index';

export async function loadSkillProfiles(sala: string): Promise<Result<SkillProfile[]>> {
  try { const { data, error } = await supabase.from('skill_profiles').select('*').eq('sala', sala).order('sort_order'); if (error) return err(new DataError('profiles')); return ok(data ?? []); } catch { return err(new DataError('profiles')); }
}
export async function saveSkillProfile(p: Partial<SkillProfile>): Promise<Result<SkillProfile>> {
  try { const { data, error } = await supabase.from('skill_profiles').upsert(p, { onConflict: 'id' }).select().single(); if (error) return err(new DataError('save profile')); return ok(data); } catch { return err(new DataError('save profile')); }
}

export async function loadSkills(sala: string): Promise<Result<Skill[]>> {
  try { const { data, error } = await supabase.from('skills').select('*').eq('sala', sala).order('category,name'); if (error) return err(new DataError('skills')); return ok(data ?? []); } catch { return err(new DataError('skills')); }
}
export async function saveSkill(s: Partial<Skill>): Promise<Result<Skill>> {
  try { const { data, error } = await supabase.from('skills').upsert(s, { onConflict: 'id' }).select().single(); if (error) return err(new DataError('save skill')); return ok(data); } catch { return err(new DataError('save skill')); }
}

export async function loadAllProfileSkills(profileIds: string[]): Promise<Result<ProfileSkill[]>> {
  if (!profileIds.length) return ok([]);
  try { const { data, error } = await supabase.from('profile_skills').select('*').in('profile_id', profileIds); if (error) return err(new DataError('profile skills')); return ok(data ?? []); } catch { return err(new DataError('profile skills')); }
}

export async function loadMemberSkills(): Promise<Result<MemberSkill[]>> {
  try { const { data, error } = await supabase.from('member_skills').select('*'); if (error) return err(new DataError('member skills')); return ok(data ?? []); } catch { return err(new DataError('member skills')); }
}

export async function loadMemberProfiles(sala: string): Promise<Result<Array<{ id: string; member_id: string; profile_id: string; sala: string }>>> {
  try { const { data, error } = await supabase.from('member_profiles').select('*').eq('sala', sala); if (error) return err(new DataError('member profiles')); return ok(data ?? []); } catch { return err(new DataError('member profiles')); }
}

export async function loadSkillActions(sala: string): Promise<Result<unknown[]>> {
  try { const { data, error } = await supabase.from('skill_actions').select('*').eq('sala', sala).order('created_at', { ascending: false }); if (error) return err(new DataError('actions')); return ok(data ?? []); } catch { return err(new DataError('actions')); }
}

export async function loadTrainingCatalog(): Promise<Result<unknown[]>> {
  try { const { data, error } = await supabase.from('training_catalog').select('*').order('category,name'); if (error) return err(new DataError('catalog')); return ok(data ?? []); } catch { return err(new DataError('catalog')); }
}

export async function saveMemberSkill(ms: Record<string, unknown>): Promise<Result<unknown>> {
  try { const { data, error } = await supabase.from('member_skills').upsert(ms, { onConflict: 'member_id,skill_id' }).select().single(); if (error) return err(new DataError('save member skill')); return ok(data); } catch { return err(new DataError('save member skill')); }
}

export async function saveMemberProfile(mp: Record<string, unknown>): Promise<Result<unknown>> {
  try { const { data, error } = await supabase.from('member_profiles').upsert(mp, { onConflict: 'member_id,profile_id,sala' }).select().single(); if (error) return err(new DataError('save member profile')); return ok(data); } catch { return err(new DataError('save member profile')); }
}

export async function deleteMemberProfile(id: string): Promise<Result<void>> {
  try { await supabase.from('member_profiles').delete().eq('id', id); return ok(undefined); } catch { return err(new DataError('delete member profile')); }
}

export async function saveSkillAction(a: Record<string, unknown>): Promise<Result<unknown>> {
  try {
    if (a.id) {
      const { data, error } = await supabase.from('skill_actions').update(a).eq('id', a.id).select().single();
      if (error) return err(new DataError('save action')); return ok(data);
    } else {
      const { data, error } = await supabase.from('skill_actions').insert(a).select().single();
      if (error) return err(new DataError('save action')); return ok(data);
    }
  } catch { return err(new DataError('save action')); }
}

export async function deleteSkillAction(id: string): Promise<Result<void>> {
  try { await supabase.from('skill_actions').delete().eq('id', id); return ok(undefined); } catch { return err(new DataError('delete action')); }
}

export async function deleteSkillProfile(id: string): Promise<Result<void>> {
  try { await supabase.from('skill_profiles').delete().eq('id', id); return ok(undefined); } catch { return err(new DataError('delete profile')); }
}

export async function saveTraining(t: Record<string, unknown>): Promise<Result<unknown>> {
  try { const { data, error } = await supabase.from('training_catalog').upsert(t, { onConflict: 'id' }).select().single(); if (error) return err(new DataError('save training')); return ok(data); } catch { return err(new DataError('save training')); }
}

export async function deleteTraining(id: string): Promise<Result<void>> {
  try { await supabase.from('training_catalog').delete().eq('id', id); return ok(undefined); } catch { return err(new DataError('delete training')); }
}
