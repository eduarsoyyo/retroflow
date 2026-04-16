// ═══ RETRO SERVICE — Lifecycle management, auto-save, finalization ═══
import { saveRetroSnapshot, createRetroArchive, saveMetric, loadRetroHistory } from '@data/retros';
import { createLogger } from '@lib/logger';
import type { Result } from '@lib/errors';
import { ok, err, DataError } from '@lib/errors';

const log = createLogger('service:retro');

export interface RetroState {
  notes: unknown[];
  actions: unknown[];
  risks: unknown[];
  objective?: string;
  tasks?: unknown[];
}

/**
 * Auto-save retro state to Supabase.
 * Called every 5s by the RetroBoard component.
 * Guards against saving empty state over existing data.
 */
export async function autoSave(
  sala: string, tipo: string, state: RetroState, userId: string | null,
): Promise<Result<void>> {
  // Anti-corruption guard: don't save empty over non-empty
  const hasData = (state.notes?.length ?? 0) > 0 ||
                  (state.actions?.length ?? 0) > 0 ||
                  (state.risks?.length ?? 0) > 0;
  
  if (!hasData) {
    log.debug('Skipping auto-save: empty state');
    return ok(undefined);
  }

  return saveRetroSnapshot(sala, tipo, state, userId, 'active');
}

/**
 * Finalize a retro: archive the snapshot and save metrics.
 */
export async function finalizeRetro(
  sala: string, tipo: string, state: RetroState, userId: string | null,
  phaseTimes: Record<number, number>,
): Promise<Result<void>> {
  try {
    // 1. Archive the retro
    await createRetroArchive(sala, tipo, state, userId);

    // 2. Save metrics
    const participants = [...new Set((state.notes as any[]).map(n => n.userName))];
    await saveMetric(sala, {
      date: new Date().toISOString(),
      notes: state.notes.length,
      participants: participants.length,
      participantNames: participants,
      actions: state.actions.length,
      actionsDone: (state.actions as any[]).filter(a => a.status === 'done' || a.status === 'archived').length,
      votes: (state.notes as any[]).reduce((s, n) => s + (n.votes?.length || 0), 0),
      objective: state.objective || null,
      tasksDone: (state.tasks as any[] || []).filter(t => t.done).length,
      tasksTotal: (state.tasks as any[] || []).length,
    });

    log.info('Retro finalized', { sala, notes: state.notes.length });
    return ok(undefined);
  } catch (e) {
    log.error('finalizeRetro failed', e);
    return err(new DataError('Failed to finalize retro'));
  }
}

/**
 * Load retro history for a project.
 */
export async function getRetroHistory(sala: string) {
  return loadRetroHistory(sala);
}

/**
 * Persist phase to localStorage for session recovery.
 */
export function savePhaseLocal(sala: string, phase: number) {
  try { localStorage.setItem(`rf-phase-${sala}`, String(phase)); } catch {}
}

export function loadPhaseLocal(sala: string): number {
  try { return parseInt(localStorage.getItem(`rf-phase-${sala}`) || '0', 10); } catch { return 0; }
}

/**
 * Persist phase times to localStorage.
 */
export function savePhaseTimes(sala: string, times: Record<number, number>) {
  try { localStorage.setItem(`rf-phase-times-${sala}`, JSON.stringify(times)); } catch {}
}

export function loadPhaseTimes(sala: string): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(`rf-phase-times-${sala}`) || '{}'); } catch { return {}; }
}
