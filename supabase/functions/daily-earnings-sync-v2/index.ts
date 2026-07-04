import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import {
  DEFAULT_EARNINGS_IMPORTANCE,
  deriveEarningsDateTimeIso,
} from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// earningshub.com API (task d92ba1a9-30aa-478e-8453-f464b4ac8d56)
// This single scraper provides BOTH upcoming (next 6 months) and reported (last 3 months + actuals).
const PARSE_SCRAPER_ID = '4a2d47a5-9885-41c3-a3eb-b1411610a667'
const PARSE_BASE_URL = `https://api.parse.bot/scraper/${PARSE_SCRAPER_ID}`

interface ParseEarningsItem {
  ticker?: string | null
  company_name?: string | null
  report_date?: string | null
  report_time?: string | null
  quarter?: string | null
  eps_estimate?: number | string | null
  eps_actual?: number | string | null
  revenue_estimate?: number | string | null
  revenue_actual?: number | string | null
  raw?: Record<string, unknown>
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null

  let str = String(val).trim().toUpperCase()
  if (!str) return null
  let multiplier = 1

  if (str.endsWith('B')) { multiplier = 1_000_000_000; str = str.slice(0, -1) }
  else if (str.endsWith('M')) { multiplier = 1_000_000; str = str.slice(0, -1) }
  else if (str.endsWith('K')) { multiplier = 1_000; str = str.slice(0, -1) }

  str = str.replace(/[$,\s]/g, '')
  const num = parseFloat(str)
  if (!Number.isFinite(num)) return null
  return num * multiplier
}

// Normalize market timing to the values the UI expects: "BeforeMarket" | "AfterMarket" | null
// Handles: "Before Market Open", "After Market Close", "BeforeMarket", "AfterMarket",
//          "pre-market", "post-market", "BMO", "AMC", etc.
function parseMarketTiming(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null
  const lower = String(timeStr).toLowerCase()
  if (lower.includes('before') || lower.includes('pre-market') || lower.includes('premarket') || lower.includes('bmo') || lower.includes('market open')) {
    return 'BeforeMarket'
  }
  if (lower.includes('after') || lower.includes('post-market') || lower.includes('postmarket') || lower.includes('amc') || lower.includes('market close')) {
    return 'AfterMarket'
  }
  return null
}

async function callParseEndpoint(endpoint: string, apiKey: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const url = `${PARSE_BASE_URL}/${endpoint}`
  const bodyStr = JSON.stringify(body)
  console.log(`[parse] POST ${endpoint} body=${bodyStr.slice(0, 300)}`)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: bodyStr,
  })

  const text = await resp.text()
  console.log(`[parse] ${endpoint} -> HTTP ${resp.status} len=${text.length} preview=${text.slice(0, 500)}`)

  if (!resp.ok) {
    throw new Error(`${endpoint} HTTP ${resp.status}: ${text.slice(0, 500)}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${endpoint} returned non-JSON: ${text.slice(0, 300)}`)
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    console.log(`[parse] ${endpoint} object keys: ${Object.keys(obj).join(',')}`)
    if (obj.error) {
      throw new Error(`${endpoint} API error: ${String(obj.error)}`)
    }

    // Parse wraps successful responses as { status: 'success', data: { <named_array>: [...] } }.
    // Dig into `data` and find the first array value inside it.
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      const inner = obj.data as Record<string, unknown>
      for (const key of ['upcoming_earnings', 'reported_earnings', 'earnings', 'entries', 'items', 'results']) {
        if (Array.isArray(inner[key])) {
          console.log(`[parse] ${endpoint} extracted data.${key} -> ${(inner[key] as unknown[]).length} items`)
          return inner[key]
        }
      }
      // fallback: first array value in data
      for (const [k, v] of Object.entries(inner)) {
        if (Array.isArray(v)) {
          console.log(`[parse] ${endpoint} extracted data.${k} -> ${v.length} items (fallback)`)
          return v
        }
      }
    }

    if (Array.isArray(obj.data)) return obj.data
    if (Array.isArray(obj.entries)) return obj.entries
    if (Array.isArray(obj.results)) return obj.results
    if (Array.isArray(obj.earnings)) return obj.earnings
    if (Array.isArray(obj.items)) return obj.items
  }

  return parsed
}

