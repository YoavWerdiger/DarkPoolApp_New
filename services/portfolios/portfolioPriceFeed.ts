/**
 * portfolioPriceFeed.ts
 * --------------------------------------------------------------------------
 * שליפת מחירים שוטפים והיסטוריים למניות, עם cache ב-Supabase + cache בזיכרון.
 *
 * מקורות:
 *   - Finnhub /quote – quote שוטף (current + previous close), חינמי 60/min
 *   - Yahoo Finance /v8/finance/chart – נתונים היסטוריים יומיים (בלי הרשאה)
 *
 * Cache:
 *   - In-memory: 5min ל-quote, 12h ל-historical
 *   - Supabase portfolio_price_cache: persistence בין sessions וסשנים בין משתמשים
 *
 * נטולת תלות ב-React – יבוא לכל מקום (services / hooks / Edge Functions לא).
 */

import { supabase } from '../../lib/supabase';
import type {
  PriceQuote,
  HistoricalPricePoint,
} from '../../screens/Portfolios/portfolioTypes';
import {
  QUOTE_CACHE_TTL_MS,
  HISTORICAL_CACHE_TTL_MS,
} from '../../screens/Portfolios/portfolioConstants';
import { filterSymbolSearchResults } from './symbolSearchFilter';

const FINNHUB_API_KEY = 'd1uf6gpr01qpci1cbg00d1uf6gpr01qpci1cbg0g';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

interface CachedQuote {
  quote: PriceQuote;
  fetchedAt: number;
}
interface CachedHistory {
  points: HistoricalPricePoint[];
  fetchedAt: number;
}

export type SymbolRangeStats = {
  weekHigh: number | null;
  weekLow: number | null;
  high52: number | null;
  low52: number | null;
};

interface CachedRangeStats {
  stats: SymbolRangeStats;
  fetchedAt: number;
}

const RANGE_STATS_TTL_MS = 15 * 60_000;

const memQuoteCache = new Map<string, CachedQuote>();
const memHistoryCache = new Map<string, CachedHistory>();
const memRangeStatsCache = new Map<string, CachedRangeStats>();

/**
 * ממיר symbol מה-format הפנימי שלנו ל-Yahoo:
 *   - מניות אמריקאיות: 'AAPL' → 'AAPL'
 *   - מניות תל אביב: 'TEVA.TA' → 'TEVA.TA' (זהה)
 *   - קריפטו: 'BTC-USD' → 'BTC-USD'
 */
function toYahooSymbol(symbol: string): string {
  return symbol;
}

function toFinnhubSymbol(symbol: string): string {
  return symbol;
}

// ---------------------------------------------------------------------------
// Quote (current price)
// ---------------------------------------------------------------------------

interface FinnhubQuoteResponse {
  c: number; // current price
  d: number; // change
  dp: number; // change percent
  h: number;
  l: number;
  o: number;
  pc: number; // previous close
  t: number; // unix timestamp
}

function _finiteOrNull(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) && v !== 0 ? v : null;
}

