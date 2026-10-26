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
  await resolveCusipTickers(supabase, out as Array<{ ticker?: unknown }>);
  return out;
}

/** CUSIP / CINS (9 תווים עם ספרה) — לא טיקר */
const CUSIP_RE = /^(?=.*\d)[0-9A-Z]{9}$/;

/**
 * שורות SEC שנשמרו עם ה-CUSIP כטיקר (לפני שהמיפוי מצא טיקר — למשל CINS של חברות זרות):
 * מחליפים לטיקר מ-cusip_ticker_map בזמן הקריאה. בלי לשנות את הנתונים בטבלה.
 */
export async function resolveCusipTickers(
  supabase: SupabaseClient,
  rows: Array<{ ticker?: unknown }>,
): Promise<void> {
  const codes = Array.from(
    new Set(rows.map((r) => String(r.ticker ?? '')).filter((t) => CUSIP_RE.test(t))),
  );
  if (!codes.length) return;
  const map = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 500) {
    const { data } = await supabase
      .from('cusip_ticker_map')
      .select('cusip, ticker')
      .in('cusip', codes.slice(i, i + 500))
      .not('ticker', 'is', null);
    for (const r of data ?? []) map.set(String(r.cusip), String(r.ticker));
  }
  if (!map.size) return;
  for (const r of rows) {
    const t = map.get(String(r.ticker ?? ''));
    if (t) r.ticker = t;
  }
}

/**
 * לכל תקופה: אם יש שורות מ-SEC — רק הן (Quiver של אותה תקופה מתעלמים: טיקרים ישנים / שורות שגויות).
 * דורש עמודות filing_date + source.
 */
export function preferSecRows<T extends { filing_date?: string | null; source?: string | null }>(rows: T[]): T[] {
  const secDates = new Set<string>();
  for (const r of rows) if (r.source === 'sec' && r.filing_date) secDates.add(String(r.filing_date).slice(0, 10));
  if (!secDates.size) return rows;
  return rows.filter((r) => {
    const d = String(r.filing_date ?? '').slice(0, 10);
    return !secDates.has(d) || r.source === 'sec';
  });
}

/** תקופה שסכומה חריג (יותר מפי 3 / פחות משליש מהחציון) — שגיאת נתונים, לא שינוי אמיתי */
export function isOutlierTotal(total: number, allTotals: number[]): boolean {
  const xs = allTotals.filter((x) => x > 0).sort((a, b) => a - b);
  if (xs.length < 4 || !(total > 0)) return false;
  const med = xs[Math.floor(xs.length / 2)];
  return total > med * 3 || total < med / 3;
}

