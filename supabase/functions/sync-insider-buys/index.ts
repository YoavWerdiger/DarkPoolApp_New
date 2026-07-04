// supabase/functions/sync-insider-buys/index.ts
// ----------------------------------------------------------------------------
// מקורות → dark_pool_insider_buys:
//   edgar           – SEC EDGAR Form 4 ישיר (חינם, ציבורי)
//   form4api        – Form4API (FORM4_API_KEY — backend parser, לא redistribution)
//   secapi          – sec-api.io (דורש רישיון commercial ל-app)
//   unusualwhales   – UW (לא ל-production app בלי redistribution license)
//
// Secrets:
//   INSIDER_SYNC_SOURCES=edgar,form4api
//   SEC_API_KEY
//   FORM4_API_KEY, FORM4_PROVIDER, FORM4_LOOKBACK_HOURS
//   UNUSUAL_WHALES_API_KEY, UW_CLIENT_API_ID=100001
//   QUIVER_API_KEY (קונגרס — sync-congress-trades / uw-explore)
//   CONGRESS_TRADES_PROVIDER=quiverquant|unusualwhales
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  fetchUwInsiderTransactions,
  fetchUwInsidersForTicker,
  resolveUwLogoUrl,
  type UwInsiderRow,
  type UwInsiderTradeAgg,
} from '../_shared/unusualWhales.ts';
import { fetchSecApiInsiderPurchases } from '../_shared/secApiInsider.ts';
import { fetchEdgarForm4InsiderTrades, type EdgarInsiderRow } from '../_shared/secEdgar.ts';
import {
  fetchForm4Company,
  fetchForm4InsiderTradesForSync,
  fetchForm4Signals,
  type NormalizedForm4Trade,
} from '../_shared/form4api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NormalizedInsiderBuy {
  external_id: string;
  ticker: string;
  company_name: string | null;
  insider_cik: string | null;
  insider_name: string | null;
  insider_role: string | null;
  transaction_type: 'P' | 'S' | 'A' | 'M' | 'G' | 'F' | 'O' | 'D';
  shares: number;
  price: number;
  value: number;
  filed_at: string;
  transaction_date: string;
  source: string;
  sector: string | null;
  is_sp500: boolean | null;
  marketcap: number | null;
  next_earnings_date: string | null;
  is_10b5_plan: boolean | null;
  shares_owned_after: number | null;
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
}

