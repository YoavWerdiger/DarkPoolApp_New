import { supabase } from '../../lib/supabase';

export interface FundHolding {
  ticker: string;
  issuer_name: string | null;
  shares: number | null;
  value_usd: number | null;
  allocation_pct: number | null;
  /** דיווח 13F ראשון שבו הטיקר מופיע אצלנו (לא בהכרח קנייה ראשונה) */
  first_added_date?: string | null;
}

export interface FundValuePoint {
  date: string;
  value: number;
}

export interface FundProfile {
  id: string;
  kind: 'fund_manager';
  name: string;
  subtitle: string;
  image_url: string | null;
  stats: {
    holdings_count: number;
    total_value_usd: number | null;
    filing_date: string | null;
    total_return_pct: number | null;
    period_returns: Record<string, number | null>;
  };
  holdings: FundHolding[];
  value_series: FundValuePoint[];
  fetched_at: string;
}

let cache = new Map<string, { at: number; data: FundProfile }>();
const CACHE_MS = 10 * 60 * 1000;

export async function fetchFundProfile(cik: string, force = false): Promise<FundProfile> {
  const id = cik.trim();
  const hit = cache.get(id);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const { data, error } = await supabase.functions.invoke<FundProfile | { error: string }>(
    'uw-fund-profile',
    { body: { id } }
  );

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('name' in data)) throw new Error('uw-fund-profile: empty');

  cache.set(id, { at: Date.now(), data });
  return data;
}
