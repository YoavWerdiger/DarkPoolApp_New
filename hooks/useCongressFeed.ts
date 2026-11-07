import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hydrateFeedFromDisk, persistFeedToDisk } from '../services/darkpool/feedDiskCache';
import { appQueryKeys } from '../lib/appQueryKeys';
import { queryClient } from '../lib/queryClient';
import {
  listCongressTradesFromDb,
  triggerCongressSync,
} from '../services/darkpool/darkPoolDbCacheService';
import { fetchUwCongressFeed } from '../services/darkpool/uwCongressFeedService';
import {
  buildCongressFeedItem,
  type CongressTradeFeedItem,
} from '../screens/DarkPool/utils/congressFeedCalc';
import { seedFeedQuoteMap } from '../screens/DarkPool/utils/feedQuoteCache';
import { fetchAndCacheFeedQuotes } from '../screens/DarkPool/utils/feedQuotes';
import {
  congressFeedDailyBarRequest,
  fetchDailyBarsForTickers,
} from '../screens/DarkPool/utils/congressTradeOpens';
import {
  DARK_POOL_SEC_PRODUCTION,
  DARK_POOL_FEED_ENRICH_QUOTES,
  DARK_POOL_FEED_STALE_MS,
} from '../types/darkpool.types';

export type { CongressTradeFeedItem };

function congressQuoteSeed(
  queryKey?: readonly unknown[]
): ReturnType<typeof seedFeedQuoteMap> {
  const previous = queryKey
    ? queryClient.getQueryData<CongressTradeFeedItem[]>(queryKey)
    : undefined;
  return seedFeedQuoteMap({ previousItems: previous ?? [] });
}

async function enrichWithQuotes(
  rows: Awaited<ReturnType<typeof listCongressTradesFromDb>>,
  queryKey?: readonly unknown[]
): Promise<CongressTradeFeedItem[]> {
  const seeded = congressQuoteSeed(queryKey);
  if (!DARK_POOL_FEED_ENRICH_QUOTES) {
    return rows.map((trade) => buildCongressFeedItem(trade, seeded));
  }
  const quotes = await fetchAndCacheFeedQuotes(
    rows.map((t) => t.ticker),
    seeded
  );
  const barReq = congressFeedDailyBarRequest(rows);
  const dailyBars =
    barReq.tickers.length > 0
      ? await fetchDailyBarsForTickers(barReq.tickers, barReq.range).catch(
          () => new Map()
        )
      : undefined;
  return rows.map((trade) => buildCongressFeedItem(trade, quotes, dailyBars));
}

function dedupeFeed(enriched: CongressTradeFeedItem[]): CongressTradeFeedItem[] {
  const seen = new Set<string>();
  return enriched.filter((item) => {
    if (seen.has(item.trade.id)) return false;
    seen.add(item.trade.id);
    return true;
  });
}

export async function loadCongress(
  limit: number,
  refresh: boolean,
  opts?: { deferQuotes?: boolean; queryKey?: readonly unknown[] }
): Promise<CongressTradeFeedItem[]> {
  if (refresh && !DARK_POOL_SEC_PRODUCTION) {
    await triggerCongressSync().catch(() => fetchUwCongressFeed(limit, true));
  }

  let rows = await listCongressTradesFromDb(limit);
  if (!rows.length && !refresh && !DARK_POOL_SEC_PRODUCTION) {
    await fetchUwCongressFeed(limit, false).catch(() => undefined);
    rows = await listCongressTradesFromDb(limit);
  }

  const deferQuotes = opts?.deferQuotes !== false && DARK_POOL_FEED_ENRICH_QUOTES;
  const key = opts?.queryKey;
  if (!deferQuotes) {
    return dedupeFeed(await enrichWithQuotes(rows, key));
  }

  const firstPaint = dedupeFeed(
    rows.map((trade) => buildCongressFeedItem(trade, congressQuoteSeed(key)))
  );
  if (key && rows.length > 0) {
    void enrichWithQuotes(rows, key)
      .then((enriched) => {
        queryClient.setQueryData(key, dedupeFeed(enriched));
      })
      .catch(() => undefined);
  }
  return firstPaint;
}

export function useCongressFeed(limit = 40, enabled = true) {
  const forceRef = useRef(false);
  const queryKey = appQueryKeys.congressFeed(limit);

  const query = useQuery<CongressTradeFeedItem[]>({
    queryKey,
    queryFn: () => {
      const refresh = forceRef.current;
      forceRef.current = false;
      return loadCongress(limit, refresh, { deferQuotes: true, queryKey });
    },
    enabled,
    staleTime: DARK_POOL_FEED_STALE_MS,
    placeholderData: (previous) => previous ?? [],
  });

  const keyStr = JSON.stringify(queryKey);
  // כניסה אופטימיסטית: הפיד האחרון מהדיסק מיד; הרשת מרעננת ברקע בשקט
  useEffect(() => {
    if (enabled) void hydrateFeedFromDisk(queryKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, enabled]);
  useEffect(() => {
    if (!query.isPlaceholderData && query.isSuccess) persistFeedToDisk(queryKey, query.data, query.dataUpdatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.dataUpdatedAt, query.isPlaceholderData, query.isSuccess, keyStr]);

  // ספינר רק במשיכה של המשתמש — לא ברענון רקע בכניסה למסך
  const [pulling, setPulling] = useState(false);

  const refetch = useCallback(async () => {
    setPulling(true);
    try {
      forceRef.current = true;
      await query.refetch();
    } finally {
      setPulling(false);
    }
  }, [query]);

  return {
    trades: query.data ?? [],
    // אין עדיין נתונים אמיתיים (גם placeholder ריק) — שלד, לא «אין עסקאות»
    loading: !(query.data && query.data.length > 0) && (query.isLoading || query.isPlaceholderData || query.isFetching),
    refreshing: pulling,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
