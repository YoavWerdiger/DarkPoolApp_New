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

interface State {
  aggregates: DarkPoolDailyAggregateRow[];
  trades: DarkPoolTradeRow[];
  signals: DarkPoolSignalRow[];
  insiderBuys: InsiderBuyRow[];
  loading: boolean;
  isWatching: boolean;
  alertsOn: boolean;
  error: string | null;
}

const EMPTY: State = {
  aggregates: [],
  trades: [],
  signals: [],
  insiderBuys: [],
  loading: true,
  isWatching: false,
  alertsOn: false,
  error: null,
};

export function useDarkPoolTicker(ticker: string | undefined) {
  const { isPremium } = useSubscription();
  const [state, setState] = useState<State>(EMPTY);

  const load = useCallback(async () => {
    if (!ticker) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [aggregates, trades, signals, insiderBuys, watchRow] = await Promise.all([
        getTickerAggregates(ticker, 30),
        getTickerTrades(ticker, { isPremium }, isPremium ? 100 : 3),
        listSignals({ isPremium, ticker, limit: isPremium ? 20 : 3 }),
        getTickerInsiderBuys(ticker, 90),
        fetchWatchRow(ticker),
      ]);
      setState({
        aggregates,
        trades,
        signals,
        insiderBuys,
        loading: false,
        isWatching: !!watchRow,
        alertsOn: watchRow?.alerts_on ?? false,
        error: null,
      });
    } catch (e) {
      logger.warn('useDarkPoolTicker', (e as Error).message);
      setState((s) => ({ ...s, loading: false, error: (e as Error).message || 'load_failed' }));
    }
  }, [ticker, isPremium]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleWatch = useCallback(async () => {
    if (!ticker) return;
    if (state.isWatching) {
      await removeFromWatchlist(ticker);
      setState((s) => ({ ...s, isWatching: false, alertsOn: false }));
    } else {
      await addToWatchlist(ticker);
      setState((s) => ({ ...s, isWatching: true, alertsOn: true }));
    }
  }, [ticker, state.isWatching]);

  const setAlerts = useCallback(async (on: boolean) => {
    if (!ticker || !state.isWatching) return;
    await toggleWatchlistAlerts(ticker, on);
    setState((s) => ({ ...s, alertsOn: on }));
  }, [ticker, state.isWatching]);

  return { ...state, isPremium, refetch: load, toggleWatch, setAlerts };
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
