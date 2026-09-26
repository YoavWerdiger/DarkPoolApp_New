/**
 * קריאה ישירה מ-DB — מהיר, בלי Edge / UW בכל כניסה למסך.
 */

import { supabase } from '../../lib/supabase';
import type { ActualCongressHolding } from '../../types/darkpool.types';
import {
  beatSpyRate,
  medianNumber,
  parseQuiverUsd,
  quiverAllocationToPct,
} from '../../screens/DarkPool/utils/congressHonesty';
import { disclosureDelayDays } from '../../screens/DarkPool/utils/congressTradeDisplay';
import { extractQuiverHoldingVendorEntry } from '../../screens/DarkPool/utils/holdingEntryReturn';
import {
  isBioguideHoldingsCacheFresh,
  isTickerHoldingsCacheFresh,
  looksLikeCompleteBioguideHoldings,
  mapTickerCongressHoldersFromCache,
  type PoliticianRosterRow,
  type QuiverHoldingsTickerCache,
  type TickerCongressHolder,
} from '../../screens/DarkPool/utils/tickerCongressHolders';
import type { CongressFeedTrade } from './uwCongressFeedService';
import type { UwExplorePayload } from './uwExploreService';
import type { PoliticianMetricsPayload } from './uwPoliticianMetricsService';

const EXPLORE_KEY = 'explore_v1';

const CONGRESS_BASE_COLUMNS =
  'external_id, politician_id, politician_name, politician_image_url, ticker, company_name, transaction_type, shares, price, amount_label, filed_at, transaction_date, txn_label, source';

/** עמודות התשואה של Quiver — נוספו ב-20260917210000_congress_trade_quiver_returns. */
const CONGRESS_RETURN_COLUMNS = 'excess_return_pct, price_change_pct, spy_change_pct';

const CONGRESS_SELECT = `${CONGRESS_BASE_COLUMNS}, ${CONGRESS_RETURN_COLUMNS}`;

/** PostgREST מחזיר 42703 כשעמודה לא קיימת — כלומר המיגרציה עוד לא הורצה. */
function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === '42703';
}

function numOrNull(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapCongressRow(row: Record<string, unknown>): CongressFeedTrade {
  return {
    id: String(row.external_id),
    politician_id: String(row.politician_id),
    politician_name: String(row.politician_name),
    politician_image_url: row.politician_image_url
      ? String(row.politician_image_url)
      : null,
    ticker: String(row.ticker).toUpperCase(),
    company_name: row.company_name ? String(row.company_name) : null,
    transaction_type: row.transaction_type === 'sell' ? 'sell' : 'buy',
    shares: row.shares != null ? Number(row.shares) : null,
    price: row.price != null ? Number(row.price) : null,
    amount_label: row.amount_label ? String(row.amount_label) : null,
    filed_at: String(row.filed_at),
    transaction_date: String(row.transaction_date).slice(0, 10),
    txn_label: row.txn_label
      ? String(row.txn_label)
      : row.transaction_type === 'sell'
        ? 'מכירה'
        : 'רכישה',
    source: (row.source === 'quiverquant' ? 'quiverquant' : 'unusualwhales') as
      | 'quiverquant'
      | 'unusualwhales',
    excess_return_pct: numOrNull(row.excess_return_pct),
    price_change_pct: numOrNull(row.price_change_pct),
    spy_change_pct: numOrNull(row.spy_change_pct),
  };
}

export async function listCongressTradesFromDb(limit = 50): Promise<CongressFeedTrade[]> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select(CONGRESS_SELECT)
    .order('filed_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (!isMissingColumnError(error)) throw error;
    const legacy = await supabase
      .from('dark_pool_congress_trades')
      .select(CONGRESS_BASE_COLUMNS)
      .order('filed_at', { ascending: false })
      .limit(limit);
    if (legacy.error) throw legacy.error;
    return (legacy.data ?? []).map(mapCongressRow);
  }

  return (data ?? []).map(mapCongressRow);
}

/**
 * כל עסקאות האדם ב-`dark_pool_congress_trades` — לפרופיל executive (טראמפ)
 * שאין לו bioguide / CurrentHolding.
 */
export async function listCongressTradesForPerson(
  politicianId: string,
  limit = 500
): Promise<CongressFeedTrade[]> {
  const pid = politicianId.trim();
  if (!pid) return [];

  const run = (columns: string) =>
    supabase
      .from('dark_pool_congress_trades')
      .select(columns)
      .eq('politician_id', pid)
      .order('transaction_date', { ascending: true })
      .limit(Math.min(1000, Math.max(1, limit)));

  const { data, error } = await run(CONGRESS_SELECT);
  if (error) {
    if (!isMissingColumnError(error)) throw error;
    const legacy = await run(CONGRESS_BASE_COLUMNS);
    if (legacy.error) throw legacy.error;
    return (legacy.data ?? []).map((row) =>
      mapCongressRow(row as unknown as Record<string, unknown>)
    );
  }
  return (data ?? []).map((row) => mapCongressRow(row as unknown as Record<string, unknown>));
}

