import { supabase } from '../../lib/supabase';
import type {
  PortfolioSource,
  ReconstructedPortfolioMetrics,
} from './portfolioMetricsTypes';

export type { ReconstructedPortfolioMetrics, PortfolioSource } from './portfolioMetricsTypes';

export interface InvestorHolding {
  ticker: string;
  issuer: string | null;
  owner_label?: string | null;
  trade_count: number;
  last_trade_date: string | null;
  txn_mix: string;
  allocation_pct?: number;
  amount_label?: string | null;
}

export interface PortfolioSnapshot {
  disclosure_year: number | null;
  estimated_value_usd: number;
  estimated_value_label: string;
  filing_date: string | null;
  disclosure_url: string | null;
  source: 'annual_disclosure';
}

export interface InvestorRecentTrade {
  id: string;
  ticker: string;
  txn_label: string;
  amount_label: string | null;
  date: string | null;
}

export interface InvestorProfile {
  id: string;
  kind: 'politician' | 'insider';
  name: string;
  subtitle: string;
  image_url: string | null;
  ticker?: string;
  stats: {
    total_trades: number;
    unique_tickers: number;
    last_active_days: number | null;
  };
  holdings: InvestorHolding[];
  holdings_source?: 'snapshot' | 'trades';
  portfolio_snapshot?: PortfolioSnapshot | null;
  recent_trades: InvestorRecentTrade[];
  sparkline_values: number[];
  metrics?: ReconstructedPortfolioMetrics | null;
  portfolio_source?: PortfolioSource;
  fetched_at: string;
}

let cache = new Map<string, { at: number; data: InvestorProfile }>();
const CACHE_MS = 8 * 60 * 1000;

function cacheKey(id: string, kind: string, ticker?: string) {
  return `${kind}:${id}:${ticker ?? ''}`;
}

export async function fetchInvestorProfile(
  id: string,
  kind: 'politician' | 'insider',
  ticker?: string,
  force = false
): Promise<InvestorProfile> {
  const key = cacheKey(id, kind, ticker);
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const { data, error } = await supabase.functions.invoke<
    InvestorProfile | { error: string }
  >('uw-investor-profile', { body: { id, kind, ticker } });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('name' in data)) throw new Error('uw-investor-profile: empty');

  cache.set(key, { at: Date.now(), data });
  return data;
}

export function clearInvestorProfileCache() {
  cache.clear();
}
