import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  clearUwSignalsCache,
  fetchUwSignals,
  type UwSignalsPayload,
} from '../services/darkpool/uwSignalsService';

export function useUwSignals() {
  const forceRef = useRef(false);
  const query = useQuery<UwSignalsPayload>({
    queryKey: appQueryKeys.uwSignals,
    queryFn: () => {
      const force = forceRef.current;
      forceRef.current = false;
      if (force) clearUwSignalsCache();
      return fetchUwSignals(force);
    },
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
