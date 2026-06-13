import { useCallback, useEffect, useState } from 'react';
import {
  clearUwSignalsCache,
  fetchUwSignals,
  type UwSignalsPayload,
} from '../services/darkpool/uwSignalsService';

export function useUwSignals() {
  const [data, setData] = useState<UwSignalsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) clearUwSignalsCache();
    setError(null);
    try {
      setData(await fetchUwSignals(force));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    error,
    refetch: () => load(true),
  };
}
