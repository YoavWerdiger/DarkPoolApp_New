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

import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import { queryClient } from '../lib/queryClient';
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
import {
  DARK_POOL_FORM4_ONLY,
  DARK_POOL_PREMIUM_GATING_ENABLED,
} from '../types/darkpool.types';
import { useSubscription } from './useSubscription';

interface DarkPoolFeedData {
  liveSignals: DarkPoolFeedItem[];
  topAccumulation: TopAccumulationRow[];
  whaleOrders: DarkPoolTradeRow[];
  confluence: DarkPoolSignalRow[];
}

const EMPTY: DarkPoolFeedData = {
  liveSignals: [],
  topAccumulation: [],
  whaleOrders: [],
  confluence: [],
};

export function useDarkPoolFeed() {
  const { isPremium: subscriptionIsPremium } = useSubscription();
  // כש-Premium gating כבוי — כולם מקבלים גישה מלאה (ללא השהייה / מגבלת כמות).
  const isPremium = DARK_POOL_PREMIUM_GATING_ENABLED ? subscriptionIsPremium : true;
  const queryKey = appQueryKeys.darkPoolFeed(isPremium);

  const query = useQuery<DarkPoolFeedData>({
    queryKey,
    queryFn: async () => {
      const [live, accumulation, whales, confluence] = await Promise.all([
        listLiveSignalsFeed({ isPremium }, isPremium ? 40 : 3),
        listTopAccumulation({ isPremium }, isPremium ? 12 : 3),
        listWhaleOrders({ isPremium }, isPremium ? 25 : 3),
        listConfluenceSignals({ isPremium }, isPremium ? 10 : 3),
      ]);
      return {
        liveSignals: live,
        topAccumulation: accumulation,
        whaleOrders: whales,
        confluence,
      };
    },
    enabled: !DARK_POOL_FORM4_ONLY,
  });

  // Realtime updates — only Premium clients (free is delayed 15min anyway).
  useEffect(() => {
    if (DARK_POOL_FORM4_ONLY || !isPremium) return;
    const liveKey = appQueryKeys.darkPoolFeed(isPremium);
    const unsub = subscribeDarkPool((e: DarkPoolRealtimeEvent) => {
      if (e.type !== 'signal') return;
      queryClient.setQueryData<DarkPoolFeedData>(liveKey, (prev) => {
        if (!prev) return prev;
        const nextSignals = upsertLive(prev.liveSignals, e.payload);
        const nextConfluence =
          e.payload.signal_type === 'INSIDER_DARKPOOL_CONFLUENCE'
            ? [e.payload, ...prev.confluence.filter((c) => c.id !== e.payload.id)].slice(0, 20)
            : prev.confluence;
        return { ...prev, liveSignals: nextSignals, confluence: nextConfluence };
      });
    });
    return () => { try { unsub(); } catch {} };
  }, [isPremium]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const data = query.data ?? EMPTY;
  return {
    liveSignals: data.liveSignals,
    topAccumulation: data.topAccumulation,
    whaleOrders: data.whaleOrders,
    confluence: data.confluence,
    loading: query.isLoading && !DARK_POOL_FORM4_ONLY,
    refreshing: query.isRefetching,
    error: query.error ? (query.error as Error).message || 'failed_to_load' : null,
    isPremium,
    refetch,
  };
}

function upsertLive(
  list: DarkPoolFeedItem[],
  signal: DarkPoolSignalRow
): DarkPoolFeedItem[] {
  const filtered = list.filter((it) => it.signal.id !== signal.id);
  return [{ signal, latestTrade: null, insiderHint: null }, ...filtered].slice(0, 50);
}