function parseInsiderSources(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let debugTicker: string | null = null;
  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as { debug?: boolean; ticker?: string };
      if (body?.debug) debugTicker = (body.ticker || 'AAPL').toUpperCase();
    } catch {
      // empty body is fine
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const sources = parseInsiderSources(
    Deno.env.get('INSIDER_SYNC_SOURCES') || 'edgar,form4api'
  );
  const secApiKey = Deno.env.get('SEC_API_KEY') || '';
  const apiKey = Deno.env.get('FORM4_API_KEY') || '';
  const provider = (Deno.env.get('FORM4_PROVIDER') || 'form4api').toLowerCase();
  const lookbackHrs = Number(Deno.env.get('FORM4_LOOKBACK_HOURS') || '72');
  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';

  if (sources.has('secapi') && !secApiKey) {
    return new Response(JSON.stringify({ error: 'SEC_API_KEY missing (required when secapi in INSIDER_SYNC_SOURCES)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (sources.has('form4api') && !apiKey) {
    return new Response(JSON.stringify({ error: 'FORM4_API_KEY missing (required when form4api in INSIDER_SYNC_SOURCES)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (sources.has('unusualwhales') && !uwKey) {
    return new Response(JSON.stringify({ error: 'UNUSUAL_WHALES_API_KEY missing' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (
    !sources.has('secapi') &&
    !sources.has('form4api') &&
    !sources.has('edgar') &&
    !sources.has('unusualwhales')
  ) {
    return new Response(JSON.stringify({ error: 'INSIDER_SYNC_SOURCES empty' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (debugTicker) {
    if (!uwKey && sources.has('unusualwhales')) {
      return new Response(JSON.stringify({ error: 'UNUSUAL_WHALES_API_KEY missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const uwRows = await fetchUwInsidersForTicker(uwKey, debugTicker);
    const { data: trades } = await supabase
      .from('dark_pool_insider_buys')
      .select('insider_name, insider_cik')
      .eq('ticker', debugTicker)
      .limit(5);
    const samples = (trades ?? []).map((t) => ({
      insider_name: t.insider_name,
      insider_cik: t.insider_cik,
      match: pickUwInsider(t.insider_name, t.insider_cik, uwRows),
    }));
    let uwTxSample = 0;
    try {
      const tx = await fetchUwInsiderTransactions(uwKey, {
        limit: 20,
        transactionCodes: ['P'],
      });
      uwTxSample = tx.filter((t) => (t.ticker || '').toUpperCase() === debugTicker).length;
    } catch (e) {
      console.warn('debug uw transactions', e);
    }

    return jsonOk({
      debug: true,
      ticker: debugTicker,
      sources: Array.from(sources),
      uw_count: uwRows.length,
      uw_with_logo: uwRows.filter((r) => resolveUwLogoUrl(r)).length,
      uw_transactions_for_ticker: uwTxSample,
      uw_sample: uwRows.slice(0, 3).map((r) => ({
        cik: r.cik,
        display_name: r.display_name,
        name: r.name,
        logo_url: resolveUwLogoUrl(r) ? 'yes' : 'no',
      })),
      form4_samples: samples,
    });
  }

  try {
    const since = new Date(Date.now() - lookbackHrs * 60 * 60 * 1000).toISOString();
    const rows: NormalizedInsiderBuy[] = [];

    const sp500Names =
      sources.has('unusualwhales') && uwKey
        ? await loadSp500CompanyNames(supabase)
        : new Map<string, string>();

    const [secRows, form4Rows, edgarRows, uwRows] = await Promise.all([
      sources.has('secapi') && secApiKey
        ? fetchSecApiInsiderPurchases(secApiKey, since)
            .then((r) => r.map((row) => withDefaultEnrichment({ ...row, source: 'secapi' })))
            .catch((e) => {
              console.warn('sync-insider-buys secapi skipped', e);
              return [] as NormalizedInsiderBuy[];
            })
        : Promise.resolve([] as NormalizedInsiderBuy[]),
      sources.has('form4api') && apiKey
        ? provider === 'form4api'
          ? fetchFromForm4Api(apiKey, since)
          : fetchInsiderBuys(provider, apiKey, since)
        : Promise.resolve([] as NormalizedInsiderBuy[]),
      sources.has('edgar')
        ? fetchEdgarForm4InsiderTrades(since, { maxFilings: 80 })
            .then((rows) => rows.map(mapEdgarToNormalized))
            .catch((e) => {
              console.warn('sync-insider-buys edgar skipped', e);
              return [] as NormalizedInsiderBuy[];
            })
        : Promise.resolve([] as NormalizedInsiderBuy[]),
      sources.has('unusualwhales') && uwKey
        ? fetchInsiderBuysFromUw(uwKey, since, sp500Names)
        : Promise.resolve([] as NormalizedInsiderBuy[]),
    ]);

    rows.push(...secRows, ...form4Rows, ...edgarRows, ...uwRows);
    const deduped = dedupeInsiderRows(rows);

    if (!deduped.length) {
      const avatarsOnly =
        sources.has('unusualwhales') && uwKey
          ? await enrichInsiderAvatars(supabase, uwKey)
          : 0;
      const signalsSynced =
        sources.has('form4api') && apiKey
          ? await syncForm4Signals(supabase, apiKey).catch(() => 0)
          : 0;
      return jsonOk({
        inserted: 0,
        fetched: 0,
        from_secapi: 0,
        from_form4: 0,
        from_edgar: 0,
        from_uw: 0,
        avatars_enriched: avatarsOnly,
        signals_synced: signalsSynced,
        sources: Array.from(sources),
      });
    }

    const { error } = await supabase
      .from('dark_pool_insider_buys')
      .upsert(deduped, { onConflict: 'source,external_id' });
    if (error) throw error;

    const avatarsEnriched =
      sources.has('unusualwhales') && uwKey
        ? await enrichInsiderAvatars(supabase, uwKey, deduped.map((r) => r.ticker))
        : 0;

    const signalsSynced =
      sources.has('form4api') && apiKey
        ? await syncForm4Signals(supabase, apiKey).catch((e) => {
            console.warn('form4 signals', e);
            return 0;
          })
        : 0;

    const fromSecApi = deduped.filter((r) => r.source === 'secapi').length;
    const fromForm4 = deduped.filter((r) => r.source === 'form4api').length;
    const fromEdgar = deduped.filter((r) => r.source === 'edgar').length;
    const fromUw = deduped.filter((r) => r.source === 'unusualwhales').length;

    return jsonOk({
      inserted: deduped.length,
      fetched: deduped.length,
      from_secapi: fromSecApi,
      from_form4: fromForm4,
      from_edgar: fromEdgar,
      from_uw: fromUw,
      avatars_enriched: avatarsEnriched,
      signals_synced: signalsSynced,
      sources: Array.from(sources),
    });
  } catch (e) {
    console.error('sync-insider-buys error', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'internal' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function dedupeInsiderRows(rows: NormalizedInsiderBuy[]): NormalizedInsiderBuy[] {
  const map = new Map<string, NormalizedInsiderBuy>();
  for (const row of rows) {
    map.set(`${row.source}:${row.external_id}`, row);
  }
  return Array.from(map.values());
}

function withDefaultEnrichment(
  row: Omit<
    NormalizedInsiderBuy,
    | 'is_10b5_plan'
    | 'shares_owned_after'
    | 'return_1d'
    | 'return_1w'
    | 'return_1m'
    | 'return_3m'
    | 'return_6m'
  >
): NormalizedInsiderBuy {
  return {
    ...row,
    is_10b5_plan: null,
    shares_owned_after: null,
    return_1d: null,
    return_1w: null,
    return_1m: null,
    return_3m: null,
    return_6m: null,
  };
}

function mapEdgarToNormalized(row: EdgarInsiderRow): NormalizedInsiderBuy {
  return withDefaultEnrichment({
    external_id: row.external_id,
    ticker: row.ticker,
    company_name: row.company_name,
    insider_cik: row.insider_cik,
    insider_name: row.insider_name,
    insider_role: row.insider_role,
    transaction_type: row.transaction_type,
    shares: row.shares,
    price: row.price,
    value: row.value,
    filed_at: row.filed_at,
    transaction_date: row.transaction_date,
    source: 'edgar',
    sector: null,
    is_sp500: null,
    marketcap: null,
    next_earnings_date: null,
  });
}

async function fetchInsiderBuys(
  provider: string,
  apiKey: string,
  sinceIso: string
): Promise<NormalizedInsiderBuy[]> {
  if (provider === 'form4api') return fetchFromForm4Api(apiKey, sinceIso);
  if (provider === 'quiverquant') return fetchFromQuiver(apiKey, sinceIso);
  return [];
}

async function fetchFromForm4Api(
  apiKey: string,
  sinceIso: string
): Promise<NormalizedInsiderBuy[]> {
  const exclude10b5 =
    (Deno.env.get('FORM4_EXCLUDE_10B5') || 'true').toLowerCase() !== 'false';
  const trades = await fetchForm4InsiderTradesForSync(apiKey, sinceIso, { exclude10b5 });
  const enrichSectors =
    (Deno.env.get('FORM4_ENRICH_SECTORS') || 'false').toLowerCase() === 'true';
  const sectorCache = enrichSectors ? await enrichForm4Sectors(apiKey, trades) : new Map();
  return trades.map((t) => form4TradeToRow(t, sectorCache.get(t.ticker) ?? null));
}

function form4TradeToRow(
  t: NormalizedForm4Trade,
  sector: string | null
): NormalizedInsiderBuy {
  return {
    external_id: t.external_id,
    ticker: t.ticker,
    company_name: t.company_name,
    insider_cik: t.insider_cik,
    insider_name: t.insider_name,
    insider_role: t.insider_role,
    transaction_type: t.transaction_type,
    shares: t.shares,
    price: t.price,
    value: t.value,
    filed_at: t.filed_at,
    transaction_date: t.transaction_date,
    source: 'form4api',
    sector,
    is_sp500: null,
    marketcap: null,
    next_earnings_date: null,
    is_10b5_plan: t.is_10b5_plan,
    shares_owned_after: t.shares_owned_after,
    return_1d: t.return_1d,
    return_1w: t.return_1w,
    return_1m: t.return_1m,
    return_3m: t.return_3m,
    return_6m: t.return_6m,
  };
}

async function enrichForm4Sectors(
  apiKey: string,
  trades: NormalizedForm4Trade[]
): Promise<Map<string, string | null>> {
  const cache = new Map<string, string | null>();
  const tickers = [...new Set(trades.map((t) => t.ticker))].slice(0, 15);
  for (const ticker of tickers) {
    try {
      const co = await fetchForm4Company(apiKey, ticker);
      cache.set(ticker, co?.sicDescription?.trim() || null);
    } catch {
      cache.set(ticker, null);
    }
    await delay(60);
  }
  return cache;
}

async function syncForm4Signals(
  supabase: ReturnType<typeof createClient>,
  apiKey: string
): Promise<number> {
  const signals = await fetchForm4Signals(apiKey, { maxPages: 3 });
  if (!signals.length) return 0;

  const rows = signals
    .map((s) => {
      const ticker = s.ticker?.trim().toUpperCase();
      const signal_date = s.signalDate?.slice(0, 10);
      if (!ticker || !signal_date) return null;
      return {
        ticker,
        signal_date,
        company_name: s.companyName?.trim() || null,
        is_cluster_buy: !!s.isClusterBuy,
        is_cluster_sell: !!s.isClusterSell,
        insider_count: s.insiderCount ?? null,
        buy_sell_ratio: s.buySellRatio ?? null,
        synced_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (!rows.length) return 0;
  const { error } = await supabase
    .from('dark_pool_insider_signals')
    .upsert(rows, { onConflict: 'ticker,signal_date' });
  if (error) throw error;
  return rows.length;
}

async function loadSp500CompanyNames(
  supabase: ReturnType<typeof createClient>
): Promise<Map<string, string>> {
  const { data } = await supabase.from('sp500_constituents').select('ticker, name');
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const t = String(row.ticker ?? '').trim().toUpperCase();
    const n = String(row.name ?? '').trim();
    if (t && n) map.set(t, n);
  }
  return map;
}

async function fetchInsiderBuysFromUw(
  uwKey: string,
  sinceIso: string,
  sp500Names: Map<string, string>
): Promise<NormalizedInsiderBuy[]> {
  const sinceDate = sinceIso.slice(0, 10);
  const sp500Only = (Deno.env.get('UW_INSIDER_SP500_ONLY') || 'false').toLowerCase() === 'true';
  const raw = await fetchUwInsiderTransactions(uwKey, {
    limit: 500,
    transactionCodes: ['P'],
    group: true,
    commonStockOnly: true,
    ...(sp500Only ? { isSp500: true } : {}),
  });
  const out: NormalizedInsiderBuy[] = [];
  for (const r of raw) {
    const row = mapUwInsiderTransaction(r, sinceDate, sp500Names);
    if (row) out.push(row);
  }
  return out;
}

function mapUwInsiderTransaction(
  r: UwInsiderTradeAgg,
  sinceDate: string,
  sp500Names: Map<string, string>
): NormalizedInsiderBuy | null {
  const ticker = r.ticker?.trim().toUpperCase();
  if (!ticker || !r.transaction_date) return null;
  const code = (r.transaction_code || 'P').toUpperCase();
  if (code !== 'P') return null;
  if (r.is_10b5_1) return null;

  const txDate = r.transaction_date.slice(0, 10);
  if (txDate < sinceDate) return null;

  const shares = Math.abs(Number(r.amount) || 0);
  if (shares <= 0) return null;

  const price = Number(r.price ?? r.stock_price) || 0;
  const value = Math.round(shares * price * 100) / 100;
  const filedAt = r.filing_date
    ? `${r.filing_date.slice(0, 10)}T12:00:00Z`
    : `${txDate}T12:00:00Z`;
  const id = r.id?.trim();
  if (!id) return null;

  return withDefaultEnrichment({
    external_id: `uw:${id}`,
    ticker,
    company_name: sp500Names.get(ticker) ?? null,
    insider_cik: r.reporter_cik?.trim() || null,
    insider_name: r.owner_name?.trim() || null,
    insider_role: r.officer_title?.trim() || null,
    transaction_type: 'P',
    shares,
    price,
    value: value > 0 ? value : shares * price,
    filed_at: filedAt,
    transaction_date: txDate,
    source: 'unusualwhales',
    sector: r.sector?.trim() || null,
    is_sp500: r.is_s_p_500 === true ? true : r.is_s_p_500 === false ? false : null,
    marketcap: r.marketcap != null ? Number(r.marketcap) : null,
    next_earnings_date: r.next_earnings_date?.slice(0, 10) || null,
  });
}

async function fetchFromQuiver(apiKey: string, sinceIso: string): Promise<NormalizedInsiderBuy[]> {
  const url = `https://api.quiverquant.com/beta/live/insiders?date_from=${sinceIso.slice(0, 10)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`quiverquant ${res.status}`);
  const json = await res.json() as Array<{
    Ticker: string;
    Name?: string;
    Title?: string;
    TransactionDate?: string;
    Shares?: number;
    PricePerShare?: number;
    TransactionCode?: string;
    AccessionNumber?: string;
  }>;
  const out: NormalizedInsiderBuy[] = [];
  for (const r of json) {
    if (!r.Ticker || !r.TransactionDate) continue;
    const code = (r.TransactionCode || 'P').toUpperCase();
    if (code !== 'P') continue;
    const shares = Number(r.Shares) || 0;
    const price = Number(r.PricePerShare) || 0;
    out.push(
      withDefaultEnrichment({
        external_id: r.AccessionNumber
          ? `quiver:${r.AccessionNumber}`
          : `quiver:${r.Ticker}:${r.TransactionDate}`,
        ticker: r.Ticker.toUpperCase(),
        company_name: null,
        insider_cik: null,
        insider_name: r.Name ?? null,
        insider_role: r.Title ?? null,
        transaction_type: code,
        shares,
        price,
        value: shares * price,
        filed_at: new Date().toISOString(),
        transaction_date: r.TransactionDate.slice(0, 10),
        source: 'quiverquant',
        sector: null,
        is_sp500: null,
        marketcap: null,
        next_earnings_date: null,
      })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unusual Whales — תמונות בכירים (GET /api/insider/{ticker})
// ---------------------------------------------------------------------------

function normalizeNameKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(name: string): string[] {
  return normalizeNameKey(name).split(' ').filter((t) => t.length > 1);
}

function form4NameVariants(name: string): string[] {
  const tokens = nameTokens(name);
  const variants = new Set<string>([normalizeNameKey(name)]);
  if (tokens.length >= 2) {
    // SEC filing style: "LAST FIRST [M]" → try "FIRST LAST"
    variants.add(normalizeNameKey([...tokens.slice(1), tokens[0]].join(' ')));
    variants.add(normalizeNameKey(`${tokens[1]} ${tokens[0]}`));
    if (tokens.length >= 3) {
      variants.add(normalizeNameKey(`${tokens[1]} ${tokens[2]} ${tokens[0]}`));
    }
  }
  return Array.from(variants);
}

function insiderNamesMatch(form4Name: string, uwName: string): boolean {
  const b = normalizeNameKey(uwName);
  if (!b) return false;
  for (const variant of form4NameVariants(form4Name)) {
    if (!variant) continue;
    if (variant === b) return true;
    if (variant.includes(b) || b.includes(variant)) return true;
    const ta = variant.split(' ').filter((t) => t.length > 1);
    const tb = b.split(' ').filter((t) => t.length > 1);
    if (ta.length < 2 || tb.length < 2) continue;
    const setA = new Set(ta);
    let overlap = 0;
    for (const t of tb) {
      if (setA.has(t)) overlap++;
    }
    if (overlap >= Math.min(ta.length, tb.length) - 1) return true;
  }
  return false;
}

function pickUwInsider(
  form4Name: string | null,
  form4Cik: string | null,
  uwRows: UwInsiderRow[]
): UwInsiderRow | null {
  if (!uwRows.length) return null;
  if (form4Cik) {
    const pad = form4Cik.replace(/\D/g, '').padStart(10, '0');
    const byCik = uwRows.find((r) => {
      const c = (r.cik || '').replace(/\D/g, '').padStart(10, '0');
      return c === pad;
    });
    if (byCik) return byCik;
  }
  if (!form4Name) return uwRows.find((r) => resolveUwLogoUrl(r)) ?? null;
  for (const row of uwRows) {
    const candidates = [row.display_name, row.name].filter(Boolean) as string[];
    for (const c of candidates) {
      if (insiderNamesMatch(form4Name, c)) return row;
    }
  }
  return null;
}

async function enrichInsiderAvatars(
  supabase: ReturnType<typeof createClient>,
  uwKey: string,
  priorityTickers: string[] = []
): Promise<number> {
  const isEntityName = (name: string | null) =>
    !!name &&
    /\b(INC|LLC|LP|L\.P\.|LTD|CORP|CO\.|TRUST|FUND|MANAGEMENT|PARTNERS|CAPITAL|VENTURES|HOLDINGS)\b/i.test(
      name
    );
  const tickerSet = new Set(priorityTickers.map((t) => t.toUpperCase()));

  const { data: missingRows } = await supabase
    .from('dark_pool_insider_buys')
    .select('ticker')
    .is('insider_logo_url', null)
    .order('filed_at', { ascending: false })
    .limit(400);

  for (const row of missingRows ?? []) {
    if (row.ticker) tickerSet.add(String(row.ticker).toUpperCase());
  }

  const tickers = Array.from(tickerSet).slice(0, 80);
  let enriched = 0;

  for (const ticker of tickers) {
    const uwInsiders = await fetchUwInsidersForTicker(uwKey, ticker);
    if (!uwInsiders.length) continue;

    const { data: trades } = await supabase
      .from('dark_pool_insider_buys')
      .select('id, insider_name, insider_cik')
      .eq('ticker', ticker)
      .is('insider_logo_url', null);

    for (const trade of trades ?? []) {
      if (isEntityName(trade.insider_name) && !trade.insider_cik) continue;
      const match = pickUwInsider(trade.insider_name, trade.insider_cik, uwInsiders);
      const logo = match ? resolveUwLogoUrl(match) : null;
      if (!logo) continue;
      const { error } = await supabase
        .from('dark_pool_insider_buys')
        .update({
          insider_logo_url: logo,
          insider_cik: trade.insider_cik || match?.cik || null,
        })
        .eq('id', trade.id);
      if (!error) enriched++;
    }

    await delay(120);
  }

  return enriched;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
