import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  fetchExploreSnapshotFromDb,
  triggerExploreSync,
  triggerPersonPortraitSync,
} from '../services/darkpool/darkPoolDbCacheService';
import {
  fetchExploreFromDbDirect,
  isExplorePayloadEmpty,
} from '../services/darkpool/exploreFromDbClient';
import {
  clearUwExploreCache,
  fetchUwExplore,
  type UwExplorePayload,
} from '../services/darkpool/uwExploreService';
import { DARK_POOL_SEC_PRODUCTION } from '../types/darkpool.types';

export async function loadExplore(refresh: boolean): Promise<UwExplorePayload> {
  try {
    if (DARK_POOL_SEC_PRODUCTION) {
      let payload = await fetchExploreFromDbDirect();

        if (refresh || isExplorePayloadEmpty(payload)) {
          await triggerExploreSync().catch(() => undefined);
          await triggerPersonPortraitSync(refresh).catch(() => undefined);
          const edge = await fetchUwExplore(true).catch(() => null);
        if (edge && !isExplorePayloadEmpty(edge)) {
          payload = edge;
        } else {
          payload = await fetchExploreFromDbDirect();
        }
      }
      return payload;
    }

    if (!refresh) {
      const cached = await fetchExploreSnapshotFromDb();
      if (cached && !isExplorePayloadEmpty(cached)) return cached;
    } else {
      await triggerExploreSync();
      const cached = await fetchExploreSnapshotFromDb();
      if (cached && !isExplorePayloadEmpty(cached)) return cached;
    }

    return await fetchUwExplore(refresh);
  } catch (e) {
    const fallback = DARK_POOL_SEC_PRODUCTION
      ? await fetchExploreFromDbDirect().catch(() => null)
      : await fetchExploreSnapshotFromDb().catch(() => null);
    if (fallback && !isExplorePayloadEmpty(fallback)) return fallback;

    const msg = (e as Error).message ?? '';
    throw new Error(
      /[<]|\bhtml\b|doctype/i.test(msg)
        ? 'שגיאה זמנית בטעינת גילוי — נסה שוב.'
        : msg || 'שגיאה בטעינת גילוי'
    );
  }
}

export function useDarkPoolExplore() {
  const forceRef = useRef(false);
  const query = useQuery<UwExplorePayload>({
    queryKey: appQueryKeys.uwExplore,
    queryFn: () => {
      const refresh = forceRef.current;
      forceRef.current = false;
      if (refresh) clearUwExploreCache();
      return loadExplore(refresh);
    },
  });

  const refetch = useCallback(async () => {
    forceRef.current = true;
    await query.refetch();
  }, [query]);

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    refreshing: query.isRefetching,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
