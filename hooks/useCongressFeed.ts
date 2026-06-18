import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useCongressFeed(limit = 40, enabled = true) {
  const [trades, setTrades] = useState<CongressTradeFeedItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (!enabled) {
        setTrades([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setError(null);
      try {
        if (refresh) {
          if (!DARK_POOL_SEC_PRODUCTION) {
            await triggerCongressSync().catch(() => {
              return fetchUwCongressFeed(limit, true);
            });
          }
        }

        let rows = await listCongressTradesFromDb(limit);
        if (!rows.length && !refresh && !DARK_POOL_SEC_PRODUCTION) {
          await fetchUwCongressFeed(limit, false).catch(() => undefined);
          rows = await listCongressTradesFromDb(limit);
        }

        if (!mounted.current) return;
        const enriched = await enrichWithQuotes(rows);
        const seen = new Set<string>();
        const deduped = enriched.filter((item) => {
          if (seen.has(item.trade.id)) return false;
          seen.add(item.trade.id);
          return true;
        });
        setTrades(deduped);
      } catch (e) {
        if (!mounted.current) return;
        setError((e as Error).message);
      }
    },
    [enabled, limit]
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void load(false).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load, enabled]);

  const refetch = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  return { trades, loading, refreshing, error, refetch };
}
