/**
 * גרף טיקר + שינוי מול בסיס אמיתי (יום / טווח נבחר).
 * לא תשואת «כניסה» משוחזרת מ-STOCK Act.
 */

import type { PerformancePeriod } from '../../Portfolios/portfolioTypes';

export type TickerChartRange = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' | 'ALL';

export type YahooTickerRange = '1d' | '5d' | '1mo' | '3mo' | 'ytd' | '1y' | '5y' | '10y';
export type YahooTickerInterval = '5m' | '1h' | '1d';

export interface YahooTickerRequest {
  yahooRange: YahooTickerRange;
  interval: YahooTickerInterval;
}

export const TICKER_CHART_RANGES: TickerChartRange[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  'YTD',
  '1Y',
  '5Y',
  'ALL',
];

/**
 * Yahoo `range=max&interval=1d` is silently monthly/quarterly (AAPL≈3mo, TSLA≈1mo).
 * Never request `max` for a session chart. 1M must be daily closes.
 * 1D uses 5m separately; the daily fallback window is 1Y.
 * Other chips request their own range (1M → 1mo/1d) — not a single 10y dump.
 */
export function tickerHistoryRangeForChip(range: TickerChartRange): TickerChartRange {
  return range === '1D' ? '1Y' : range;
}

/** cache React Query — פחות burst ל-Yahoo בפרודקשן. */
export function tickerHistoryStaleMs(interval: YahooTickerInterval): number {
  if (interval === '5m') return 2 * 60_000;
  if (interval === '1h') return 45 * 60_000;
  return 12 * 60 * 60_000;
}

/** ב־1D אין צורך ב־10y יומי — רק גיבוי קצר אם 5m נכשל. */
export function yahooFallbackDailyFor1D(): YahooTickerRequest {
  return { yahooRange: '5d', interval: '1d' };
}

export function yahooRequestForTickerRange(range: TickerChartRange): YahooTickerRequest {
  switch (range) {
    case '1D':
      return { yahooRange: '1d', interval: '5m' };
    case '1W':
      return { yahooRange: '5d', interval: '1h' };
    case '1M':
      return { yahooRange: '1mo', interval: '1h' };
    case '3M':
      return { yahooRange: '3mo', interval: '1d' };
    case 'YTD':
      return { yahooRange: 'ytd', interval: '1d' };
    case '1Y':
      return { yahooRange: '1y', interval: '1d' };
    case '5Y':
      return { yahooRange: '5y', interval: '1d' };
    case 'ALL':
      return { yahooRange: '10y', interval: '1d' };
  }
}

export interface TickerClosePoint {
  date: string;
  close: number;
}

export interface TickerChartPoint {
  date: string;
  value: number;
}

export interface TickerRangeChange {
  abs: number | null;
  pct: number | null;
}

const RANGE_DAYS: Record<Exclude<TickerChartRange, 'ALL' | 'YTD' | '1D'>, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 91,
  '1Y': 365,
  '5Y': 365 * 5,
};

function validClose(p: TickerClosePoint | null | undefined): p is TickerClosePoint {
  return (
    !!p &&
    /^\d{4}-\d{2}-\d{2}/.test(p.date) &&
    p.close > 0 &&
    Number.isFinite(p.close)
  );
}

function sortCloses(series: TickerClosePoint[]): TickerClosePoint[] {
  return series.filter(validClose).sort((a, b) => a.date.localeCompare(b.date));
}

function utcTodayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function addUtcDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function tickerRangeCutoffIso(
  range: TickerChartRange,
  now = new Date()
): string | null {
  if (range === 'ALL') return null;
  if (range === 'YTD') return `${now.getUTCFullYear()}-01-01`;
  const today = utcTodayIso(now);
  if (range === '1D') return addUtcDays(today, -1);
  return addUtcDays(today, -RANGE_DAYS[range]);
}

export function tickerSeriesSpanDays(series: TickerClosePoint[]): number {
  const sorted = sortCloses(series);
  if (sorted.length < 2) return 0;
  const ms =
    Date.parse(`${sorted[sorted.length - 1].date}T00:00:00Z`) -
    Date.parse(`${sorted[0].date}T00:00:00Z`);
  return ms / 86_400_000;
}

export function filterTickerClosesByRange(
  series: TickerClosePoint[],
  range: TickerChartRange,
  now = new Date()
): TickerClosePoint[] {
  const sorted = sortCloses(series);
  if (!sorted.length) return [];
  if (range === 'ALL') return sorted;
  const cutoff = tickerRangeCutoffIso(range, now);
  if (!cutoff) return sorted;
  return sorted.filter((p) => p.date >= cutoff);
}

