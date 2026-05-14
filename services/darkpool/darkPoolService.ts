/**
 * darkPoolService.ts
 * -----------------------------------------------------------------------------
 * שירות לקוח (React Native) לפיצ'ר Dark Pool:
 *   - שליפת live signals + Top Accumulation + Whale orders + Confluence
 *   - watchlist (add / remove / list)
 *   - per-ticker series (charts)
 *
 * השכבה משתמשת ב-RLS — כל קריאה מאומתת אוטומטית דרך supabase client.
 *
 * Premium Lock:
 *   - free users → רואים רק רשומות עם detected_at < now() - 15 דקות, ועד 3 שורות
 *   - premium    → ללא הגבלה
 *   ה-API מקבל `{ isPremium }` כפרמטר; ב-UI מספיק להזריק את ערך `useSubscription`.
 */

import { supabase } from '../../lib/supabase';
import type {
  DarkPoolDailyAggregateRow,
  DarkPoolFeedItem,
  DarkPoolSignalRow,
  DarkPoolSignalType,
  DarkPoolTradeRow,
  DarkPoolWatchlistRow,
  InsiderBuyRow,
  TopAccumulationRow,
} from '../../types/darkpool.types';
import {
  DARK_POOL_FREE_DELAY_MINUTES,
  DARK_POOL_FREE_TOP_N,
} from '../../types/darkpool.types';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Generic guards
// ---------------------------------------------------------------------------

export interface PremiumGate {
  isPremium: boolean;
}

