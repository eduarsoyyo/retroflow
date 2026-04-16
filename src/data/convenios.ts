// ═══ CONVENIOS — CRUD for labor agreements ═══
import { supabase } from './supabase';

export interface Convenio {
  id: string;
  name: string;
  vac_days: number;
  extra_days: Array<{ name: string; days: number }>;
  notes: string;
  max_annual_hours: number;
  effective_days: number;
  effective_hours: number;
  weekly_hours: number;
  intensive_start: string;
  intensive_end: string;
  intensive_hours: number;
  normal_daily_schedule: Record<string, number>;
  entry_time_from: string;
  entry_time_to: string;
  lunch_min: number;
  lunch_max: number;
  adjustment_days: number;
  adjustment_hours: number;
  free_days: number;
  free_days_note: string;
  category: string;
  region: string;
  monthly_hours: Array<{ m: number; d: number; h: number }>;
  created_at: string;
}

export async function loadConvenios(): Promise<Convenio[]> {
  try {
    const { data } = await supabase.from('convenios').select('*').order('name');
    return data || [];
  } catch { return []; }
}

export async function saveConvenio(c: Partial<Convenio>): Promise<Convenio | null> {
  try {
    if (c.id) {
      const { data } = await supabase.from('convenios').update({ name: c.name, vac_days: c.vac_days, extra_days: c.extra_days, notes: c.notes }).eq('id', c.id).select().single();
      return data;
    }
    const { data } = await supabase.from('convenios').insert({ name: c.name, vac_days: c.vac_days || 22, extra_days: c.extra_days || [], notes: c.notes || '' }).select().single();
    return data;
  } catch { return null; }
}

export async function deleteConvenio(id: string): Promise<void> {
  try { await supabase.from('convenios').delete().eq('id', id); } catch {}
}

export async function assignConvenioToMember(memberId: string, convenioId: string | null): Promise<void> {
  try { await supabase.from('team_members').update({ convenio_id: convenioId }).eq('id', memberId); } catch {}
}
