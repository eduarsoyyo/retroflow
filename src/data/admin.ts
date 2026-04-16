// ═══ ADMIN DATA — Roles, Calendars, Escalation queries ═══
import { supabase } from './supabase';

export async function loadAdminRoles(): Promise<string[]> {
  try {
    const { data } = await supabase.from('admin_roles').select('name');
    return data ? data.map((r: Record<string, unknown>) => r.name) : [];
  } catch { return []; }
}

export async function saveAdminRole(name: string): Promise<void> {
  try { await supabase.from('admin_roles').insert({ name }); } catch {}
}

export async function deleteAdminRole(name: string): Promise<void> {
  try { await supabase.from('admin_roles').delete().eq('name', name); } catch {}
}

export async function loadAdminCalendars(): Promise<any[]> {
  try {
    const { data } = await supabase.from('admin_calendars').select('*');
    return data || [];
  } catch { return []; }
}

export async function loadActiveRetroSnapshots(): Promise<any[]> {
  try {
    const { data } = await supabase.from('retros')
      .select('sala,data,created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    return data || [];
  } catch { return []; }
}