function toArray(value: unknown): ParseEarningsItem[] {
  if (Array.isArray(value)) return value as ParseEarningsItem[]
  return []
}

function buildRecord(item: ParseEarningsItem): Record<string, unknown> | null {
  const rawTicker = (item.ticker || (item.raw as { symbol?: string } | undefined)?.symbol || '').toString().trim().toUpperCase()
  if (!rawTicker) return null

  const reportDate = item.report_date || (item.raw as { earningsDate?: string } | undefined)?.earningsDate
  if (!reportDate || !/^\d{4}-\d{2}-\d{2}/.test(String(reportDate))) return null

  const code = rawTicker.includes('.') ? rawTicker : `${rawTicker}.US`
  const marketTiming = parseMarketTiming(item.report_time)

  const raw = (item.raw ?? {}) as Record<string, unknown>

  const epsEstimate = parseNumber(item.eps_estimate) ?? parseNumber(raw.epsEstimate)
  const epsActual = parseNumber(item.eps_actual) ?? parseNumber(raw.eps)
  const revenueEstimate = parseNumber(item.revenue_estimate) ?? parseNumber(raw.revenueEstimate)
  const revenueActual = parseNumber(item.revenue_actual) ?? parseNumber(raw.revenue)

  const epsSurprise = epsActual !== null && epsEstimate !== null ? epsActual - epsEstimate : null
  const epsSurprisePercent = epsSurprise !== null && epsEstimate !== null && epsEstimate !== 0
    ? (epsSurprise / Math.abs(epsEstimate)) * 100
    : null
  const revSurprise = revenueActual !== null && revenueEstimate !== null ? revenueActual - revenueEstimate : null
  const revSurprisePercent = revSurprise !== null && revenueEstimate !== null && revenueEstimate !== 0
    ? (revSurprise / Math.abs(revenueEstimate)) * 100
    : null

  return {
    ticker: rawTicker,
    code,
    company_name: item.company_name ?? (raw.assetName as string | undefined) ?? null,
    report_date: String(reportDate).slice(0, 10),
    report_time: item.report_time ?? null,
    quarter: item.quarter ?? null,

    // canonical EPS
    eps_estimate: epsEstimate,
    estimate: epsEstimate,
    eps: epsActual,
    actual: epsActual,
    eps_surprise: epsSurprise,
    eps_surprise_percent: epsSurprisePercent,

    // canonical revenue
    revenue_estimate: revenueEstimate,
    revenue_estimate_avg: revenueEstimate,
    revenue: revenueActual,
    revenue_actual: revenueActual,
    revenue_surprise: revSurprise,
    revenue_surprise_percent: revSurprisePercent,

    // timing (unified: BeforeMarket/AfterMarket)
    before_after_market: marketTiming,
    earnings_date_time: deriveEarningsDateTimeIso(String(reportDate).slice(0, 10), marketTiming),
    importance: DEFAULT_EARNINGS_IMPORTANCE,

    // backward compatibility
    date: String(reportDate).slice(0, 10),
    time: item.report_time ?? null,
    symbol: rawTicker,
    asset_name: item.company_name ?? (raw.assetName as string | undefined) ?? null,

    // metadata
    source: 'earningshub.com',
    api_source: 'earningshub.com',
    currency: 'USD',
    updated_at: new Date().toISOString(),
  }
}

