import { supabase } from '../../lib/supabase';

export interface UwTickerNewsItem {
  id: string;
  title: string;
  source: string | null;
  date: string | null;
  sentiment: string | null;
  is_major: boolean;
}

export interface UwTickerInsights {
  ticker: string;
  news: UwTickerNewsItem[];
  gex: { net_gamma: number; label: string; strike_count: number } | null;
  flow_alerts: Array<{
    id: string;
    ticker: string;
    premium: number;
    type: string;
    rule: string;
  }>;
  insider_live: Array<{
    id: string;
    owner_name: string;
    txn_label: string;
    amount_label: string | null;
    date: string | null;
    logo_url: string | null;
  }>;
  form4_company?: {
    name: string;
    sector: string | null;
    active_insiders: number;
  } | null;
  cluster_signal?: {
    date: string;
    is_cluster_buy: boolean;
    is_cluster_sell: boolean;
    insider_count: number;
  } | null;
  insider_sentiment?: {
    period: string;
    score: number;
    buy_count: number;
    sell_count: number;
  } | null;
  warnings: string[];
  fetched_at: string;
}

const cache = new Map<string, { at: number; data: UwTickerInsights }>();
const CACHE_MS = 5 * 60 * 1000;

export async function fetchUwTickerInsights(
  ticker: string,
  force = false
): Promise<UwTickerInsights> {
  const sym = ticker.toUpperCase();
  const hit = cache.get(sym);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const { data, error } = await supabase.functions.invoke<
    UwTickerInsights | { error: string }
  >('uw-ticker-insights', { body: { ticker: sym, force } });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('ticker' in data)) throw new Error('uw-ticker-insights: empty');

  const normalized: UwTickerInsights = {
    ...data,
    warnings: data.warnings ?? [],
    news: data.news ?? [],
    flow_alerts: data.flow_alerts ?? [],
    insider_live: data.insider_live ?? [],
  };
  cache.set(sym, { at: Date.now(), data: normalized });
  return normalized;
}
