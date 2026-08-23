/**
 * Quiver Quantitative REST client — קונגרס + insiders.
 *
 * Secrets:
 *   QUIVER_API_KEY (או FORM4_API_KEY אם אותו מנוי)
 *   CONGRESS_TRADES_PROVIDER=quiverquant|unusualwhales
 */

const QUIVER_BASE = 'https://api.quiverquant.com';

export type CongressTradesProvider = 'quiverquant' | 'unusualwhales';

export interface QuiverCongressTrade {
  Representative?: string;
  BioGuideID?: string;
  ReportDate?: string;
  TransactionDate?: string;
  Ticker?: string;
  Transaction?: string;
  Range?: string;
  House?: string;
  Amount?: string;
  Party?: string;
  last_modified?: string;
  TickerType?: string;
  Description?: string | null;
  ExcessReturn?: number | null;
  PriceChange?: number | null;
  SPYChange?: number | null;
}

export interface QuiverPolitician {
  Name?: string;
  BioGuideID?: string;
  Party?: string;
  Chamber?: string;
  House?: string;
  TradeCount?: number;
  NetWorth?: number;
  'Net Worth'?: number;
  LastTraded?: string;
  State?: string;
}

function quiverHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
}

async function quiverGetJson<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${QUIVER_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), { headers: quiverHeaders(apiKey) });
  if (!res.ok) {
    const body = await res.text();
    const snippet = body.includes('<!')
      ? `HTTP ${res.status}`
      : body.slice(0, 80).replace(/\s+/g, ' ').trim();
    throw new Error(`quiver ${path} ${res.status}${snippet ? `: ${snippet}` : ''}`);
  }
  return (await res.json()) as T;
}

export function getCongressTradesProvider(): CongressTradesProvider {
  const raw = (Deno.env.get('CONGRESS_TRADES_PROVIDER') || 'quiverquant').toLowerCase();
  return raw === 'unusualwhales' ? 'unusualwhales' : 'quiverquant';
}

export function resolveQuiverApiKey(): string {
  return (
    Deno.env.get('QUIVER_API_KEY')?.trim() ||
    Deno.env.get('QUIVERQUANT_API_KEY')?.trim() ||
    Deno.env.get('FORM4_API_KEY')?.trim() ||
    ''
  );
}

export function resolveCongressApiKey(
  provider: CongressTradesProvider = getCongressTradesProvider()
): string {
  if (provider === 'quiverquant') return resolveQuiverApiKey();
  return Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
}

/** עסקאות קונגרס אחרונות — GET /beta/live/congresstrading */
export async function fetchQuiverLiveCongressTrades(
  apiKey: string
): Promise<QuiverCongressTrade[]> {
  const json = await quiverGetJson<QuiverCongressTrade[] | { data?: QuiverCongressTrade[] }>(
    apiKey,
    '/beta/live/congresstrading'
  );
  if (Array.isArray(json)) return json;
  return json.data ?? [];
}

/** היסטוריה לפי טיקר — GET /beta/historical/congresstrading/{ticker} */
export async function fetchQuiverHistoricalCongressByTicker(
  apiKey: string,
  ticker: string
): Promise<QuiverCongressTrade[]> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return [];
  const json = await quiverGetJson<QuiverCongressTrade[] | { data?: QuiverCongressTrade[] }>(
    apiKey,
    `/beta/historical/congresstrading/${encodeURIComponent(sym)}`
  );
  if (Array.isArray(json)) return json;
  return json.data ?? [];
}

/**
 * היסטוריה לפוליטיקאים מאוצרים — live מלא + historical לטיקרים פופולריים,
 * מסונן לפי BioGuideID.
 */
