/**
 * darkpoolProvider.ts
 * -----------------------------------------------------------------------------
 * שכבת abstraction מעל ספקי הנתונים של Dark Pool prints.
 *
 * תומך בשלושה ספקים פעילים:
 *   - 'polygon'        – Polygon.io v3 trades (TRF condition codes 12/14/18 וכו')
 *   - 'unusualwhales'  – UnusualWhales darkpool prints feed
 *   - 'intrinio'       – Intrinio Dark Pool Activity API
 * וב-'mock' לפיתוח/בדיקות.
 *
 * הקובץ הזה הוא **pure**, ללא תלות ב-supabase/expo — כדי שיוכל לרוץ גם בלקוח
 * (debug only) וגם ב-Edge Function (Deno).
 *
 * שימוש מומלץ:
 *   const provider = getDarkPoolProvider();
 *   const { trades, nextCursor, lastTimestamp } =
 *     await provider.fetchTrades({ since: '2024-...Z', limit: 1000 });
 */

import type {
  DarkPoolProvider,
  DarkPoolProviderQuery,
  DarkPoolProviderResponse,
  DarkPoolSide,
  NormalizedDarkPoolTrade,
} from '../../types/darkpool.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IDarkPoolProvider {
  readonly name: DarkPoolProvider;
  fetchTrades(query: DarkPoolProviderQuery): Promise<DarkPoolProviderResponse>;
}

// ---------------------------------------------------------------------------
// Config (Deno / Node both expose process.env-like vars)
// ---------------------------------------------------------------------------

function readEnv(key: string): string | undefined {
  try {
    // Deno
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = (globalThis as any).Deno;
    if (d?.env?.get) return d.env.get(key) || undefined;
  } catch {
    // ignore
  }
  if (typeof process !== 'undefined' && process.env) {
    const v = (process.env as Record<string, string | undefined>)[key];
    return v && v.trim().length > 0 ? v : undefined;
  }
  return undefined;
}

export function resolveProviderName(): DarkPoolProvider {
  const raw = (readEnv('DARK_POOL_PROVIDER') || 'polygon').toLowerCase();
  if (
    raw === 'polygon' ||
    raw === 'unusualwhales' ||
    raw === 'intrinio' ||
    raw === 'mock'
  ) {
    return raw;
  }
  return 'polygon';
}

// ---------------------------------------------------------------------------
// Common helpers
// ---------------------------------------------------------------------------

/** מסיק side לפי קרבת המחיר ל-bid/ask. */
export function inferSide(
  price: number,
  bid?: number | null,
  ask?: number | null
): DarkPoolSide {
  if (!Number.isFinite(price) || price <= 0) return 'unknown';
  if (bid != null && ask != null && ask > bid) {
    const mid = (bid + ask) / 2;
    if (price >= mid + (ask - bid) * 0.2) return 'buy';
    if (price <= mid - (ask - bid) * 0.2) return 'sell';
    return 'unknown';
  }
  return 'unknown';
}

/** עיגול ב-2 ספות לאחר הנקודה. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ולידציה ונרמול לפני כתיבה ל-DB. */
export function sanitizeTrade(
  raw: Partial<NormalizedDarkPoolTrade>,
  provider: DarkPoolProvider
): NormalizedDarkPoolTrade | null {
  const ticker = String(raw.ticker || '').trim().toUpperCase();
  const price = Number(raw.price);
  const size = Number(raw.size);
  const timestamp = Number(raw.timestamp);
  if (!ticker) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(size) || size <= 0) return null;
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const premium = round2(price * size);
  return {
    externalId: raw.externalId ? String(raw.externalId) : null,
    ticker,
    companyName: raw.companyName ? String(raw.companyName) : null,
    timestamp,
    price,
    size,
    premium,
    volume: Number.isFinite(raw.volume as number) ? Number(raw.volume) : null,
    side: (raw.side as DarkPoolSide) || 'unknown',
    exchange: raw.exchange ? String(raw.exchange) : null,
    marketCap: Number.isFinite(raw.marketCap as number)
      ? Number(raw.marketCap)
      : null,
    provider,
  };
}