/**
 * עסקאות קונגרס לטיקר אחד — טאב הפיד במסך המניה.
 * אותו יומן STOCK Act; אין המצאת שורות.
 */
export async function listCongressTradesByTicker(
  ticker: string,
  limit = 40
): Promise<CongressFeedTrade[]> {
  const sym = ticker.replace(/^\$/, '').trim().toUpperCase();
  if (!sym) return [];

  const run = (columns: string) =>
    supabase
      .from('dark_pool_congress_trades')
      .select(columns)
      .eq('ticker', sym)
      .order('filed_at', { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)));

  const { data, error } = await run(CONGRESS_SELECT);
  if (error) {
    if (!isMissingColumnError(error)) throw error;
    const legacy = await run(CONGRESS_BASE_COLUMNS);
    if (legacy.error) throw legacy.error;
    return (legacy.data ?? []).map((row) =>
      mapCongressRow(row as unknown as Record<string, unknown>)
    );
  }
  return (data ?? []).map((row) => mapCongressRow(row as unknown as Record<string, unknown>));
}

/**
 * "פעילות אחרונה" במסך פרטי עסקה — כל העסקאות של אותו אדם באותו טיקר.
 * נתון שכבר קיים ב-DB; אין קריאת API חדשה.
 */
export async function listCongressTradesForPersonTicker(
  politicianId: string,
  ticker: string,
  limit = 12
): Promise<CongressFeedTrade[]> {
  const pid = politicianId.trim();
  const sym = ticker.trim().toUpperCase();
  if (!pid || !sym) return [];

  const run = (columns: string) =>
    supabase
      .from('dark_pool_congress_trades')
      .select(columns)
      .eq('politician_id', pid)
      .eq('ticker', sym)
      .order('transaction_date', { ascending: false })
      .limit(limit);

  const { data, error } = await run(CONGRESS_SELECT);
  if (error) {
    if (!isMissingColumnError(error)) throw error;
    const legacy = await run(CONGRESS_BASE_COLUMNS);
    if (legacy.error) throw legacy.error;
    return (legacy.data ?? []).map((row) =>
      mapCongressRow(row as unknown as Record<string, unknown>)
    );
  }
  return (data ?? []).map((row) => mapCongressRow(row as unknown as Record<string, unknown>));
}

const QUIVER_HOLDINGS_CACHE_KEY = 'quiver_congress_holdings';

export interface CongressPersonHonestyStats {
  avg_delay_days: number | null;
  beat_spy_rate_pct: number | null;
  beat_spy_n: number;
  median_excess_return_pct: number | null;
}

export interface PoliticianExcessLeader {
  politician_id: string;
  politician_name: string;
  politician_image_url: string | null;
  median_excess_return_pct: number;
  sample_size: number;
}

async function readQuiverHoldingsCache(): Promise<QuiverHoldingsTickerCache | null> {
  const { data, error } = await supabase
    .from('dark_pool_uw_snapshots')
    .select('payload')
    .eq('cache_key', QUIVER_HOLDINGS_CACHE_KEY)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload as QuiverHoldingsTickerCache | null) ?? null;
}

function mapBioguideHoldingsFromPayload(
  payload: QuiverHoldingsTickerCache | null | undefined,
  bg: string
): ActualCongressHolding[] {
  const rows = payload?.by_bioguide?.[bg] ?? [];
  const stamp = payload?.bioguides_synced?.[bg];
  const asOfDate =
    typeof stamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(stamp) ? stamp.slice(0, 10) : null;

  return rows
    .map((h) => {
      const ticker = String(h.Ticker ?? '')
        .toUpperCase()
        .trim();
      if (!ticker) return null;
      const vendor = extractQuiverHoldingVendorEntry(h as Record<string, unknown>);
      return {
        bioguideId: String(h.BioGuideID ?? bg),
        ticker,
        companyName: null,
        currentValueUSD: parseQuiverUsd(h.CurrentHolding as number | string | null),
        portfolioPercent: quiverAllocationToPct(h.Allocation as number | string | null),
        asOfDate,
        vendorShares: vendor.vendorShares,
        vendorAvgCost: vendor.vendorAvgCost,
        vendorPriceChangePct: vendor.vendorPriceChangePct,
      } satisfies ActualCongressHolding;
    })
    .filter((h): h is ActualCongressHolding => h != null)
    .sort((a, b) => (b.currentValueUSD ?? 0) - (a.currentValueUSD ?? 0));
}

