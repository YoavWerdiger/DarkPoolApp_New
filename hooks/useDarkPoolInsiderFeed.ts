/**
 * useDarkPoolInsiderFeed.ts
 * -----------------------------------------------------------------------------
 * הוק לפיד "LATEST TRADES" של ה-Dark Pool — מציג רכישות בכירים אחרונות
 * שזרמו דרך Form4Api (`sync-insider-buys` → `dark_pool_insider_buys`).
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

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { DARK_POOL_PREMIUM_GATING_ENABLED } from '../types/darkpool.types';
import { useSubscription } from './useSubscription';

export type DarkPoolFeedTab = 'all' | 'watchlist';
export type { InsiderTradeFeedItem };

interface UseDarkPoolInsiderFeedState {
  trades: InsiderTradeFeedItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export interface UseDarkPoolInsiderFeedOptions {
  tab: DarkPoolFeedTab;
  /** אופציונלי — מגביל את גודל ה-fetch. */
  limit?: number;
}

const QUOTE_ENRICH_TIMEOUT_MS = 6_000;

export function useDarkPoolInsiderFeed({
  tab,
  limit,
}: UseDarkPoolInsiderFeedOptions) {
  const { isPremium: subscriptionIsPremium } = useSubscription();
  // כש-Premium gating כבוי — כולם מקבלים גישה מלאה (ללא השהייה / מגבלת כמות).
  const isPremium = DARK_POOL_PREMIUM_GATING_ENABLED ? subscriptionIsPremium : true;
  const [state, setState] = useState<UseDarkPoolInsiderFeedState>({
    trades: [],
    loading: true,
    refreshing: false,
    error: null,
  });
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async (refresh = false) => {
    setState((s) => ({
      ...s,
      loading: refresh ? s.loading : true,
      refreshing: refresh,
      error: null,
    }));
    try {
      let watchedTickers: string[] | undefined;
      if (tab === 'watchlist') {
        const wl = await listWatchlist().catch(() => []);
        watchedTickers = wl.map((r) => r.ticker);
        if (watchedTickers.length === 0) {
          if (!mounted.current) return;
          setState({
            trades: [],
            loading: false,
            refreshing: false,
            error: null,
          });
          return;
        }
      }

      const trades = await listRecentInsiderTrades({
        isPremium,
        watchedTickers,
        limit: limit ?? (isPremium ? 30 : 3),
      });

      // העשרה במחירים שוטפים — עם timeout כדי לא לתקוע את ה-UI.
      const symbols = Array.from(new Set(trades.map((t) => t.ticker)));
      const quotes = symbols.length
        ? await Promise.race([
            getQuotes(symbols),
            new Promise<Map<string, PriceQuote>>((resolve) =>
              setTimeout(() => resolve(new Map()), QUOTE_ENRICH_TIMEOUT_MS)
            ),
          ])
        : new Map<string, PriceQuote>();

      if (!mounted.current) return;
      setState({
        trades: trades.map((trade) => buildFeedItem(trade, quotes)),
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (e) {
      if (!mounted.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        error: (e as Error).message || 'failed_to_load',
      }));
    }
  }, [tab, limit, isPremium]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);
  return { ...state, isPremium, refetch };
}
