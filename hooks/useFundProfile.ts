import { useCallback, useEffect, useState } from 'react';
import { fetchFundProfile, type FundProfile } from '../services/darkpool/uwFundProfileService';

export function useFundProfile(cik: string) {
  const [profile, setProfile] = useState<FundProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!cik) return;
      try {
        setError(null);
        setProfile(await fetchFundProfile(cik, force));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [cik]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refetch = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  return { profile, loading, refreshing, error, refetch };
}
