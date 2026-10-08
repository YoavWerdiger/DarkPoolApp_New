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

/** בריצה הלילית (אחרי ה-screener) — מעט, כדי לא לחרוג מזמן הריצה */
const FINNHUB_PER_RUN_FULL = 50
/** ריצת באקפיל בלבד (mode=backfill, כל 20 דק׳) — 120 × ~1.05s ≈ 2 דקות, בתוך 150s */
const FINNHUB_PER_RUN_BACKFILL = 120
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * סימבולים מדיווחי רווחים (7 ימים אחורה והלאה) שאין להם שורה ב-stock_market_caps — Finnhub profile2.
 * הרשימה מגיעה מהמסד (earnings_symbols_missing_cap), לא מול ה-screener של אותו לילה: אחרת אותם
 * 50 חזרו כל לילה והשאר לעולם לא הושלמו (215 דיווחים עתידיים בלי שווי).
 * סימבול בלי נתון ב-Finnhub נשאר «לא ידוע» (לא נמחק!) — ה-free tier מחזיר פרופיל ריק גם לחברות
 * גדולות (EQR, LC, SATS). נרשם ב-market_cap_lookup_misses כדי לא לחזור עליו 24 שעות.
 */
// deno-lint-ignore no-explicit-any
async function backfillFromFinnhub(supabase: any, limit: number): Promise<{ checked: number; found: number; unknownMarked: number }> {
  const key = Deno.env.get('FINNHUB_API_KEY')
  if (!key) return { checked: 0, found: 0, unknownMarked: 0 }
  const { data, error } = await supabase.rpc('earnings_symbols_missing_cap', { p_limit: limit })
  if (error) {
    console.warn('[market-caps] missing list failed:', error.message)
    return { checked: 0, found: 0, unknownMarked: 0 }
  }
  const missing = ((data ?? []) as string[]).map((s) => normalizeCapSymbol(s)).filter(Boolean)

  const now = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []
  const misses: Array<Record<string, unknown>> = []
  let found = 0
  let unknownMarked = 0
  for (const sym of missing) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${key}`,
      )
      if (res.status === 429) {
        // מגבלת קצב — עוצרים; הריצה הבאה תמשיך מאותו מקום
        console.warn('[market-caps] finnhub rate limited — stopping this run')
        break
      }
      if (res.ok) {
        const p = await res.json()
        // marketCapitalization ב-Finnhub הוא במיליוני USD
        const cap = Number(p?.marketCapitalization ?? 0) * 1_000_000
        if (Number.isFinite(cap) && cap > 0) {
          rows.push({ symbol: sym, market_cap: cap, name: p?.name ?? null, sector: p?.finnhubIndustry ?? null, country: p?.country ?? null, updated_at: now })
          found++
        } else {
          // אין נתון — נשאר לא-ידוע (לא מסננים), רק לא ננסה שוב 24 שעות
          misses.push({ symbol: sym, attempted_at: now })
          unknownMarked++
        }
      }
    } catch {
      // סימבול בודד שנכשל לא עוצר את השאר (יישאר חסר ויטופל בריצה הבאה)
    }
    await sleep(1050)
  }
  if (rows.length) {
    const { error: upErr } = await supabase.from('stock_market_caps').upsert(rows, { onConflict: 'symbol' })
    if (upErr) console.warn('[market-caps] finnhub upsert failed:', upErr.message)
  }
  if (misses.length) {
    const { error: mErr } = await supabase.from('market_cap_lookup_misses').upsert(misses, { onConflict: 'symbol' })
    if (mErr) console.warn('[market-caps] misses upsert failed:', mErr.message)
  }
  console.log(`[market-caps] finnhub backfill checked=${missing.length} found=${found} unknown=${unknownMarked}`)
  return { checked: missing.length, found, unknownMarked }
}

/** ניקוי דיווחים עתידיים (בלי תוצאה) של חברות שידוע שהן מתחת ל-1B */
// deno-lint-ignore no-explicit-any
async function purgeSmallCaps(supabase: any): Promise<number> {
  const { data, error } = await supabase.rpc('purge_small_cap_earnings')
  if (error) {
    console.warn('[market-caps] purge failed:', error.message)
    return 0
  }
  console.log(`[market-caps] purged ${data ?? 0} small-cap upcoming reports`)
  return Number(data ?? 0)
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // באקפיל בלבד — בלי screener (ריצה מהירה כל 20 דק׳)
    if (new URL(req.url).searchParams.get('mode') === 'backfill') {
      const backfill = await backfillFromFinnhub(supabase, FINNHUB_PER_RUN_BACKFILL)
      const purged = await purgeSmallCaps(supabase)
      return new Response(JSON.stringify({ ok: true, mode: 'backfill', ...backfill, purged }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

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
    const backfilled = await backfillFromFinnhub(supabase, FINNHUB_PER_RUN_FULL)
    const purged = await purgeSmallCaps(supabase)

    return new Response(JSON.stringify({ ok: true, upserted: records.length, ge_1b: ge1b, backfilled, purged }), {
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
