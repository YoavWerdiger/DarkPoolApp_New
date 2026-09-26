/**
 * תשואת טיקר מאז יום עסקת קונגרס.
 *
 * דיווח STOCK Act מכיל טווח דולרי בלבד — אין מחיר למניה ואין כמות.
 * לכן «מאז העסקה» הוא שינוי מחיר הטיקר, לא P&L של פוזיציה:
 *   1. (current − open[transaction_date]) / open[transaction_date] — אין מחיר Form 4
 *   2. Quiver `PriceChange` רק כשאין פתיחה או ציטוט חי
 *
 * לא אמצע טווח הדיווח, לא כמות מומצאת, לא שווי פוזיציה.
 */

export type DailyOpenPoint = {
  date: string;
  open?: number | null;
};

function usablePrice(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function isoDayKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/**
 * % שינוי מחיר המניה מפתיחה מול נוכחי.
 * 12.5 = +12.50%. 0 לגיטימי. null = אין נתון.
 */
export function calcTickerReturnPctFromOpen(
  openPrice: number | null | undefined,
  currentPrice: number | null | undefined
): number | null {
  const open = usablePrice(openPrice);
  const current = usablePrice(currentPrice);
  if (open == null || current == null) return null;
  return ((current - open) / open) * 100;
}

/**
 * $ שינוי של מחיר המניה (current − open) — לא שווי פוזיציה.
 */
export function calcSharePriceDeltaFromOpen(
  openPrice: number | null | undefined,
  currentPrice: number | null | undefined
): number | null {
  const open = usablePrice(openPrice);
  const current = usablePrice(currentPrice);
  if (open == null || current == null) return null;
  return current - open;
}

/**
 * קונגרס: פתיחת יום הביצוע מול חי; PriceChange רק כ-fallback.
 */
export function resolveCongressSinceTradePct(input: {
  vendorPriceChangePct?: number | null;
  openOnTransactionDate?: number | null;
  currentPrice?: number | null;
}): number | null {
  const fromOpen = calcTickerReturnPctFromOpen(
    input.openOnTransactionDate,
    input.currentPrice
  );
  if (fromOpen != null) return fromOpen;
  const vendor = input.vendorPriceChangePct;
  if (vendor != null && Number.isFinite(vendor)) return vendor;
  return null;
}

/**
 * פתיחה יומית ליום הביצוע. יום מדויק קודם; אחרת הסשן הקרוב אחריו;
 * ואם אין — הסשן האחרון שלפניו (סופ״ש / חג).
 */
export function pickDailyOpenOnDate(
  points: ReadonlyArray<DailyOpenPoint> | null | undefined,
  transactionDate: string | null | undefined
): number | null {
  const target = isoDayKey(transactionDate);
  if (!target || !points?.length) return null;

  let exact: number | null = null;
  let afterDate: string | null = null;
  let afterOpen: number | null = null;
  let beforeDate: string | null = null;
  let beforeOpen: number | null = null;

  for (const point of points) {
    const day = isoDayKey(point.date);
    const open = usablePrice(point.open);
    if (!day || open == null) continue;
    if (day === target) {
      exact = open;
      continue;
    }
    if (day > target && (afterDate == null || day < afterDate)) {
      afterDate = day;
      afterOpen = open;
    }
    if (day < target && (beforeDate == null || day > beforeDate)) {
      beforeDate = day;
      beforeOpen = open;
    }
  }

  return exact ?? afterOpen ?? beforeOpen;
}

/** 1y לעסקאות מהשנה האחרונה; 5y להיסטוריה ארוכה יותר. לא Yahoo `max`. */
export function yahooRangeForTransactionDate(
  transactionDate: string | null | undefined
): '1y' | '5y' {
  const day = isoDayKey(transactionDate);
  if (!day) return '5y';
  const ts = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(ts)) return '5y';
  const ageMs = Date.now() - ts;
  return ageMs > 360 * 24 * 60 * 60 * 1000 ? '5y' : '1y';
}

export function yahooRangeForOldestTransactionDate(
  dates: ReadonlyArray<string | null | undefined>
): '1y' | '5y' {
  let oldest: string | null = null;
  for (const raw of dates) {
    const day = isoDayKey(raw);
    if (!day) continue;
    if (!oldest || day < oldest) oldest = day;
  }
  return yahooRangeForTransactionDate(oldest);
}

function uniqueOpenTickers(tickers: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tickers) {
    const t = typeof raw === 'string' ? raw.trim().toUpperCase().replace(/^\$/, '') : '';
    if (!t || t.length > 8 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 40) break;
  }
  return out;
}

/** כל טיקרי הפיד — פתיחה יומית לחישוב «מאז העסקה». */
export function congressFeedDailyBarRequest(
  trades: ReadonlyArray<{
    ticker?: string | null;
    transaction_date?: string | null;
  }>
): { tickers: string[]; range: '1y' | '5y' } {
  return {
    tickers: uniqueOpenTickers(trades.map((row) => row.ticker)),
    range: yahooRangeForOldestTransactionDate(
      trades.map((row) => row.transaction_date)
    ),
  };
}

/** @deprecated — השתמשו ב־congressFeedDailyBarRequest */
export function congressTickersNeedingOpen(
  trades: ReadonlyArray<{
    ticker?: string | null;
    price_change_pct?: number | null;
    transaction_date?: string | null;
  }>
): { tickers: string[]; range: '1y' | '5y' } {
  const need: Array<{ ticker: string; day: string | null }> = [];
  for (const trade of trades) {
    if (trade.price_change_pct != null && Number.isFinite(trade.price_change_pct)) {
      continue;
    }
    const ticker =
      typeof trade.ticker === 'string'
        ? trade.ticker.trim().toUpperCase().replace(/^\$/, '')
        : '';
    if (!ticker) continue;
    need.push({ ticker, day: trade.transaction_date ?? null });
  }
  return {
    tickers: uniqueOpenTickers(need.map((row) => row.ticker)),
    range: yahooRangeForOldestTransactionDate(need.map((row) => row.day)),
  };
}
