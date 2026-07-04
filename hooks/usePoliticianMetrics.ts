import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import { fetchPoliticianMetricsFromDb } from '../services/darkpool/darkPoolDbCacheService';
import {
  fetchPoliticianMetrics,
  type PoliticianMetricsPayload,
} from '../services/darkpool/uwPoliticianMetricsService';

async function loadMetrics(
  politicianId: string,
  force: boolean
): Promise<PoliticianMetricsPayload | null> {
  try {
    if (!force) {
      const cached = await fetchPoliticianMetricsFromDb(politicianId);
      if (cached) return cached;
    }
    return await fetchPoliticianMetrics(politicianId, force);
  } catch (e) {
    const cached = await fetchPoliticianMetricsFromDb(politicianId).catch(() => null);
    if (cached) return cached;
    throw e;
  }
}

export function usePoliticianMetrics(politicianId: string, enabled = true) {
  const forceRef = useRef(false);
  const query = useQuery<PoliticianMetricsPayload | null>({
    queryKey: appQueryKeys.politicianMetrics(politicianId),
    queryFn: () => {
      const force = forceRef.current;
      forceRef.current = false;
      return loadMetrics(politicianId, force);
    },
    enabled: enabled && !!politicianId,
  });

  const refetch = useCallback(async () => {
    forceRef.current = true;
    await query.refetch();
  }, [query]);

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
