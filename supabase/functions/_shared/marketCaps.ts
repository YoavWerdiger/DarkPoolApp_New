// שווי שוק לסימבולים אמריקאים — טבלת stock_market_caps (מתעדכנת ב-refresh-market-caps)
// מינימלי — הפונקציות משתמשות בגרסאות supabase-js שונות (esm.sh / npm:)
// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any }

/** דיווחי רווחים רק לחברות בשווי שוק 2B ומעלה */
export const MIN_EARNINGS_MARKET_CAP_USD = 2_000_000_000

/** BRK/B, BRK-B → BRK.B (הפורמט ב-earnings_calendar) */
export function normalizeCapSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[/-]/g, '.')
}

/**
 * מפת symbol → market_cap. null אם הטבלה ריקה/לא זמינה —
 * אז לא מסננים (עדיף להשאיר מאשר למחוק הכול בגלל refresh שנכשל).
 */
export async function loadMarketCapMap(
  supabase: Db,
): Promise<Map<string, number> | null> {
  const map = new Map<string, number>()
  const PAGE = 1000
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await supabase
      .from('stock_market_caps')
      .select('symbol, market_cap')
      .range(from, from + PAGE - 1)
    if (error) {
      console.warn('[marketCaps] load failed:', error.message)
      return null
    }
    for (const row of data ?? []) {
      map.set(String(row.symbol), Number(row.market_cap))
    }
    if (!data || data.length < PAGE) break
  }
  return map.size > 1000 ? map : null
}
