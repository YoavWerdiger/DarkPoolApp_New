import { supabase } from '../../lib/supabase';

export interface PoliticianMetricsPayload {
  politician_id: string;
  name: string;
  image_url: string | null;
  metrics: {
    portfolio_value: number;
    total_cost: number;
    total_return_usd: number;
    total_return_pct: number;
    series: Array<{ date: string; value: number }>;
    holdings: Array<{
      ticker: string;
      qty: number;
      cost_usd: number;
      current_price: number;
      market_value: number;
      allocation_pct: number;
      return_pct: number;
    }>;
    period_returns: Record<string, number | null>;
    win_rate: number | null;
    avg_delay_days: number | null;
    trade_count: number;
  } | null;
  snapshot_holdings_count: number;
  source: 'reconstructed' | 'snapshot_only' | 'none';
  warnings: string[];
  fetched_at: string;
}

const cache = new Map<string, { at: number; data: PoliticianMetricsPayload }>();
const CACHE_MS = 15 * 60 * 1000;

export async function fetchPoliticianMetrics(
  politicianId: string,
  force = false
): Promise<PoliticianMetricsPayload> {
  const id = politicianId.trim();
  const hit = cache.get(id);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const { data, error } = await supabase.functions.invoke<
    PoliticianMetricsPayload | { error: string }
  >('uw-politician-metrics', { body: { politician_id: id, force } });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('politician_id' in data)) {
    throw new Error('uw-politician-metrics: empty');
  }

  cache.set(id, { at: Date.now(), data });
  return data;
}

export function clearPoliticianMetricsCache() {
  cache.clear();
}
