// ═══ TEAM — Data access with structured error handling ═══
import { supabase } from './supabase';
import { createLogger } from '@lib/logger';
import { ok, err, type Result } from '@lib/errors';
import { DataError } from '@lib/errors';
import type { Member } from '@app-types/index';

const log = createLogger('data:team');

export async function loadTeamMembers(): Promise<Result<Member[]>> {
  try {
    const { data, error } = await supabase.from('team_members').select('*').order('name');
    if (error) {
      log.error('loadTeamMembers failed', error, { code: error.code });
      return err(new DataError('Failed to load team members', { code: error.code }));
    }
    return ok(data ?? []);
  } catch (e) {
    log.error('loadTeamMembers exception', e);
    return err(new DataError('Network error loading team members'));
  }
}

export async function saveTeamMember(member: Partial<Member>): Promise<Result<Member>> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .upsert(member, { onConflict: 'id' })
      .select()
      .single();
    if (error) {
      log.error('saveTeamMember failed', error, { memberId: member.id });
      return err(new DataError('Failed to save team member', { memberId: member.id }));
    }
    return ok(data);
  } catch (e) {
    log.error('saveTeamMember exception', e);
    return err(new DataError('Network error saving team member'));
  }
}

export async function loadOrgChart(sala: string): Promise<Result<Array<{ id: string; sala: string; member_id: string; manager_id: string | null }>>> {
  try {
    const { data, error } = await supabase.from('org_chart').select('*').eq('sala', sala);
    if (error) return err(new DataError('Failed to load org chart'));
    return ok(data ?? []);
  } catch (e) {
    return err(new DataError('Network error loading org chart'));
  }
}

export async function saveOrgNode(sala: string, memberId: string, managerId: string | null): Promise<Result<void>> {
  try {
    const { data: existing } = await supabase.from('org_chart')
      .select('id').eq('sala', sala).eq('member_id', memberId).maybeSingle();
    if (existing?.id) {
      await supabase.from('org_chart').update({ manager_id: managerId }).eq('id', existing.id);
    } else {
      await supabase.from('org_chart').insert({ sala, member_id: memberId, manager_id: managerId });
    }
    return ok(undefined);
  } catch (e) {
    log.error('saveOrgNode exception', e);
    return err(new DataError('Failed to save org node'));
  }
}

export async function updateOrgField(sala: string, memberId: string, managerId: string | null, field: string, val: unknown): Promise<Result<void>> {
  try {
    const { data: existing } = await supabase.from('org_chart')
      .select('id').eq('sala', sala).eq('member_id', memberId).maybeSingle();
    if (existing?.id) {
      await supabase.from('org_chart').update({ [field]: val }).eq('id', existing.id);
    } else {
      await supabase.from('org_chart').insert({ sala, member_id: memberId, manager_id: managerId || null, [field]: val });
    }
    return ok(undefined);
  } catch (e) {
    log.error('updateOrgField exception', e);
    return err(new DataError('Failed to update org field'));
  }
}
