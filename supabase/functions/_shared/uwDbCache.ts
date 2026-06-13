/**
 * שמירה/קריאה של cache UW ב-Postgres (service_role).
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

export interface CongressTradeRow {
  external_id: string;
  politician_id: string;
  politician_name: string;
  politician_image_url: string | null;
  ticker: string;
  company_name: string | null;
  transaction_type: 'buy' | 'sell';
  shares: number | null;
  price: number | null;
  amount_label: string | null;
  filed_at: string;
  transaction_date: string;
  txn_label: string | null;
  source: string;
}

export function createServiceSupabase(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
}

export interface InsiderBuyDbRow {
  external_id: string;
  ticker: string;
  company_name: string | null;
  insider_cik: string | null;
  insider_name: string | null;
  insider_role: string | null;
  insider_logo_url: string | null;
  transaction_type: string;
  shares: number;
  price: number;
  value: number;
  filed_at: string;
  transaction_date: string;
  source: string;
}

const BIOGUIDE_RE = /^[A-Z]\d{6}$/;
const CONGRESS_SELECT =
  'external_id, politician_id, politician_name, politician_image_url, ticker, company_name, transaction_type, shares, price, amount_label, filed_at, transaction_date, txn_label, source';

function mapCongressRows(data: unknown[] | null): CongressTradeRow[] {
  return (data ?? []).map(mapCongressDbRow);
}

function dedupeCongressRows(rows: CongressTradeRow[]): CongressTradeRow[] {
  const byExt = new Map<string, CongressTradeRow>();
  for (const row of rows) {
    const prev = byExt.get(row.external_id);
    if (!prev || row.filed_at > prev.filed_at) byExt.set(row.external_id, row);
  }
  return Array.from(byExt.values()).sort((a, b) => b.filed_at.localeCompare(a.filed_at));
}

export async function loadCongressTradesForPoliticianFromDb(
  supabase: SupabaseClient,
  politicianId: string,
  limit = 500
): Promise<CongressTradeRow[]> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select(CONGRESS_SELECT)
    .eq('politician_id', politicianId)
    .order('filed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (data?.length) return mapCongressRows(data);

  const merged: CongressTradeRow[] = [];

  if (BIOGUIDE_RE.test(politicianId)) {
    const { data: byPhoto, error: photoErr } = await supabase
      .from('dark_pool_congress_trades')
      .select(CONGRESS_SELECT)
      .ilike('politician_image_url', `%/${politicianId}.jpg%`)
      .order('filed_at', { ascending: false })
      .limit(limit);
    if (photoErr) throw photoErr;
    if (byPhoto?.length) merged.push(...mapCongressRows(byPhoto));
  }

  const lastName = politicianId.includes(':')
    ? ''
    : politicianId.split(/\s+/).pop()?.replace(/[^A-Za-z'-]/g, '') ?? '';
  if (lastName.length >= 3 && !BIOGUIDE_RE.test(politicianId)) {
    const { data: byName, error: nameErr } = await supabase
      .from('dark_pool_congress_trades')
      .select(CONGRESS_SELECT)
      .ilike('politician_name', `%${lastName}%`)
      .order('filed_at', { ascending: false })
      .limit(limit);
    if (nameErr) throw nameErr;
    if (byName?.length) merged.push(...mapCongressRows(byName));
  }

  return dedupeCongressRows(merged).slice(0, limit);
}

export async function loadCongressTradesFromDb(
  supabase: SupabaseClient,
  limit: number
): Promise<CongressTradeRow[]> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select(
      'external_id, politician_id, politician_name, politician_image_url, ticker, company_name, transaction_type, shares, price, amount_label, filed_at, transaction_date, txn_label, source'
    )
    .order('filed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapCongressDbRow);
}

export async function upsertCongressTradesToDb(
  supabase: SupabaseClient,
  rows: CongressTradeRow[]
): Promise<number> {
  if (!rows.length) return 0;
  const payload = rows.map((r) => ({
    external_id: r.external_id,
    politician_id: r.politician_id,
    politician_name: r.politician_name,
    politician_image_url: r.politician_image_url,
    ticker: r.ticker,
    company_name: r.company_name,
    transaction_type: r.transaction_type,
    shares: r.shares,
    price: r.price,
    amount_label: r.amount_label,
    filed_at: r.filed_at,
    transaction_date: r.transaction_date,
    txn_label: r.txn_label,
    source: r.source,
    synced_at: new Date().toISOString(),
  }));

  const byExternalId = new Map<string, (typeof payload)[number]>();
  for (const row of payload) {
    const prev = byExternalId.get(row.external_id);
    if (!prev || row.filed_at > prev.filed_at) {
      byExternalId.set(row.external_id, row);
    }
  }
  const unique = Array.from(byExternalId.values());

  const { error } = await supabase.from('dark_pool_congress_trades').upsert(unique, {
    onConflict: 'external_id',
    ignoreDuplicates: false,
  });
  if (error) throw error;
  return unique.length;
}

export async function loadSnapshot<T>(
  supabase: SupabaseClient,
  cacheKey: string,
  maxAgeMs: number
): Promise<{ payload: T; updated_at: string } | null> {
  const { data, error } = await supabase
    .from('dark_pool_uw_snapshots')
    .select('payload, updated_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return null;

  const updatedAt = String(data.updated_at ?? '');
  const age = Date.now() - Date.parse(updatedAt);
  if (!Number.isFinite(age) || age > maxAgeMs) return null;

  return { payload: data.payload as T, updated_at: updatedAt };
}

export async function loadSnapshotStale<T>(
  supabase: SupabaseClient,
  cacheKey: string
): Promise<{ payload: T; updated_at: string } | null> {
  const { data, error } = await supabase
    .from('dark_pool_uw_snapshots')
    .select('payload, updated_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return null;
  return { payload: data.payload as T, updated_at: String(data.updated_at ?? '') };
}

export async function saveSnapshot(
  supabase: SupabaseClient,
  cacheKey: string,
  payload: unknown
): Promise<void> {
  const { error } = await supabase.from('dark_pool_uw_snapshots').upsert(
    {
      cache_key: cacheKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cache_key' }
  );
  if (error) throw error;
}

/** ממיר שורת DB לפורמט UW לחישוב תיק (congressPortfolio). */
export function congressDbRowToUwTrade(row: CongressTradeRow): {
  politician_id: string;
  ticker: string;
  symbol: string;
  txn_type: string;
  amounts: string | null;
  transaction_date: string;
  filed_at_date: string;
  issuer?: string | null;
  reporter?: string | null;
} {
  return {
    politician_id: row.politician_id,
    ticker: row.ticker,
    symbol: row.ticker,
    txn_type: row.transaction_type === 'sell' ? 'Sell' : 'Buy',
    amounts: row.amount_label,
    transaction_date: row.transaction_date,
    filed_at_date: row.filed_at.slice(0, 10),
    issuer: row.company_name,
  };
}

