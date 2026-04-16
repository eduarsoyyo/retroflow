// ═══ ROOMS — Data access ═══
import { supabase } from './supabase';
import { ok, err, type Result, DataError } from '@lib/errors';
import { createLogger } from '@lib/logger';
import type { Room } from '@app-types/index';

const log = createLogger('data:rooms');

export async function loadRooms(): Promise<Result<Room[]>> {
  try {
    const { data, error } = await supabase.from('rooms').select('*').order('name');
    if (error) { log.error('loadRooms', error); return err(new DataError('Failed to load rooms')); }
    return ok(data ?? []);
  } catch (e) { return err(new DataError('Network error')); }
}

export async function saveRoom(room: Partial<Room>): Promise<Result<void>> {
  try {
    const { error } = await supabase.from('rooms').upsert(room, { onConflict: 'slug' });
    if (error) return err(new DataError('Failed to save room'));
    return ok(undefined);
  } catch { return err(new DataError('Network error')); }
}

// ── Tags ──

export async function loadTags(sala: string): Promise<any[]> {
  try { const { data } = await supabase.from('tags').select('*').eq('sala', sala); return data ?? []; } catch { return []; }
}

export async function loadTagAssignments(sala: string): Promise<any[]> {
  try { const { data } = await supabase.from('tag_assignments').select('*').eq('sala', sala); return data ?? []; } catch { return []; }
}
