// ═══ RETROS — Data access ═══
import { supabase } from './supabase';
import { ok, err, type Result, DataError } from '@lib/errors';
import { createLogger } from '@lib/logger';

const log = createLogger('data:retros');

interface RetroSnapshot {
  id: string;
  sala: string;
  tipo: string;
  status: string;
  created_at: string;
  updated_at?: string;
  data: Record<string, unknown>;
}

export async function loadRetros(sala?: string): Promise<Result<RetroSnapshot[]>> {
  try {
    let query = supabase.from('retros')
      .select('id,sala,tipo,status,created_at,updated_at,data');
    if (sala) query = query.eq('sala', sala);
    const { data, error } = await query
      .order('created_at', { ascending: false });
    if (error) { log.error('loadRetros', error); return err(new DataError('Failed to load retros')); }
    return ok(data ?? []);
  } catch { return err(new DataError('Network error')); }
}

export async function saveRetroSnapshot(
  sala: string, tipo: string, stateData: unknown, userId: string | null, status = 'active',
): Promise<Result<void>> {
  try {
    if (status === 'active') {
      const { data: existing } = await supabase.from('retros')
        .select('id').eq('sala', sala).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1);
      if (existing?.[0]) {
        await supabase.from('retros')
          .update({ data: stateData, updated_at: new Date().toISOString() })
          .eq('id', existing[0].id);
        return ok(undefined);
      }
    }
    await supabase.from('retros').insert({ sala, tipo, status, data: stateData, created_by: userId });
    return ok(undefined);
  } catch (e) { log.error('saveRetroSnapshot', e); return err(new DataError('Failed to save snapshot')); }
}

export async function createRetroArchive(
  sala: string, tipo: string, stateData: unknown, userId: string | null,
): Promise<Result<void>> {
  try {
    await supabase.from('retros').insert({ sala, tipo, status: 'closed', data: stateData, created_by: userId });
    return ok(undefined);
  } catch (e) { log.error('createRetroArchive', e); return err(new DataError('Failed to archive retro')); }
}

export async function loadRetroHistory(sala: string): Promise<Result<RetroSnapshot[]>> {
  try {
    const { data, error } = await supabase.from('retros')
      .select('id,sala,tipo,status,created_at,data')
      .eq('sala', sala).eq('status', 'closed')
      .order('created_at', { ascending: false });
    if (error) return err(new DataError('Failed to load history'));
    return ok(data ?? []);
  } catch { return err(new DataError('Network error')); }
}

export async function saveMetric(sala: string, entry: Record<string, unknown>): Promise<Result<void>> {
  try {
    await supabase.from('retro_metrics').insert({
      sala,
      date: entry.date || new Date().toISOString(),
      notes: entry.notes || 0,
      participants: entry.participants || 0,
      participant_names: entry.participantNames || [],
      actions: entry.actions || 0,
      actions_done: entry.actionsDone || 0,
      votes: entry.votes || 0,
      objective: entry.objective || null,
      tasks_done: entry.tasksDone || 0,
      tasks_total: entry.tasksTotal || 0,
    });
    return ok(undefined);
  } catch (e) { log.error('saveMetric', e); return err(new DataError('Failed to save metric')); }
}

export async function loadMetrics(sala?: string): Promise<Record<string, unknown>[]> {
  try {
    let q = supabase.from('retro_metrics').select('*').order('date', { ascending: false });
    if (sala) q = q.eq('sala', sala);
    const { data } = await q;
    return data || [];
  } catch { return []; }
}