function _volumeOrNull(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function _parseFinnhubResponse(symbol: string, data: FinnhubQuoteResponse): PriceQuote | null {
  if (!data || !data.c || data.c === 0) return null;
  return {
    symbol,
    price: data.c,
    previous_close: data.pc || null,
    open: _finiteOrNull(data.o),
    day_high: _finiteOrNull(data.h),
    day_low: _finiteOrNull(data.l),
    volume: null,
    currency: 'USD',
    as_of: new Date(data.t ? data.t * 1000 : Date.now()).toISOString(),
    source: 'finnhub',
  };
}

async function fetchFinnhubQuote(symbol: string): Promise<PriceQuote | null> {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(
    toFinnhubSymbol(symbol)
  )}&token=${FINNHUB_API_KEY}`;

  try {
    const res = await fetch(url);
    if (res.status === 429) {
      // Rate limited — wait 5 seconds then retry once before falling back to Yahoo
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const retry = await fetch(url);
        if (!retry.ok) return null;
        return _parseFinnhubResponse(symbol, (await retry.json()) as FinnhubQuoteResponse);
      } catch {
        return null;
      }
    }
    if (!res.ok) return null;
    return _parseFinnhubResponse(symbol, (await res.json()) as FinnhubQuoteResponse);
  } catch {
    return null;
  }
}

/** Yahoo fallback – מספק quote אם Finnhub נכשל / סימבול לא נתמך */
async function fetchYahooQuote(symbol: string): Promise<PriceQuote | null> {
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(
      toYahooSymbol(symbol)
    )}?range=5d&interval=1d`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    if (!meta?.regularMarketPrice) return null;
    return {
      symbol,
      price: meta.regularMarketPrice,
      previous_close: meta.chartPreviousClose ?? meta.previousClose ?? null,
      open: _finiteOrNull(meta.regularMarketOpen),
      day_high: _finiteOrNull(meta.regularMarketDayHigh),
      day_low: _finiteOrNull(meta.regularMarketDayLow),
      volume: _volumeOrNull(meta.regularMarketVolume),
      currency: meta.currency || 'USD',
      as_of: new Date(meta.regularMarketTime * 1000 || Date.now()).toISOString(),
      source: 'yahoo',
    };
  } catch {
    return null;
  }
}

async function persistQuote(quote: PriceQuote): Promise<void> {
  try {
    await supabase.from('portfolio_price_cache').upsert(
      {
        symbol: quote.symbol,
        as_of: quote.as_of,
        price: quote.price,
        previous_close: quote.previous_close,
        currency: quote.currency,
        source: quote.source,
      },
      { onConflict: 'symbol,as_of' }
    );
  } catch {
    /* fire-and-forget */
  }
}

async function loadQuoteFromSupabase(symbol: string): Promise<PriceQuote | null> {
  try {
    const { data, error } = await supabase
      .from('portfolio_price_cache')
      .select('*')
      .eq('symbol', symbol)
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const ageMs = Date.now() - new Date(data.as_of).getTime();
    if (ageMs > QUOTE_CACHE_TTL_MS) return null;
    return {
      symbol: data.symbol,
      price: Number(data.price),
      previous_close: data.previous_close != null ? Number(data.previous_close) : null,
      open: null,
      day_high: null,
      day_low: null,
      volume: null,
      currency: data.currency,
      as_of: data.as_of,
      source: data.source,
    };
  } catch {
    return null;
  }
}

/**
 * מחזיר quote שוטף לסימבול. סדר לקיחה:
 *   1. Memory cache (5 דקות)
 *   2. Supabase cache (5 דקות)
 *   3. Finnhub
 *   4. Yahoo Finance (fallback)
 */
export async function getQuote(symbol: string): Promise<PriceQuote | null> {
  const now = Date.now();
  const sym = symbol.toUpperCase();

  const cached = memQuoteCache.get(sym);
  if (cached && now - cached.fetchedAt < QUOTE_CACHE_TTL_MS) {
    return cached.quote;
  }

  const fromDb = await loadQuoteFromSupabase(sym);
  if (fromDb) {
    memQuoteCache.set(sym, { quote: fromDb, fetchedAt: now });
    return fromDb;
  }

  // Finnhub למחיר; Yahoo במקביל לווליום (וגיבוי מחיר)
  const [finnhub, yahoo] = await Promise.all([
    fetchFinnhubQuote(sym),
    fetchYahooQuote(sym),
  ]);
  let fresh: PriceQuote | null = null;
  if (finnhub && yahoo) {
    fresh = {
      ...finnhub,
      volume: yahoo.volume ?? null,
      open: finnhub.open ?? yahoo.open ?? null,
      day_high: finnhub.day_high ?? yahoo.day_high ?? null,
      day_low: finnhub.day_low ?? yahoo.day_low ?? null,
    };
  } else {
    fresh = finnhub || yahoo;
  }
  if (fresh) {
    memQuoteCache.set(sym, { quote: fresh, fetchedAt: now });
    void persistQuote(fresh);
  }
  return fresh;
}

