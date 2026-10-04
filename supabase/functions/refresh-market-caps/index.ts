// מרענן stock_market_caps מה-screener של Nasdaq (קריאה אחת לכל המניות האמריקאיות)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeCapSymbol } from '../_shared/marketCaps.ts'

const SCREENER_URL =
  'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true'

type ScreenerRow = {
  symbol?: string
  name?: string
  marketCap?: string
  sector?: string
  country?: string
}

const FINNHUB_PER_RUN = 50
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** סימבולים מדיווחי רווחים (30 יום אחורה ←) שאין להם שווי — Finnhub profile2 (60/דקה) */
// deno-lint-ignore no-explicit-any
async function backfillFromFinnhub(supabase: any, known: Set<string>): Promise<number> {
  const key = Deno.env.get('FINNHUB_API_KEY')
  if (!key) return 0
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('earnings_calendar')
    .select('ticker, code')
    .gte('report_date', since)
    .limit(10000)
  const missing = Array.from(
    new Set(
      ((data ?? []) as Array<{ ticker: string | null; code: string | null }>)
        .map((r) => normalizeCapSymbol(String(r.ticker || (r.code ?? '').split('.')[0] || '')))
        .filter((s) => s && !known.has(s)),
    ),
  ).slice(0, FINNHUB_PER_RUN)

  const now = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []
  for (const sym of missing) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${key}`,
      )
      if (res.ok) {
        const p = await res.json()
        // marketCapitalization ב-Finnhub הוא במיליוני USD
        const cap = Number(p?.marketCapitalization ?? 0) * 1_000_000
        if (Number.isFinite(cap) && cap > 0) {
          rows.push({
            symbol: sym,
            market_cap: cap,
            name: p?.name ?? null,
            sector: p?.finnhubIndustry ?? null,
            country: p?.country ?? null,
            updated_at: now,
          })
        }
      }
    } catch {
      // סימבול בודד שנכשל לא עוצר את השאר
    }
    await sleep(1100)
  }
  if (rows.length) {
    const { error } = await supabase.from('stock_market_caps').upsert(rows, { onConflict: 'symbol' })
    if (error) console.warn('[market-caps] finnhub upsert failed:', error.message)
  }
  console.log(`[market-caps] finnhub backfill ${rows.length}/${missing.length}`)
  return rows.length
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const resp = await fetch(SCREENER_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!resp.ok) throw new Error(`screener HTTP ${resp.status}`)
    const json = await resp.json()
    const rows = (json?.data?.rows ?? []) as ScreenerRow[]

    const now = new Date().toISOString()
    const records = rows
      .map((r) => ({
        symbol: normalizeCapSymbol(String(r.symbol ?? '')),
        market_cap: Number(r.marketCap ?? 0),
        name: r.name ?? null,
        sector: r.sector || null,
        country: r.country || null,
        updated_at: now,
      }))
      .filter((r) => r.symbol && Number.isFinite(r.market_cap) && r.market_cap > 0)

    // הגנה: תשובה חלקית/שבורה לא דורסת את הטבלה
    if (records.length < 3000) throw new Error(`screener returned only ${records.length} rows`)

    const CHUNK = 1000
    for (let i = 0; i < records.length; i += CHUNK) {
      const { error } = await supabase
        .from('stock_market_caps')
        .upsert(records.slice(i, i + CHUNK), { onConflict: 'symbol' })
      if (error) throw error
    }

    const ge1b = records.filter((r) => r.market_cap >= 1_000_000_000).length
    console.log(`[market-caps] upserted ${records.length} (>=1B: ${ge1b})`)

    // ה-screener חלקי (חסרות למשל AVB/EQR) — משלימים סימבולים מלוח הדיווחים דרך Finnhub
    const backfilled = await backfillFromFinnhub(supabase, new Set(records.map((r) => r.symbol)))

    return new Response(JSON.stringify({ ok: true, upserted: records.length, ge_1b: ge1b, backfilled }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[market-caps] failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
