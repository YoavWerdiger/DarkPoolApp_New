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
import {
  feedQuotesToPrices,
  mergeFeedQuotePrices,
  seedFeedQuoteMap,
} from '../screens/DarkPool/utils/feedQuoteCache';
import { fetchAndCacheFeedQuotes } from '../screens/DarkPool/utils/feedQuotes';
import { DARK_POOL_FEED_ENRICH_QUOTES } from '../types/darkpool.types';

interface FollowingFeedData {
  items: FollowingActivityItem[];
  followingCount: number;
  quotes: Record<string, number>;
}

async function loadFollowing(
  refresh: boolean,
  opts?: { queryKey?: readonly unknown[] }
): Promise<FollowingFeedData> {
  const following = await listFollowedInvestors();
  if (!following.length) return { items: [], followingCount: 0, quotes: {} };
  const payload = await fetchFollowingFeed(following, refresh);
  const prev = opts?.queryKey
    ? queryClient.getQueryData<FollowingFeedData>(opts.queryKey)
    : undefined;
  const seededQuotes = mergeFeedQuotePrices(
    prev?.quotes,
    feedQuotesToPrices(seedFeedQuoteMap())
  );
  const base: FollowingFeedData = {
    items: payload.items,
    followingCount: following.length,
    quotes: seededQuotes,
  };
  if (DARK_POOL_FEED_ENRICH_QUOTES && payload.items.length && opts?.queryKey) {
    void fetchAndCacheFeedQuotes(payload.items.map((item) => item.ticker))
      .then((map) => {
        queryClient.setQueryData(opts.queryKey, {
          ...base,
          quotes: mergeFeedQuotePrices(seededQuotes, feedQuotesToPrices(map)),
        });
      })
      .catch(() => undefined);
  }
  return base;
}

export function useDarkPoolFollowingFeed() {
  const forceRef = useRef(false);
  const query = useQuery<FollowingFeedData>({
    queryKey: appQueryKeys.followingFeed,
    queryFn: () => {
      const refresh = forceRef.current;
      forceRef.current = false;
      return loadFollowing(refresh, { queryKey: appQueryKeys.followingFeed });
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
    quotes: query.data?.quotes ?? {},
    loading: query.isLoading,
    refreshing: query.isRefetching,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
