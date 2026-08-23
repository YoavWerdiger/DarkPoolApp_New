import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  fetchInvestorProfile,
  type InvestorProfile,
} from '../services/darkpool/uwInvestorProfileService';

export function useDarkPoolInvestorProfile(
  id: string,
  kind: 'politician' | 'insider',
  ticker?: string
) {
  const forceRef = useRef(false);
  const query = useQuery<InvestorProfile>({
    queryKey: appQueryKeys.investorProfile(id, kind, ticker),
    queryFn: () => {
      const force = forceRef.current;
      forceRef.current = false;
      return fetchInvestorProfile(id, kind, ticker, force);
    },
    enabled: !!id,
    // שרת ממומש (snapshot) — cache לקוח ארוך יותר
    staleTime: 20 * 60 * 1000,
    refetchOnMount: true,
  });

  const refetch = useCallback(async () => {
    forceRef.current = true;
    await query.refetch();
  }, [query]);

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    refreshing: query.isRefetching,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
