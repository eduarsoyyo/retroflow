// ═══ PREDICTION — Delivery probability based on historical velocity ═══

export interface SprintVelocity {
  sprint: string;
  planned: number;
  completed: number;
  date: string;
}

export interface PredictionResult {
  avgVelocity: number;
  stdDev: number;
  remaining: number;
  sprintsNeeded: number;
  confidence: {
    optimistic: number;   // sprints at 85th percentile velocity
    expected: number;     // sprints at average velocity
    pessimistic: number;  // sprints at 15th percentile velocity
  };
  estimatedDate: {
    optimistic: string;
    expected: string;
    pessimistic: string;
  };
  probability: number;  // 0-100% chance of finishing in X sprints
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Calculate delivery prediction from velocity history.
 * Uses Monte Carlo-style confidence intervals.
 */
export function predictDelivery(
  velocities: SprintVelocity[],
  remainingPoints: number,
  sprintLengthDays: number = 14,
): PredictionResult | null {
  if (velocities.length < 2) return null;

  const completed = velocities.map(v => v.completed).filter(c => c > 0);
  if (completed.length < 2) return null;

  // Average and standard deviation
  const avg = completed.reduce((s, v) => s + v, 0) / completed.length;
  const variance = completed.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / completed.length;
  const std = Math.sqrt(variance);

  // Confidence intervals (assuming normal distribution)
  const velOptimistic = avg + std;          // ~85th percentile
  const velPessimistic = Math.max(1, avg - std); // ~15th percentile

  // Sprints needed
  const sprintsExpected = Math.ceil(remainingPoints / avg);
  const sprintsOptimistic = Math.ceil(remainingPoints / velOptimistic);
  const sprintsPessimistic = Math.ceil(remainingPoints / velPessimistic);

  // Estimated dates
  const today = new Date();
  const addDays = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r.toISOString().slice(0, 10);
  };

  // Trend: compare last 3 vs first 3
  let trend: PredictionResult['trend'] = 'stable';
  if (completed.length >= 4) {
    const recent = completed.slice(-3);
    const early = completed.slice(0, 3);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const earlyAvg = early.reduce((s, v) => s + v, 0) / early.length;
    if (recentAvg > earlyAvg * 1.15) trend = 'improving';
    else if (recentAvg < earlyAvg * 0.85) trend = 'declining';
  }

  // Probability of finishing within sprintsExpected (using z-score)
  const targetVelocity = remainingPoints / sprintsExpected;
  const zScore = std > 0 ? (avg - targetVelocity) / std : 2;
  const probability = Math.min(99, Math.max(5, Math.round(normalCDF(zScore) * 100)));

  return {
    avgVelocity: Math.round(avg * 10) / 10,
    stdDev: Math.round(std * 10) / 10,
    remaining: remainingPoints,
    sprintsNeeded: sprintsExpected,
    confidence: {
      optimistic: sprintsOptimistic,
      expected: sprintsExpected,
      pessimistic: sprintsPessimistic,
    },
    estimatedDate: {
      optimistic: addDays(today, sprintsOptimistic * sprintLengthDays),
      expected: addDays(today, sprintsExpected * sprintLengthDays),
      pessimistic: addDays(today, sprintsPessimistic * sprintLengthDays),
    },
    probability,
    trend,
  };
}

/** Approximate normal CDF */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327;
  const p = d * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Extract velocity data from task completion dates (weekly buckets, no sprints needed)
 */
export function extractVelocities(
  actions: Array<Record<string, unknown>>,
): SprintVelocity[] {
  // Group completed tasks by ISO week
  const weekMap: Record<string, { planned: number; completed: number }> = {};

  actions.forEach(a => {
    const date = (a.updatedAt || a.createdAt || a.date || '') as string;
    if (!date) return;
    const d = new Date(date);
    // ISO week key
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `S${weekNum}`;
    const pts = (a.hours as number) || 1;

    if (!weekMap[key]) weekMap[key] = { planned: 0, completed: 0 };
    weekMap[key].planned += pts;
    if (a.status === 'done' || a.status === 'archived') weekMap[key].completed += pts;
  });

  return Object.entries(weekMap)
    .map(([sprint, data]) => ({ sprint, ...data, date: '' }))
    .filter(v => v.completed > 0)
    .slice(-12); // Last 12 weeks max
}