// ---------------------------------------------------------------------------
// Polygon.io implementation
//   Endpoint: /v3/trades/{ticker}?timestamp.gte=...
//   Dark-pool prints מסומנים ע"י conditions:
//   12 = "Form-T" (post-market), 14 = "TRF" trade, 37/38 = "ADF/TRF" — חבילות
//   רחבות של non-exchange prints. תלוי בחשבון; ברירת מחדל = 12/14/37/38.
// ---------------------------------------------------------------------------

const POLYGON_DARK_POOL_CONDITIONS = new Set([12, 14, 37, 38]);

class PolygonProvider implements IDarkPoolProvider {
  readonly name: DarkPoolProvider = 'polygon';
  private readonly apiKey: string;
  private readonly base: string;

  constructor(apiKey: string, base = 'https://api.polygon.io') {
    this.apiKey = apiKey;
    this.base = base;
  }

  async fetchTrades({
    since,
    limit = 1000,
    ticker,
  }: DarkPoolProviderQuery): Promise<DarkPoolProviderResponse> {
    if (!this.apiKey) throw new Error('POLYGON_API_KEY missing');
    const tickers = ticker
      ? [ticker.toUpperCase()]
      : await this.discoverUniverse();
    const out: NormalizedDarkPoolTrade[] = [];
    let latest = 0;
    for (const sym of tickers) {
      const url = `${this.base}/v3/trades/${encodeURIComponent(sym)}?timestamp.gte=${encodeURIComponent(
        since
      )}&order=asc&limit=${Math.min(limit, 5000)}&apiKey=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = (await res.json()) as PolygonTradesResponse;
      const results = json.results || [];
      for (const r of results) {
        const conds = Array.isArray(r.conditions) ? r.conditions : [];
        const isDark = conds.some((c) =>
          POLYGON_DARK_POOL_CONDITIONS.has(c)
        );
        if (!isDark) continue;
        const ts = Math.floor((r.participant_timestamp ?? r.sip_timestamp ?? 0) / 1e6);
        if (!ts) continue;
        if (ts > latest) latest = ts;
        const normalized = sanitizeTrade(
          {
            externalId: r.id != null ? `${sym}:${r.id}` : null,
            ticker: sym,
            timestamp: ts,
            price: r.price,
            size: r.size,
            exchange: r.exchange != null ? String(r.exchange) : null,
            side: 'unknown',
          },
          'polygon'
        );
        if (normalized) out.push(normalized);
      }
    }
    return {
      trades: out,
      nextCursor: latest ? String(latest) : null,
      lastTimestamp: latest || null,
    };
  }

  /**
   * אוניברס סינון בסיסי — Top 1000 most active US stocks.
   * ב-production מומלץ להזריק רשימה דרך טבלה במסד; כאן מחזירים רשימה קצרה כברירת מחדל.
   */
  private async discoverUniverse(): Promise<string[]> {
    const url = `${this.base}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${this.apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return DEFAULT_UNIVERSE;
      const json = (await res.json()) as PolygonSnapshotResponse;
      const tickers = (json.tickers || [])
        .filter((t) => (t?.day?.v || 0) > 500_000)
        .map((t) => t.ticker)
        .slice(0, 500);
      return tickers.length ? tickers : DEFAULT_UNIVERSE;
    } catch {
      return DEFAULT_UNIVERSE;
    }
  }
}

interface PolygonTradesResponse {
  results?: Array<{
    id?: number | string;
    price: number;
    size: number;
    conditions?: number[];
    exchange?: number;
    sip_timestamp?: number;
    participant_timestamp?: number;
  }>;
  next_url?: string;
}

interface PolygonSnapshotResponse {
  tickers?: Array<{
    ticker: string;
    day?: { v?: number };
  }>;
}

const DEFAULT_UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'TSLA',
  'AMD', 'NFLX', 'AVGO', 'JPM', 'V', 'MA', 'COST', 'WMT', 'XOM',
  'PFE', 'BAC', 'WFC', 'BA', 'DIS', 'CRM', 'ORCL', 'ADBE', 'INTC',
  'KO', 'PEP', 'MCD', 'NKE', 'PYPL', 'SBUX', 'UBER', 'LYFT', 'SHOP',
  'PLTR', 'SOFI', 'COIN', 'HOOD', 'GME', 'AMC', 'BB', 'ABNB',
  'SPY', 'QQQ', 'IWM', 'DIA', 'TQQQ', 'SQQQ',
];

