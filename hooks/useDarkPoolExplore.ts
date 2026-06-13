import { useCallback, useEffect, useState } from 'react';
import {
  fetchExploreSnapshotFromDb,
  triggerExploreSync,
} from '../services/darkpool/darkPoolDbCacheService';
import {
  clearUwExploreCache,
  fetchUwExplore,
  type UwExplorePayload,
} from '../services/darkpool/uwExploreService';
import { DARK_POOL_SEC_PRODUCTION } from '../types/darkpool.types';

export function useDarkPoolExplore() {
  const [data, setData] = useState<UwExplorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      clearUwExploreCache();
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      if (!refresh) {
        const cached = await fetchExploreSnapshotFromDb();
        if (cached?.most_followed?.length || cached?.top_active?.length) {
          setData(cached);
          return;
        }
        if (DARK_POOL_SEC_PRODUCTION) {
          setData(await fetchUwExplore(false));
          return;
        }
      } else {
        await triggerExploreSync();
        const cached = await fetchExploreSnapshotFromDb();
        if (cached) {
          setData(cached);
          return;
        }
      }

      setData(await fetchUwExplore(refresh));
    } catch (e) {
      const fallback = await fetchExploreSnapshotFromDb().catch(() => null);
      if (fallback) setData(fallback);
      else {
        const msg = (e as Error).message ?? '';
        if (/[<]|\bhtml\b|doctype/i.test(msg)) {
          setError('שגיאה זמנית בטעינת גילוי — נסה שוב.');
        } else {
          setError(msg || 'שגיאה בטעינת גילוי');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, refreshing, error, refetch: () => load(true) };
}
