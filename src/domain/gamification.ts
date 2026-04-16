// ═══ GAMIFICATION — Scoring, retro tiers, achievements ═══

export type RetroTier = 'nox' | 'lumos' | 'revelio' | 'patronum';
export type House = 'gryffindor' | 'slytherin' | 'ravenclaw' | 'hufflepuff';

export const HOUSES: Record<House, { name: string; color: string; emoji: string }> = {
  gryffindor: { name: 'Gryffindor', color: '#AE0001', emoji: '🦁' },
  slytherin:  { name: 'Slytherin',  color: '#2A623D', emoji: '🐍' },
  ravenclaw:  { name: 'Ravenclaw',  color: '#0E1A40', emoji: '🦅' },
  hufflepuff: { name: 'Hufflepuff', color: '#FFDB00', emoji: '🦡' },
};

export const TIER_CONFIG: Record<RetroTier, { name: string; spell: string; color: string; minScore: number; emoji: string }> = {
  nox:      { name: 'Nox',      spell: 'Oscuridad',   color: '#86868B', minScore: 0,  emoji: '🌑' },
  lumos:    { name: 'Lumos',    spell: 'Luz básica',  color: '#FF9500', minScore: 30, emoji: '💡' },
  revelio:  { name: 'Revelio',  spell: 'Revelación',  color: '#007AFF', minScore: 60, emoji: '✨' },
  patronum: { name: 'Patronum', spell: 'Máxima magia', color: '#5856D6', minScore: 85, emoji: '🦌' },
};

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  condition: (stats: UserStats) => boolean;
}

export interface UserStats {
  tasksCompleted: number;
  tasksCompletedThisWeek: number;
  risksCreated: number;
  risksMitigated: number;
  retrosParticipated: number;
  retrosFacilitated: number;
  votesGiven: number;
  epicsCompleted: number;
  topContributorWeeks: number;
  totalPoints: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_wand',     name: 'Primera varita',       emoji: '🪄', description: 'Completa tu primera tarea', condition: s => s.tasksCompleted >= 1 },
  { id: 'prefect',        name: 'Prefecto',             emoji: '⭐', description: 'Cierra 10 tareas en una semana', condition: s => s.tasksCompletedThisWeek >= 10 },
  { id: 'snitch_seeker',  name: 'Buscador de Snitch',   emoji: '🏆', description: 'Crea 5 riesgos identificados', condition: s => s.risksCreated >= 5 },
  { id: 'dumbledore',     name: 'Profesor Dumbledore',   emoji: '🧙', description: 'Facilita 5 retrospectivas', condition: s => s.retrosFacilitated >= 5 },
  { id: 'chosen_one',     name: 'El Elegido',           emoji: '⚡', description: 'Sé top contributor 3 semanas', condition: s => s.topContributorWeeks >= 3 },
  { id: 'marauder_map',   name: 'Mapa del Merodeador',  emoji: '🗺️', description: 'Completa todas las tareas de una épica', condition: s => s.epicsCompleted >= 1 },
  { id: 'patronus',       name: 'Patronus corpóreo',    emoji: '🦌', description: 'Alcanza 100 puntos', condition: s => s.totalPoints >= 100 },
  { id: 'order_phoenix',  name: 'Orden del Fénix',      emoji: '🔥', description: 'Mitiga 10 riesgos', condition: s => s.risksMitigated >= 10 },
  { id: 'quidditch',      name: 'Capitán de Quidditch',  emoji: '🧹', description: 'Participa en 10 retros', condition: s => s.retrosParticipated >= 10 },
  { id: 'goblet',         name: 'Cáliz de Fuego',       emoji: '🏅', description: 'Alcanza 500 puntos', condition: s => s.totalPoints >= 500 },
];

// Points per action
export const POINTS = {
  taskComplete: 5,
  riskCreate: 3,
  riskMitigate: 10,
  retroVote: 1,
  retroNote: 2,
  retroAction: 3,
  retroFacilitate: 8,
};