/**
 * אחזקות Quiver לפי bioguide — GET /beta/live/congress_stock_holdings?bioguide_id=
 * דרך ה-edge הקיים. בלי חותמת `bioguides_synced` לא מציגים מיזוג חלקי מטיקר.
 */
export async function listCongressHoldingsByBioguide(
  bioguideId: string
): Promise<ActualCongressHolding[]> {
  const bg = bioguideId.trim().toUpperCase();
  if (!/^[A-Z]\d{6}$/.test(bg)) return [];

  const first = await readQuiverHoldingsCache();
  if (isBioguideHoldingsCacheFresh(first, bg)) {
    return mapBioguideHoldingsFromPayload(first, bg);
  }
  // ספר מלא בלי חותמת (סנכרון ישן לפני bioguides_synced) — לא שורת טיקר.
  if (looksLikeCompleteBioguideHoldings(first?.by_bioguide?.[bg])) {
    return mapBioguideHoldingsFromPayload(first, bg);
  }

  try {
    await triggerQuiverHoldingsBioguideSync(bg);
  } catch {
    return [];
  }
  const payload = await readQuiverHoldingsCache();
  if (
    isBioguideHoldingsCacheFresh(payload, bg) ||
    looksLikeCompleteBioguideHoldings(payload?.by_bioguide?.[bg])
  ) {
    return mapBioguideHoldingsFromPayload(payload, bg);
  }
  return [];
}

const QUIVER_POLITICIANS_CACHE_KEY = 'quiver_congress_politicians';

/**
 * מחזיקי טיקר מ-`GET /beta/live/congress_stock_holdings?ticker=`.
 * בלי חותמת `tickers_synced` טרייה לא סורקים cache חלקי של מאוצרים.
 */
export async function listCongressHoldingsByTicker(
  ticker: string
): Promise<TickerCongressHolder[]> {
  const sym = ticker.replace(/^\$/, '').trim().toUpperCase();
  if (!sym || sym.length > 8) return [];

  const politiciansRes = await supabase
    .from('dark_pool_uw_snapshots')
    .select('payload')
    .eq('cache_key', QUIVER_POLITICIANS_CACHE_KEY)
    .maybeSingle();
  const politiciansPayload = politiciansRes.data?.payload as
    | { politicians?: PoliticianRosterRow[] }
    | null;

  const first = await readQuiverHoldingsCache();
  if (!isTickerHoldingsCacheFresh(first, sym)) {
    await triggerQuiverHoldingsTickerSync(sym);
  }

  const holdingsPayload = await readQuiverHoldingsCache();
  if (!isTickerHoldingsCacheFresh(holdingsPayload, sym)) return [];

  return mapTickerCongressHoldersFromCache({
    ticker: sym,
    byBioguide: holdingsPayload?.by_bioguide,
    politicians: politiciansPayload?.politicians,
  });
}

/** רענון אחזקות לפי טיקר דרך ה-edge הקיים — לא endpoint חדש. */
export async function triggerQuiverHoldingsTickerSync(ticker: string): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-quiver-congress-cache', {
    body: { ticker, politicians: false },
  });
  if (error) throw error;
}

/** רענון תיק מלא לפי BioGuide — `GET /beta/live/congress_stock_holdings?bioguide_id=`. */
export async function triggerQuiverHoldingsBioguideSync(bioguideId: string): Promise<void> {
  const bg = bioguideId.trim().toUpperCase();
  const { error } = await supabase.functions.invoke('sync-quiver-congress-cache', {
    body: { bioguides: [bg], politicians: false },
  });
  if (error) throw error;
}

/** Avg Delay + Beat-S&P מ-`filed_at`/`transaction_date`/`excess_return_pct` — בלי win-rate. */
export async function fetchCongressPersonHonestyStats(
  politicianId: string
): Promise<CongressPersonHonestyStats> {
  const empty: CongressPersonHonestyStats = {
    avg_delay_days: null,
    beat_spy_rate_pct: null,
    beat_spy_n: 0,
    median_excess_return_pct: null,
  };
  const pid = politicianId.trim();
  if (!pid) return empty;

  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select('filed_at, transaction_date, excess_return_pct')
    .eq('politician_id', pid)
    .limit(500);
  if (error) {
    if (isMissingColumnError(error)) {
      const legacy = await supabase
        .from('dark_pool_congress_trades')
        .select('filed_at, transaction_date')
        .eq('politician_id', pid)
        .limit(500);
      if (legacy.error) throw legacy.error;
      return statsFromRows(legacy.data ?? []);
    }
    throw error;
  }
  return statsFromRows(data ?? []);
}

