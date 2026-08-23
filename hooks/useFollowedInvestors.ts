import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import { queryClient } from '../lib/queryClient';
import {
  listFollowedInvestors,
  subscribeFollowChanges,
  syncFollowedFromCloud,
  type FollowedInvestor,
} from '../services/darkpool/darkPoolFollowService';

export function useFollowedInvestors() {
  // הטעינה הראשונה מסנכרנת מהענן; רענונים מקומיים קוראים מהמטמון המקומי
  const forceRef = useRef(true);
  const query = useQuery<FollowedInvestor[]>({
    queryKey: appQueryKeys.followedInvestors,
    queryFn: async () => {
      const force = forceRef.current;
      forceRef.current = false;
      try {
        return force ? await syncFollowedFromCloud() : await listFollowedInvestors(false);
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    // Prefer setQueryData over invalidate — list is already written; avoid refetch lag
    const unsub = subscribeFollowChanges((list) => {
      if (list) {
        queryClient.setQueryData(appQueryKeys.followedInvestors, list);
        return;
      }
      void listFollowedInvestors(false)
        .then((fresh) => {
          queryClient.setQueryData(appQueryKeys.followedInvestors, fresh);
        })
        .catch(() => {
          void queryClient.invalidateQueries({ queryKey: appQueryKeys.followedInvestors });
        });
    });
    return unsub;
  }, []);

  const refetch = useCallback(async () => {
    forceRef.current = true;
    await query.refetch();
  }, [query]);

  const list = query.data ?? [];
  return { list, loading: query.isLoading, refetch, count: list.length };
}
