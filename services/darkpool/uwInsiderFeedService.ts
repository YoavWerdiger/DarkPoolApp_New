import { supabase } from '../../lib/supabase';
import type { InsiderBuyRow } from '../../types/darkpool.types';

export interface UwLiveInsiderFeedPayload {
  trades: InsiderBuyRow[];
  fetched_at: string;
  source: 'unusualwhales';
}

let cache: { at: number; data: UwLiveInsiderFeedPayload } | null = null;
const CACHE_MS = 3 * 60 * 1000;

export async function fetchUwLiveInsiderFeed(
  limit = 40,
  force = false
): Promise<InsiderBuyRow[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data.trades;
  }

  const { data, error } = await supabase.functions.invoke<
    UwLiveInsiderFeedPayload | { error: string }
  >('uw-insider-feed', { body: { limit } });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('trades' in data)) throw new Error('uw-insider-feed: empty');

  const payload: UwLiveInsiderFeedPayload = {
    trades: data.trades ?? [],
    fetched_at: data.fetched_at ?? new Date().toISOString(),
    source: 'unusualwhales',
  };
  cache = { at: Date.now(), data: payload };
  return payload.trades;
}

export function clearUwLiveInsiderFeedCache() {
  cache = null;
}
