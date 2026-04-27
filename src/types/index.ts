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
  phone: string
  rooms: string[]
  is_superuser: boolean
  house: string | null
  dedication: number
  start_date: string | null
  end_date: string | null
  calendario_id: string | null
  convenio_id: string | null
  vacations: VacationEntry[]
  annual_vac_days: number
  prev_year_pending: number
  created_at: string
}

export interface VacationEntry {
  date: string
  type: string
  half?: 'morning' | 'afternoon'
}

export interface Room {
  slug: string
  name: string
  tipo: RoomType
  metadata: Record<string, unknown>
}

export type RoomType = 'agile' | 'waterfall' | 'itil' | 'kanban'

export interface Retro {
  id: string
  sala: string
  tipo: string
  status: 'active' | 'closed'
  data: RetroData
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RetroData {
  objective?: string
  notes?: RetroNote[]
  risks?: Risk[]
  tasks?: RetroTask[]
  actions?: RetroAction[]
}

export interface RetroNote {
  id: string
  text: string
  category: 'good' | 'bad' | 'start' | 'stop'
  author: string
  votes: string[]
  reactions: Record<string, string[]>
}

export interface RetroTask {
  id: string
  text: string
  status: 'done' | 'partial' | 'not'
}

export interface RetroAction {
  id: string
  title: string
  description?: string
  owner?: string
  status: string
  priority: string
  source?: string
}

export interface Risk {
  id: string
  title: string
  description?: string
  probability: number
  impact: number
  criticality: number
  status: string
  owner?: string
  mitigation?: string
  sala?: string
}

export interface Tag {
  id: string
  sala: string
  name: string
  color: string
}

export interface OrgChartEntry {
  id: string
  sala: string
  member_id: string
  manager_id: string | null
  role: string
  level: number
}

export interface SkillProfile {
  id: string
  sala: string
  name: string
  description: string
  fte: number
  color: string
  icon: string
  sort_order: number
}

export interface Skill {
  id: string
  sala: string
  name: string
  category: string
  icon: string
  description: string
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
  intensive_from: string | null
  intensive_to: string | null
}

export interface CalendarHoliday {
  date: string
  name: string
}

export interface Convenio {
  id: string
  name: string
  vac_days: number
  extra_days: unknown[]
  notes: string
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

// ─── Retro Metrics ───

export interface RetroMetric {
  id: string
  sala: string
  tipo: string
  date: string
  notes: number
  actions: number
  risks: number
  participants: number
  participant_names: string[]
  objective: string
  tasks: RetroTask[]
  phase_times: Record<string, number>
  total_time: number
  tier: string
  score: number
  created_at: string
}