function buildDelayedCutoff(): string {
  const cutoff = new Date(Date.now() - DARK_POOL_FREE_DELAY_MINUTES * 60_000);
  return cutoff.toISOString();
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export interface ListSignalsParams extends PremiumGate {
  /** מסנן לפי סוג סיגנל ספציפי. */
  signalType?: DarkPoolSignalType | DarkPoolSignalType[];
  /** מסנן לפי טיקר. */
  ticker?: string;
  /** מספר תוצאות (default 50). */
  limit?: number;
  /** ציון מינימלי. */
  minScore?: number;
  /** since ISO. */
  since?: string;
}

export async function listSignals(
  params: ListSignalsParams
): Promise<DarkPoolSignalRow[]> {
  const limit = clampLimit(params.limit ?? 50, params.isPremium);
  let q = supabase
    .from('dark_pool_signals')
    .select('*')
    .order('score', { ascending: false })
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (!params.isPremium) {
    q = q.lte('detected_at', buildDelayedCutoff());
  }
  if (params.ticker) q = q.eq('ticker', params.ticker.toUpperCase());
  if (params.minScore != null) q = q.gte('score', params.minScore);
  if (params.since) q = q.gte('detected_at', params.since);
  if (params.signalType) {
    const arr = Array.isArray(params.signalType)
      ? params.signalType
      : [params.signalType];
    q = q.in('signal_type', arr);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DarkPoolSignalRow[];
}

export async function listLiveSignalsFeed(
  gate: PremiumGate,
  limit = 30
): Promise<DarkPoolFeedItem[]> {
  const signals = await listSignals({
    isPremium: gate.isPremium,
    limit,
  });
  if (!signals.length) return [];
  const tickers = Array.from(new Set(signals.map((s) => s.ticker)));
  const { data: trades } = await supabase
    .from('dark_pool_trades')
    .select('*')
    .in('ticker', tickers)
    .order('ts', { ascending: false })
    .limit(tickers.length * 3);
  const latestByTicker = new Map<string, DarkPoolTradeRow>();
  for (const t of (trades ?? []) as DarkPoolTradeRow[]) {
    if (!latestByTicker.has(t.ticker)) latestByTicker.set(t.ticker, t);
  }
  return signals.map((signal) => ({
    signal,
    latestTrade: latestByTicker.get(signal.ticker) ?? null,
    insiderHint:
      signal.signal_type === 'INSIDER_DARKPOOL_CONFLUENCE'
        ? {
            insider_name: signal.metrics?.insider_name ?? null,
            value: Number(signal.metrics?.insider_value) || 0,
            days_ago: Number(signal.metrics?.insider_days_ago) || 0,
          }
        : null,
  }));
}

export async function listConfluenceSignals(
  gate: PremiumGate,
  limit = 10
): Promise<DarkPoolSignalRow[]> {
  return listSignals({
    isPremium: gate.isPremium,
    signalType: 'INSIDER_DARKPOOL_CONFLUENCE',
    limit,
  });
}

// ---------------------------------------------------------------------------
// Whales (>= $1M prints)
// ---------------------------------------------------------------------------

export async function listWhaleOrders(
  gate: PremiumGate,
  limit = 20
): Promise<DarkPoolTradeRow[]> {
  const max = clampLimit(limit, gate.isPremium);
  let q = supabase
    .from('v_dark_pool_recent_whales')
    .select('*')
    .order('premium', { ascending: false })
    .limit(max);
  if (!gate.isPremium) q = q.lte('ts', buildDelayedCutoff());
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DarkPoolTradeRow[];
}

// ---------------------------------------------------------------------------
// Top Accumulation
// ---------------------------------------------------------------------------

export async function listTopAccumulation(
  gate: PremiumGate,
  limit = 10
): Promise<TopAccumulationRow[]> {
  const max = clampLimit(limit, gate.isPremium);
  const { data, error } = await supabase
    .from('v_dark_pool_top_accumulation_3d')
    .select('*')
    .limit(max);
  if (error) throw error;
  return (data ?? []) as TopAccumulationRow[];
}

// ---------------------------------------------------------------------------
// Ticker-level data
// ---------------------------------------------------------------------------

export async function getTickerTrades(
  ticker: string,
  gate: PremiumGate,
  limit = 100
): Promise<DarkPoolTradeRow[]> {
  let q = supabase
    .from('dark_pool_trades')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .order('ts', { ascending: false })
    .limit(limit);
  if (!gate.isPremium) q = q.lte('ts', buildDelayedCutoff());
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DarkPoolTradeRow[];
}

export async function getTickerAggregates(
  ticker: string,
  days = 30
): Promise<DarkPoolDailyAggregateRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('dark_pool_daily_aggregates')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DarkPoolDailyAggregateRow[];
}

export async function getTickerInsiderBuys(
  ticker: string,
  days = 90
): Promise<InsiderBuyRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('dark_pool_insider_buys')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .gte('transaction_date', since.toISOString().slice(0, 10))
    .order('transaction_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InsiderBuyRow[];
}

// ---------------------------------------------------------------------------
// Insider trade feed (Form4Api)
//   מציג את ה־"LATEST TRADES" — רכישות/מכירות בכירים שזרמו דרך
//   sync-insider-buys (Form4Api). כשהמשתמש סומן watchlist, יש סינון
//   לטיקרים שבעבירה (Following).
// ---------------------------------------------------------------------------

export interface ListInsiderTradesParams extends PremiumGate {
  /** סנן רק לטיקרים מ-watchlist של המשתמש (Following tab). */
  watchedTickers?: string[];
  /** מספר תוצאות (default 30). */
  limit?: number;
  /** מסנן לפי סוג עסקה (default: P = רכישה). */
  transactionTypes?: Array<InsiderBuyRow['transaction_type']>;
  /** ימים אחורה (default 30). */
  daysBack?: number;
}

export async function listRecentInsiderTrades(
  params: ListInsiderTradesParams
): Promise<InsiderBuyRow[]> {
  const limit = clampLimit(params.limit ?? 30, params.isPremium);
  const daysBack = Math.max(1, Math.min(120, params.daysBack ?? 30));
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  let q = supabase
    .from('dark_pool_insider_buys')
    .select('*')
    .gte('transaction_date', since.toISOString().slice(0, 10))
    .order('filed_at', { ascending: false })
    .limit(limit);

  const types = params.transactionTypes?.length
    ? params.transactionTypes
    : (['P'] as InsiderBuyRow['transaction_type'][]);
  q = q.in('transaction_type', types);

  if (!params.isPremium) {
    q = q.lte('filed_at', buildDelayedCutoff());
  }

  if (params.watchedTickers && params.watchedTickers.length > 0) {
    q = q.in(
      'ticker',
      params.watchedTickers.map((t) => t.toUpperCase())
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as InsiderBuyRow[];
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export async function listWatchlist(): Promise<DarkPoolWatchlistRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('not_authenticated');
  const { data, error } = await supabase
    .from('dark_pool_watchlists')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DarkPoolWatchlistRow[];
}

export async function addToWatchlist(ticker: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('not_authenticated');
  const { error } = await supabase.from('dark_pool_watchlists').upsert(
    {
      user_id: auth.user.id,
      ticker: ticker.toUpperCase(),
      alerts_on: true,
    },
    { onConflict: 'user_id,ticker' }
  );
  if (error) throw error;
}

export async function removeFromWatchlist(ticker: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('not_authenticated');
  const { error } = await supabase
    .from('dark_pool_watchlists')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('ticker', ticker.toUpperCase());
  if (error) throw error;
}

export async function toggleWatchlistAlerts(
  ticker: string,
  alertsOn: boolean
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('not_authenticated');
  const { error } = await supabase
    .from('dark_pool_watchlists')
    .update({ alerts_on: alertsOn })
    .eq('user_id', auth.user.id)
    .eq('ticker', ticker.toUpperCase());
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Realtime helpers
// ---------------------------------------------------------------------------

export type DarkPoolRealtimeEvent =
  | { type: 'signal'; payload: DarkPoolSignalRow }
  | { type: 'trade'; payload: DarkPoolTradeRow };

/**
 * מאזין ל-stream של dark_pool_signals/trades בזמן אמת.
 * מחזיר פונקציית unsubscribe.
 */
export function subscribeDarkPool(
  onEvent: (e: DarkPoolRealtimeEvent) => void,
  filters?: { ticker?: string }
): () => void {
  const channelName = `darkpool-${filters?.ticker ?? 'all'}-${Date.now()}`;
  const channel = supabase.channel(channelName);
  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dark_pool_signals',
        filter: filters?.ticker
          ? `ticker=eq.${filters.ticker.toUpperCase()}`
          : undefined,
      },
      (payload) => {
        const row = payload.new as DarkPoolSignalRow;
        if (row) onEvent({ type: 'signal', payload: row });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dark_pool_trades',
        filter: filters?.ticker
          ? `ticker=eq.${filters.ticker.toUpperCase()}`
          : undefined,
      },
      (payload) => {
        const row = payload.new as DarkPoolTradeRow;
        if (row) onEvent({ type: 'trade', payload: row });
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        logger.warn('darkPoolService', `realtime channel error: ${channelName}`);
      }
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clampLimit(requested: number, isPremium: boolean): number {
  const safe = Math.max(1, Math.min(200, Math.floor(requested)));
  return isPremium ? safe : Math.min(safe, DARK_POOL_FREE_TOP_N);
}
