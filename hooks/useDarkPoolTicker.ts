/**
 * useDarkPoolTicker.ts
 * -----------------------------------------------------------------------------
 * Hook נקודתי לטיקר בודד — משתמש במסך פירוט מניה (Dark Pool tab).
 *
 * מחזיר:
 *   - aggregates    – שורות יומיות 30 יום אחורה (לגרפים)
 *   - trades        – הדפסות אחרונות
 *   - signals       – סיגנלים על הטיקר
 *   - insiderBuys   – רכישות בכירים 90 יום
 *   - isWatching, toggleWatch
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  addToWatchlist,
  getTickerAggregates,
  getTickerInsiderBuys,
  getTickerTrades,
  listSignals,
  removeFromWatchlist,
  toggleWatchlistAlerts,
} from '../services/darkpool/darkPoolService';
import { supabase } from '../services/supabase';
import type {
  DarkPoolDailyAggregateRow,
  DarkPoolSignalRow,
  DarkPoolTradeRow,
  InsiderBuyRow,
} from '../types/darkpool.types';
import { useSubscription } from './useSubscription';
import { logger } from '../utils/logger';

interface TickerData {
  aggregates: DarkPoolDailyAggregateRow[];
  trades: DarkPoolTradeRow[];
  signals: DarkPoolSignalRow[];
  insiderBuys: InsiderBuyRow[];
  watchRow: { ticker: string; alerts_on: boolean } | null;
}

const EMPTY_DATA: TickerData = {
  aggregates: [],
  trades: [],
  signals: [],
  insiderBuys: [],
  watchRow: null,
};

export function useDarkPoolTicker(ticker: string | undefined) {
  const { isPremium } = useSubscription();
  const [isWatching, setIsWatching] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);

  const query = useQuery<TickerData>({
    queryKey: appQueryKeys.darkPoolTicker((ticker || '').toUpperCase(), isPremium),
    queryFn: async () => {
      const sym = ticker as string;
      const [aggregates, trades, signals, insiderBuys, watchRow] = await Promise.all([
        getTickerAggregates(sym, 30),
        getTickerTrades(sym, { isPremium }, isPremium ? 100 : 3),
        listSignals({ isPremium, ticker: sym, limit: isPremium ? 20 : 3 }),
        getTickerInsiderBuys(sym, 90),
        fetchWatchRow(sym),
      ]);
      return { aggregates, trades, signals, insiderBuys, watchRow };
    },
    enabled: !!ticker,
  });

  // סנכרון מצב מעקב מתוך הנתונים שנטענו
  useEffect(() => {
    if (query.data) {
      setIsWatching(!!query.data.watchRow);
      setAlertsOn(query.data.watchRow?.alerts_on ?? false);
    }
  }, [query.data]);

  const data = query.data ?? EMPTY_DATA;

  const toggleWatch = useCallback(async () => {
    if (!ticker) return;
    if (isWatching) {
      await removeFromWatchlist(ticker);
      setIsWatching(false);
      setAlertsOn(false);
    } else {
      await addToWatchlist(ticker);
      setIsWatching(true);
      setAlertsOn(true);
    }
  }, [ticker, isWatching]);

  const setAlerts = useCallback(
    async (on: boolean) => {
      if (!ticker || !isWatching) return;
      await toggleWatchlistAlerts(ticker, on);
      setAlertsOn(on);
    },
    [ticker, isWatching]
  );

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    aggregates: data.aggregates,
    trades: data.trades,
    signals: data.signals,
    insiderBuys: data.insiderBuys,
    loading: query.isLoading,
    isWatching,
    alertsOn,
    error: query.error ? (query.error as Error).message || 'load_failed' : null,
    isPremium,
    refetch,
    toggleWatch,
    setAlerts,
  };
}

async function fetchWatchRow(ticker: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) return null;
  const { data } = await supabase
    .from('dark_pool_watchlists')
    .select('ticker, alerts_on')
    .eq('user_id', auth.user.id)
    .eq('ticker', ticker.toUpperCase())
    .maybeSingle();
  return data;
}
