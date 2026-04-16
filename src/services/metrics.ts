// ═══ AUTO METRICS — Generate status report from project state ═══
import type { Task, Risk, Member } from '../types/index';

export interface StatusReport {
  generatedAt: string;
  period: string;
  // Tasks
  totalTasks: number;
  completed: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  completionPct: number;
  // Velocity
  tasksCompletedThisWeek: number;
  tasksCreatedThisWeek: number;
  netFlow: number; // created - completed (positive = growing backlog)
  // Risks
  totalRisks: number;
  criticalRisks: number;
  escalatedRisks: number;
  mitigatedRisks: number;
  // Team
  teamSize: number;
  avgLoadPerPerson: number;
  topContributors: Array<{ name: string; completed: number }>;
  unassignedTasks: number;
  // Epics
  epics: Array<{ name: string; total: number; done: number; pct: number; points: number }>;
  // Health score (0-100)
  healthScore: number;
  healthLabel: string;
  healthColor: string;
  // Highlights
  highlights: string[];
  warnings: string[];
}

export function generateStatusReport(
  actions: Task[],
  risks: Risk[],
  teamMembers: Member[],
): StatusReport {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const active = actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled');
  const completed = active.filter(a => a.status === 'done' || a.status === 'archived');
  const inProgress = active.filter(a => a.status === 'doing' || a.status === 'in_progress' || a.status === 'inprogress');
  const blocked = active.filter(a => a.status === 'blocked');
  const overdue = active.filter(a => a.status !== 'done' && a.date && a.date < today);
  const completionPct = active.length > 0 ? Math.round(completed.length / active.length * 100) : 0;

  // This week
  const completedThisWeek = completed.filter(a => (a as Record<string, unknown>).updatedAt && (a as Record<string, unknown>).updatedAt as string >= weekAgo).length;
  const createdThisWeek = active.filter(a => (a as Record<string, unknown>).createdAt && (a as Record<string, unknown>).createdAt as string >= weekAgo).length;

  // Risks
  const activeRisks = (risks || []).filter(r => r.status !== 'mitigated');
  const critical = activeRisks.filter(r => r.impact === 'alto' && r.prob === 'alta');
  const escalated = activeRisks.filter(r => r.escalation?.level && r.escalation.level !== 'equipo');
  const mitigated = (risks || []).filter(r => r.status === 'mitigated');

  // Team load
  const unassigned = active.filter(a => !a.owner || a.owner === 'Sin asignar').length;
  const ownerCounts: Record<string, { open: number; done: number }> = {};
  active.forEach(a => {
    if (!a.owner || a.owner === 'Sin asignar') return;
    if (!ownerCounts[a.owner]) ownerCounts[a.owner] = { open: 0, done: 0 };
    if (a.status === 'done' || a.status === 'archived') ownerCounts[a.owner].done++;
    else ownerCounts[a.owner].open++;
  });
  const avgLoad = teamMembers.length > 0 ? Math.round(active.filter(a => a.status !== 'done').length / teamMembers.length * 10) / 10 : 0;
  const topContributors = Object.entries(ownerCounts)
    .map(([name, c]) => ({ name, completed: c.done }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  // Epics
  const epicMap: Record<string, { total: number; done: number; points: number }> = {};
  active.forEach(t => {
    const epic = (t as Record<string, unknown>).epicLink as string;
    if (!epic) return;
    if (!epicMap[epic]) epicMap[epic] = { total: 0, done: 0, points: 0 };
    epicMap[epic].total++;
    epicMap[epic].points += (t as Record<string, unknown>).hours as number || 0;
    if (t.status === 'done' || t.status === 'archived') epicMap[epic].done++;
  });
  const epics = Object.entries(epicMap).map(([name, d]) => ({
    name, ...d, pct: d.total > 0 ? Math.round(d.done / d.total * 100) : 0,
  })).sort((a, b) => b.total - a.total);

  // Health score
  let health = 70;
  if (completionPct >= 50) health += 10;
  if (completionPct >= 75) health += 10;
  if (blocked.length === 0) health += 5;
  if (overdue.length === 0) health += 10;
  if (critical.length > 0) health -= 15;
  if (escalated.length > 0) health -= 10;
  if (blocked.length > 3) health -= 10;
  if (overdue.length > 5) health -= 10;
  if (unassigned > active.length * 0.3) health -= 5;
  health = Math.max(0, Math.min(100, health));

  const healthLabel = health >= 80 ? 'Saludable' : health >= 60 ? 'Aceptable' : health >= 40 ? 'En riesgo' : 'Crítico';
  const healthColor = health >= 80 ? '#34C759' : health >= 60 ? '#FF9500' : health >= 40 ? '#FF3B30' : '#AF52DE';

  // Highlights & warnings
  const highlights: string[] = [];
  const warnings: string[] = [];

  if (completedThisWeek > 0) highlights.push(`${completedThisWeek} tarea${completedThisWeek > 1 ? 's' : ''} completada${completedThisWeek > 1 ? 's' : ''} esta semana`);
  if (completionPct >= 75) highlights.push(`${completionPct}% del trabajo completado`);
  if (mitigated.length > 0) highlights.push(`${mitigated.length} riesgo${mitigated.length > 1 ? 's' : ''} mitigado${mitigated.length > 1 ? 's' : ''}`);
  if (topContributors.length > 0 && topContributors[0].completed > 0) highlights.push(`Top contributor: ${topContributors[0].name} (${topContributors[0].completed} tareas)`);

  if (overdue.length > 0) warnings.push(`${overdue.length} tarea${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''}`);
  if (blocked.length > 0) warnings.push(`${blocked.length} tarea${blocked.length > 1 ? 's' : ''} bloqueada${blocked.length > 1 ? 's' : ''}`);
  if (critical.length > 0) warnings.push(`${critical.length} riesgo${critical.length > 1 ? 's' : ''} en zona crítica`);
  if (escalated.length > 0) warnings.push(`${escalated.length} riesgo${escalated.length > 1 ? 's' : ''} escalado${escalated.length > 1 ? 's' : ''}`);
  if (unassigned > 3) warnings.push(`${unassigned} tareas sin asignar`);
  if (createdThisWeek > completedThisWeek * 2) warnings.push('Backlog creciendo más rápido que la velocidad del equipo');

  return {
    generatedAt: now.toISOString(),
    period: `${weekAgo} — ${today}`,
    totalTasks: active.length, completed: completed.length, inProgress: inProgress.length,
    blocked: blocked.length, overdue: overdue.length, completionPct,
    tasksCompletedThisWeek: completedThisWeek, tasksCreatedThisWeek: createdThisWeek,
    netFlow: createdThisWeek - completedThisWeek,
    totalRisks: activeRisks.length, criticalRisks: critical.length, escalatedRisks: escalated.length, mitigatedRisks: mitigated.length,
    teamSize: teamMembers.length, avgLoadPerPerson: avgLoad, topContributors, unassignedTasks: unassigned,
    epics, healthScore: health, healthLabel, healthColor,
    highlights, warnings,
  };
}
