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

const memQuoteCache = new Map<string, CachedQuote>();
const memHistoryCache = new Map<string, CachedHistory>();

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

async function fetchFinnhubQuote(symbol: string): Promise<PriceQuote | null> {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(
    toFinnhubSymbol(symbol)
  )}&token=${FINNHUB_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as FinnhubQuoteResponse;
    if (!data || !data.c || data.c === 0) return null;
    return {
      symbol,
      price: data.c,
      previous_close: data.pc || null,
      currency: 'USD',
      as_of: new Date(data.t ? data.t * 1000 : Date.now()).toISOString(),
      source: 'finnhub',
    };
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

  const fresh =
    (await fetchFinnhubQuote(sym)) || (await fetchYahooQuote(sym));
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
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
        adjclose?: Array<{
          adjclose: (number | null)[];
        }>;
      };
    }>;
    error: unknown;
  };
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
  const cacheKey = `${sym}_${range}`;
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

    const closes =
      result.indicators.adjclose?.[0]?.adjclose ||
      result.indicators.quote[0].close;

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

/** חיפוש symbol ב-Finnhub - free tier */
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
    return arr.slice(0, 25).map((r) => ({
      symbol: r.symbol,
      description: r.description,
      display_symbol: r.displaySymbol,
      type: r.type,
    }));
  } catch {
    return [];
  }
}

/** ניקוי cache ידני – שימושי כש-pull-to-refresh */
export function clearPriceCaches(): void {
  memQuoteCache.clear();
  memHistoryCache.clear();
}
