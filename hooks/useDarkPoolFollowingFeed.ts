import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import { queryClient } from '../lib/queryClient';
import {
  listFollowedInvestors,
  subscribeFollowChanges,
} from '../services/darkpool/darkPoolFollowService';
import {
  fetchFollowingFeed,
  type FollowingActivityItem,
} from '../services/darkpool/uwFollowingFeedService';

interface FollowingFeedData {
  items: FollowingActivityItem[];
  followingCount: number;
}

async function loadFollowing(refresh: boolean): Promise<FollowingFeedData> {
  const following = await listFollowedInvestors();
  if (!following.length) return { items: [], followingCount: 0 };
  const payload = await fetchFollowingFeed(following, refresh);
  return { items: payload.items, followingCount: following.length };
}

export function useDarkPoolFollowingFeed() {
  const forceRef = useRef(false);
  const query = useQuery<FollowingFeedData>({
    queryKey: appQueryKeys.followingFeed,
    queryFn: () => {
      const refresh = forceRef.current;
      forceRef.current = false;
      return loadFollowing(refresh);
    },
  });

  useEffect(() => {
    const unsub = subscribeFollowChanges(() => {
      forceRef.current = true;
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.followingFeed });
    });
    return unsub;
  }, []);

  const refetch = useCallback(async () => {
    forceRef.current = true;
    await query.refetch();
  }, [query]);

  return {
    items: query.data?.items ?? [],
    followingCount: query.data?.followingCount ?? 0,
    loading: query.isLoading,
    refreshing: query.isRefetching,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
