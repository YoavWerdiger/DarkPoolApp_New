/**
 * useDarkPoolFeed.ts
 * -----------------------------------------------------------------------------
 * React hook לשליפת ה-feed הראשי של Dark Pool Intelligence.
 *
 * מחזיר:
 *   - liveSignals    – Live Signals (top score, premium-gated)
 *   - topAccumulation – Top Accumulation (horizontal scroll cards)
 *   - whaleOrders     – הדפסות > $1M
 *   - confluence      – INSIDER_DARKPOOL_CONFLUENCE
 *   - loading, refreshing, refetch, error
 *
 * משתמש ב-realtime subscription כדי לעדכן את liveSignals כשמופיע סיגנל חדש.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listLiveSignalsFeed,
  listTopAccumulation,
  listWhaleOrders,
  listConfluenceSignals,
  subscribeDarkPool,
  type DarkPoolRealtimeEvent,
} from '../services/darkpool/darkPoolService';
import type {
  DarkPoolFeedItem,
  DarkPoolSignalRow,
  DarkPoolTradeRow,
  TopAccumulationRow,
} from '../types/darkpool.types';
import { DARK_POOL_PREMIUM_GATING_ENABLED } from '../types/darkpool.types';
import { useSubscription } from './useSubscription';

interface UseDarkPoolFeedState {
  liveSignals: DarkPoolFeedItem[];
  topAccumulation: TopAccumulationRow[];
  whaleOrders: DarkPoolTradeRow[];
  confluence: DarkPoolSignalRow[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export function useDarkPoolFeed() {
  const { isPremium: subscriptionIsPremium } = useSubscription();
  // כש-Premium gating כבוי — כולם מקבלים גישה מלאה (ללא השהייה / מגבלת כמות).
  const isPremium = DARK_POOL_PREMIUM_GATING_ENABLED ? subscriptionIsPremium : true;
  const [state, setState] = useState<UseDarkPoolFeedState>({
    liveSignals: [],
    topAccumulation: [],
    whaleOrders: [],
    confluence: [],
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
      const [live, accumulation, whales, confluence] = await Promise.all([
        listLiveSignalsFeed({ isPremium }, isPremium ? 40 : 3),
        listTopAccumulation({ isPremium }, isPremium ? 12 : 3),
        listWhaleOrders({ isPremium }, isPremium ? 25 : 3),
        listConfluenceSignals({ isPremium }, isPremium ? 10 : 3),
      ]);
      if (!mounted.current) return;
      setState({
        liveSignals: live,
        topAccumulation: accumulation,
        whaleOrders: whales,
        confluence,
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
  }, [isPremium]);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Realtime updates — only Premium clients (free is delayed 15min anyway).
  useEffect(() => {
    if (!isPremium) return;
    const unsub = subscribeDarkPool((e: DarkPoolRealtimeEvent) => {
      if (e.type !== 'signal') return;
      setState((s) => {
        const nextSignals = upsertLive(s.liveSignals, e.payload);
        const nextConfluence =
          e.payload.signal_type === 'INSIDER_DARKPOOL_CONFLUENCE'
            ? [e.payload, ...s.confluence.filter((c) => c.id !== e.payload.id)].slice(0, 20)
            : s.confluence;
        return { ...s, liveSignals: nextSignals, confluence: nextConfluence };
      });
    });
    return () => { try { unsub(); } catch {} };
  }, [isPremium]);

  const refetch = useCallback(() => load(true), [load]);
  return { ...state, isPremium, refetch };
}

function upsertLive(
  list: DarkPoolFeedItem[],
  signal: DarkPoolSignalRow
): DarkPoolFeedItem[] {
  const filtered = list.filter((it) => it.signal.id !== signal.id);
  return [{ signal, latestTrade: null, insiderHint: null }, ...filtered].slice(0, 50);
}