// ---------------------------------------------------------------------------
// UnusualWhales implementation
//   Endpoint: /api/darkpool/recent?date=YYYY-MM-DD&limit=500
// ---------------------------------------------------------------------------

class UnusualWhalesProvider implements IDarkPoolProvider {
  readonly name: DarkPoolProvider = 'unusualwhales';
  private readonly apiKey: string;
  private readonly base: string;

  constructor(apiKey: string, base = 'https://api.unusualwhales.com') {
    this.apiKey = apiKey;
    this.base = base;
  }

  async fetchTrades({
    since,
    limit = 500,
    ticker,
  }: DarkPoolProviderQuery): Promise<DarkPoolProviderResponse> {
    if (!this.apiKey) throw new Error('UNUSUAL_WHALES_API_KEY missing');
    const sinceMs = Date.parse(since);
    const capped = Math.min(200, Math.max(1, limit));
    const url = ticker
      ? `${this.base}/api/darkpool/${encodeURIComponent(ticker.toUpperCase())}?limit=${capped}`
      : `${this.base}/api/darkpool/recent?limit=${capped}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`unusualwhales error: ${res.status}`);
    }
    const json = (await res.json()) as UnusualWhalesResponse;
    const rows = Array.isArray(json.data) ? json.data : [];
    const trades: NormalizedDarkPoolTrade[] = [];
    let latest = 0;
    for (const r of rows) {
      const ts = parseUWTimestamp(r.executed_at);
      if (!ts || ts < sinceMs) continue;
      if (ts > latest) latest = ts;
      const normalized = sanitizeTrade(
        {
          externalId: r.tracking_id ? `uw:${r.tracking_id}` : null,
          ticker: r.ticker,
          companyName: r.name ?? null,
          timestamp: ts,
          price: Number(r.price),
          size: Number(r.size),
          volume: r.volume != null ? Number(r.volume) : null,
          side: normalizeSide(r.side),
          exchange: r.exchange ?? null,
          marketCap: r.market_cap != null ? Number(r.market_cap) : null,
        },
        'unusualwhales'
      );
      if (normalized) trades.push(normalized);
    }
    return {
      trades,
      nextCursor: latest ? String(latest) : null,
      lastTimestamp: latest || null,
    };
  }
}

interface UnusualWhalesResponse {
  data?: Array<{
    tracking_id?: string;
    ticker: string;
    name?: string;
    price: number | string;
    size: number | string;
    volume?: number | string;
    side?: string;
    exchange?: string;
    market_cap?: number | string;
    executed_at: string;
  }>;
}

function parseUWTimestamp(s?: string): number | null {
  if (!s) return null;
  const v = Date.parse(s);
  return Number.isFinite(v) ? v : null;
}

function normalizeSide(s?: string | null): DarkPoolSide {
  const v = (s || '').toLowerCase();
  if (v === 'buy' || v === 'b') return 'buy';
  if (v === 'sell' || v === 's') return 'sell';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Intrinio implementation
//   Endpoint: /securities/dark-pool-activity?next_page=...
// ---------------------------------------------------------------------------

class IntrinioProvider implements IDarkPoolProvider {
  readonly name: DarkPoolProvider = 'intrinio';
  private readonly apiKey: string;
  private readonly base: string;

  constructor(apiKey: string, base = 'https://api-v2.intrinio.com') {
    this.apiKey = apiKey;
    this.base = base;
  }

  async fetchTrades({
    since,
    limit = 1000,
    ticker,
  }: DarkPoolProviderQuery): Promise<DarkPoolProviderResponse> {
    if (!this.apiKey) throw new Error('INTRINIO_API_KEY missing');
    const params = new URLSearchParams({
      api_key: this.apiKey,
      start_date: since.slice(0, 10),
      page_size: String(Math.min(limit, 10000)),
    });
    if (ticker) params.set('identifier', ticker.toUpperCase());
    const url = `${this.base}/securities/dark-pool-activity?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`intrinio error: ${res.status}`);
    const json = (await res.json()) as IntrinioResponse;
    const rows = json.dark_pool_activity || [];
    const sinceMs = Date.parse(since);
    const trades: NormalizedDarkPoolTrade[] = [];
    let latest = 0;
    for (const r of rows) {
      const ts = Date.parse(r.execution_time);
      if (!Number.isFinite(ts) || ts < sinceMs) continue;
      if (ts > latest) latest = ts;
      const normalized = sanitizeTrade(
        {
          externalId: r.id ? `intrinio:${r.id}` : null,
          ticker: r.security?.ticker ?? '',
          companyName: r.security?.company_name ?? null,
          timestamp: ts,
          price: Number(r.price),
          size: Number(r.size),
          side: normalizeSide(r.side),
        },
        'intrinio'
      );
      if (normalized) trades.push(normalized);
    }
    return {
      trades,
      nextCursor: json.next_page || (latest ? String(latest) : null),
      lastTimestamp: latest || null,
    };
  }
}

