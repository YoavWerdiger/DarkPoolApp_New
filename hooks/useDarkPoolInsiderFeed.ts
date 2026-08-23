/**
 * useDarkPoolInsiderFeed.ts
 * -----------------------------------------------------------------------------
 * הוק לפיד "LATEST TRADES" של ה-Dark Pool — מציג רכישות בכירים אחרונות
 * מ-`dark_pool_insider_buys` (סנכרון `sync-insider-buys`, מקור עיקרי Unusual Whales).
 *
 * לכל עסקה מצרפים quote נוכחי (Finnhub/Yahoo דרך `portfolioPriceFeed`) כדי
 * להציג "Since trade +X%" כמו במסך InsiderWave.
 *
 * תומך ב-2 מצבי טאב:
 *   - 'all'        – כל הבכירים האחרונים
 *   - 'watchlist'  – רק טיקרים שהמשתמש עוקב אחריהם דרך dark_pool_watchlists
 *
 * Premium gating:
 *   - free   – top 3 רשומות, השהייה של 15 דקות
 *   - premium – ללא הגבלה
 */

import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  listRecentInsiderTrades,
  listWatchlist,
} from '../services/darkpool/darkPoolService';
import { getQuotes } from '../services/portfolios/portfolioPriceFeed';
import type { PriceQuote } from '../screens/Portfolios/portfolioTypes';
import {
  buildFeedItem,
  type InsiderTradeFeedItem,
} from '../screens/DarkPool/utils/insiderFeedCalc';
import {
  DARK_POOL_INSIDER_UW_ONLY,
  DARK_POOL_PREMIUM_GATING_ENABLED,
  DARK_POOL_FEED_ENRICH_QUOTES,
} from '../types/darkpool.types';
import { triggerInsiderSync } from '../services/darkpool/uwSignalsService';
import { fetchUwLiveInsiderFeed } from '../services/darkpool/uwInsiderFeedService';
import { useSubscription } from './useSubscription';

export type DarkPoolFeedTab = 'congress' | 'all' | 'watchlist' | 'following';
export type { InsiderTradeFeedItem };

export interface UseDarkPoolInsiderFeedOptions {
  tab: DarkPoolFeedTab;
  /** אופציונלי — מגביל את גודל ה-fetch. */
  limit?: number;
  /** כבה fetch (למשל כשמציגים רק פיד מעקב בכירים). */
  enabled?: boolean;
}

const QUOTE_ENRICH_TIMEOUT_MS = 6_000;

export async function loadInsider(
  tab: DarkPoolFeedTab,
  limit: number | undefined,
  isPremium: boolean,
  refresh: boolean
): Promise<InsiderTradeFeedItem[]> {
  let watchedTickers: string[] | undefined;
  if (tab === 'watchlist') {
    const wl = await listWatchlist().catch(() => []);
    watchedTickers = wl.map((r) => r.ticker);
    if (watchedTickers.length === 0) return [];
  }

  let trades = await listRecentInsiderTrades({
    isPremium,
    watchedTickers,
    limit: limit ?? (isPremium ? 30 : 3),
  });

  if (trades.length === 0 && DARK_POOL_INSIDER_UW_ONLY && tab !== 'watchlist') {
    try {
      trades = await fetchUwLiveInsiderFeed(limit ?? 40, refresh);
    } catch (e) {
      console.warn('uw live insider feed fallback', e);
    }
  }

  const symbols = DARK_POOL_FEED_ENRICH_QUOTES
    ? Array.from(new Set(trades.map((t) => t.ticker)))
    : [];
  const quotes = symbols.length
    ? await Promise.race([
        getQuotes(symbols),
        new Promise<Map<string, PriceQuote>>((resolve) =>
          setTimeout(() => resolve(new Map()), QUOTE_ENRICH_TIMEOUT_MS)
        ),
      ])
    : new Map<string, PriceQuote>();

  return trades.map((trade) => buildFeedItem(trade, quotes));
}

export function useDarkPoolInsiderFeed({
  tab,
  limit,
  enabled = true,
}: UseDarkPoolInsiderFeedOptions) {
  const { isPremium: subscriptionIsPremium } = useSubscription();
  // כש-Premium gating כבוי — כולם מקבלים גישה מלאה (ללא השהייה / מגבלת כמות).
  const isPremium = DARK_POOL_PREMIUM_GATING_ENABLED ? subscriptionIsPremium : true;
  const forceRef = useRef(false);

  const query = useQuery<InsiderTradeFeedItem[]>({
    queryKey: appQueryKeys.insiderFeed(tab, isPremium, limit),
    queryFn: () => {
      const refresh = forceRef.current;
      forceRef.current = false;
      return loadInsider(tab, limit, isPremium, refresh);
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    forceRef.current = true;
    try {
      await triggerInsiderSync();
    } catch (e) {
      console.warn('insider sync on refresh', e);
    }
    await query.refetch();
  }, [query]);

  return {
    trades: query.data ?? [],
    loading: query.isLoading,
    refreshing: query.isRefetching,
    error: query.error ? (query.error as Error).message : null,
    isPremium,
    refetch,
  };
}
