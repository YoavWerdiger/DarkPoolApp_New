import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import { fetchFundProfile, type FundProfile } from '../services/darkpool/uwFundProfileService';

export function useFundProfile(cik: string) {
  const forceRef = useRef(false);
  const query = useQuery<FundProfile>({
    queryKey: appQueryKeys.fundProfile(cik),
    queryFn: () => {
      const force = forceRef.current;
      forceRef.current = false;
      return fetchFundProfile(cik, force);
    },
    enabled: !!cik,
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