/** שליפת quotes במרובה – batched */
export async function getQuotes(
  symbols: string[]
): Promise<Map<string, PriceQuote>> {
  const map = new Map<string, PriceQuote>();
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  await Promise.all(
    unique.map(async (sym) => {
      const q = await getQuote(sym);
      if (q) map.set(sym, q);
    })
  );
  return map;
}

// ---------------------------------------------------------------------------
// Historical prices (יומי)
// ---------------------------------------------------------------------------

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta?: {
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketPrice?: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
        }>;
        adjclose?: Array<{
          adjclose: (number | null)[];
        }>;
      };
    }>;
    error: unknown;
  };
}

function _maxFinite(values: Array<number | null | undefined>): number | null {
  let max: number | null = null;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    max = max == null ? v : Math.max(max, v);
  }
  return max;
}

function _minFinite(values: Array<number | null | undefined>): number | null {
  let min: number | null = null;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    min = min == null ? v : Math.min(min, v);
  }
  return min;
}

/**
 * שיא/שפל שבועי (~5 ימי מסחר) + 52 שבועות מ-Yahoo chart.
 */
export async function getSymbolRangeStats(
  symbol: string
): Promise<SymbolRangeStats> {
  const sym = symbol.toUpperCase();
  const now = Date.now();
  const cached = memRangeStatsCache.get(sym);
  if (cached && now - cached.fetchedAt < RANGE_STATS_TTL_MS) {
    return cached.stats;
  }

  const empty: SymbolRangeStats = {
    weekHigh: null,
    weekLow: null,
    high52: null,
    low52: null,
  };

  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(
      toYahooSymbol(sym)
    )}?range=1mo&interval=1d`;
    const res = await fetch(url);
    if (!res.ok) return empty;
    const data = (await res.json()) as YahooChartResponse;
    const result = data?.chart?.result?.[0];
    if (!result) return empty;

    const quote = result.indicators?.quote?.[0];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];
    const closes = quote?.close ?? [];

    const lastN = 5;
    const weekHighs = highs.slice(-lastN);
    const weekLows = lows.slice(-lastN);
    // fallback ל-close אם אין high/low
    const weekHigh =
      _maxFinite(weekHighs) ?? _maxFinite(closes.slice(-lastN));
    const weekLow = _minFinite(weekLows) ?? _minFinite(closes.slice(-lastN));

    let high52 = _finiteOrNull(result.meta?.fiftyTwoWeekHigh);
    let low52 = _finiteOrNull(result.meta?.fiftyTwoWeekLow);

    if (high52 == null || low52 == null) {
      try {
        const yUrl = `${YAHOO_BASE}/${encodeURIComponent(
          toYahooSymbol(sym)
        )}?range=1y&interval=1d`;
        const yRes = await fetch(yUrl);
        if (yRes.ok) {
          const yData = (await yRes.json()) as YahooChartResponse;
          const yResult = yData?.chart?.result?.[0];
          const yQuote = yResult?.indicators?.quote?.[0];
          if (high52 == null) {
            high52 =
              _maxFinite(yQuote?.high ?? []) ??
              _maxFinite(yQuote?.close ?? []);
          }
          if (low52 == null) {
            low52 =
              _minFinite(yQuote?.low ?? []) ??
              _minFinite(yQuote?.close ?? []);
          }
        }
      } catch {
        /* keep partial */
      }
    }

    const stats: SymbolRangeStats = { weekHigh, weekLow, high52, low52 };
    memRangeStatsCache.set(sym, { stats, fetchedAt: now });
    return stats;
  } catch {
    return empty;
  }
}

export async function getSymbolsRangeStats(
  symbols: string[]
): Promise<Record<string, SymbolRangeStats>> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const out: Record<string, SymbolRangeStats> = {};
  // concurrency מוגבל — Yahoo נחסם בקלות על burst גדול
  const chunkSize = 4;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (sym) => {
        out[sym] = await getSymbolRangeStats(sym);
      })
    );
  }
  return out;
}

/**
 * מחזיר רשימת מחירי close יומיים לסימבול בטווח תאריכים.
 * משתמש ב-Yahoo Finance (חינמי, ללא API key).
 *
 * @param symbol - לדוגמה 'AAPL', 'BTC-USD', 'TA35.TA'
 * @param range - לדוגמה '1mo', '3mo', '6mo', '1y', '5y', 'max'
 */
export async function getHistoricalPrices(
  symbol: string,
  range: '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max' = '1y'
): Promise<HistoricalPricePoint[]> {
  const sym = symbol.toUpperCase();
  const cacheKey = `${sym}_${range}_raw`;
  const now = Date.now();
  const cached = memHistoryCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < HISTORICAL_CACHE_TTL_MS) {
    return cached.points;
  }

  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(
      toYahooSymbol(sym)
    )}?range=${range}&interval=1d`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as YahooChartResponse;
    const result = data?.chart?.result?.[0];
    if (!result || !result.timestamp) return [];

    // חשוב: raw close בלבד — לא adjclose.
    // מחירי כניסה ב-trades הם unadjusted; adjclose (אחרי reverse-split ב-UVIX וכו')
    // יוצר ספייקים מזויפים ב-unrealized ההיסטורי של הגרף.
    const closes = result.indicators.quote[0].close;

    const points: HistoricalPricePoint[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const close = closes[i];
      if (close == null) continue;
      const date = new Date(result.timestamp[i] * 1000);
      const isoDate = date.toISOString().slice(0, 10);
      points.push({ date: isoDate, close });
    }

    memHistoryCache.set(cacheKey, { points, fetchedAt: now });
    return points;
  } catch {
    return [];
  }
}

