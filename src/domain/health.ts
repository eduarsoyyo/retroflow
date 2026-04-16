// ═══ SERVICE HEALTH — Composite health score ═══
import type { HealthScore } from '@app-types/index';

export interface HealthMetrics {
  totalTasks: number;
  tasksDone: number;
  tasksOnTrack: number;
  risksOpen: number;
  risksMitigated: number;
  risksEscalated: number;
  risksTotal: number;
  avgFitPercent: number;
  coveragePercent: number;
}

const WEIGHTS = {
  tareasAlDia: 30,
  riesgosControlados: 25,
  escaladosResueltos: 15,
  encajeEquipo: 20,
  coberturaEquipo: 10,
} as const;

export function calculateHealth(m: Partial<HealthMetrics>): HealthScore {
  const {
    totalTasks = 0, tasksDone = 0, tasksOnTrack = 0,
    risksOpen = 0, risksMitigated = 0, risksEscalated = 0, risksTotal = 0,
    avgFitPercent = 0, coveragePercent = 0,
  } = m;

  const tareasAlDia = totalTasks > 0 ? (tasksDone + tasksOnTrack) / totalTasks : 1;
  const riesgosControlados = (risksMitigated + risksOpen) > 0 ? risksMitigated / (risksMitigated + risksOpen) : 1;
  const escaladosResueltos = risksTotal > 0 ? 1 - (risksEscalated / risksTotal) : 1;
  const encajeEquipo = avgFitPercent / 100;
  const coberturaEquipo = coveragePercent / 100;

  const score = Math.round(
    tareasAlDia * WEIGHTS.tareasAlDia +
    riesgosControlados * WEIGHTS.riesgosControlados +
    escaladosResueltos * WEIGHTS.escaladosResueltos +
    encajeEquipo * WEIGHTS.encajeEquipo +
    coberturaEquipo * WEIGHTS.coberturaEquipo,
  );

  return {
    score,
    color: score >= 80 ? '#34C759' : score >= 60 ? '#FF9500' : '#FF3B30',
    components: {
      tareasAlDia: Math.round(tareasAlDia * 100),
      riesgosControlados: Math.round(riesgosControlados * 100),
      escaladosResueltos: Math.round(escaladosResueltos * 100),
      encajeEquipo: avgFitPercent,
      coberturaEquipo: coveragePercent,
    },
  };
}
