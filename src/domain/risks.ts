// ═══ RISKS — Pure helpers ═══
import type { Risk, RiskType, EscalationLevel } from '@app-types/index';

export const RISK_TYPES: Array<{ id: RiskType; label: string; icon: string; color: string; prefix: string }> = [
  { id: 'riesgo',      label: 'Riesgo',      icon: 'R', color: '#FF9500', prefix: 'R' },
  { id: 'problema',    label: 'Problema',     icon: 'P', color: '#FF3B30', prefix: 'P' },
  { id: 'oportunidad', label: 'Oportunidad',  icon: 'O', color: '#34C759', prefix: 'O' },
];

export const ESCALATION_LEVELS: Array<{ id: EscalationLevel; label: string; color: string }> = [
  { id: 'equipo', label: 'Equipo',            color: '#34C759' },
  { id: 'jp',     label: 'Jefe de Proyecto',  color: '#FF9500' },
  { id: 'sm',     label: 'Service Manager',   color: '#FF3B30' },
  { id: 'dt',     label: 'Dirección Técnica', color: '#5856D6' },
];

export function riskTitle(r: Pick<Risk, 'title' | 'text'>): string {
  return r?.title || r?.text || '';
}

export function riskNumber(risk: Risk, allRisks: Risk[]): string {
  const type = risk.type || 'riesgo';
  const prefix = RISK_TYPES.find(t => t.id === type)?.prefix || 'R';
  const sameType = allRisks.filter(r => (r.type || 'riesgo') === type);
  const idx = sameType.findIndex(r => r.id === risk.id) + 1;
  return `${prefix}${idx || '?'}`;
}

export function nextEscalationLevel(current: EscalationLevel | undefined) {
  const idx = ESCALATION_LEVELS.findIndex(l => l.id === (current || 'equipo'));
  return idx < ESCALATION_LEVELS.length - 1 ? ESCALATION_LEVELS[idx + 1] : null;
}

export function prevEscalationLevel(current: EscalationLevel) {
  const idx = ESCALATION_LEVELS.findIndex(l => l.id === current);
  return idx > 0 ? ESCALATION_LEVELS[idx - 1] : null;
}

interface AutoEscalationResult {
  shouldEscalate: boolean;
  staleDays?: number;
  threshold?: number;
}

export function checkAutoEscalation(
  risk: Risk,
  config: Record<string, number> = { critical: 2, moderate: 5, low: 10 },
): AutoEscalationResult {
  if (risk.status === 'mitigated') return { shouldEscalate: false };
  const lastUpdate = risk.escalation?.escalatedAt || risk.createdAt;
  if (!lastUpdate) return { shouldEscalate: false };

  const staleDays = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 86400000);
  const probVal: Record<string, number> = { alta: 3, media: 2, baja: 1 };
  const impVal: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
  const score = (probVal[risk.prob] ?? 2) * (impVal[risk.impact] ?? 2);
  const sector = score >= 6 ? 'critical' : score >= 3 ? 'moderate' : 'low';
  const threshold = config[sector] ?? 5;
  const currentLevel = risk.escalation?.level || 'equipo';
  const hasNext = ESCALATION_LEVELS.findIndex(l => l.id === currentLevel) < ESCALATION_LEVELS.length - 1;

  return { shouldEscalate: staleDays >= threshold && hasNext, staleDays, threshold };
}
