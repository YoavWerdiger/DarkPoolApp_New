import { useCallback, useEffect, useState } from 'react';
import {
  fetchPoliticianMetricsFromDb,
} from '../services/darkpool/darkPoolDbCacheService';
import {
  fetchPoliticianMetrics,
  type PoliticianMetricsPayload,
} from '../services/darkpool/uwPoliticianMetricsService';

export function usePoliticianMetrics(politicianId: string, enabled = true) {
  const [data, setData] = useState<PoliticianMetricsPayload | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!enabled || !politicianId) return;
      setError(null);
      try {
        if (!force) {
          const cached = await fetchPoliticianMetricsFromDb(politicianId);
          if (cached) {
            setData(cached);
            return;
          }
        }
        setData(await fetchPoliticianMetrics(politicianId, force));
      } catch (e) {
        const cached = await fetchPoliticianMetricsFromDb(politicianId).catch(() => null);
        if (cached) setData(cached);
        else setError((e as Error).message);
      }
    },
    [enabled, politicianId]
  );

  useEffect(() => {
    if (!enabled || !politicianId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load, enabled, politicianId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await load(true);
    setLoading(false);
  }, [load]);

  return { data, loading, error, refetch };
}
