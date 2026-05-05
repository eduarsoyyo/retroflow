// src/types/index.ts — Domain types backed by database tables.
//
// Conventions:
//   - Each `interface` here mirrors a row of a real Postgres table or a
//     well-defined jsonb shape (e.g. `Member.cost_rates`).
//   - Project-internal shapes that live INSIDE jsonb columns (notes,
//     actions, risks of `retros.data`) are NOT here — they're in
//     `src/types/project.ts`. We re-export them at the bottom of this
//     file so `import type { Action, Risk } from '@/types'` keeps working.
//   - Optional fields end with `| null` when the DB column is nullable
//     (matches what Supabase returns) and with `?` when the field is
//     itself missing from the payload.
//
// History: in earlier iterations this file held shapes for several
// retro-related entities (RetroData, RetroNote, RetroTask, RetroAction,
// RetroMetric, plus a normalised Risk table that never made it to the
// DB). All of those were unused by the running app and contradicted the
// actual jsonb shapes in use, so they have been removed. If a normalised
// retros schema ever ships, declare its row types here from scratch.

// ─── Core entities ───
export interface Member {
  id: string
  name: string
  username: string
  email: string
  avatar: string
  color: string
  role_label: string
  company: string
  rooms: string[]
  is_superuser: boolean
  house: string | null
  calendario_id: string | null
  vacations: VacationEntry[]
  annual_vac_days: number
  prev_year_pending: number
  created_at: string
  // ─── Finance & status fields (jsonb / optional columns) ───
  cost_rate?: number | null
  cost_rates?: CostRateEntry[] | null
  sell_rate?: number | null
  contract_type?: string | null
  convenio?: string | null
  preferences?: Record<string, unknown> | null
  manager_id?: string | null
  responsable_id?: string | null
  hire_date?: string | null
  status?: string | null
  vacation_carryover?: number | null
}

// History — fields removed in session 38 (sesión 38) because they
// existed in the type but NOT in the team_members table:
//   - phone           → never had a column in DB; only used as ''
//                       in tests to satisfy the type.
//   - dedication      → lives on org_chart, not on the member;
//                       no member.dedication is ever read by code.
//   - start_date      → idem (org_chart owns project assignment dates).
//   - end_date        → idem.
//   - convenio_id     → DB has `convenio` (text) and `calendario_id`,
//                       not a separate convenio_id column. The text
//                       column is enough; no FK to a convenios table.
// If any of these come back, add the column to team_members FIRST,
// migrate existing rows, and only then declare it here again.

export interface VacationEntry {
  date: string
  type: string
  half?: 'morning' | 'afternoon'
  // ─── Optional fields used by absence-aware calculations ───
  member_id?: string
  date_from?: string
  date_to?: string
  days?: number
  status?: string
}

export interface Room {
  slug: string
  name: string
  tipo: RoomType
  metadata: Record<string, unknown>
  cliente_id?: string | null
  // ─── Project lifecycle & finance (optional jsonb / columns) ───
  status?: string | null
  billing_type?: string | null
  budget?: number | null
  sell_rate?: number | null
  fixed_price?: number | null
  planned_hours?: number | null
  planned_start?: string | null
  planned_end?: string | null
  actual_start?: string | null
  actual_end?: string | null
  start_date?: string | null
  end_date?: string | null
  description?: string | null
  target_margin?: number | null
  risk_pct?: number | null
  cost_profiles?: CostProfile[] | null
  member_rates?: MemberRate[] | null
  member_assigns?: MemberAssign[] | null
  member_sell_rates?: MemberRate[] | null
  services?: ServiceContractEntry[] | null
  created_at?: string | null
}

export interface Cliente {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  contact_name?: string | null
  contact_email?: string | null
  notes?: string | null
  status?: string | null
  created_at?: string | null
}

export type RoomType = 'agile' | 'waterfall' | 'itil' | 'kanban'

