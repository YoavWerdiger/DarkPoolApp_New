import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  fetchUwTickerInsights,
  type UwTickerInsights,
} from '../services/darkpool/uwTickerInsightsService';
import { DARK_POOL_VENDOR_LIVE_APIS } from '../types/darkpool.types';

export function useUwTickerInsights(ticker: string | undefined) {
  const sym = (ticker || '').trim().toUpperCase();
  const forceRef = useRef(false);
  const query = useQuery<UwTickerInsights>({
    queryKey: appQueryKeys.tickerInsights(sym),
    queryFn: () => {
      const force = forceRef.current;
      forceRef.current = false;
      return fetchUwTickerInsights(sym, force);
    },
    enabled: !!sym && DARK_POOL_VENDOR_LIVE_APIS,
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
