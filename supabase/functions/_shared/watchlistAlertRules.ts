/**
 * כללי התראות רשימת מעקב — לוגיקה טהורה (בלי Deno / רשת), משותפת ל-Edge Function
 * `watchlist-alerts` ולבדיקות jest.
 *
 * כל כלל מחזיר met: true / false / null:
 *   mode 'level' — יורה פעם אחת כשהתנאי מתקיים ונדרך מחדש רק כש-met=false
 *                  (null = אזור היסטרזיס סביב הסף — לא משנה מצב, מונע ריצוד).
 *   mode 'once'  — יורה פעם אחת לכל ref (יום מסחר / תאריך דיווח).
 */

export type WatchlistAlertKind =
  | 'above'
  | 'below'
  | 'change_pct'
  | 'day_high'
  | 'week_high'
  | 'week_low'
  | 'y52_high'
  | 'y52_low'
  | 'entry_gain'
  | 'entry_loss'
  | 'target_hit'
  | 'earnings';

export interface WatchlistAlertItem {
  id: string;
  user_id: string;
  symbol: string;
  alerts_enabled: boolean | null;
  entry_price: number | string | null;
  target_price: number | string | null;
  alert_above: number | string | null;
  alert_below: number | string | null;
  alert_change_pct: number | string | null;
  alert_above_prices: Array<number | string> | null;
  alert_below_prices: Array<number | string> | null;
  alert_change_pcts: Array<number | string> | null;
  alert_entry_gain_pct: number | string | null;
  alert_entry_loss_pct: number | string | null;
  alert_entry_gain_pcts: Array<number | string> | null;
  alert_entry_loss_pcts: Array<number | string> | null;
  alert_day_high: boolean | null;
  alert_week_high: boolean | null;
  alert_week_low: boolean | null;
  alert_52w_high: boolean | null;
  alert_52w_low: boolean | null;
  alert_target_hit: boolean | null;
  alert_earnings: boolean | null;
}

export interface WatchlistAlertMarket {
  price: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  /** מקסימום/מינימום של 5 ימי המסחר הקודמים (בלי היום) */
  prevWeekHigh: number | null;
  prevWeekLow: number | null;
  /** מקסימום/מינימום של ~52 השבועות הקודמים (בלי היום) */
  prev52High: number | null;
  prev52Low: number | null;
  /** תאריך דיווח קרוב (YYYY-MM-DD) אם הוא היום או ביום המסחר הבא */
  earningsDate: string | null;
}

export interface WatchlistAlertContext {
  /** תאריך מסחר בניו יורק YYYY-MM-DD */
  tradeDate: string;
  /** דקות מאז פתיחת המסחר (09:30 ET) */
  minutesSinceOpen: number;
}

export interface WatchlistAlertEval {
  item_id: string;
  user_id: string;
  symbol: string;
  rule_key: string;
  mode: 'level' | 'once';
  met: boolean | null;
  ref: string | null;
  kind: WatchlistAlertKind;
  threshold: number | null;
  price: number | null;
  message: string;
}

/** היסטרזיס לחזרה מעל/מתחת לרמת מחיר (0.3%) לפני שנדרך מחדש */
export const PRICE_REARM_PCT = 0.003;
/** היסטרזיס לאחוזים מול מחיר כניסה (נקודות אחוז) */
export const ENTRY_REARM_PTS = 0.5;
/** שיא יומי רק אחרי חצי שעה מהפתיחה — בפתיחה המחיר הוא תמיד «השיא» */
export const DAY_HIGH_MIN_MINUTES = 30;
/** המחיר בטווח 0.15% מהשיא היומי נחשב «בשיא» — הבדיקה כל כמה דקות, לא בכל עסקה */
export const DAY_HIGH_TOLERANCE_PCT = 0.0015;

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function thresholdList(arr: unknown, legacy: unknown): number[] {
  const fromArr = Array.isArray(arr)
    ? arr.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const base = fromArr.length > 0 ? fromArr : (() => {
    const l = num(legacy);
    return l != null && l > 0 ? [l] : [];
  })();
  return Array.from(new Set(base.map((n) => Number(n.toFixed(6))))).sort((a, b) => a - b);
}

