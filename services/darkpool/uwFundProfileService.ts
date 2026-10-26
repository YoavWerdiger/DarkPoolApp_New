import { PROFILE_QUERY_STALE_MS } from '../../lib/profileQueryCache';
import { supabase } from '../../lib/supabase';

export interface FundHolding {
  ticker: string;
  issuer_name: string | null;
  shares: number | null;
  value_usd: number | null;
  allocation_pct: number | null;
  /** דיווח 13F ראשון שבו הטיקר מופיע אצלנו (לא בהכרח קנייה ראשונה) */
  first_added_date?: string | null;
  /** מחיר כניסה מוצר: Yahoo ב־first_added_date (כמו פוליטיקאים) */
  entry_price?: number | null;
  current_price?: number | null;
  /** תשואה מול מחיר שוק נוכחי */
  return_pct?: number | null;
}

export interface FundValuePoint {
  date: string;
  value: number;
}

export interface FundProfile {
  id: string;
  kind: 'fund_manager';
  /** company = חברה ציבורית שמגישה 13F (אחזקות אסטרטגיות). חסר בשרת ישן = fund */
  entity_type?: 'fund' | 'company';
  /** טיקר החברה עצמה (רק ל-company) */
  ticker?: string | null;
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
const CACHE_MS = PROFILE_QUERY_STALE_MS;

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

export interface FundFilingHistoryRow {
  filing_date: string;
  ticker: string;
  shares: number | null;
  value_usd: number | null;
}

/** היסטוריית 13F גולמית — RLS ציבורי. בלי midpoint ובלי שחזור STOCK Act. */
export async function fetchFundHoldingsHistory(cik: string): Promise<FundFilingHistoryRow[]> {
  const id = cik.trim();
  if (!id) return [];
  // השרת מחזיר עד 1000 שורות לשאילתה (גם עם limit גבוה). ARK ~3200 שורות → בלי עימוד הגיעו רק
  // הדוחות הישנים (2022: SQ, FB…) והאחזקות/הגרף היו שגויים.
  const PAGE = 1000;
  const data: Array<{
    filing_date: unknown;
    ticker: unknown;
    shares: unknown;
    value_usd: unknown;
    source?: unknown;
  }> = [];
  for (let from = 0; from < 20000; from += PAGE) {
    const { data: batch, error } = await supabase
      .from('dark_pool_fund_holdings')
      .select('filing_date, ticker, shares, value_usd, source')
      .eq('fund_cik', id)
      .order('filing_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    data.push(...(batch ?? []));
    if (!batch || batch.length < PAGE) break;
  }
  // תקופה שיש לה שורות מה-SEC — רק הן (שורות Quiver של אותה תקופה: טיקרים ישנים / ערכים שגויים)
  const secDates = new Set(
    data.filter((r) => r.source === 'sec').map((r) => String(r.filing_date ?? '').slice(0, 10))
  );
  return data
    .filter(
      (row) => !secDates.has(String(row.filing_date ?? '').slice(0, 10)) || row.source === 'sec'
    )
    .map((row) => ({
      filing_date: String(row.filing_date ?? '').slice(0, 10),
      ticker: String(row.ticker ?? '')
        .toUpperCase()
        .trim(),
      shares: row.shares != null ? Number(row.shares) : null,
      value_usd: row.value_usd != null ? Number(row.value_usd) : null,
    }));
}