export async function loadInsiderBuysFromDb(
  supabase: SupabaseClient,
  opts: { ticker?: string; insiderName?: string; limit?: number }
): Promise<InsiderBuyDbRow[]> {
  let q = supabase
    .from('dark_pool_insider_buys')
    .select(
      'external_id, ticker, company_name, insider_cik, insider_name, insider_role, insider_logo_url, transaction_type, shares, price, value, filed_at, transaction_date, source'
    )
    .order('filed_at', { ascending: false })
    .limit(Math.min(200, Math.max(10, opts.limit ?? 80)));

  if (opts.ticker) q = q.eq('ticker', opts.ticker.toUpperCase());
  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as InsiderBuyDbRow[];
  if (opts.insiderName) {
    const key = opts.insiderName.trim();
    rows = rows.filter((r) =>
      namesLooseMatchInsider(key, String(r.insider_name ?? ''))
    );
  }
  return rows;
}

function namesLooseMatchInsider(a: string, b: string): boolean {
  const na = a.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  const nb = b.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(' ').filter((w) => w.length > 1));
  const tb = new Set(nb.split(' ').filter((w) => w.length > 1));
  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap += 1;
  return overlap >= Math.min(2, Math.min(ta.size, tb.size));
}

function mapCongressDbRow(row: Record<string, unknown>): CongressTradeRow {
  return {
    external_id: String(row.external_id ?? ''),
    politician_id: String(row.politician_id ?? ''),
    politician_name: String(row.politician_name ?? ''),
    politician_image_url: row.politician_image_url
      ? String(row.politician_image_url)
      : null,
    ticker: String(row.ticker ?? '').toUpperCase(),
    company_name: row.company_name ? String(row.company_name) : null,
    transaction_type: row.transaction_type === 'sell' ? 'sell' : 'buy',
    shares: row.shares != null ? Number(row.shares) : null,
    price: row.price != null ? Number(row.price) : null,
    amount_label: row.amount_label ? String(row.amount_label) : null,
    filed_at: String(row.filed_at ?? ''),
    transaction_date: String(row.transaction_date ?? '').slice(0, 10),
    txn_label: row.txn_label ? String(row.txn_label) : null,
    source: String(row.source ?? 'unusualwhales'),
  };
}