/** מפתח יציב לסף — 200 ו-200.0 הם אותו כלל */
export function thresholdKey(n: number): string {
  return String(Number(n.toFixed(6)));
}

function nextCalendarDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r);
}

export function evaluateWatchlistItem(
  item: WatchlistAlertItem,
  m: WatchlistAlertMarket,
  ctx: WatchlistAlertContext,
): WatchlistAlertEval[] {
  if (!item.alerts_enabled) return [];
  const out: WatchlistAlertEval[] = [];
  const sym = String(item.symbol || '').toUpperCase();
  const price = m.price != null && m.price > 0 ? m.price : null;
  const base = { item_id: item.id, user_id: item.user_id, symbol: sym, price };

  const push = (e: Omit<WatchlistAlertEval, 'item_id' | 'user_id' | 'symbol' | 'price'>) =>
    out.push({ ...base, ...e });

  for (const t of thresholdList(item.alert_above_prices, item.alert_above)) {
    push({
      rule_key: `above:${thresholdKey(t)}`,
      mode: 'level',
      met: price == null ? null : price >= t ? true : price < t * (1 - PRICE_REARM_PCT) ? false : null,
      ref: null,
      kind: 'above',
      threshold: t,
      message: `עברה את ${fmtUsd(t)} · עכשיו ${price != null ? fmtUsd(price) : '—'}`,
    });
  }

  for (const t of thresholdList(item.alert_below_prices, item.alert_below)) {
    push({
      rule_key: `below:${thresholdKey(t)}`,
      mode: 'level',
      met: price == null ? null : price <= t ? true : price > t * (1 + PRICE_REARM_PCT) ? false : null,
      ref: null,
      kind: 'below',
      threshold: t,
      message: `ירדה מתחת ל־${fmtUsd(t)} · עכשיו ${price != null ? fmtUsd(price) : '—'}`,
    });
  }

  const pct =
    price != null && m.previousClose != null && m.previousClose > 0
      ? ((price - m.previousClose) / m.previousClose) * 100
      : null;
  for (const t of thresholdList(item.alert_change_pcts, item.alert_change_pct)) {
    push({
      rule_key: `change:${thresholdKey(t)}`,
      mode: 'once',
      met: pct == null ? null : Math.abs(pct) >= t,
      ref: ctx.tradeDate,
      kind: 'change_pct',
      threshold: t,
      message:
        pct == null
          ? ''
          : `${pct >= 0 ? 'עולה' : 'יורדת'} ${pct >= 0 ? '+' : '−'}${fmtPct(Math.abs(pct))}% היום (סף ${fmtPct(t)}%)`,
    });
  }

  if (item.alert_day_high) {
    const ready = ctx.minutesSinceOpen >= DAY_HIGH_MIN_MINUTES;
    push({
      rule_key: 'day_high',
      mode: 'once',
      met:
        price == null || m.dayHigh == null || !ready
          ? null
          : price >= m.dayHigh * (1 - DAY_HIGH_TOLERANCE_PCT) && (m.open == null || price > m.open),
      ref: ctx.tradeDate,
      kind: 'day_high',
      threshold: m.dayHigh,
      message: `בשיא יומי חדש · ${price != null ? fmtUsd(price) : '—'}`,
    });
  }

  const rangeRule = (
    flag: boolean | null,
    key: 'week_high' | 'week_low' | 'y52_high' | 'y52_low',
    level: number | null,
    up: boolean,
    label: string,
  ) => {
    if (!flag) return;
    push({
      rule_key: key,
      mode: 'once',
      met: price == null || level == null ? null : up ? price > level : price < level,
      ref: ctx.tradeDate,
      kind: key,
      threshold: level,
      message: `${label} · ${price != null ? fmtUsd(price) : '—'}`,
    });
  };
  rangeRule(item.alert_week_high, 'week_high', m.prevWeekHigh, true, 'פורצת את השיא השבועי');
  rangeRule(item.alert_week_low, 'week_low', m.prevWeekLow, false, 'שוברת את השפל השבועי');
  rangeRule(item.alert_52w_high, 'y52_high', m.prev52High, true, 'בשיא 52 שבועות');
  rangeRule(item.alert_52w_low, 'y52_low', m.prev52Low, false, 'בשפל 52 שבועות');

  const entry = num(item.entry_price);
  const vsEntry = price != null && entry != null && entry > 0 ? ((price - entry) / entry) * 100 : null;
  for (const t of thresholdList(item.alert_entry_gain_pcts, item.alert_entry_gain_pct)) {
    push({
      rule_key: `entry_gain:${thresholdKey(t)}`,
      mode: 'level',
      met: vsEntry == null ? null : vsEntry >= t ? true : vsEntry < t - ENTRY_REARM_PTS ? false : null,
      ref: null,
      kind: 'entry_gain',
      threshold: t,
      message: `+${vsEntry != null ? vsEntry.toFixed(1) : '—'}% ממחיר הכניסה (סף +${fmtPct(t)}%)`,
    });
  }
  for (const t of thresholdList(item.alert_entry_loss_pcts, item.alert_entry_loss_pct)) {
    const a = Math.abs(t);
    push({
      rule_key: `entry_loss:${thresholdKey(a)}`,
      mode: 'level',
      met: vsEntry == null ? null : vsEntry <= -a ? true : vsEntry > -a + ENTRY_REARM_PTS ? false : null,
      ref: null,
      kind: 'entry_loss',
      threshold: a,
      message: `${vsEntry != null ? vsEntry.toFixed(1) : '—'}% ממחיר הכניסה (סף −${fmtPct(a)}%)`,
    });
  }

  const target = num(item.target_price);
  if (item.alert_target_hit && target != null && target > 0) {
    // יעד מתחת למחיר הכניסה = יעד בירידה; אחרת יעד בעלייה
    const down = entry != null && entry > 0 && target < entry;
    const met =
      price == null
        ? null
        : down
          ? price <= target
            ? true
            : price > target * (1 + PRICE_REARM_PCT)
              ? false
              : null
          : price >= target
            ? true
            : price < target * (1 - PRICE_REARM_PCT)
              ? false
              : null;
    push({
      rule_key: `target:${thresholdKey(target)}`,
      mode: 'level',
      met,
      ref: null,
      kind: 'target_hit',
      threshold: target,
      message: `הגיעה ליעד ${fmtUsd(target)} · עכשיו ${price != null ? fmtUsd(price) : '—'}`,
    });
  }

  if (item.alert_earnings) {
    const when =
      m.earningsDate === ctx.tradeDate
        ? 'היום'
        : m.earningsDate != null && m.earningsDate === nextCalendarDay(ctx.tradeDate)
          ? 'מחר'
          : 'ביום המסחר הבא';
    push({
      rule_key: 'earnings',
      mode: 'once',
      met: m.earningsDate != null,
      ref: m.earningsDate,
      kind: 'earnings',
      threshold: null,
      message: `מדווחת ${when}${m.earningsDate ? ` (${m.earningsDate})` : ''}`,
    });
  }

  return out;
}

/** האם צריך היסטוריית מחירים (שבוע / 52 שבועות) לפריט */
export function itemNeedsRange(item: WatchlistAlertItem): boolean {
  return !!(item.alerts_enabled && (item.alert_week_high || item.alert_week_low || item.alert_52w_high || item.alert_52w_low));
}

/** מקסימום/מינימום מנרות יומיים, בלי נר היום */
export function rangeFromDailyBars(
  bars: Array<{ date: string; high: number | null; low: number | null }>,
  tradeDate: string,
): { prevWeekHigh: number | null; prevWeekLow: number | null; prev52High: number | null; prev52Low: number | null } {
  const prior = bars
    .filter((b) => b.date < tradeDate && b.high != null && b.low != null && b.high > 0 && b.low > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (prior.length === 0) return { prevWeekHigh: null, prevWeekLow: null, prev52High: null, prev52Low: null };
  const week = prior.slice(-5);
  const year = prior.slice(-252);
  return {
    prevWeekHigh: Math.max(...week.map((b) => b.high as number)),
    prevWeekLow: Math.min(...week.map((b) => b.low as number)),
    prev52High: Math.max(...year.map((b) => b.high as number)),
    prev52Low: Math.min(...year.map((b) => b.low as number)),
  };
}
