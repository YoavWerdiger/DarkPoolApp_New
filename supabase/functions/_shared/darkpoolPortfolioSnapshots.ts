/**
 * Snapshots ממומשים לפרופילי Dark Pool — קריאה/כתיבה ל-dark_pool_person_portfolio_snapshots
 * + cache מחירים market_daily_prices.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  fetchYahooDaily,
  type CongressPortfolioMetrics,
} from './congressPortfolio.ts';

export type SnapshotKind = 'politician' | 'insider' | 'fund_manager';

export interface PortfolioSnapshotRow {
  person_id: string;
  kind: SnapshotKind;
  series: unknown;
  holdings: unknown;
  period_returns: unknown;
  portfolio_value: number | null;
  total_return_pct: number | null;
  metrics: unknown;
  profile_meta: Record<string, unknown>;
  source_meta: Record<string, unknown>;
  computed_at: string;
}

/** פרופילים מאוצרים — bootstrap + materialize full */
export const CURATED_MATERIALIZE_TARGETS: Array<{
  id: string;
  kind: SnapshotKind;
  ticker?: string;
}> = [
  { id: '888dc73f-f1eb-485a-a241-80657aaaaff9', kind: 'politician' },
  { id: 'P000197', kind: 'politician' },
  { id: 'S000148', kind: 'politician' },
  { id: 'M000355', kind: 'politician' },
  { id: 'R000595', kind: 'politician' },
  { id: 'C001098', kind: 'politician' },
  { id: 'O000172', kind: 'politician' },
  { id: 'P000603', kind: 'politician' },
  { id: 'C001114', kind: 'politician' },
  { id: 'TSLA:Musk', kind: 'insider', ticker: 'TSLA' },
  { id: 'AAPL:Cook', kind: 'insider', ticker: 'AAPL' },
  { id: 'MSFT:Nadella', kind: 'insider', ticker: 'MSFT' },
  { id: 'NVDA:Huang', kind: 'insider', ticker: 'NVDA' },
  { id: 'META:Zuckerberg', kind: 'insider', ticker: 'META' },
  { id: 'ORCL:Ellison', kind: 'insider', ticker: 'ORCL' },
  { id: '1067983', kind: 'fund_manager' },
  { id: '1697748', kind: 'fund_manager' },
  { id: '1336528', kind: 'fund_manager' },
];

export const CURATED_ID_SET = new Set(
  CURATED_MATERIALIZE_TARGETS.map((t) => t.id)
);

/** שעות עד שה-snapshot נחשב טרי (serve ללא Yahoo) */
export function snapshotFreshHours(): number {
  return Math.min(
    168,
    Math.max(1, Number(Deno.env.get('PORTFOLIO_SNAPSHOT_FRESH_HOURS') || '24'))
  );
}

