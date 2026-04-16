// ═══ HOOKS ═══
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { Result } from '@lib/errors';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for async data loading with loading/error states.
 * Prevents the setState-on-unmounted-component bug.
 */
export function useAsync<T>(fn: () => Promise<Result<T>>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fn().then(result => {
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error.userMessage || result.error.message);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError('Error inesperado');
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [...deps, trigger]);

  return { data, loading, error, refetch };
}

/**
 * Debounce hook — returns a debounced version of the callback.
 */
export function useDebounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => fn(...args), ms));
  }, [fn, ms]) as unknown as T;
}

export { useRealtime } from './useRealtime';
export type { OnlineUser, CursorInfo, RealtimeState } from './useRealtime';
