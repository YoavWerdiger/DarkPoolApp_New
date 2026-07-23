import { supabase } from '../../lib/supabase';
import type { FollowedInvestor } from './darkPoolFollowService';

export interface FollowingActivityItem {
  id: string;
  source: 'congress' | 'insider';
  person_id: string;
  person_kind: 'politician' | 'insider';
  person_name: string;
  person_image_url: string | null;
  ticker: string;
  issuer: string | null;
  txn_label: string;
  amount_label: string | null;
  activity_date: string | null;
  filed_label: string | null;
}

export interface FollowingFeedPayload {
  items: FollowingActivityItem[];
  fetched_at: string;
}

let cache: { at: number; key: string; data: FollowingFeedPayload } | null = null;
const CACHE_MS = 5 * 60 * 1000;

function cacheKey(following: FollowedInvestor[]) {
  return following.map((f) => `${f.kind}:${f.id}`).sort().join('|');
}

export async function fetchFollowingFeed(
  following: FollowedInvestor[],
  force = false
): Promise<FollowingFeedPayload> {
  if (!following.length) {
    return { items: [], fetched_at: new Date().toISOString() };
  }

  const key = cacheKey(following);
  if (!force && cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const { data, error } = await supabase.functions.invoke<
    FollowingFeedPayload | { error: string }
  >('uw-following-feed', {
    body: {
      following: following.map((f) => ({
        id: f.id,
        kind: f.kind,
        name: f.name,
        image_url: f.image_url,
        ticker: f.ticker,
      })),
    },
  });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('items' in data)) throw new Error('uw-following-feed: empty');

  const normalized: FollowingFeedPayload = {
    items: data.items ?? [],
    fetched_at: data.fetched_at ?? new Date().toISOString(),
  };

  cache = { at: Date.now(), key, data: normalized };
  return normalized;
}

export function clearFollowingFeedCache() {
  cache = null;
}