export function appendLiveClose(
  series: TickerClosePoint[],
  livePrice: number | null | undefined,
  todayIso = utcTodayIso()
): TickerClosePoint[] {
  if (livePrice == null || !(livePrice > 0) || !Number.isFinite(livePrice)) {
    return sortCloses(series);
  }
  const sorted = sortCloses(series);
  const last = sorted[sorted.length - 1];
  if (last?.date === todayIso) {
    return [...sorted.slice(0, -1), { date: todayIso, close: livePrice }];
  }
  return [...sorted, { date: todayIso, close: livePrice }];
}

function appendLiveIntraday(
  series: TickerClosePoint[],
  livePrice: number | null | undefined,
  now = new Date()
): TickerClosePoint[] {
  if (livePrice == null || !(livePrice > 0) || !Number.isFinite(livePrice)) {
    return sortCloses(series);
  }
  const sorted = sortCloses(series);
  const iso = now.toISOString();
  const last = sorted[sorted.length - 1];
  if (last && Math.abs(Date.parse(last.date) - now.getTime()) < 60_000) {
    return [...sorted.slice(0, -1), { date: iso, close: livePrice }];
  }
  return [...sorted, { date: iso, close: livePrice }];
}

/**
 * סדרת גרף לטווח. 1D = ברים אינטריידיי אם יש; אחרת previous_close → מחיר חי.
 */
export function buildTickerChartSeries(opts: {
  daily: TickerClosePoint[];
  range: TickerChartRange;
  livePrice?: number | null;
  previousClose?: number | null;
  now?: Date;
  /** ברים 5m מ-Yahoo `1d` — לא שני קצוות יומיים. */
  intraday?: TickerClosePoint[];
  /** ברי שעה של הסשן הנוכחי — מחליפים סגירה יומית אחת. */
  sessionBars?: TickerClosePoint[];
}): TickerChartPoint[] {
  const now = opts.now ?? new Date();
  const today = utcTodayIso(now);
  const live = opts.livePrice;
  const prev = opts.previousClose;

  if (opts.range === '1D') {
    const intra = sortCloses(opts.intraday ?? []);
    if (intra.length >= 2) {
      return appendLiveIntraday(intra, live, now).map((p) => ({
        date: p.date,
        value: p.close,
      }));
    }
    const hourly = sortCloses(opts.sessionBars ?? []);
    if (hourly.length >= 2) {
      return appendLiveIntraday(hourly, live, now).map((p) => ({
        date: p.date,
        value: p.close,
      }));
    }
    if (prev != null && prev > 0 && live != null && live > 0) {
      return [
        { date: addUtcDays(today, -1), value: prev },
        { date: today, value: live },
      ];
    }
    const two = sortCloses(opts.daily).slice(-2);
    return two.map((p) => ({ date: p.date, value: p.close }));
  }

  const withLive = appendLiveClose(opts.daily, live, today);
  const dailyPoints = filterTickerClosesByRange(withLive, opts.range, now).map((p) => ({
    date: p.date,
    value: p.close,
  }));
  return mergeSessionPriceBars(dailyPoints, opts.sessionBars ?? []);
}

/** מחליף את נקודת היום בסגירות שעה אמיתיות. בלי ברי שעה — הסדרה היומית נשארת. */
export function mergeSessionPriceBars(
  series: TickerChartPoint[],
  sessionBars: TickerClosePoint[]
): TickerChartPoint[] {
  const session = sortCloses(sessionBars);
  if (session.length < 2) return series;
  const sessionDay = session[session.length - 1].date.slice(0, 10);
  const history = series.filter((p) => p.date.slice(0, 10) < sessionDay);
  return [
    ...history,
    ...session.map((p) => ({ date: p.date, value: p.close })),
  ];
}

