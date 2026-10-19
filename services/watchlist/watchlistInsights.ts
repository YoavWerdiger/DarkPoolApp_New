/**
 * תובנות לרשימת מעקב: earnings, נרמול פריטים.
 */

import { supabase } from '../../lib/supabase';
import type { StockWatchlistItem } from './watchlistTypes';
import {
  legacyFirst,
  parseThresholdList,
  uniqSortedThresholds,
} from './watchlistAlertThresholds';

export type EarningsHint = { date: string; session: string | null };
export type WatchlistInsights = {
  earningsBySymbol: Record<string, EarningsHint>;
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

export async function fetchWatchlistEarningsHints(
  symbols: string[]
): Promise<Record<string, EarningsHint>> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  if (unique.length === 0) return {};
  const today = toDateStr(new Date());
  const until = addDays(today, 21);

  const { data } = await supabase
    .from('earnings_calendar')
    .select('code, ticker, report_date, before_after_market, date')
    .in('code', unique)
    .gte('report_date', today)
    .lte('report_date', until)
    .order('report_date', { ascending: true })
    .limit(200);

  return mapEarnings(data ?? [], unique);
}

function mapEarnings(
  rows: Array<{
    code?: string | null;
    ticker?: string | null;
    report_date?: string | null;
    date?: string | null;
    before_after_market?: string | null;
  }>,
  symbols: string[]
): Record<string, EarningsHint> {
  const wanted = new Set(symbols);
  const out: Record<string, EarningsHint> = {};
  for (const row of rows) {
    const sym = (row.code || row.ticker || '').toUpperCase();
    if (!wanted.has(sym) || out[sym]) continue;
    const date = row.report_date || row.date;
    if (!date) continue;
    out[sym] = {
      date: String(date).slice(0, 10),
      session: row.before_after_market ?? null,
    };
  }
  return out;
}

export async function loadWatchlistInsights(
  symbols: string[]
): Promise<WatchlistInsights> {
  const earningsBySymbol = await fetchWatchlistEarningsHints(symbols);
  return { earningsBySymbol };
}

// הערכת התראות + שליחה: בשרת — supabase/functions/watchlist-alerts
// (כללים ב-supabase/functions/_shared/watchlistAlertRules.ts).

export function computeVsEntry(
  price: number | null,
  entry: number | null | undefined
): number | null {
  if (price == null || entry == null || !Number.isFinite(entry) || entry === 0) {
    return null;
  }
  return ((price - entry) / entry) * 100;
}

export function computeVsTarget(
  price: number | null,
  target: number | null | undefined
): number | null {
  if (price == null || target == null || !Number.isFinite(target) || target === 0) {
    return null;
  }
  return ((target - price) / price) * 100;
}

export function normalizeItem(raw: Record<string, unknown>): StockWatchlistItem {
  const alert_above_prices = parseThresholdList(
    raw.alert_above_prices,
    raw.alert_above
  );
  const alert_below_prices = parseThresholdList(
    raw.alert_below_prices,
    raw.alert_below
  );
  const alert_change_pcts = parseThresholdList(
    raw.alert_change_pcts,
    raw.alert_change_pct
  );
  const alert_entry_gain_pcts = parseThresholdList(
    raw.alert_entry_gain_pcts,
    raw.alert_entry_gain_pct
  );
  const alert_entry_loss_pcts = parseThresholdList(
    raw.alert_entry_loss_pcts,
    raw.alert_entry_loss_pct
  );

  return {
    id: String(raw.id),
    watchlist_id: String(raw.watchlist_id),
    user_id: String(raw.user_id),
    symbol: String(raw.symbol),
    company_name: (raw.company_name as string) ?? null,
    notes: (raw.notes as string) ?? null,
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? ''),
    entry_price: raw.entry_price != null ? Number(raw.entry_price) : null,
    target_price: raw.target_price != null ? Number(raw.target_price) : null,
    alert_above: legacyFirst(alert_above_prices),
    alert_below: legacyFirst(alert_below_prices),
    alert_change_pct: legacyFirst(alert_change_pcts),
    alert_above_prices,
    alert_below_prices,
    alert_change_pcts,
    alerts_enabled: Boolean(raw.alerts_enabled),
    alert_day_high: Boolean(raw.alert_day_high),
    alert_week_high: Boolean(raw.alert_week_high),
    alert_week_low: Boolean(raw.alert_week_low),
    alert_52w_high: Boolean(raw.alert_52w_high),
    alert_52w_low: Boolean(raw.alert_52w_low),
    alert_entry_gain_pct: legacyFirst(alert_entry_gain_pcts),
    alert_entry_loss_pct: legacyFirst(alert_entry_loss_pcts),
    alert_entry_gain_pcts,
    alert_entry_loss_pcts,
    alert_target_hit: Boolean(raw.alert_target_hit),
    alert_earnings: Boolean(raw.alert_earnings),
  };
}

export { uniqSortedThresholds };