/** מחיר ב-תאריך ספציפי או היום הקרוב לפניו (לחישובי tx historic). */
export async function getPriceAtDate(
  symbol: string,
  date: string,
  range: '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max' = '1y'
): Promise<number | null> {
  const points = await getHistoricalPrices(symbol, range);
  if (!points.length) return null;
  const target = date.slice(0, 10);
  let best: HistoricalPricePoint | null = null;
  for (const p of points) {
    if (p.date <= target) best = p;
    else break;
  }
  return best?.close ?? null;
}

// ---------------------------------------------------------------------------
// Symbol search (autocomplete)
// ---------------------------------------------------------------------------

export interface SymbolSearchResult {
  symbol: string;
  description: string;
  display_symbol: string;
  type: string;
}

/** חיפוש symbol ב-Finnhub - free tier + סינון listings זרים/זבל */
export async function searchSymbols(
  query: string
): Promise<SymbolSearchResult[]> {
  if (!query || query.trim().length < 1) return [];
  try {
    const url = `${FINNHUB_BASE}/search?q=${encodeURIComponent(
      query.trim()
    )}&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const arr = (data?.result ?? []) as Array<{
      symbol: string;
      description: string;
      displaySymbol: string;
      type: string;
    }>;
    const mapped = arr.map((r) => ({
      symbol: r.symbol,
      description: r.description,
      display_symbol: r.displaySymbol || r.symbol,
      type: r.type || '',
    }));
    return filterSymbolSearchResults(mapped, query, {
      usPrimaryOnly: true,
      limit: 20,
    });
  } catch {
    return [];
  }
}

/** ניקוי cache ידני – שימושי כש-pull-to-refresh */
export function clearPriceCaches(): void {
  memRangeStatsCache.clear();
  memQuoteCache.clear();
  memHistoryCache.clear();
}