export async function fetchQuiverTradesForBioguides(
  apiKey: string,
  bioguides: string[],
  tickers: string[] = DEFAULT_HISTORY_TICKERS
): Promise<QuiverCongressTrade[]> {
  const want = new Set(
    bioguides.map((b) => b.trim().toUpperCase()).filter((b) => /^[A-Z]\d{6}$/.test(b))
  );
  if (!want.size) return [];

  const merged: QuiverCongressTrade[] = [];
  try {
    const live = await fetchQuiverLiveCongressTrades(apiKey);
    merged.push(...live);
  } catch (e) {
    console.warn('quiver live congress:', (e as Error).message);
  }

  for (const ticker of tickers) {
    try {
      const hist = await fetchQuiverHistoricalCongressByTicker(apiKey, ticker);
      merged.push(...hist);
      await delay(80);
    } catch (e) {
      console.warn(`quiver historical ${ticker}:`, (e as Error).message);
    }
  }

  const out: QuiverCongressTrade[] = [];
  const seen = new Set<string>();
  for (const row of merged) {
    const bg = String(row.BioGuideID ?? '')
      .trim()
      .toUpperCase();
    if (!want.has(bg)) continue;
    if (!isQuiverEquityTrade(row)) continue;
    const key = [
      bg,
      String(row.Ticker ?? '').toUpperCase(),
      String(row.TransactionDate ?? '').slice(0, 10),
      String(row.Transaction ?? ''),
      String(row.Range ?? row.Amount ?? ''),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** טיקרים עם דיווחי קונגרס נפוצים — מכסים היסטוריה של פלוסי וכו׳ */
export const DEFAULT_HISTORY_TICKERS = [
  'NVDA',
  'AAPL',
  'MSFT',
  'GOOGL',
  'GOOG',
  'AMZN',
  'META',
  'TSLA',
  'NFLX',
  'CRM',
  'AVGO',
  'AMD',
  'INTC',
  'UBER',
  'DIS',
  'BA',
  'JPM',
  'V',
  'MA',
  'COST',
  'PANW',
  'CRWD',
  'PLTR',
  'COIN',
];

/** BioGuides של פרופילים מאוצרים במסך אינסיידרים */
export const CURATED_CONGRESS_BIOGUIDES = [
  'P000197', // Nancy Pelosi
  'S000148', // Chuck Schumer
  'M000355', // Mitch McConnell
  'R000595', // Marco Rubio
  'C001098', // Ted Cruz
  'O000172', // AOC
  'P000603', // Rand Paul
  'C001114', // Dan Crenshaw
];

/**
 * UUID של Unusual Whales לפרופילים מאוצרים שאינם BioGuide (executive / נשיא).
 * Trump — לא STOCK Act קונגרס; עסקאות מגיעות מ־UW politician-portfolios.
 */
export const CURATED_EXECUTIVE_UW_IDS = [
  '888dc73f-f1eb-485a-a241-80657aaaaff9', // Donald Trump
];

/** רשימת פוליטיקאים — GET /beta/bulk/congress/politicians (paginated) */
export async function fetchQuiverCongressPoliticians(
  apiKey: string,
  opts: { pageSize?: number; maxPages?: number } = {}
): Promise<QuiverPolitician[]> {
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 50));
  const maxPages = Math.min(10, Math.max(1, opts.maxPages ?? 4));
  const out: QuiverPolitician[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const json = await quiverGetJson<{ data?: QuiverPolitician[] }>(
      apiKey,
      '/beta/bulk/congress/politicians',
      { page, page_size: pageSize, sort_by: 'trade_count' }
    );
    const batch = json.data ?? [];
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    await delay(120);
  }

  return out;
}

export function parseQuiverTxnSide(raw?: string | null): 'buy' | 'sell' | null {
  const t = (raw || '').toLowerCase();
  if (t.includes('sale') || t.includes('sell')) return 'sell';
  if (t.includes('purchase') || t.includes('buy')) return 'buy';
  return null;
}

export function isQuiverEquityTrade(row: QuiverCongressTrade): boolean {
  const ticker = String(row.Ticker ?? '').trim().toUpperCase();
  if (!ticker || ticker.length > 6) return false;
  const tt = String(row.TickerType ?? '').toLowerCase();
  if (tt && !tt.includes('stock') && tt !== 'st') return false;
  return parseQuiverTxnSide(row.Transaction) != null;
}

export function quiverPoliticianNetWorth(p: QuiverPolitician): number | undefined {
  const n = p.NetWorth ?? p['Net Worth'];
  return n != null && Number.isFinite(Number(n)) ? Number(n) : undefined;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
