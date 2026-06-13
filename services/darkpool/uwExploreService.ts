import { supabase } from '../../lib/supabase';

function sanitizeExploreWarningsClient(warnings: string[]): string[] {
  return warnings
    .filter((w) => w && !/[<]|\bhtml\b|doctype/i.test(w) && !/quiver.*500/i.test(w))
    .map((w) => (w.length > 100 ? `${w.slice(0, 97)}…` : w))
    .slice(0, 2);
}

export interface ExplorePerson {
  id: string;
  name: string;
  subtitle: string;
  image_url: string | null;
  metric?: string;
  metric_label?: string;
  activity_score?: number;
  sparkline_values?: number[];
  kind: 'politician' | 'insider' | 'fund_manager';
  ticker?: string;
  followers_count?: number;
  portfolio_value?: number;
  returns?: Record<string, number | null>;
}

export interface UwExplorePayload {
  most_followed: ExplorePerson[];
  executives: ExplorePerson[];
  top_active: ExplorePerson[];
  recently_active: ExplorePerson[];
  insiders_with_photo: ExplorePerson[];
  warnings?: string[];
  fetched_at: string;
  source: 'quiverquant' | 'unusualwhales' | 'public_filings';
}

let cache: { at: number; data: UwExplorePayload } | null = null;
const CACHE_MS = 15 * 60 * 1000;

export async function fetchUwExplore(force = false): Promise<UwExplorePayload> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const { data, error } = await supabase.functions.invoke<
    UwExplorePayload | { error: string }
  >('uw-explore', { body: {} });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('most_followed' in data)) {
    throw new Error('uw-explore: empty response');
  }

  const normalized: UwExplorePayload = {
    ...data,
    executives: data.executives ?? [],
    warnings: sanitizeExploreWarningsClient(data.warnings ?? []),
    source: data.source ?? 'unusualwhales',
  };

  cache = { at: Date.now(), data: normalized };
  return normalized;
}

export function clearUwExploreCache() {
  cache = null;
}
