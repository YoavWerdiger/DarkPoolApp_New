import { useCallback, useEffect, useState } from 'react';
import {
  fetchInvestorProfile,
  type InvestorProfile,
} from '../services/darkpool/uwInvestorProfileService';

export function useDarkPoolInvestorProfile(
  id: string,
  kind: 'politician' | 'insider',
  ticker?: string
) {
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!id) return;
      try {
        setError(null);
        const data = await fetchInvestorProfile(id, kind, ticker, force);
        setProfile(data);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id, kind, ticker]
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