interface IntrinioResponse {
  dark_pool_activity?: Array<{
    id?: string;
    execution_time: string;
    price: number | string;
    size: number | string;
    side?: string;
    security?: { ticker?: string; company_name?: string };
  }>;
  next_page?: string;
}

// ---------------------------------------------------------------------------
// Mock provider (for dev / tests)
// ---------------------------------------------------------------------------

export class MockDarkPoolProvider implements IDarkPoolProvider {
  readonly name: DarkPoolProvider = 'mock';
  private trades: NormalizedDarkPoolTrade[];

  constructor(trades: NormalizedDarkPoolTrade[] = []) {
    this.trades = trades;
  }

  async fetchTrades({
    since,
    limit = 1000,
    ticker,
  }: DarkPoolProviderQuery): Promise<DarkPoolProviderResponse> {
    const sinceMs = Date.parse(since);
    const filtered = this.trades
      .filter((t) => t.timestamp >= sinceMs)
      .filter((t) => !ticker || t.ticker === ticker.toUpperCase())
      .slice(0, limit);
    const latest = filtered.reduce(
      (acc, t) => (t.timestamp > acc ? t.timestamp : acc),
      0
    );
    return {
      trades: filtered,
      nextCursor: latest ? String(latest) : null,
      lastTimestamp: latest || null,
    };
  }

  setTrades(trades: NormalizedDarkPoolTrade[]) {
    this.trades = trades;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface ProviderFactoryOptions {
  /** override env-based detection. */
  provider?: DarkPoolProvider;
  /** dependency-inject keys (כדי שלא נחפש env בלקוח). */
  keys?: {
    polygon?: string;
    unusualwhales?: string;
    intrinio?: string;
  };
  /** mock seed when provider='mock'. */
  mockTrades?: NormalizedDarkPoolTrade[];
}

export function getDarkPoolProvider(
  options: ProviderFactoryOptions = {}
): IDarkPoolProvider {
  const name = options.provider || resolveProviderName();
  switch (name) {
    case 'polygon':
      return new PolygonProvider(
        options.keys?.polygon || readEnv('POLYGON_API_KEY') || ''
      );
    case 'unusualwhales':
      return new UnusualWhalesProvider(
        options.keys?.unusualwhales || readEnv('UNUSUAL_WHALES_API_KEY') || ''
      );
    case 'intrinio':
      return new IntrinioProvider(
        options.keys?.intrinio || readEnv('INTRINIO_API_KEY') || ''
      );
    case 'mock':
    default:
      return new MockDarkPoolProvider(options.mockTrades);
  }
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type {
  DarkPoolProvider,
  DarkPoolProviderQuery,
  DarkPoolProviderResponse,
  NormalizedDarkPoolTrade,
} from '../../types/darkpool.types';
