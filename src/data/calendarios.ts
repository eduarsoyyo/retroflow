// ═══ CALENDARIOS — CRUD for holiday calendars ═══
import { supabase } from './supabase';

export interface Holiday { date: string; name: string; type?: 'nacional' | 'autonomico' | 'local' | 'empresa' }

export interface MonthBreakdown { month: number; days: number; hours: number }

export interface Calendario {
  id: string;
  name: string;
  year: number;
  region: string;
  holidays: Holiday[];
  // Schedule
  weekly_hours_normal: number;      // 40 or 41
  daily_hours_lj: number;           // Mon-Thu: 8, 8.5, 8.75
  daily_hours_v: number;            // Fri: 6, 7, 8, 8.75
  daily_hours_intensive: number;    // 7 always
  intensive_start: string;          // "06-15" or "08-01"
  intensive_end: string;            // "09-15" or "08-31"
  // Agreement
  convenio_hours: number;           // 1760, 1772, 1780, 1800
  vacation_days: number;            // 22 or 23
  adjustment_days: number;          // 0, 1, 2
  adjustment_hours: number;         // 0, 1, 2, 7
  free_days: number;                // 0 or 2 (libre disposición)
  employee_type: string;            // "consultor" | "staff" | "all"
  seniority: string;                // "pre-2009" | "post-2009" | "all"
  created_at: string;
}

export async function loadCalendarios(): Promise<Calendario[]> {
  try {
    const { data } = await supabase.from('calendarios').select('*').order('year', { ascending: false });
    return data || [];
  } catch { return []; }
}

export async function saveCalendario(c: Partial<Calendario>): Promise<Calendario | null> {
  const payload = {
    name: c.name, year: c.year, region: c.region, holidays: c.holidays,
    weekly_hours_normal: c.weekly_hours_normal,
    daily_hours_lj: c.daily_hours_lj,
    daily_hours_v: c.daily_hours_v,
    daily_hours_intensive: c.daily_hours_intensive,
    intensive_start: c.intensive_start,
    intensive_end: c.intensive_end,
    convenio_hours: c.convenio_hours,
    vacation_days: c.vacation_days,
    adjustment_days: c.adjustment_days,
    adjustment_hours: c.adjustment_hours,
    free_days: c.free_days,
    employee_type: c.employee_type,
    seniority: c.seniority,
  };
  // Strip undefined keys so Supabase doesn't choke
  Object.keys(payload).forEach(k => { if ((payload as Record<string, unknown>)[k] === undefined) delete (payload as Record<string, unknown>)[k]; });
  try {
    if (c.id) {
      const { data } = await supabase.from('calendarios').update(payload).eq('id', c.id).select().single();
      return data;
    }
    const { data } = await supabase.from('calendarios').insert({ ...payload, name: payload.name || 'Nuevo', year: payload.year || 2026, region: payload.region || '', holidays: payload.holidays || [] }).select().single();
    return data;
  } catch { return null; }
}

export async function deleteCalendario(id: string): Promise<void> {
  try { await supabase.from('calendarios').delete().eq('id', id); } catch {}
}

export async function assignCalendarioToMember(memberId: string, calendarioId: string | null): Promise<void> {
  try { await supabase.from('team_members').update({ calendario_id: calendarioId }).eq('id', memberId); } catch {}
}

/** Calculate monthly breakdown of working days and hours */
export function calculateMonthlyBreakdown(cal: Calendario): MonthBreakdown[] {
  const result: MonthBreakdown[] = [];
  const holidaySet = new Set((cal.holidays || []).map(h => h.date));
  const year = cal.year || 2026;
  const intStart = `${year}-${cal.intensive_start || '08-01'}`;
  const intEnd = `${year}-${cal.intensive_end || '08-31'}`;

  for (let month = 0; month < 12; month++) {
    let days = 0, hours = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(date).getDay();
      if (dow === 0 || dow === 6) continue; // weekend
      if (holidaySet.has(date)) continue;   // holiday
      
      days++;
      const isIntensive = date >= intStart && date <= intEnd;
      if (isIntensive) {
        hours += cal.daily_hours_intensive || 7;
      } else if (dow === 5) { // Friday
        hours += cal.daily_hours_v || 8;
      } else {
        hours += cal.daily_hours_lj || 8;
      }
    }
    result.push({ month: month + 1, days, hours });
  }
  return result;
}

/** Calculate annual summary */
export function calculateAnnualSummary(cal: Calendario) {
  const monthly = calculateMonthlyBreakdown(cal);
  const totalDays = monthly.reduce((s, m) => s + m.days, 0);
  const totalHours = monthly.reduce((s, m) => s + m.hours, 0);
  const effectiveDays = totalDays - (cal.vacation_days || 22) - (cal.adjustment_days || 0) - (cal.free_days || 0);
  const vacHours = (cal.vacation_days || 22) * (cal.daily_hours_lj || 8);
  const effectiveHours = totalHours - vacHours - (cal.adjustment_hours || 0);
  const diff = effectiveHours - (cal.convenio_hours || 1800);
  
  return { monthly, totalDays, totalHours, effectiveDays, effectiveHours, vacHours, diff };
}
