import { useCallback, useEffect, useState } from 'react';
import {
  fetchUwTickerInsights,
  type UwTickerInsights,
} from '../services/darkpool/uwTickerInsightsService';
import { DARK_POOL_VENDOR_LIVE_APIS } from '../types/darkpool.types';

export function useUwTickerInsights(ticker: string | undefined) {
  const [data, setData] = useState<UwTickerInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      const sym = (ticker || '').trim().toUpperCase();
      if (!sym || !DARK_POOL_VENDOR_LIVE_APIS) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchUwTickerInsights(sym, force);
        setData(payload);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [ticker]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: () => load(true) };
}