// Merge duplicates within a batch, preferring the record with actuals (reported) over estimates (upcoming).
function mergeByKey(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>()
  for (const rec of records) {
    const key = `${rec.ticker}|${rec.report_date}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, rec)
      continue
    }
    // prefer the one that has actuals
    const hasActuals = rec.actual !== null || rec.revenue_actual !== null
    const existingHasActuals = existing.actual !== null || existing.revenue_actual !== null
    if (hasActuals && !existingHasActuals) {
      map.set(key, { ...existing, ...rec })
    } else if (!hasActuals && existingHasActuals) {
      map.set(key, { ...rec, ...existing })
    } else {
      map.set(key, { ...existing, ...rec })
    }
  }
  return Array.from(map.values())
}

async function probeAllParseEndpoints(apiKey: string) {
  const today = new Date().toISOString().split('T')[0]
  const future = new Date(); future.setDate(future.getDate() + 30)
  const futureStr = future.toISOString().split('T')[0]
  const past = new Date(); past.setDate(past.getDate() - 30)
  const pastStr = past.toISOString().split('T')[0]

  const probes: Array<{ scraper: string; endpoint: string; body: Record<string, unknown> }> = [
    // Primary API (4a2d47a5)
    { scraper: '4a2d47a5-9885-41c3-a3eb-b1411610a667', endpoint: 'get_upcoming_earnings', body: {} },
    { scraper: '4a2d47a5-9885-41c3-a3eb-b1411610a667', endpoint: 'get_upcoming_earnings', body: { start_date: today, end_date: futureStr } },
    { scraper: '4a2d47a5-9885-41c3-a3eb-b1411610a667', endpoint: 'get_reported_earnings', body: {} },
    { scraper: '4a2d47a5-9885-41c3-a3eb-b1411610a667', endpoint: 'get_reported_earnings', body: { start_date: pastStr, end_date: today } },
    // API #2 (raw HTML)
    { scraper: '19f29e4b-4d7f-4a6e-9fd5-61a2a712543d', endpoint: 'fetch_recent_earnings_pages', body: { page_number: '1' } },
    { scraper: '19f29e4b-4d7f-4a6e-9fd5-61a2a712543d', endpoint: 'update_actuals_for_today', body: {} },
    // API #3 (older upcoming)
    { scraper: '5bcb6c63-dbcd-4383-9928-d7eb9e6d55ed', endpoint: 'fetch_earnings_data', body: {} },
    { scraper: '5bcb6c63-dbcd-4383-9928-d7eb9e6d55ed', endpoint: 'get_upcoming_earnings', body: {} },
  ]

  const results: Array<Record<string, unknown>> = []
  for (const p of probes) {
    const t0 = Date.now()
    try {
      const resp = await fetch(`https://api.parse.bot/scraper/${p.scraper}/${p.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(p.body),
      })
      const text = await resp.text()
      const elapsed = Date.now() - t0
      let parsed: unknown = null
      try { parsed = JSON.parse(text) } catch { /* keep raw */ }
      const arrLen = Array.isArray(parsed) ? parsed.length : null
      const keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.keys(parsed as Record<string, unknown>)
        : null
      results.push({
        scraper: p.scraper.slice(0, 8),
        endpoint: p.endpoint,
        body: p.body,
        status: resp.status,
        elapsed_ms: elapsed,
        bytes: text.length,
        is_array: Array.isArray(parsed),
        array_length: arrLen,
        object_keys: keys,
        preview: text.slice(0, 400),
      })
    } catch (err) {
      results.push({
        scraper: p.scraper.slice(0, 8),
        endpoint: p.endpoint,
        body: p.body,
        error: err instanceof Error ? err.message : String(err),
        elapsed_ms: Date.now() - t0,
      })
    }
  }
  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = Date.now()
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')

  try {
    console.log('Daily Earnings Sync V2 (earningshub.com) started')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('EARNINGS_API_KEY') || Deno.env.get('PARSE_BOT_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    }
    if (!apiKey) {
      throw new Error('Missing EARNINGS_API_KEY (or PARSE_BOT_API_KEY) env var')
    }

    if (mode === 'debug') {
      console.log('Running Parse diagnostics...')
      const diagnostics = await probeAllParseEndpoints(apiKey)
      return new Response(
        JSON.stringify({ mode: 'debug', elapsed_ms: Date.now() - startedAt, probes: diagnostics }, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Build explicit date ranges (scraper defaults occasionally return empty if
    // the website structure varies — being explicit is more reliable).
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const upcomingEnd = new Date(today); upcomingEnd.setDate(upcomingEnd.getDate() + 180)
    const upcomingEndStr = upcomingEnd.toISOString().split('T')[0]
    const reportedStart = new Date(today); reportedStart.setDate(reportedStart.getDate() - 90)
    const reportedStartStr = reportedStart.toISOString().split('T')[0]

    // 1. Fetch upcoming earnings (future)
    console.log(`Fetching upcoming earnings (${todayStr} -> ${upcomingEndStr})...`)
    let upcomingItems: ParseEarningsItem[] = []
    try {
      const upcomingRaw = await callParseEndpoint('get_upcoming_earnings', apiKey, {
        start_date: todayStr,
        end_date: upcomingEndStr,
      })
      upcomingItems = toArray(upcomingRaw)
      console.log(`  -> upcoming: ${upcomingItems.length} items`)
      if (upcomingItems.length > 0) {
        console.log(`  sample: ${JSON.stringify(upcomingItems[0]).slice(0, 500)}`)
      }
    } catch (err) {
      console.error('  upcoming failed:', err instanceof Error ? err.message : String(err))
    }

    // 2. Fetch reported earnings (past with actuals)
    console.log(`Fetching reported earnings (${reportedStartStr} -> ${todayStr})...`)
    let reportedItems: ParseEarningsItem[] = []
    try {
      const reportedRaw = await callParseEndpoint('get_reported_earnings', apiKey, {
        start_date: reportedStartStr,
        end_date: todayStr,
      })
      reportedItems = toArray(reportedRaw)
      console.log(`  -> reported: ${reportedItems.length} items`)
      if (reportedItems.length > 0) {
        console.log(`  sample: ${JSON.stringify(reportedItems[0]).slice(0, 500)}`)
      }
    } catch (err) {
      console.error('  reported failed:', err instanceof Error ? err.message : String(err))
    }

    const totalFetched = upcomingItems.length + reportedItems.length
    if (totalFetched === 0) {
      throw new Error('Both Parse endpoints returned empty results')
    }

    // 3. Build + merge records
    const allItems: ParseEarningsItem[] = [...upcomingItems, ...reportedItems]
    const rawRecords: Record<string, unknown>[] = []
    let skipped = 0
    for (const item of allItems) {
      const rec = buildRecord(item)
      if (rec) rawRecords.push(rec)
      else skipped++
    }
    const records = mergeByKey(rawRecords)
    console.log(`Prepared ${records.length} unique records (raw: ${rawRecords.length}, skipped: ${skipped})`)

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted_count: 0, message: 'No valid records to upsert' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (records.length > 0) {
      console.log('Sample record:', JSON.stringify(records[0], null, 2))
    }

    // 4. Upsert in batches
    const batchSize = 100
    let insertedCount = 0
    let errorCount = 0

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)

      const { error: tickerError } = await supabase
        .from('earnings_calendar')
        .upsert(batch, { onConflict: 'ticker,report_date', ignoreDuplicates: false })

      if (!tickerError) {
        insertedCount += batch.length
        continue
      }

      console.warn(`Batch ${i / batchSize + 1}: ticker,report_date upsert failed -> ${tickerError.message}`)

      // Fallback: try code,report_date
      if (tickerError.message?.toLowerCase().includes('constraint')) {
        const { error: codeError } = await supabase
          .from('earnings_calendar')
          .upsert(batch, { onConflict: 'code,report_date', ignoreDuplicates: false })
        if (!codeError) {
          insertedCount += batch.length
          continue
        }
        console.warn(`Batch ${i / batchSize + 1}: code,report_date upsert failed -> ${codeError.message}`)
      }

      // Final fallback: per-row
      for (const rec of batch) {
        try {
          const { data: existing } = await supabase
            .from('earnings_calendar')
            .select('id')
            .eq('ticker', rec.ticker as string)
            .eq('report_date', rec.report_date as string)
            .maybeSingle()

          if (existing) {
            const { error } = await supabase
              .from('earnings_calendar')
              .update(rec)
              .eq('id', existing.id)
            if (error) { errorCount++; console.error(`update ${rec.code}:`, error.message) }
            else insertedCount++
          } else {
            const { error } = await supabase.from('earnings_calendar').insert(rec)
            if (error) { errorCount++; console.error(`insert ${rec.code}:`, error.message) }
            else insertedCount++
          }
        } catch (err) {
          errorCount++
          console.error('per-row exception:', err instanceof Error ? err.message : String(err))
        }
      }
    }

    const elapsed = Date.now() - startedAt
    console.log(`Done. inserted=${insertedCount} errors=${errorCount} elapsed_ms=${elapsed}`)

    return new Response(
      JSON.stringify({
        success: true,
        source: 'earningshub.com',
        scraper_id: PARSE_SCRAPER_ID,
        upcoming_fetched: upcomingItems.length,
        reported_fetched: reportedItems.length,
        total_unique: records.length,
        skipped,
        inserted_count: insertedCount,
        error_count: errorCount,
        elapsed_ms: elapsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Sync error:', message)
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        elapsed_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
