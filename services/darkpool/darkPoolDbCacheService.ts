/**
 * קריאה ישירה מ-DB — מהיר, בלי Edge / UW בכל כניסה למסך.
 */

import { supabase } from '../../lib/supabase';
import type { CongressFeedTrade } from './uwCongressFeedService';
import type { UwExplorePayload } from './uwExploreService';
import type { PoliticianMetricsPayload } from './uwPoliticianMetricsService';

const EXPLORE_KEY = 'explore_v1';

export async function listCongressTradesFromDb(limit = 50): Promise<CongressFeedTrade[]> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select(
      'external_id, politician_id, politician_name, politician_image_url, ticker, company_name, transaction_type, shares, price, amount_label, filed_at, transaction_date, txn_label, source'
    )
    .order('filed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
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
  }));
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
    body: { limit: 60 },
  });
  if (error) throw error;
}

export async function triggerExploreSync(): Promise<void> {
  const { error } = await supabase.functions.invoke('uw-explore', {
    body: { force: true },
  });
  if (error) throw error;
}
