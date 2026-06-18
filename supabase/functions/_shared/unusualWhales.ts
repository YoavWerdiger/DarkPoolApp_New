// supabase/functions/_shared/unusualWhales.ts
// ----------------------------------------------------------------------------
// לקוח REST ל-Unusual Whales — משותף ל-sync-insider-buys ו-sync-darkpool.
//
// Secrets:
//   UNUSUAL_WHALES_API_KEY
//   UW_CLIENT_API_ID (אופציונלי, ברירת מחדל 100001 — נדרש לפי skill.md)
// ----------------------------------------------------------------------------

const UW_BASE = 'https://api.unusualwhales.com';

export interface UwFetchResult<T> {
  data: T[];
  status: number;
}

export function uwHeaders(apiKey: string): Record<string, string> {
  const clientId = Deno.env.get('UW_CLIENT_API_ID') || '100001';
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'UW-CLIENT-API-ID': clientId,
  };
}

export async function uwGet<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<UwFetchResult<T>> {
  const url = new URL(path.startsWith('http') ? path : `${UW_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), { headers: uwHeaders(apiKey) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`unusualwhales ${path} ${res.status}: ${body.slice(0, 280)}`);
  }
  const json = await res.json();
  const data = parseUwDataArray<T>(json);
  return { data, status: res.status };
}

export interface UwProbeResult {
  id: string;
  label: string;
  path: string;
  ok: boolean;
  status: number;
  duration_ms: number;
  data_count: number | null;
  body_preview: string;
  hint: string | null;
}

/** קריאת UW לדיאגנוסטיקה — לא זורק, מחזיר status + preview. */
export async function uwProbe(
  apiKey: string,
  id: string,
  label: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<UwProbeResult> {
  const url = new URL(path.startsWith('http') ? path : `${UW_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const started = Date.now();
  try {
    const res = await fetch(url.toString(), { headers: uwHeaders(apiKey) });
    const text = await res.text();
    const duration_ms = Date.now() - started;
    let data_count: number | null = null;
    let hint: string | null = null;
    try {
      const json = JSON.parse(text) as unknown;
      data_count = countUwRecords(json);
      if (res.ok && data_count === 0) {
        hint = '200 אבל אין רשומות — ייתכן שה-tier לא כולל נתונים או שאין coverage';
      }
      if (res.status === 403) {
        hint = '403 — המפתח/תוכנית לא כוללים endpoint זה';
      }
      if (res.status === 401) {
        hint = '401 — מפתח API לא תקין';
      }
      if (res.status === 429) {
        hint = '429 — חריגה ממכסת קריאות';
      }
    } catch {
      hint = 'תשובה לא JSON';
    }
    return {
      id,
      label,
      path: url.pathname + url.search,
      ok: res.ok && (data_count ?? 0) > 0,
      status: res.status,
      duration_ms,
      data_count,
      body_preview: text.slice(0, 400),
      hint,
    };
  } catch (e) {
    return {
      id,
      label,
      path: url.pathname + url.search,
      ok: false,
      status: 0,
      duration_ms: Date.now() - started,
      data_count: null,
      body_preview: '',
      hint: (e as Error).message,
    };
  }
}

function countUwRecords(json: unknown): number {
  if (Array.isArray(json)) return json.length;
  if (!json || typeof json !== 'object') return 0;
  const o = json as Record<string, unknown>;
  if (Array.isArray(o.data)) {
    const first = o.data[0];
    if (first && typeof first === 'object') {
      const p = first as Record<string, unknown>;
      if (Array.isArray(p.stock_holdings)) {
        return (o.data as unknown[]).reduce((sum, row) => {
          const r = row as Record<string, unknown>;
          const stocks = Array.isArray(r.stock_holdings) ? r.stock_holdings.length : 0;
          const opts = Array.isArray(r.option_holdings) ? r.option_holdings.length : 0;
          return sum + stocks + opts;
        }, 0);
      }
    }
    return o.data.length;
  }
  if (Array.isArray(o.trades)) return o.trades.length;
  if (Array.isArray(o.results)) return o.results.length;
  return 0;
}

/** UW לעיתים מחזיר { data: [] } ולעיתים מבנה אחר — נרמול למערך. */
function parseUwDataArray<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.trades)) return o.trades as T[];
    if (Array.isArray(o.results)) return o.results as T[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Insider roster (תמונות + CIK)
// ---------------------------------------------------------------------------

export interface UwInsiderRow {
  cik?: string;
  display_name?: string;
  name?: string;
  id?: number;
  logo_url?: string | null;
  name_slug?: string;
  ticker?: string;
  is_person?: boolean;
}

export async function fetchUwInsidersForTicker(
  apiKey: string,
  ticker: string
): Promise<UwInsiderRow[]> {
  try {
    const { data } = await uwGet<UwInsiderRow>(
      apiKey,
      `/api/insider/${encodeURIComponent(ticker.toUpperCase())}`
    );
    return data;
  } catch (e) {
    console.warn(`uw insiders ${ticker}:`, (e as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Insider transactions feed (הפיד העיקרי של UW לעסקאות)
// ---------------------------------------------------------------------------

export interface UwInsiderTradeAgg {
  id?: string;
  ids?: string[];
  ticker?: string;
  owner_name?: string;
  officer_title?: string;
  transaction_code?: string;
  transaction_date?: string;
  filing_date?: string;
  amount?: number | string;
  price?: number | string;
  stock_price?: number | string;
  is_10b5_1?: boolean;
  is_director?: boolean;
  is_officer?: boolean;
  sector?: string;
  marketcap?: string | number;
  transactions?: number;
  reporter_cik?: string;
  is_s_p_500?: boolean;
}

export interface FetchUwInsiderTransactionsOpts {
  maxPages?: number;
  limit?: number;
  /** קודי עסקה SEC — ברירת מחדל רכישות P בלבד */
  transactionCodes?: string[];
  group?: boolean;
  commonStockOnly?: boolean;
  isSp500?: boolean;
  page?: number;
  ticker_symbol?: string;
  owner_name?: string;
}

export async function fetchUwInsiderTransactions(
  apiKey: string,
  opts: FetchUwInsiderTransactionsOpts = {}
): Promise<UwInsiderTradeAgg[]> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 200));
  const codes = opts.transactionCodes?.length ? opts.transactionCodes : ['P'];
  const out: UwInsiderTradeAgg[] = [];
  const maxPages = opts.maxPages ?? 1;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${UW_BASE}/api/insider/transactions`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('page', String(page));
    url.searchParams.set('group', String(opts.group ?? true));
    url.searchParams.set('common_stock_only', String(opts.commonStockOnly ?? true));
    if (opts.isSp500 === true) url.searchParams.set('is_s_p_500', 'true');
    if (opts.ticker_symbol) {
      url.searchParams.set('ticker_symbol', opts.ticker_symbol.toUpperCase());
    }
    if (opts.owner_name?.trim()) {
      url.searchParams.set('owner_name', opts.owner_name.trim());
    }
    for (const code of codes) {
      url.searchParams.append('transaction_codes[]', code);
    }

    const res = await fetch(url.toString(), { headers: uwHeaders(apiKey) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`unusualwhales /api/insider/transactions ${res.status}: ${body.slice(0, 280)}`);
    }
    const json = (await res.json()) as { data?: UwInsiderTradeAgg[] };
    const batch = json.data ?? [];
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < limit) break;
  }

  return out;
}

const UW_INSIDER_IMG = 'https://storage.googleapis.com/uwassets/insiders';

export function resolveUwLogoUrl(row: UwInsiderRow): string | null {
  const url = row.logo_url?.trim();
  if (url) return url;
  if (row.id != null && Number.isFinite(Number(row.id))) {
    return `${UW_INSIDER_IMG}/${row.id}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Congress
// ---------------------------------------------------------------------------

/** שם פוליטיקאי מ-UW — השדה משתנה בין endpoints. */
export function uwCongressPersonName(t: {
  name?: string;
  politician_name?: string;
  reporter?: string;
}): string {
  return String(t.politician_name ?? t.name ?? t.reporter ?? '').trim();
}

export interface UwCongressTrade {
  name?: string;
  politician_name?: string;
  ticker?: string;
  symbol?: string;
  issuer?: string;
  politician_id?: string;
  reporter?: string;
  transaction_date?: string;
  filed_at_date?: string;
  txn_type?: string;
  amounts?: string;
  member_type?: string;
  notes?: string;
  current_chamber?: string;
  /** מסומן כשמגיע מ-/api/congress/unusual-trades */
  is_unusual?: boolean;
}

export interface UwPolitician {
  politician_id?: string;
  id?: string;
  name?: string;
  party?: string;
  chamber?: string;
  bioguide_id?: string;
  trade_count?: number;
  last_trade_date?: string;
}

/** עסקאות קונגרס «יוצאות דופן» — GET /api/congress/unusual-trades */
export interface UwCongressUnusualTrade {
  amount?: string;
  asset?: string;
  asset_type?: string;
  company_name?: string;
  description?: string;
  politician?: string;
  politician_name?: string;
  politician_id?: string;
  ticker?: string;
  symbol?: string;
  transaction_date?: string;
  filing_date?: string;
  txn_type?: string;
  transaction_type?: string;
}

export async function fetchUwCongressUnusualTrades(
  apiKey: string,
  opts: { limit?: number; page?: number; types?: string } = {}
): Promise<UwCongressUnusualTrade[]> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const { data } = await uwGet<UwCongressUnusualTrade>(apiKey, '/api/congress/unusual-trades', {
    limit,
    page: opts.page ?? 1,
    types: opts.types,
  });
  return data;
}

export async function fetchUwCongressUnusualByTickers(
  apiKey: string,
  tickers: string[],
  opts: { limit?: number; politician?: string; date_from?: string } = {}
): Promise<UwCongressUnusualTrade[]> {
  if (!tickers.length) return [];
  const { data } = await uwGet<UwCongressUnusualTrade>(
    apiKey,
    '/api/congress/unusual-trades/by-tickers',
    {
      tickers: tickers.map((t) => t.toUpperCase()).join(','),
      limit: Math.min(500, opts.limit ?? 100),
      politician: opts.politician,
      date_from: opts.date_from,
    }
  );
  return data;
}

export interface UwCongressChartData {
  spy_prices: Array<{ date?: string; close?: number }>;
  trades: Array<{
    amount?: string;
    company_name?: string;
    filing_date?: string;
    id?: string;
    asset_type?: string;
  }>;
}

export async function fetchUwCongressUnusualChartData(
  apiKey: string,
  dateFrom?: string,
  dateTo?: string
): Promise<UwCongressChartData> {
  const url = new URL(`${UW_BASE}/api/congress/unusual-trades/chart-data`);
  if (dateFrom) url.searchParams.set('date_from', dateFrom);
  if (dateTo) url.searchParams.set('date_to', dateTo);
  const res = await fetch(url.toString(), { headers: uwHeaders(apiKey) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`unusualwhales chart-data ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as UwCongressChartData;
  return {
    spy_prices: json.spy_prices ?? [],
    trades: json.trades ?? [],
  };
}

export async function fetchUwCongressUnusualStats(apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${UW_BASE}/api/congress/unusual-trades/stats`, {
    headers: uwHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`unusualwhales stats ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** עסקאות לפי פוליטיקאי — GET /api/politician-portfolios/recent_trades */
export async function fetchUwPoliticianTrades(
  apiKey: string,
  politicianId: string,
  limit = 300
): Promise<UwCongressTrade[]> {
  const clamped = Math.min(500, Math.max(1, limit));
  const { data } = await uwGet<UwCongressTrade>(apiKey, '/api/politician-portfolios/recent_trades', {
    politician_id: politicianId,
    limit: clamped,
    page: 0,
  });
  if (data.length) return data;
  const { data: recent } = await uwGet<UwCongressTrade>(apiKey, '/api/congress/recent-trades', {
    limit: clamped,
  });
  return recent.filter((t) => String(t.politician_id ?? '') === politicianId);
}

export interface UwPoliticianStockHolding {
  ticker?: string;
  type?: string;
  min_amount?: number | string;
  mid_amount?: number | string;
  max_amount?: number | string;
}

export interface UwPoliticianPortfolio {
  id?: string;
  owner?: string;
  last_annual_disclosure?: number;
  stock_holdings?: UwPoliticianStockHolding[];
  option_holdings?: UwPoliticianStockHolding[];
  crypto_holdings?: UwPoliticianStockHolding[];
}

/** Snapshot תיק מדווח — GET /api/politician-portfolios/{politician_id} */
export async function fetchUwPoliticianPortfolio(
  apiKey: string,
  politicianId: string,
  aggregateAll = true
): Promise<UwPoliticianPortfolio[]> {
  const path = `/api/politician-portfolios/${encodeURIComponent(politicianId)}`;
  const { data } = await uwGet<UwPoliticianPortfolio>(apiKey, path, {
    aggregate_all_portfolios: aggregateAll,
  });
  return data;
}

export interface UwPoliticianDisclosure {
  id?: string;
  politician_id?: string;
  politician_name?: string;
  disclosure_year?: number;
  filing_date?: string;
  url?: string;
  chamber?: string;
}

/** דיווחים שנתיים — GET /api/politician-portfolios/disclosures */
export async function fetchUwPoliticianDisclosures(
  apiKey: string,
  politicianId: string
): Promise<UwPoliticianDisclosure[]> {
  const { data } = await uwGet<UwPoliticianDisclosure>(
    apiKey,
    '/api/politician-portfolios/disclosures',
    { politician_id: politicianId, latest_only: true }
  );
  return data;
}

export function mapUnusualTradeToCongress(row: UwCongressUnusualTrade): UwCongressTrade {
  const ticker =
    String(row.ticker ?? row.symbol ?? extractTickerFromAsset(row.asset, row.company_name) ?? '')
      .toUpperCase()
      .trim();
  return {
    politician_id: row.politician_id,
    politician_name: row.politician_name ?? row.politician,
    name: row.politician_name ?? row.politician,
    ticker,
    issuer: row.company_name,
    amounts: row.amount,
    txn_type: row.txn_type ?? row.transaction_type,
    transaction_date: row.transaction_date ?? row.filing_date,
    filed_at_date: row.filing_date ?? row.transaction_date,
    is_unusual: true,
  };
}

function extractTickerFromAsset(asset?: string, company?: string): string | null {
  const a = (asset || company || '').trim();
  const m = a.match(/\b([A-Z]{1,5})\b/);
  return m ? m[1] : null;
}

export function dedupeCongressTrades(rows: UwCongressTrade[]): UwCongressTrade[] {
  const seen = new Set<string>();
  const out: UwCongressTrade[] = [];
  for (const t of rows) {
    const pid = String(t.politician_id ?? '').trim();
    const ticker = String(t.ticker ?? t.symbol ?? '').toUpperCase();
    const date = String(t.transaction_date ?? t.filed_at_date ?? '').slice(0, 10);
    const key = `${pid}:${ticker}:${date}:${t.txn_type ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function fetchUwCongressRecent(
  apiKey: string,
  limit = 100
): Promise<UwCongressTrade[]> {
  const clamped = Math.min(500, Math.max(1, limit));
  const merged: UwCongressTrade[] = [];

  try {
    const { data } = await uwGet<UwCongressTrade>(apiKey, '/api/congress/recent-trades', {
      limit: Math.min(200, clamped),
    });
    merged.push(...data);
  } catch (e) {
    console.warn('congress recent-trades:', (e as Error).message);
  }

  if (merged.length < Math.min(20, clamped)) {
    try {
      const { data } = await uwGet<UwCongressTrade>(
        apiKey,
        '/api/politician-portfolios/recent_trades',
        { limit: clamped, page: 0 }
      );
      merged.push(...data);
    } catch (e) {
      console.warn('congress politician-portfolios:', (e as Error).message);
    }
  }

  return dedupeCongressTrades(merged).slice(0, clamped);
}

export async function fetchUwPoliticians(
  apiKey: string,
  lastTradedMonths = 24
): Promise<UwPolitician[]> {
  const { data } = await uwGet<UwPolitician>(apiKey, '/api/congress/politicians', {
    last_traded_within_months: lastTradedMonths,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Market sentiment (סקירה)
// ---------------------------------------------------------------------------

export interface UwMarketTidePoint {
  timestamp?: string;
  net_call_premium?: string | number;
  net_put_premium?: string | number;
}

export async function fetchUwMarketTide(apiKey: string): Promise<UwMarketTidePoint[]> {
  const { data } = await uwGet<UwMarketTidePoint>(apiKey, '/api/market/market-tide', {
    interval_5m: false,
  });
  return data;
}

// ---------------------------------------------------------------------------
// News + GEX (מסך טיקר)
// ---------------------------------------------------------------------------

export interface UwNewsHeadline {
  headline?: string;
  title?: string;
  source?: string;
  created_at?: string;
  published_at?: string;
  sentiment?: string;
  is_major?: boolean;
  tickers?: string[];
  url?: string;
}

export async function fetchUwNewsHeadlines(
  apiKey: string,
  ticker: string,
  limit = 8
): Promise<UwNewsHeadline[]> {
  const { data } = await uwGet<UwNewsHeadline>(apiKey, '/api/news/headlines', {
    ticker: ticker.toUpperCase(),
    limit: Math.min(20, Math.max(1, limit)),
  });
  return data;
}

export interface UwSpotGexStrikeRow {
  strike?: number | string;
  call_gamma_oi?: number | string;
  put_gamma_oi?: number | string;
  call_gamma_vol?: number | string;
  put_gamma_vol?: number | string;
  net_gamma_oi?: number | string;
  gamma?: number | string;
}

export interface UwGexSummary {
  net_gamma: number;
  label: string;
  strike_count: number;
}

export async function fetchUwSpotGexSummary(
  apiKey: string,
  ticker: string
): Promise<UwGexSummary | null> {
  try {
    const { data } = await uwGet<UwSpotGexStrikeRow>(
      apiKey,
      `/api/stock/${encodeURIComponent(ticker.toUpperCase())}/spot-exposures/strike`,
      { limit: 120 }
    );
    if (!data.length) return null;
    let sum = 0;
    for (const row of data) {
      const direct = Number(row.net_gamma_oi ?? row.gamma);
      if (Number.isFinite(direct)) {
        sum += direct;
        continue;
      }
      const call = Number(row.call_gamma_oi ?? row.call_gamma_vol) || 0;
      const put = Number(row.put_gamma_oi ?? row.put_gamma_vol) || 0;
      sum += call + put;
    }
    const label =
      sum > 0
        ? 'גמא חיובי — לחץ על תנודתיות'
        : sum < 0
          ? 'גמא שלילי — מגביר תנודתיות'
          : 'גמא ניטרלי';
    return { net_gamma: sum, label, strike_count: data.length };
  } catch (e) {
    console.warn(`gex ${ticker}:`, (e as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Insider flow (לפי טיקר / סקטור)
// ---------------------------------------------------------------------------

export interface UwInsiderFlowPoint {
  date?: string;
  premium?: number | string;
  buy_sell?: string;
  volume?: number | string;
  transactions?: number | string;
  uniq_insiders?: number | string;
  avg_price?: number | string;
}

/** GET /api/insider/{ticker}/ticker-flow */
export async function fetchUwInsiderTickerFlow(
  apiKey: string,
  ticker: string,
  limit = 60
): Promise<UwInsiderFlowPoint[]> {
  const { data } = await uwGet<UwInsiderFlowPoint>(
    apiKey,
    `/api/insider/${encodeURIComponent(ticker.toUpperCase())}/ticker-flow`,
    { limit: Math.min(500, Math.max(1, limit)) }
  );
  return data;
}

/** GET /api/insider/{sector}/sector-flow */
export async function fetchUwInsiderSectorFlow(
  apiKey: string,
  sector: string,
  limit = 60
): Promise<UwInsiderFlowPoint[]> {
  const { data } = await uwGet<UwInsiderFlowPoint>(
    apiKey,
    `/api/insider/${encodeURIComponent(sector)}/sector-flow`,
    { limit: Math.min(500, Math.max(1, limit)) }
  );
  return data;
}

// ---------------------------------------------------------------------------
// Dark pool (רשמי: recent + per ticker)
// ---------------------------------------------------------------------------

export interface UwDarkpoolPrint {
  tracking_id?: number | string;
  ticker: string;
  price: number | string;
  size: number | string;
  premium?: number | string;
  volume?: number | string;
  executed_at: string;
  canceled?: boolean;
  market_center?: string;
}

/** GET /api/darkpool/recent */
export async function fetchUwDarkpoolRecent(
  apiKey: string,
  opts: {
    limit?: number;
    min_premium?: number;
    sinceMs?: number;
  } = {}
): Promise<{ prints: UwDarkpoolPrint[]; lastTimestamp: number | null }> {
  const capped = Math.min(200, Math.max(1, opts.limit ?? 100));
  const { data } = await uwGet<UwDarkpoolPrint>(apiKey, '/api/darkpool/recent', {
    limit: capped,
    min_premium: opts.min_premium ?? 0,
  });
  const sinceMs = opts.sinceMs ?? 0;
  const prints: UwDarkpoolPrint[] = [];
  let latest = 0;
  for (const r of data) {
    if (r.canceled) continue;
    const ts = Date.parse(r.executed_at);
    if (!Number.isFinite(ts) || (sinceMs > 0 && ts < sinceMs)) continue;
    if (ts > latest) latest = ts;
    prints.push(r);
  }
  return { prints, lastTimestamp: latest || null };
}

/** GET /api/darkpool/{ticker} */
export async function fetchUwDarkpoolByTicker(
  apiKey: string,
  ticker: string,
  opts: { limit?: number; min_premium?: number } = {}
): Promise<UwDarkpoolPrint[]> {
  const { data } = await uwGet<UwDarkpoolPrint>(
    apiKey,
    `/api/darkpool/${encodeURIComponent(ticker.toUpperCase())}`,
    {
      limit: Math.min(500, opts.limit ?? 80),
      min_premium: opts.min_premium ?? 0,
    }
  );
  return data.filter((r) => !r.canceled);
}

export async function fetchUwFlowAlertsForTicker(
  apiKey: string,
  ticker: string,
  limit = 5
): Promise<
  Array<{
    id: string;
    ticker: string;
    premium: number;
    type: string;
    rule: string;
  }>
> {
  const url = new URL(`${UW_BASE}/api/option-trades/flow-alerts`);
  url.searchParams.set('ticker_symbol', ticker.toUpperCase());
  url.searchParams.set('limit', String(Math.min(30, limit * 3)));
  url.searchParams.set('min_premium', '50000');
  const res = await fetch(url.toString(), { headers: uwHeaders(apiKey) });
  if (!res.ok) return [];
  const json = await res.json();
  const rows = parseUwDataArray<Record<string, unknown>>(json);
  return rows
    .map((r) => {
      const t = String(r.ticker ?? r.ticker_symbol ?? '').toUpperCase();
      if (t !== ticker.toUpperCase()) return null;
      const prem = Number(r.total_premium ?? r.premium) || 0;
      return {
        id: String(r.id ?? `${t}-${r.created_at}`),
        ticker: t,
        premium: prem,
        type: String(r.type ?? '').toLowerCase(),
        rule: String(r.alert_rule ?? r.rule_name ?? 'Flow'),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.premium - a.premium)
    .slice(0, limit);
}
