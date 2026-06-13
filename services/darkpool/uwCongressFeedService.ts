import { supabase } from '../../lib/supabase';

export interface CongressFeedTrade {
  id: string;
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
  txn_label: string;
  source: 'quiverquant' | 'unusualwhales';
}

export interface UwCongressFeedPayload {
  trades: CongressFeedTrade[];
  fetched_at: string;
  source: 'quiverquant' | 'unusualwhales';
  cached?: boolean;
  warning?: string;
}

let cache: { at: number; data: UwCongressFeedPayload } | null = null;
const CACHE_MS = 3 * 60 * 1000;

export async function fetchUwCongressFeed(
  limit = 40,
  force = false
): Promise<CongressFeedTrade[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data.trades.slice(0, limit);
  }

  const { data, error } = await supabase.functions.invoke<
    UwCongressFeedPayload | { error: string }
  >('uw-congress-feed', { body: { limit, force } });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('trades' in data)) throw new Error('uw-congress-feed: empty');

  const payload: UwCongressFeedPayload = {
    trades: data.trades ?? [],
    fetched_at: data.fetched_at ?? new Date().toISOString(),
    source: data.source ?? 'quiverquant',
    warning: data.warning,
  };
  cache = { at: Date.now(), data: payload };
  return payload.trades.slice(0, limit);
}

export function clearUwCongressFeedCache() {
  cache = null;
}