function statsFromRows(
  rows: Array<{
    filed_at?: string | null;
    transaction_date?: string | null;
    excess_return_pct?: number | null;
  }>
): CongressPersonHonestyStats {
  const delays = rows
    .map((r) => disclosureDelayDays(r.filed_at, r.transaction_date))
    .filter((n): n is number => n != null);
  const excess = rows.map((r) =>
    r.excess_return_pct != null ? Number(r.excess_return_pct) : null
  );
  const beat = beatSpyRate(excess, 3);
  return {
    avg_delay_days: delays.length ? delays.reduce((s, n) => s + n, 0) / delays.length : null,
    beat_spy_rate_pct: beat?.pct ?? null,
    beat_spy_n: beat?.n ?? 0,
    median_excess_return_pct: medianNumber(
      excess.filter((n): n is number => n != null && Number.isFinite(n))
    ),
  };
}

/** דירוג פוליטיקאים לפי חציון ExcessReturn של Quiver — לא תשואת תיק משוחזרת. */
export async function listPoliticianMedianExcessLeaders(
  minSample = 5,
  limit = 12
): Promise<PoliticianExcessLeader[]> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select('politician_id, politician_name, politician_image_url, excess_return_pct')
    .not('excess_return_pct', 'is', null)
    .limit(2500);

  if (error) {
    if (isMissingColumnError(error)) return [];
    throw error;
  }

  const byId = new Map<
    string,
    {
      politician_id: string;
      politician_name: string;
      politician_image_url: string | null;
      values: number[];
    }
  >();

  for (const row of data ?? []) {
    const id = String(row.politician_id ?? '').trim();
    const n = Number(row.excess_return_pct);
    if (!id || !Number.isFinite(n)) continue;
    const prev = byId.get(id);
    if (prev) {
      prev.values.push(n);
      continue;
    }
    byId.set(id, {
      politician_id: id,
      politician_name: String(row.politician_name ?? ''),
      politician_image_url: row.politician_image_url
        ? String(row.politician_image_url)
        : null,
      values: [n],
    });
  }

  return Array.from(byId.values())
    .map((g) => {
      const median = medianNumber(g.values);
      if (median == null || g.values.length < minSample) return null;
      return {
        politician_id: g.politician_id,
        politician_name: g.politician_name,
        politician_image_url: g.politician_image_url,
        median_excess_return_pct: median,
        sample_size: g.values.length,
      };
    })
    .filter((g): g is PoliticianExcessLeader => g != null)
    .sort((a, b) => b.median_excess_return_pct - a.median_excess_return_pct)
    .slice(0, limit);
}

export interface RecentPoliticianActivity {
  politician_id: string;
  politician_name: string;
  politician_image_url: string | null;
  last_filed_at: string;
}

/** פוליטיקאים עם דיווח אחרון אמיתי — בלי תשואה משוחזרת. */
export async function listRecentlyActivePoliticians(
  limit = 12
): Promise<RecentPoliticianActivity[]> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select('politician_id, politician_name, politician_image_url, filed_at')
    .order('filed_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  const seen = new Set<string>();
  const out: RecentPoliticianActivity[] = [];
  for (const row of data ?? []) {
    const id = String(row.politician_id ?? '').trim();
    const name = String(row.politician_name ?? '').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      politician_id: id,
      politician_name: name,
      politician_image_url: row.politician_image_url
        ? String(row.politician_image_url)
        : null,
      last_filed_at: String(row.filed_at ?? ''),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchExploreSnapshotFromDb(): Promise<UwExplorePayload | null> {
  const { data, error } = await supabase
    .from('dark_pool_uw_snapshots')
    .select('payload, updated_at')
    .eq('cache_key', EXPLORE_KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload || typeof data.payload !== 'object') return null;

  const p = data.payload as UwExplorePayload;
  return {
    ...p,
    executives: p.executives ?? [],
    warnings: p.warnings ?? [],
    fetched_at: p.fetched_at ?? String(data.updated_at ?? ''),
    source: p.source ?? 'quiverquant',
  };
}

export async function fetchPoliticianMetricsFromDb(
  politicianId: string
): Promise<PoliticianMetricsPayload | null> {
  const { data, error } = await supabase
    .from('dark_pool_uw_snapshots')
    .select('payload')
    .eq('cache_key', `politician_metrics:${politicianId}`)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload || typeof data.payload !== 'object') return null;
  return data.payload as PoliticianMetricsPayload;
}

export async function triggerCongressSync(): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-congress-trades', {
    body: { limit: 200, deep: true },
  });
  if (error) throw error;
}

export async function triggerExploreSync(): Promise<void> {
  const { error } = await supabase.functions.invoke('uw-explore', {
    body: { force: true },
  });
  if (error) throw error;
}

export async function triggerPersonPortraitSync(force = false): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-person-portraits', {
    body: { force, limit: 80 },
  });
  if (error) throw error;
}
