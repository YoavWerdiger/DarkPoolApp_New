/**
 * כל שורות 13F של קרן — בעמודים. PostgREST מחזיר עד 1000 שורות לשאילתה, ו-ARK לבדה ~3200
 * (16 רבעונים × ~200) — בלי עימוד הגיע «פרוסה» אקראית: מהדוח האחרון רק 9 אחזקות קטנות.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

const PAGE = 1000;
const MAX_ROWS = 20000;

export async function loadAllFundHoldingRows<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  cik: string,
  columns: string
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from('dark_pool_fund_holdings')
      .select(columns)
      .eq('fund_cik', cik)
      .order('filing_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}
