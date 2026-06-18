import { useCallback, useEffect, useState } from 'react';
import {
  listFollowedInvestors,
  subscribeFollowChanges,
  syncFollowedFromCloud,
  type FollowedInvestor,
} from '../services/darkpool/darkPoolFollowService';

export function useFollowedInvestors() {
  const [list, setList] = useState<FollowedInvestor[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (forceSync = false) => {
    try {
      const data = forceSync
        ? await syncFollowedFromCloud()
        : await listFollowedInvestors(forceSync);
      setList(data);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void reload(true).finally(() => {
      if (!cancelled) setLoading(false);
    });
    const unsub = subscribeFollowChanges(() => {
      void reload();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [reload]);

  const refetch = useCallback(async () => {
    await reload(true);
  }, [reload]);

  return { list, loading, refetch, count: list.length };
}