export function isSnapshotFresh(
  computedAt: string | null | undefined,
  freshHours = snapshotFreshHours()
): boolean {
  if (!computedAt) return false;
  const t = Date.parse(computedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < freshHours * 3600_000;
}

export async function loadPortfolioSnapshot(
  supabase: SupabaseClient,
  personId: string,
  kind: SnapshotKind
): Promise<PortfolioSnapshotRow | null> {
  const { data, error } = await supabase
    .from('dark_pool_person_portfolio_snapshots')
    .select(
      'person_id, kind, series, holdings, period_returns, portfolio_value, total_return_pct, metrics, profile_meta, source_meta, computed_at'
    )
    .eq('person_id', personId)
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw error;
  return (data as PortfolioSnapshotRow | null) ?? null;
}

export async function upsertPortfolioSnapshot(
  supabase: SupabaseClient,
  row: {
    person_id: string;
    kind: SnapshotKind;
    series: unknown;
    holdings: unknown;
    period_returns: unknown;
    portfolio_value?: number | null;
    total_return_pct?: number | null;
    metrics?: unknown;
    profile_meta?: Record<string, unknown>;
    source_meta?: Record<string, unknown>;
  }
): Promise<void> {
  const payload = {
    person_id: row.person_id,
    kind: row.kind,
    series: row.series ?? [],
    holdings: row.holdings ?? [],
    period_returns: row.period_returns ?? {},
    portfolio_value: row.portfolio_value ?? null,
    total_return_pct: row.total_return_pct ?? null,
    metrics: row.metrics ?? null,
    profile_meta: row.profile_meta ?? {},
    source_meta: {
      ...(row.source_meta ?? {}),
      written_at: new Date().toISOString(),
    },
    computed_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('dark_pool_person_portfolio_snapshots')
    .upsert(payload, { onConflict: 'person_id,kind' });
  if (error) throw error;
}

export function seriesMapFromJson(series: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!series || typeof series !== 'object') return out;
  for (const [k, v] of Object.entries(series as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out.set(k.slice(0, 10), n);
  }
  return out;
}

export function seriesMapToJson(map: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of map.entries()) out[k] = v;
  return out;
}

const PRICE_CACHE_MAX_AGE_MS = 6 * 3600_000;

/** טוען מחירים מ-DB; מחזיר רק טיקרים עם cache טרי */
export async function loadCachedPriceMaps(
  supabase: SupabaseClient,
  tickers: string[],
  maxAgeMs = PRICE_CACHE_MAX_AGE_MS
): Promise<Map<string, Map<string, number>>> {
  const unique = Array.from(
    new Set(tickers.map((t) => t.toUpperCase().trim()).filter(Boolean))
  );
  const out = new Map<string, Map<string, number>>();
  if (!unique.length) return out;

  const { data, error } = await supabase
    .from('market_daily_prices')
    .select('ticker, series, fetched_at')
    .in('ticker', unique);
  if (error) {
    console.warn('loadCachedPriceMaps', error.message);
    return out;
  }
  const cutoff = Date.now() - maxAgeMs;
  for (const row of data ?? []) {
    const fetched = Date.parse(String(row.fetched_at ?? ''));
    if (!Number.isFinite(fetched) || fetched < cutoff) continue;
    const map = seriesMapFromJson(row.series);
    if (map.size) out.set(String(row.ticker).toUpperCase(), map);
  }
  return out;
}

export async function persistPriceMaps(
  supabase: SupabaseClient,
  prices: Map<string, Map<string, number>>,
  range = '5y'
): Promise<number> {
  const rows = Array.from(prices.entries())
    .filter(([, m]) => m.size > 0)
    .map(([ticker, map]) => ({
      ticker,
      series: seriesMapToJson(map),
      price_range: range,
      fetched_at: new Date().toISOString(),
    }));
  if (!rows.length) return 0;
  // upsert בבאצ'ים
  let written = 0;
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const { error } = await supabase
      .from('market_daily_prices')
      .upsert(chunk, { onConflict: 'ticker' });
    if (error) console.warn('persistPriceMaps', error.message);
    else written += chunk.length;
  }
  return written;
}

/**
 * Batch Yahoo: cache DB קודם, אחר כך fetch לטיקרים חסרים/ישנים, שמירה ל-DB.
 */
export async function ensureYahooPriceMaps(
  supabase: SupabaseClient,
  tickers: string[],
  opts: { forceRefresh?: boolean; concurrency?: number } = {}
): Promise<Map<string, Map<string, number>>> {
  const unique = Array.from(
    new Set(tickers.map((t) => t.toUpperCase().trim()).filter((t) => t.length <= 5))
  );
  const out = new Map<string, Map<string, number>>();
  if (!unique.length) return out;

  if (!opts.forceRefresh) {
    const cached = await loadCachedPriceMaps(supabase, unique);
    for (const [k, v] of cached) out.set(k, v);
  }

  const missing = unique.filter((t) => !out.has(t) || out.get(t)!.size === 0);
  const concurrency = Math.min(8, Math.max(2, opts.concurrency ?? 6));
  const fetched = new Map<string, Map<string, number>>();

  for (let i = 0; i < missing.length; i += concurrency) {
    const batch = missing.slice(i, i + concurrency);
    const settled = await Promise.all(
      batch.map(async (sym) => {
        const map = await fetchYahooDaily(sym, '5y');
        return [sym, map] as const;
      })
    );
    for (const [sym, map] of settled) {
      if (map.size) {
        out.set(sym, map);
        fetched.set(sym, map);
      } else {
        out.set(sym, out.get(sym) ?? new Map());
      }
    }
  }

  if (fetched.size) {
    await persistPriceMaps(supabase, fetched).catch((e) =>
      console.warn('persistPriceMaps failed', e)
    );
  }
  return out;
}

export function metricsToSnapshotFields(metrics: CongressPortfolioMetrics) {
  return {
    series: metrics.series ?? [],
    holdings: metrics.holdings ?? [],
    period_returns: metrics.period_returns ?? {},
    portfolio_value: metrics.portfolio_value ?? null,
    total_return_pct: metrics.total_return_pct ?? null,
    metrics,
  };
}