/**
 * Evaluate retro quality → tier
 */
export function evaluateRetroTier(data: {
  notes: number;
  participants: number;
  totalMembers: number;
  actions: number;
  votes: number;
  risksReviewed: boolean;
  objectiveMet: boolean | null;
}): { tier: RetroTier; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Participation (0-25)
  const participationPct = data.totalMembers > 0 ? data.participants / data.totalMembers : 0;
  if (participationPct >= 0.8) { score += 25; reasons.push('Alta participación'); }
  else if (participationPct >= 0.5) { score += 15; reasons.push('Participación aceptable'); }
  else { score += 5; reasons.push('Baja participación'); }

  // Notes quality (0-25)
  const notesPerPerson = data.participants > 0 ? data.notes / data.participants : 0;
  if (notesPerPerson >= 3) { score += 25; reasons.push('Muchas aportaciones'); }
  else if (notesPerPerson >= 1.5) { score += 15; reasons.push('Aportaciones suficientes'); }
  else if (data.notes > 0) { score += 5; }

  // Actions (0-20)
  if (data.actions >= 5) { score += 20; reasons.push('Acciones concretas'); }
  else if (data.actions >= 2) { score += 12; }
  else if (data.actions > 0) { score += 5; }

  // Votes engagement (0-15)
  if (data.votes >= data.participants * 2) { score += 15; reasons.push('Buena votación'); }
  else if (data.votes > 0) { score += 8; }

  // Risks reviewed (0-10)
  if (data.risksReviewed) { score += 10; reasons.push('Riesgos revisados'); }

  // Objective (0-5)
  if (data.objectiveMet === true) { score += 5; reasons.push('Objetivo cumplido'); }

  const tier: RetroTier = score >= 85 ? 'patronum' : score >= 60 ? 'revelio' : score >= 30 ? 'lumos' : 'nox';
  return { tier, score, reasons };
}

/**
 * Calculate user stats from actions/risks/retros
 */
export function calculateUserStats(
  userName: string,
  actions: Array<Record<string, unknown>>,
  risks: Array<Record<string, unknown>>,
  retroMetrics: Array<Record<string, unknown>>,
): UserStats {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const myTasks = actions.filter(a => a.owner === userName);
  const completed = myTasks.filter(a => a.status === 'done' || a.status === 'archived');
  const completedThisWeek = completed.filter(a => (a.updatedAt as string || '') >= weekAgo);

  const risksCreated = risks.filter(r => r.owner === userName || r.createdBy === userName).length;
  const risksMitigated = risks.filter(r => r.status === 'mitigated' && (r.owner === userName || r.mitigatedBy === userName)).length;

  const retrosParticipated = retroMetrics.filter(m => {
    const names = m.participant_names as string[] || [];
    return names.includes(userName);
  }).length;

  // Epic completion
  const epicTasks: Record<string, { total: number; done: number }> = {};
  actions.forEach(a => {
    const epic = a.epicLink as string;
    if (!epic) return;
    if (!epicTasks[epic]) epicTasks[epic] = { total: 0, done: 0 };
    epicTasks[epic].total++;
    if (a.status === 'done' || a.status === 'archived') epicTasks[epic].done++;
  });
  const epicsCompleted = Object.values(epicTasks).filter(e => e.total > 0 && e.done === e.total).length;

  const totalPoints = completed.length * POINTS.taskComplete +
    risksCreated * POINTS.riskCreate +
    risksMitigated * POINTS.riskMitigate;

  return {
    tasksCompleted: completed.length,
    tasksCompletedThisWeek: completedThisWeek.length,
    risksCreated, risksMitigated,
    retrosParticipated,
    retrosFacilitated: 0, // would need SM tracking
    votesGiven: 0, // would need vote tracking
    epicsCompleted,
    topContributorWeeks: 0, // would need historical tracking
    totalPoints,
  };
}