/**
 * `retros` table row. The `data` column is jsonb with arbitrary shape
 * (notes, actions, risks, tasks, objective, currentPhase, ...). We
 * intentionally type it as `Record<string, unknown>` because:
 *   - Different fields in the jsonb are owned by different components
 *     and have evolved independently.
 *   - The canonical shapes for what's INSIDE that jsonb live in
 *     `src/types/project.ts` (Action, Risk, Note, TaskItem) and the
 *     components parse what they need.
 *   - Forcing a single nominal shape here would lie about the data.
 *
 * If at any point we move to a normalised schema (notes table, actions
 * table, etc), this opaque type goes away and rows become typed.
 */
export interface Retro {
  id: string
  sala: string
  tipo: string
  status: 'active' | 'closed'
  data: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  sala: string
  name: string
  color: string
}

/**
 * One row of `org_chart`: assignment of a member to a project.
 * A member can have several rows in the same sala for multi-period
 * dedication (sums, see `services/team.ts`).
 *
 * Note: `role` and `level` columns existed in an earlier draft of the
 * schema but were never adopted and don't exist in the running DB.
 * Removed from the type accordingly. If you ever see code reading
 * `entry.role`, suspect dead code from that legacy shape.
 */
export interface OrgChartEntry {
  id: string
  sala: string
  member_id: string
  manager_id: string | null
  dedication?: number
  start_date?: string
  end_date?: string
}

export interface Calendario {
  id: string
  name: string
  year: number
  region: string
  holidays: CalendarHoliday[]
  daily_hours_lj: number
  daily_hours_v: number
  daily_hours_intensive: number
  intensive_start: string | null
  intensive_end: string | null
  // ─── Optional finance / hours fields ───
  convenio_hours?: number | null
}

export interface CalendarHoliday {
  date: string
  name: string
}

// ─── Auth ───
export interface AuthUser {
  id: string
  name: string
  username: string
  email: string
  avatar: string
  color: string
  role_label: string
  is_superuser: boolean
  rooms: string[]
}

// ═════════════════════════════════════════════════════════════════════════════
// Finance / cost-tracking jsonb shapes — referenced from Member and Room
// ═════════════════════════════════════════════════════════════════════════════

/** Single salary entry on team_members.cost_rates (jsonb array). */
export interface CostRateEntry {
  /** First month of validity, format yyyy-mm */
  from: string
  /** Last month of validity (inclusive), yyyy-mm. Open-ended if undefined. */
  to?: string
  /** Annual gross salary in euros (preferred field) */
  salary?: number
  /** Multiplier on top of salary to estimate company cost (default 1.33) */
  multiplier?: number
  /** Legacy €/hour stored directly (pre-migration) */
  rate?: number
}

/** Member rate override on rooms.member_rates (jsonb array). */
export interface MemberRate {
  member_id: string
  from?: string
  to?: string
  rate: number
}

/** Project assignment with dedication on rooms.member_assigns (jsonb array). */
export interface MemberAssign {
  member_id: string
  /** 0..1 (1 = full time) */
  dedication: number
  from?: string
  to?: string
}

/** Cost profile bucket on rooms.cost_profiles (jsonb array). */
export interface CostProfile {
  id: string
  name: string
  rate: number
}

/** Contracted service on rooms.services (jsonb array). */
export interface ServiceContractEntry {
  id: string
  name: string
  from: string
  to: string
  cost: number
  margin_pct: number
  risk_pct: number
}

// ═════════════════════════════════════════════════════════════════════════════
// Re-exports of jsonb-domain shapes from src/types/project.ts
// ═════════════════════════════════════════════════════════════════════════════
//
// These shapes live inside `retros.data` (jsonb). They are owned by
// project.ts because that's where their semantics are documented in
// detail. Re-exported here so consumers can do a single
// `import type { Action, Risk, Note, TaskItem, Comment } from '@/types'`
// without remembering whether the type lives in the index or in a
// sub-module.

export type { Action, Risk, Note, TaskItem, Comment } from './project'