function pctFrom(start: number, end: number): number | null {
  if (!(start > 0) || !(end > 0) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return ((end - start) / start) * 100;
}

/**
 * שינוי מול בסיס אמיתי: יום = previous_close; טווח = close ראשון בסדרה.
 * לא midpoint / לא «מחיר כניסה» משוחזר.
 */
export function tickerRangeChange(opts: {
  range: TickerChartRange;
  livePrice: number | null | undefined;
  previousClose: number | null | undefined;
  daily: TickerClosePoint[];
  now?: Date;
}): TickerRangeChange {
  const live = opts.livePrice;
  const prev = opts.previousClose;

  if (opts.range === '1D') {
    if (live == null || !(live > 0) || prev == null || !(prev > 0)) {
      return { abs: null, pct: null };
    }
    return { abs: live - prev, pct: pctFrom(prev, live) };
  }

  const series = buildTickerChartSeries({
    daily: opts.daily,
    range: opts.range,
    livePrice: live,
    previousClose: prev,
    now: opts.now,
  });
  if (series.length < 2) return { abs: null, pct: null };
  const start = series[0].value;
  const end = series[series.length - 1].value;
  if (!(start > 0) || !(end > 0)) return { abs: null, pct: null };
  return { abs: end - start, pct: pctFrom(start, end) };
}

/**
 * שינוי להירו: מחיר מוצג (חי או נקודת גרירה) מול אותו בסיס כמו tickerRangeChange.
 */
export function tickerDisplayedChange(opts: {
  range: TickerChartRange;
  endPrice: number | null | undefined;
  previousClose: number | null | undefined;
  daily: TickerClosePoint[];
  now?: Date;
}): TickerRangeChange {
  const end = opts.endPrice;
  if (end == null || !(end > 0)) return { abs: null, pct: null };

  if (opts.range === '1D') {
    const prev = opts.previousClose;
    if (prev == null || !(prev > 0)) return { abs: null, pct: null };
    return { abs: end - prev, pct: pctFrom(prev, end) };
  }

  const series = buildTickerChartSeries({
    daily: opts.daily,
    range: opts.range,
    livePrice: end,
    previousClose: opts.previousClose,
    now: opts.now,
  });
  if (series.length < 2) return { abs: null, pct: null };
  const start = series[0].value;
  if (!(start > 0)) return { abs: null, pct: null };
  return { abs: end - start, pct: pctFrom(start, end) };
}

export function formatTickerScrubDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const hasTime = /T\d{2}:/.test(iso);
  const d = hasTime ? new Date(iso) : new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  if (hasTime) {
    return d.toLocaleString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function tickerRangeHasCoverage(opts: {
  range: TickerChartRange;
  daily: TickerClosePoint[];
  livePrice?: number | null;
  previousClose?: number | null;
  now?: Date;
}): boolean {
  const { range, daily, livePrice, previousClose, now } = opts;
  if (range === '1D') {
    if (livePrice != null && livePrice > 0 && previousClose != null && previousClose > 0) {
      return true;
    }
    return sortCloses(daily).length >= 2;
  }
  if (range === 'ALL') {
    return tickerSeriesSpanDays(daily) >= 365 * 4.5;
  }
  const series = buildTickerChartSeries({
    daily,
    range,
    livePrice,
    previousClose,
    now,
  });
  if (series.length < 2) return false;
  if (range === 'YTD') return true;
  const days = RANGE_DAYS[range];
  const spanMs =
    Date.parse(`${series[series.length - 1].date}T00:00:00Z`) -
    Date.parse(`${series[0].date}T00:00:00Z`);
  const spanDays = spanMs / 86_400_000;
  const minSpan = days <= 30 ? Math.min(days * 0.25, 3) : days * 0.25;
  return spanDays >= minSpan;
}

export function visibleTickerChartRanges(opts: {
  daily: TickerClosePoint[];
  livePrice?: number | null;
  previousClose?: number | null;
  now?: Date;
}): TickerChartRange[] {
  return TICKER_CHART_RANGES.filter((range) =>
    tickerRangeHasCoverage({ ...opts, range })
  );
}

/** מיפוי טווח טיקר → תקופת דגימה (אותן כללים כמו גרף תיק). */
export function tickerRangeToSamplePeriod(range: TickerChartRange): PerformancePeriod {
  if (range === 'ALL') return 'All';
  return range;
}

export function pickDefaultTickerRange(
  visible: TickerChartRange[]
): TickerChartRange {
  if (visible.includes('1Y')) return '1Y';
  if (visible.includes('3M')) return '3M';
  if (visible.includes('1M')) return '1M';
  if (visible.includes('1D')) return '1D';
  return visible[0] ?? '1D';
}

export function formatTickerLivePrice(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return `$${price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatTickerAbsChange(abs: number): string {
  const sign = abs > 0 ? '+' : abs < 0 ? '−' : '';
  return `${sign}$${Math.abs(abs).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatTickerPctChange(pct: number): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

export function tickerChangeTone(
  pct: number | null | undefined
): 'positive' | 'negative' | 'neutral' {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return 'neutral';
  return pct > 0 ? 'positive' : 'negative';
}
