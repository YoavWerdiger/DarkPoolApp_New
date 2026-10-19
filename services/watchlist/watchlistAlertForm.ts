/** ערכי טופס ההתראות בשיט המניה מול מה שבשרת — זיהוי שינוי ושמירה של הפרש בלבד */
import type { StockWatchlistItem, WatchlistItemPatch } from './watchlistTypes';
import { parseThresholdList } from './watchlistAlertThresholds';

/** ערכי ההתראות כפי שנשמרים ב-DB — לזיהוי שינוי בשרת / עריכה בטופס */
export type AlertValues = {
  above: number[];
  below: number[];
  change: number[];
  enabled: boolean;
  dayHigh: boolean;
  weekHigh: boolean;
  weekLow: boolean;
  y52High: boolean;
  y52Low: boolean;
  target: boolean;
  /** מחיר היעד להתראת «הגעה ליעד» */
  targetPrice: number | null;
  earnings: boolean;
};

export function alertValuesFromItem(item: StockWatchlistItem): AlertValues {
  return {
    above: parseThresholdList(item.alert_above_prices, item.alert_above),
    below: parseThresholdList(item.alert_below_prices, item.alert_below),
    change: parseThresholdList(item.alert_change_pcts, item.alert_change_pct),
    enabled: !!item.alerts_enabled,
    dayHigh: !!item.alert_day_high,
    weekHigh: !!item.alert_week_high,
    weekLow: !!item.alert_week_low,
    y52High: !!item.alert_52w_high,
    y52Low: !!item.alert_52w_low,
    target: !!item.alert_target_hit,
    targetPrice:
      item.target_price != null && Number.isFinite(Number(item.target_price)) && Number(item.target_price) > 0
        ? Number(item.target_price)
        : null,
    earnings: !!item.alert_earnings,
  };
}

export function alertSig(v: AlertValues): string {
  return JSON.stringify(v);
}

function sameList(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/**
 * רק שדות שהשתנו מול מה שבשרת — כדי ששמירה לא תדרוס הגדרות שלא נגעו בהן
 * (למשל ערכים ישנים מה-cache, או ספי כניסה שאין להם UI כרגע).
 */
export function diffAlertPatch(server: AlertValues, next: AlertValues): WatchlistItemPatch {
  const patch: WatchlistItemPatch = {};
  if (!sameList(server.above, next.above)) patch.alert_above_prices = next.above;
  if (!sameList(server.below, next.below)) patch.alert_below_prices = next.below;
  if (!sameList(server.change, next.change)) patch.alert_change_pcts = next.change;
  if (server.enabled !== next.enabled) patch.alerts_enabled = next.enabled;
  if (server.dayHigh !== next.dayHigh) patch.alert_day_high = next.dayHigh;
  if (server.weekHigh !== next.weekHigh) patch.alert_week_high = next.weekHigh;
  if (server.weekLow !== next.weekLow) patch.alert_week_low = next.weekLow;
  if (server.y52High !== next.y52High) patch.alert_52w_high = next.y52High;
  if (server.y52Low !== next.y52Low) patch.alert_52w_low = next.y52Low;
  if (server.target !== next.target) patch.alert_target_hit = next.target;
  if (server.targetPrice !== next.targetPrice) patch.target_price = next.targetPrice;
  if (server.earnings !== next.earnings) patch.alert_earnings = next.earnings;
  return patch;
}
