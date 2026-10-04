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
    return new Response(JSON.stringify({ ok: true, upserted: records.length, ge_1b: ge1b }), {
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
