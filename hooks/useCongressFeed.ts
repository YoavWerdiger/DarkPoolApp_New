import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  listCongressTradesFromDb,
  triggerCongressSync,
} from '../services/darkpool/darkPoolDbCacheService';
import { fetchUwCongressFeed } from '../services/darkpool/uwCongressFeedService';
import { getQuotes } from '../services/portfolios/portfolioPriceFeed';
import type { PriceQuote } from '../screens/Portfolios/portfolioTypes';
import {
  buildCongressFeedItem,
  type CongressTradeFeedItem,
} from '../screens/DarkPool/utils/congressFeedCalc';
import { DARK_POOL_SEC_PRODUCTION, DARK_POOL_FEED_ENRICH_QUOTES } from '../types/darkpool.types';

export type { CongressTradeFeedItem };

const QUOTE_TIMEOUT_MS = 5_000;

async function enrichWithQuotes(
  rows: Awaited<ReturnType<typeof listCongressTradesFromDb>>
): Promise<CongressTradeFeedItem[]> {
  const symbols = DARK_POOL_FEED_ENRICH_QUOTES
    ? Array.from(new Set(rows.map((t) => t.ticker)))
    : [];
  const quotes =
    symbols.length > 0
      ? await Promise.race([
          getQuotes(symbols),
          new Promise<Map<string, PriceQuote>>((resolve) =>
            setTimeout(() => resolve(new Map()), QUOTE_TIMEOUT_MS)
          ),
        ])
      : new Map<string, PriceQuote>();
  return rows.map((trade) => buildCongressFeedItem(trade, quotes));
}

export async function loadCongress(limit: number, refresh: boolean): Promise<CongressTradeFeedItem[]> {
  if (refresh && !DARK_POOL_SEC_PRODUCTION) {
    await triggerCongressSync().catch(() => fetchUwCongressFeed(limit, true));
  }

  let rows = await listCongressTradesFromDb(limit);
  if (!rows.length && !refresh && !DARK_POOL_SEC_PRODUCTION) {
    await fetchUwCongressFeed(limit, false).catch(() => undefined);
    rows = await listCongressTradesFromDb(limit);
  }

  const enriched = await enrichWithQuotes(rows);
  const seen = new Set<string>();
  return enriched.filter((item) => {
    if (seen.has(item.trade.id)) return false;
    seen.add(item.trade.id);
    return true;
  });
}

export function useCongressFeed(limit = 40, enabled = true) {
  const forceRef = useRef(false);
  const query = useQuery<CongressTradeFeedItem[]>({
    queryKey: appQueryKeys.congressFeed(limit),
    queryFn: () => {
      const refresh = forceRef.current;
      forceRef.current = false;
      return loadCongress(limit, refresh);
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    forceRef.current = true;
    await query.refetch();
  }, [query]);

  return {
    trades: query.data ?? [],
    loading: query.isLoading,
    refreshing: query.isRefetching,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
