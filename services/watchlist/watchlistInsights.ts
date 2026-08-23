/**
 * תובנות לרשימת מעקב: earnings, בדיקת התראות מורחבות.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../notificationService';
import type { StockWatchlistItem, WatchlistAlertKind, WatchlistRowData } from './watchlistTypes';
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

type AlertFire = {
  itemId: string;
  symbol: string;
  kind: WatchlistAlertKind;
  threshold: number | null;
  price: number | null;
  message: string;
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function isEarningsSoon(earningsDate: string | null): boolean {
  if (!earningsDate) return false;
  const today = toDateStr(new Date());
  const tomorrow = addDays(today, 1);
  return earningsDate === today || earningsDate === tomorrow;
}

export function evaluateWatchlistAlerts(rows: WatchlistRowData[]): AlertFire[] {
  const fires: AlertFire[] = [];
  for (const row of rows) {
    const item = row.item;
    if (!item.alerts_enabled) continue;
    const price = row.price;
    const pct = row.changePct;
    const sym = item.symbol;

    const abovePrices = parseThresholdList(
      item.alert_above_prices,
      item.alert_above
    );
    for (const threshold of abovePrices) {
      if (price != null && price >= threshold) {
        fires.push({
          itemId: item.id,
          symbol: sym,
          kind: 'above',
          threshold,
          price,
          message: `${sym} עבר ${fmtUsd(threshold)} (עכשיו ${fmtUsd(price)})`,
        });
      }
    }

    const belowPrices = parseThresholdList(
      item.alert_below_prices,
      item.alert_below
    );
    for (const threshold of belowPrices) {
      if (price != null && price <= threshold) {
        fires.push({
          itemId: item.id,
          symbol: sym,
          kind: 'below',
          threshold,
          price,
          message: `${sym} ירד מתחת ל־${fmtUsd(threshold)} (עכשיו ${fmtUsd(price)})`,
        });
      }
    }

    const changePcts = parseThresholdList(
      item.alert_change_pcts,
      item.alert_change_pct
    );
    for (const threshold of changePcts) {
      if (pct != null && Math.abs(pct) >= threshold) {
        fires.push({
          itemId: item.id,
          symbol: sym,
          kind: 'change_pct',
          threshold,
          price,
          message: `${sym} זז ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% היום (סף ${threshold}%)`,
        });
      }
    }

    if (
      item.alert_day_high &&
      price != null &&
      row.dayHigh != null &&
      price >= row.dayHigh
    ) {
      fires.push({
        itemId: item.id,
        symbol: sym,
        kind: 'day_high',
        threshold: row.dayHigh,
        price,
        message: `${sym} בשיא יומי חדש ${fmtUsd(price)}`,
      });
    }

    if (
      item.alert_week_high &&
      price != null &&
      row.weekHigh != null &&
      price >= row.weekHigh
    ) {
      fires.push({
        itemId: item.id,
        symbol: sym,
        kind: 'week_high',
        threshold: row.weekHigh,
        price,
        message: `${sym} בשיא שבועי ${fmtUsd(price)}`,
      });
    }
    if (
      item.alert_week_low &&
      price != null &&
      row.weekLow != null &&
      price <= row.weekLow
    ) {
      fires.push({
        itemId: item.id,
        symbol: sym,
        kind: 'week_low',
        threshold: row.weekLow,
        price,
        message: `${sym} בשפל שבועי ${fmtUsd(price)}`,
      });
    }

    if (
      item.alert_52w_high &&
      price != null &&
      row.high52 != null &&
      price >= row.high52
    ) {
      fires.push({
        itemId: item.id,
        symbol: sym,
        kind: 'y52_high',
        threshold: row.high52,
        price,
        message: `${sym} בשיא 52 שבועות ${fmtUsd(price)}`,
      });
    }
    if (
      item.alert_52w_low &&
      price != null &&
      row.low52 != null &&
      price <= row.low52
    ) {
      fires.push({
        itemId: item.id,
        symbol: sym,
        kind: 'y52_low',
        threshold: row.low52,
        price,
        message: `${sym} בשפל 52 שבועות ${fmtUsd(price)}`,
      });
    }

    const entryGains = parseThresholdList(
      item.alert_entry_gain_pcts,
      item.alert_entry_gain_pct
    );
    for (const threshold of entryGains) {
      if (row.vsEntryPct != null && row.vsEntryPct >= threshold) {
        fires.push({
          itemId: item.id,
          symbol: sym,
          kind: 'entry_gain',
          threshold,
          price,
          message: `${sym} +${row.vsEntryPct.toFixed(1)}% ממחיר הכניסה (סף +${threshold}%)`,
        });
      }
    }

    const entryLosses = parseThresholdList(
      item.alert_entry_loss_pcts,
      item.alert_entry_loss_pct
    );
    for (const threshold of entryLosses) {
      if (row.vsEntryPct != null && row.vsEntryPct <= -Math.abs(threshold)) {
        fires.push({
          itemId: item.id,
          symbol: sym,
          kind: 'entry_loss',
          threshold,
          price,
          message: `${sym} ${row.vsEntryPct.toFixed(1)}% ממחיר הכניסה (סף −${Math.abs(threshold)}%)`,
        });
      }
    }

    if (
      item.alert_target_hit &&
      price != null &&
      item.target_price != null &&
      price >= Number(item.target_price)
    ) {
      fires.push({
        itemId: item.id,
        symbol: sym,
        kind: 'target_hit',
        threshold: Number(item.target_price),
        price,
        message: `${sym} הגיע ליעד ${fmtUsd(Number(item.target_price))} (עכשיו ${fmtUsd(price)})`,
      });
    }

    if (item.alert_earnings && isEarningsSoon(row.earningsDate)) {
      const when =
        row.earningsDate === toDateStr(new Date()) ? 'היום' : 'מחר';
      fires.push({
        itemId: item.id,
        symbol: sym,
        kind: 'earnings',
        threshold: null,
        price,
        message: `${sym} דיווח רווח ${when}${row.earningsDate ? ` (${row.earningsDate})` : ''}`,
      });
    }
  }
  return fires;
}

async function alertDedupeKey(fire: AlertFire): Promise<string> {
  const day = toDateStr(new Date());
  return `wl_alert:${fire.itemId}:${fire.kind}:${fire.threshold}:${day}`;
}

export async function dispatchWatchlistAlerts(fires: AlertFire[]): Promise<void> {
  if (fires.length === 0) return;
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data?.user?.id;
  if (!userId) return;

  for (const fire of fires) {
    const key = await alertDedupeKey(fire);
    const seen = await AsyncStorage.getItem(key);
    if (seen) continue;
    await AsyncStorage.setItem(key, '1');

    try {
      await supabase.from('stock_watchlist_alert_events').insert({
        user_id: userId,
        item_id: fire.itemId,
        symbol: fire.symbol,
        alert_kind: fire.kind,
        threshold: fire.threshold,
        price: fire.price,
        message: fire.message,
      });
    } catch {
      /* non-blocking */
    }

    try {
      await NotificationService.sendLocalNotification(
        'התראת מעקב',
        fire.message,
        {
          type: 'watchlist_alert',
          symbol: fire.symbol,
          price: fire.price,
        }
      );
    } catch {
      /* expo go / permissions */
    }
  }
}

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
