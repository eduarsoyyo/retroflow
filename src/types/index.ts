import { z } from 'zod';

// ═══ ENUMS ═══

export const RiskType = z.enum(['riesgo', 'problema', 'oportunidad']);
export type RiskType = z.infer<typeof RiskType>;

export const RiskStatus = z.enum(['open', 'mitigated']);
export type RiskStatus = z.infer<typeof RiskStatus>;

export const EscalationLevel = z.enum(['equipo', 'jp', 'sm', 'dt']);
export type EscalationLevel = z.infer<typeof EscalationLevel>;

export const ImpactLevel = z.enum(['bajo', 'medio', 'alto']);
export type ImpactLevel = z.infer<typeof ImpactLevel>;

export const ProbabilityLevel = z.enum(['baja', 'media', 'alta']);
export type ProbabilityLevel = z.infer<typeof ProbabilityLevel>;

export const CriticalitySector = z.enum(['low', 'moderate', 'critical']);
export type CriticalitySector = z.infer<typeof CriticalitySector>;

export const SkillLevel = z.number().int().min(1).max(4);
export type SkillLevel = z.infer<typeof SkillLevel>;

export const TaskStatus = z.enum(['backlog', 'todo', 'pending', 'doing', 'in_progress', 'inprogress', 'blocked', 'done', 'archived', 'discarded', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const ActionType = z.enum(['formacion', 'mentoring', 'certificacion', 'practica']);
export type ActionType = z.infer<typeof ActionType>;

export const ActionStatus = z.enum(['pendiente', 'en_curso', 'completada']);
export type ActionStatus = z.infer<typeof ActionStatus>;

// ═══ CORE ENTITIES ═══

export const EscalationSchema = z.object({
  level: EscalationLevel,
  levelLabel: z.string().optional(),
  escalatedAt: z.string().optional(),
  status: z.string().optional(),
  deadline: z.string().optional(),
  memberName: z.string().optional(),
  memberId: z.string().optional(),
}).partial();

export type Escalation = z.infer<typeof EscalationSchema>;

export const RiskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'El título es obligatorio'),
  text: z.string().optional(), // backward compat
  description: z.string().default(''),
  type: RiskType.default('riesgo'),
  impact: ImpactLevel.default('medio'),
  prob: ProbabilityLevel.default('media'),
  mitigation: z.string().default(''),
  owner: z.string().default(''),
  status: RiskStatus.default('open'),
  escalation: EscalationSchema.nullable().optional(),
  impactVotes: z.record(z.number()).optional(),
  probVotes: z.record(z.number()).optional(),
  deadline: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  fromNote: z.string().optional(),
});

export type Risk = z.infer<typeof RiskSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  description: z.string().optional(),
  checklist: z.string().optional(),
  type: z.string().default('tarea'),
  owner: z.string().default(''),
  date: z.string().optional(),
  startDate: z.string().optional(),
  status: TaskStatus.default('backlog'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  hours: z.number().nullable().optional(),
  progress: z.number().min(0).max(100).default(0),
  sprint: z.string().optional(),
  epicLink: z.string().optional(),
  demandOrigin: z.string().optional(),
  source: z.string().optional(),
  voteScore: z.number().default(0),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  riskId: z.string().nullable().optional(),
  fromCategory: z.string().nullable().optional(),
  noteId: z.string().nullable().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const MemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  username: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  avatar: z.string().optional(),
  color: z.string().optional(),
  role_label: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  rooms: z.array(z.string()).default([]),
  is_superuser: z.boolean().default(false),
  vacations: z.array(z.object({
    id: z.string().optional(),
    from: z.string(),
    to: z.string().optional(),
    type: z.string().optional(),
    note: z.string().optional(),
    reason: z.string().optional(),
    name: z.string().optional(),
    memberId: z.string().optional(),
  })).default([]),
  annual_vac_days: z.number().default(22),
  prev_year_pending: z.number().default(0),
  house: z.enum(['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff']).optional(),
});

export type Member = z.infer<typeof MemberSchema>;

export const RoomSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  tipo: z.string().default('agile'),
  metadata: z.record(z.unknown()).default({}),
});

export type Room = z.infer<typeof RoomSchema>;

export const SkillProfileSchema = z.object({
  id: z.string(),
  sala: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  fte: z.number().min(0.25).max(2).default(1),
  color: z.string().default('#007AFF'),
  icon: z.string().default('🧑‍💻'),
  sort_order: z.number().default(0),
});

export type SkillProfile = z.infer<typeof SkillProfileSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  sala: z.string(),
  name: z.string().min(1),
  category: z.string().default('técnica'),
  icon: z.string().default('📘'),
});

export type Skill = z.infer<typeof SkillSchema>;

export const ProfileSkillSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  skill_id: z.string(),
  required_level: SkillLevel,
});

export type ProfileSkill = z.infer<typeof ProfileSkillSchema>;

export const MemberSkillSchema = z.object({
  id: z.string(),
  member_id: z.string(),
  skill_id: z.string(),
  current_level: SkillLevel,
  notes: z.string().default(''),
  assessed_at: z.string().optional(),
  assessed_by: z.string().optional(),
});

export type MemberSkill = z.infer<typeof MemberSkillSchema>;

// ═══ COMPUTED TYPES ═══

export interface HealthScore {
  score: number;
  color: string;
  components: {
    tareasAlDia: number;
    riesgosControlados: number;
    escaladosResueltos: number;
    encajeEquipo: number;
    coberturaEquipo: number;
  };
}

export interface GapInfo {
  member: Member;
  skill: Skill;
  required: number;
  current: number;
  gap: number;
  profileName: string;
}

export interface ProjectMetrics {
  slug: string;
  name: string;
  tasks: { total: number; done: number; overdue: number; pctDone: number };
  risks: { open: number; mitigated: number; escalated: number; critical: number };
  team: { total: number; onVacation: number; avgFit: number | null };
}

// ═══ USER / AUTH ═══

export interface AppUser {
  id: string;
  name: string;
  username?: string;
  sala?: string;
  isSuperuser?: boolean;
  _isAdmin?: boolean;
  role?: string;
  avatar?: string;
  color?: string;
}

// ═══ VACATION ═══

export interface Vacation {
  id?: string;
  from: string;
  to?: string;
  type?: string;
  note?: string;
  reason?: string;
  name?: string;
  memberId?: string;
}

// ═══ RETRO NOTE ═══

export interface RetroNote {
  id: string;
  text: string;
  category: string;
  userName: string;
  userId: string;
  color: string;
  votes: string[];
  reactions: Record<string, number>;
  createdAt: string;
}

// ═══ ORG CHART ═══

export interface OrgChartRow {
  id: string;
  sala: string;
  member_id: string;
  manager_id: string | null;
  start_date?: string;
  end_date?: string;
  dedication?: number;
}

// ═══ BADGE STATS ═══

export interface BadgeStats {
  n: number;    // notes count
  vg: number;   // votes given
  a: number;    // actions created
  cats: number; // categories used
}

// ═══ BROADCAST PAYLOAD ═══

export interface BroadcastPayload {
  from: string;
  [key: string]: unknown;
}
