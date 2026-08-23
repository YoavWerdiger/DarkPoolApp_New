import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import {
  DEFAULT_EARNINGS_IMPORTANCE,
  calendarDaysBetween,
  deriveEarningsDateTimeIso,
  dropEstimatesNearConfirmedActuals,
  prepareEarningsRecord,
  purgeStaleEstimateRowsNearConfirmed,
} from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// earningshub.com via Parse (task d92ba1a9-30aa-478e-8453-f464b4ac8d56)
// PRIMARY source for calendar + EPS/revenue estimate/actual. UW is gap-fill only.
const PARSE_SCRAPER_ID = '4a2d47a5-9885-41c3-a3eb-b1411610a667'
const PARSE_BASE_URL = `https://api.parse.bot/scraper/${PARSE_SCRAPER_ID}`

/**
 * Sync-time curation for UW gap-fill only (Parse/Benzinga/Finnhub pass through):
 * Quality-first — do NOT raise the $300M floor.
 * 1. US listing only; reject OTC/Pink/Grey always
 * 2. Keep if mcap >= $300M (soft secondary floor, same as before)
 * 3. Keep if UW size mid/large/big/mega OR S&P500 (soft size proxy)
 * 4. Keep if has EPS/revenue estimate OR actual (e.g. QUBT with real data under $300M)
 * 5. Else drop ticker-only junk (unknown/tiny mcap + no estimates/actuals)
 * Logged rejects include reason counts.
 */
const MIN_MARKET_CAP_USD = 300_000_000
const UW_ALLOWED_CAP_SIZES = new Set(['mid', 'large', 'big', 'mega'])
const UW_US_EXCHANGES = new Set([
  'NYSE', 'NASDAQ', 'AMEX', 'NYSEARCA', 'BATS', 'ARCA',
  'NYSE AMERICAN', 'NYSEAMERICAN', 'NMS', 'NGM', 'NCM',
  'XNYS', 'XNAS', 'XASE', 'BTS',
])
const UW_OTC_EXCHANGE_RE = /OTC|OTCMKTS|OTCBB|OTCQB|OTCQX|PINK|GREY|GRAY|GREYMARKET|GRAYMARKET|EXPERT/i

interface ParseEarningsItem {
  ticker?: string | null
  company_name?: string | null
  report_date?: string | null
  report_time?: string | null
  quarter?: string | null
  eps_estimate?: number | string | null
  eps_actual?: number | string | null
  eps_prior?: number | string | null
  revenue_estimate?: number | string | null
  revenue_actual?: number | string | null
  revenue_prior?: number | string | null
  revenue_estimate_year_ago?: number | string | null
  raw?: Record<string, unknown>
  [key: string]: unknown
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

function firstNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = parseNumber(v)
    if (n !== null) return n
  }
  return null
}

function buildRecord(item: ParseEarningsItem): Record<string, unknown> | null {
  const rawTicker = (item.ticker || (item.raw as { symbol?: string } | undefined)?.symbol || '').toString().trim().toUpperCase()
  if (!rawTicker) return null

  const reportDate = item.report_date || (item.raw as { earningsDate?: string } | undefined)?.earningsDate
  if (!reportDate || !/^\d{4}-\d{2}-\d{2}/.test(String(reportDate))) return null

  const code = rawTicker.includes('.') ? rawTicker : `${rawTicker}.US`
  const marketTiming = parseMarketTiming(item.report_time)

  const raw = (item.raw ?? {}) as Record<string, unknown>

  // Parse / earningshub field aliases (flat + nested raw)
  const epsEstimate = firstNumber(
    item.eps_estimate, item.estimate, raw.epsEstimate, raw.eps_estimate, raw.estimate,
  )
  const epsActual = firstNumber(
    item.eps_actual, item.actual, item.eps, raw.epsActual, raw.eps_actual, raw.eps, raw.actual,
  )
  const epsPrior = firstNumber(
    item.eps_prior, raw.epsPrior, raw.eps_prior, raw.eps_year_ago, raw.epsYearAgo,
  )
  const revenueEstimate = firstNumber(
    item.revenue_estimate,
    raw.revenueEstimate,
    raw.revenue_estimate,
    raw.revenue_estimate_avg,
    raw.revenueEstimateAvg,
  )
  const revenueActual = firstNumber(
    item.revenue_actual, item.revenue, raw.revenueActual, raw.revenue_actual, raw.revenue,
  )
  const revenuePrior = firstNumber(
    item.revenue_prior,
    item.revenue_estimate_year_ago,
    raw.revenuePrior,
    raw.revenue_prior,
    raw.revenue_estimate_year_ago,
    raw.revenueEstimateYearAgo,
    raw.revenue_year_ago,
  )

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
    eps_prior: epsPrior,
    eps_surprise: epsSurprise,
    eps_surprise_percent: epsSurprisePercent,
    difference: epsSurprise,
    percent: epsSurprisePercent,

    // canonical revenue (Parse provides estimate + actual; prior/year-ago when present in raw)
    revenue_estimate: revenueEstimate,
    revenue_estimate_avg: revenueEstimate,
    revenue: revenueActual,
    revenue_actual: revenueActual,
    revenue_prior: revenuePrior,
    revenue_estimate_year_ago: revenuePrior,
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

const FINANCIAL_COALESCE_KEYS = [
  'actual', 'estimate', 'eps', 'eps_estimate', 'eps_prior', 'eps_surprise', 'eps_surprise_percent',
  'difference', 'percent',
  'revenue', 'revenue_actual', 'revenue_estimate', 'revenue_estimate_avg',
  'revenue_prior', 'revenue_estimate_year_ago', 'revenue_surprise', 'revenue_surprise_percent',
  'company_name', 'asset_name', 'before_after_market', 'earnings_date_time', 'report_time',
  'quarter', 'market_cap', 'exchange', 'importance',
] as const

function coalesceRecords(
  preferred: Record<string, unknown>,
  filler: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...filler, ...preferred }
  for (const key of FINANCIAL_COALESCE_KEYS) {
    const p = preferred[key]
    const f = filler[key]
    const pEmpty = p === null || p === undefined || p === ''
    const fEmpty = f === null || f === undefined || f === ''
    if (pEmpty && !fEmpty) out[key] = f
    else if (!pEmpty) out[key] = p
  }
  // Keep higher-rank / richer source label when preferred has the money fields
  const prefHasMoney =
    preferred.actual != null ||
    preferred.revenue_actual != null ||
    preferred.revenue_estimate != null ||
    preferred.revenue_estimate_avg != null ||
    preferred.estimate != null
  if (prefHasMoney || String(preferred.source ?? '').includes('earningshub')) {
    out.source = preferred.source ?? out.source
    out.api_source = preferred.api_source ?? preferred.source ?? out.api_source
  }
  out.updated_at = new Date().toISOString()
  return out
}

// Merge duplicates: prefer actuals, then Parse/earningshub, never let null wipe a populated field.
function mergeByKey(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const sourceRank = (source: unknown): number => {
    const s = String(source ?? '').toLowerCase()
    if (s.includes('earningshub')) return 5
    if (s.includes('benzinga')) return 4
    if (s.includes('finnhub')) return 3
    if (s.includes('unusualwhales') || s.includes('unusual')) return 2
    if (s.includes('eodhd')) return 1
    return 0
  }
  const map = new Map<string, Record<string, unknown>>()
  for (const rec of records) {
    const key = `${rec.ticker}|${rec.report_date}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, rec)
      continue
    }
    const hasActuals = rec.actual !== null || rec.revenue_actual !== null
    const existingHasActuals = existing.actual !== null || existing.revenue_actual !== null
    if (hasActuals && !existingHasActuals) {
      map.set(key, coalesceRecords(rec, existing))
    } else if (!hasActuals && existingHasActuals) {
      map.set(key, coalesceRecords(existing, rec))
    } else if (sourceRank(rec.source) >= sourceRank(existing.source)) {
      map.set(key, coalesceRecords(rec, existing))
    } else {
      map.set(key, coalesceRecords(existing, rec))
    }
  }
  return Array.from(map.values())
}

function extractUwEstimateActuals(item: Record<string, unknown>): {
  epsEstimate: number | null
  epsActual: number | null
  revenueEstimate: number | null
  revenueActual: number | null
  hasEstimateOrActual: boolean
} {
  const epsEstimate = firstNumber(
    item.eps_mean_est, item.street_mean_est, item.eps_estimate, item.estimate,
  )
  const epsActual = firstNumber(item.eps_actual, item.actual, item.eps, item.reported_eps)
  const revenueEstimate = firstNumber(
    item.revenue_estimate, item.revenue_est, item.revenue_mean_est, item.rev_estimate,
  )
  const revenueActual = firstNumber(item.revenue_actual, item.revenue, item.reported_revenue)
  return {
    epsEstimate,
    epsActual,
    revenueEstimate,
    revenueActual,
    hasEstimateOrActual:
      epsEstimate !== null || epsActual !== null ||
      revenueEstimate !== null || revenueActual !== null,
  }
}

function passesUwCurationFilter(
  item: Record<string, unknown>,
  quality?: ReturnType<typeof extractUwEstimateActuals>,
): { ok: boolean; reason?: string; marketCap: number | null } {
  const country = String(item.country_code ?? item.country ?? '').trim().toUpperCase()
  if (country && country !== 'US') {
    return { ok: false, reason: `non_us_country=${country}`, marketCap: null }
  }

  const exchangeRaw = String(
    item.exchange ?? item.venue ?? item.listing_exchange ?? item.primary_exchange ?? '',
  ).trim().toUpperCase()
  if (exchangeRaw && UW_OTC_EXCHANGE_RE.test(exchangeRaw)) {
    return { ok: false, reason: `otc_exchange=${exchangeRaw}`, marketCap: null }
  }
  if (exchangeRaw && !UW_US_EXCHANGES.has(exchangeRaw)) {
    return { ok: false, reason: `non_us_exchange=${exchangeRaw}`, marketCap: null }
  }

  const size = String(item.market_cap_size ?? item.marketcap_size ?? '').trim().toLowerCase()
  const marketCap = parseNumber(item.marketcap ?? item.market_cap ?? item.marketCap)
  const q = quality ?? extractUwEstimateActuals(item)
  const hasData = q.hasEstimateOrActual
  const importanceHigh =
    item.is_s_p_500 === true || size === 'big' || size === 'mega' || size === 'large'
  const sizeAllow = UW_ALLOWED_CAP_SIZES.has(size) || item.is_s_p_500 === true

  // Soft floor: known large enough names keep even before street estimates land
  if (marketCap !== null && marketCap >= MIN_MARKET_CAP_USD) {
    return { ok: true, marketCap }
  }
  // Soft size / index proxy (same OR as before — secondary to mcap floor)
  if (sizeAllow || importanceHigh) {
    return { ok: true, marketCap }
  }
  // Quality path: real estimate/actual keeps legitimate smaller names (e.g. QUBT)
  if (hasData) {
    return { ok: true, marketCap }
  }
  // No estimates/actuals + soft/unknown mcap → drop obscure ticker-only junk
  if (marketCap !== null && marketCap < MIN_MARKET_CAP_USD) {
    return { ok: false, reason: `below_cap_no_estimates=${marketCap}`, marketCap }
  }
  if (size === 'small' || size === 'micro' || size === 'nano') {
    return { ok: false, reason: `cap_size_no_estimates=${size}`, marketCap }
  }
  return { ok: false, reason: 'no_quality_signal', marketCap }
}

/**
 * Full US earnings calendar from EODHD — NO market-cap / index filter.
 * Earningshub (Parse) is a sparse highlight feed; EODHD fills small/mid caps (e.g. QUBT).
 */
async function fetchEodhdUsCalendar(
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, unknown>[]> {
  const url =
    `https://eodhd.com/api/calendar/earnings?from=${fromDate}&to=${toDate}&api_token=${apiKey}&fmt=json`
  console.log(`[eodhd] GET calendar/earnings ${fromDate}..${toDate}`)
  const resp = await fetch(url)
  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(`EODHD HTTP ${resp.status}: ${text.slice(0, 300)}`)
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`EODHD returned non-JSON: ${text.slice(0, 200)}`)
  }

  const rawItems: Array<Record<string, unknown>> = []
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.earnings)) {
      for (const item of obj.earnings as Array<Record<string, unknown>>) {
        rawItems.push(item)
      }
    } else {
      // date-keyed map: { "2026-08-10": [ ... ] }
      for (const [dateKey, reports] of Object.entries(obj)) {
        if (!/^\d{4}-\d{2}-\d{2}/.test(dateKey) || !Array.isArray(reports)) continue
        for (const item of reports as Array<Record<string, unknown>>) {
          rawItems.push({
            ...item,
            report_date: item.report_date ?? dateKey,
            date: item.date ?? dateKey,
          })
        }
      }
    }
  } else if (Array.isArray(data)) {
    for (const item of data as Array<Record<string, unknown>>) rawItems.push(item)
  }

  console.log(`[eodhd] raw items: ${rawItems.length}`)
  const records: Record<string, unknown>[] = []
  let skipped = 0

  for (const item of rawItems) {
    const prepared = prepareEarningsRecord(
      {
        code: (item.code as string | undefined) ?? (item.symbol as string | undefined),
        report_date: item.report_date as string | undefined,
        date: (item.date as string | undefined) ?? (item.report_date as string | undefined),
        before_after_market: item.before_after_market as string | undefined,
        time: item.time as string | undefined,
        currency: (item.currency as string | undefined) ?? 'USD',
        exchange: item.exchange as string | undefined,
        company_name:
          (item.company_name as string | undefined) ??
          (item.name as string | undefined) ??
          null,
        period: (item.period as string | undefined) ?? (item.quarter as string | undefined),
        period_year: (item.period_year as number | undefined) ?? (item.year as number | undefined),
        actual: (item.actual as number | undefined) ?? (item.eps as number | undefined),
        estimate: (item.estimate as number | undefined) ?? (item.eps_est as number | undefined),
        difference: item.difference as number | undefined,
        percent: item.percent as number | undefined,
        eps_prior: item.eps_prior as number | undefined,
        revenue_actual:
          (item.revenue_actual as number | undefined) ?? (item.revenue as number | undefined),
        revenue_estimate_avg:
          (item.revenue_estimate_avg as number | undefined) ??
          (item.revenue_est as number | undefined),
        importance: item.importance as number | undefined,
      },
      {
        requireUSCode: true,
        skipPreferredShares: true,
        source: 'eodhd.com',
      },
    )

    if (!prepared) {
      skipped++
      continue
    }

    const code = prepared.record.code
    const ticker = code.includes('.') ? code.split('.')[0]! : code
    const marketTiming =
      parseMarketTiming(prepared.record.before_after_market) ??
      parseMarketTiming(prepared.record.time)

    const epsEstimate = prepared.record.estimate
    const epsActual = prepared.record.actual
    const revenueEstimate = prepared.record.revenue_estimate_avg
    const revenueActual = prepared.record.revenue_actual

    records.push({
      ticker,
      code,
      company_name: prepared.record.company_name,
      report_date: prepared.record.report_date,
      report_time: prepared.record.time,
      quarter: prepared.record.period,

      eps_estimate: epsEstimate,
      estimate: epsEstimate,
      eps: epsActual,
      actual: epsActual,
      eps_surprise: prepared.record.eps_surprise,
      eps_surprise_percent: prepared.record.eps_surprise_percent,

      revenue_estimate: revenueEstimate,
      revenue_estimate_avg: revenueEstimate,
      revenue: revenueActual,
      revenue_actual: revenueActual,
      revenue_surprise: prepared.record.revenue_surprise,
      revenue_surprise_percent: prepared.record.revenue_surprise_percent,

      before_after_market: marketTiming,
      earnings_date_time: deriveEarningsDateTimeIso(prepared.record.report_date, marketTiming),
      importance: prepared.record.importance ?? DEFAULT_EARNINGS_IMPORTANCE,

      date: prepared.record.date,
      time: prepared.record.time,
      symbol: ticker,
      asset_name: prepared.record.company_name,

      source: 'eodhd.com',
      api_source: 'eodhd.com',
      currency: prepared.record.currency ?? 'USD',
      exchange: prepared.record.exchange,
      updated_at: new Date().toISOString(),
    })
  }

  console.log(`[eodhd] prepared ${records.length} US records (skipped ${skipped})`)
  return records
}

function eachDateInclusive(startStr: string, endStr: string): string[] {
  const out: string[] = []
  const cur = new Date(`${startStr}T12:00:00Z`)
  const end = new Date(`${endStr}T12:00:00Z`)
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function uwHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'UW-CLIENT-API-ID': Deno.env.get('UW_CLIENT_API_ID') || '100001',
  }
}

async function fetchUwEarningsPage(
  apiKey: string,
  session: 'premarket' | 'afterhours',
  date: string,
  page: number,
): Promise<Array<Record<string, unknown>>> {
  const url = new URL(`https://api.unusualwhales.com/api/earnings/${session}`)
  url.searchParams.set('date', date)
  url.searchParams.set('limit', '100')
  url.searchParams.set('page', String(page))
  const resp = await fetch(url.toString(), { headers: uwHeaders(apiKey) })
  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(`UW ${session} ${date} HTTP ${resp.status}: ${text.slice(0, 200)}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`UW ${session} ${date} non-JSON`)
  }
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>
    if (Array.isArray(obj.earnings)) return obj.earnings as Array<Record<string, unknown>>
  }
  return []
}

function mapBenzingaEarningsItem(item: Record<string, unknown>): Record<string, unknown> | null {
  const rawTicker = String(item.ticker ?? '').trim().toUpperCase()
  if (!rawTicker) return null
  const reportDate = String(item.date ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}/.test(reportDate)) return null
  const exchange = String(item.exchange ?? '').toUpperCase()
  // Prefer major US venues; still allow empty exchange / OTC US tickers when present
  if (
    exchange &&
    !['NYSE', 'NASDAQ', 'AMEX', 'NYSEARCA', 'BATS', 'ARCA', 'OTC', 'OTCMKTS', 'NYSE AMERICAN'].includes(exchange)
  ) {
    return null
  }

  const code = `${rawTicker}.US`
  const marketTiming = parseMarketTiming(String(item.time ?? ''))
    ?? (() => {
      const hour = parseInt(String(item.time ?? '00').split(':')[0] || '0', 10)
      if (hour >= 4 && hour < 10) return 'BeforeMarket'
      if (hour >= 16 && hour < 20) return 'AfterMarket'
      return null
    })()

  const epsEstimate = firstNumber(item.eps_est, item.eps_estimate)
  const epsActual = firstNumber(item.eps, item.eps_actual)
  const epsPrior = firstNumber(item.eps_prior)
  const revenueEstimate = firstNumber(item.revenue_est, item.revenue_estimate)
  const revenueActual = firstNumber(item.revenue, item.revenue_actual)
  const revenuePrior = firstNumber(item.revenue_prior, item.revenue_estimate_year_ago)

  const epsSurprise = firstNumber(item.eps_surprise) ??
    (epsActual !== null && epsEstimate !== null ? epsActual - epsEstimate : null)
  const epsSurprisePercent = firstNumber(item.eps_surprise_percent) ??
    (epsSurprise !== null && epsEstimate !== null && epsEstimate !== 0
      ? (epsSurprise / Math.abs(epsEstimate)) * 100
      : null)
  const revSurprise = firstNumber(item.revenue_surprise) ??
    (revenueActual !== null && revenueEstimate !== null ? revenueActual - revenueEstimate : null)
  const revSurprisePercent = firstNumber(item.revenue_surprise_percent) ??
    (revSurprise !== null && revenueEstimate !== null && revenueEstimate !== 0
      ? (revSurprise / Math.abs(revenueEstimate)) * 100
      : null)

  return {
    ticker: rawTicker,
    code,
    company_name: item.name ?? null,
    report_date: reportDate,
    report_time: item.time ?? null,
    quarter: item.period ?? null,
    period_year: item.period_year ?? null,
    exchange: exchange || null,

    eps_estimate: epsEstimate,
    estimate: epsEstimate,
    eps: epsActual,
    actual: epsActual,
    eps_prior: epsPrior,
    eps_surprise: epsSurprise,
    eps_surprise_percent: epsSurprisePercent,
    difference: epsSurprise,
    percent: epsSurprisePercent,

    revenue_estimate: revenueEstimate,
    revenue_estimate_avg: revenueEstimate,
    revenue: revenueActual,
    revenue_actual: revenueActual,
    revenue_prior: revenuePrior,
    revenue_estimate_year_ago: revenuePrior,
    revenue_surprise: revSurprise,
    revenue_surprise_percent: revSurprisePercent,

    before_after_market: marketTiming,
    earnings_date_time: deriveEarningsDateTimeIso(reportDate, marketTiming),
    importance: firstNumber(item.importance) ?? DEFAULT_EARNINGS_IMPORTANCE,

    date: reportDate,
    time: item.time ?? null,
    symbol: rawTicker,
    asset_name: item.name ?? null,

    source: 'benzinga.com',
    api_source: 'benzinga.com',
    currency: item.currency ?? 'USD',
    updated_at: new Date().toISOString(),
  }
}

async function fetchBenzingaCalendar(
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, unknown>[]> {
  // Benzinga has rich revenue_* + eps_* — critical fallback when Parse hits 402.
  // Fetch day-by-day (wide ranges are often sparse on limited plans) via v2.1.
  const records: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const dates = eachDateInclusive(fromDate, toDate)

  for (const day of dates) {
    for (let page = 0; page < 20; page++) {
      const apiUrl = new URL('https://api.benzinga.com/api/v2.1/calendar/earnings')
      apiUrl.searchParams.set('token', apiKey)
      apiUrl.searchParams.set('parameters[date]', day)
      apiUrl.searchParams.set('pagesize', '1000')
      apiUrl.searchParams.set('page', String(page))
      const resp = await fetch(apiUrl.toString(), { headers: { Accept: 'application/json' } })
      const text = await resp.text()
      if (!resp.ok) {
        console.warn(`[benzinga] ${day} page ${page} HTTP ${resp.status}: ${text.slice(0, 160)}`)
        break
      }
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        console.warn(`[benzinga] ${day} non-JSON: ${text.slice(0, 160)}`)
        break
      }
      const items = Array.isArray(data)
        ? data as Array<Record<string, unknown>>
        : Array.isArray((data as { earnings?: unknown })?.earnings)
          ? (data as { earnings: Array<Record<string, unknown>> }).earnings
          : []
      if (items.length === 0) break

      for (const item of items) {
        const mapped = mapBenzingaEarningsItem(item)
        if (!mapped) continue
        const key = `${mapped.ticker}|${mapped.report_date}`
        if (seen.has(key)) continue
        seen.add(key)
        records.push(mapped)
      }
      if (items.length < 1000) break
    }
  }

  console.log(`[benzinga] prepared ${records.length} records (${fromDate}..${toDate}, day-by-day)`)
  return records
}

/**
 * Finnhub earnings calendar — includes revenueEstimate / revenueActual.
 * Used as the main revenue backfill when Parse is 402 and Benzinga is sparse.
 */
async function fetchFinnhubCalendar(
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = []
  const seen = new Set<string>()
  // Finnhub prefers shorter windows — chunk weekly
  const allDates = eachDateInclusive(fromDate, toDate)
  for (let i = 0; i < allDates.length; i += 7) {
    const chunk = allDates.slice(i, i + 7)
    const chunkFrom = chunk[0]!
    const chunkTo = chunk[chunk.length - 1]!
    const url =
      `https://finnhub.io/api/v1/calendar/earnings?from=${chunkFrom}&to=${chunkTo}&token=${apiKey}`
    console.log(`[finnhub] GET calendar/earnings ${chunkFrom}..${chunkTo}`)
    const resp = await fetch(url)
    const text = await resp.text()
    if (!resp.ok) {
      console.warn(`[finnhub] HTTP ${resp.status}: ${text.slice(0, 200)}`)
      continue
    }
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      console.warn(`[finnhub] non-JSON: ${text.slice(0, 200)}`)
      continue
    }
    const items = Array.isArray((data as { earningsCalendar?: unknown })?.earningsCalendar)
      ? (data as { earningsCalendar: Array<Record<string, unknown>> }).earningsCalendar
      : Array.isArray(data)
        ? data as Array<Record<string, unknown>>
        : []

    for (const item of items) {
      const rawTicker = String(item.symbol ?? item.ticker ?? '').trim().toUpperCase()
      if (!rawTicker || rawTicker.includes('.')) {
        // Skip non-US / preferred tickers like BRK.A already handled elsewhere;
        // Finnhub US commons are plain symbols.
      }
      if (!rawTicker || !/^[A-Z][A-Z0-9.-]{0,11}$/.test(rawTicker)) continue
      const reportDate = String(item.date ?? '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}/.test(reportDate)) continue
      const key = `${rawTicker}|${reportDate}`
      if (seen.has(key)) continue
      seen.add(key)

      const hour = String(item.hour ?? '').toLowerCase()
      const marketTiming = hour === 'bmo' || hour.includes('before')
        ? 'BeforeMarket'
        : hour === 'amc' || hour.includes('after')
          ? 'AfterMarket'
          : parseMarketTiming(hour)

      const epsEstimate = firstNumber(item.epsEstimate, item.eps_estimate)
      const epsActual = firstNumber(item.epsActual, item.eps_actual)
      const revenueEstimate = firstNumber(item.revenueEstimate, item.revenue_estimate)
      const revenueActual = firstNumber(item.revenueActual, item.revenue_actual)

      // Skip totally empty money rows — they don't help UW enrichment
      if (
        epsEstimate === null && epsActual === null &&
        revenueEstimate === null && revenueActual === null
      ) {
        continue
      }

      const epsSurprise = epsActual !== null && epsEstimate !== null ? epsActual - epsEstimate : null
      const epsSurprisePercent = epsSurprise !== null && epsEstimate !== null && epsEstimate !== 0
        ? (epsSurprise / Math.abs(epsEstimate)) * 100
        : null
      const revSurprise = revenueActual !== null && revenueEstimate !== null
        ? revenueActual - revenueEstimate
        : null
      const revSurprisePercent = revSurprise !== null && revenueEstimate !== null && revenueEstimate !== 0
        ? (revSurprise / Math.abs(revenueEstimate)) * 100
        : null

      const quarter = item.quarter != null ? `Q${item.quarter}` : null
      records.push({
        ticker: rawTicker,
        code: rawTicker.includes('.') ? rawTicker : `${rawTicker}.US`,
        company_name: null,
        report_date: reportDate,
        report_time: hour || null,
        quarter,
        period_year: firstNumber(item.year),

        eps_estimate: epsEstimate,
        estimate: epsEstimate,
        eps: epsActual,
        actual: epsActual,
        eps_surprise: epsSurprise,
        eps_surprise_percent: epsSurprisePercent,
        difference: epsSurprise,
        percent: epsSurprisePercent,

        revenue_estimate: revenueEstimate,
        revenue_estimate_avg: revenueEstimate,
        revenue: revenueActual,
        revenue_actual: revenueActual,
        revenue_surprise: revSurprise,
        revenue_surprise_percent: revSurprisePercent,

        before_after_market: marketTiming,
        earnings_date_time: deriveEarningsDateTimeIso(reportDate, marketTiming),
        importance: DEFAULT_EARNINGS_IMPORTANCE,

        date: reportDate,
        time: hour || null,
        symbol: rawTicker,
        asset_name: null,

        source: 'finnhub.com',
        api_source: 'finnhub.com',
        currency: 'USD',
        updated_at: new Date().toISOString(),
      })
    }
  }

  console.log(`[finnhub] prepared ${records.length} records (${fromDate}..${toDate})`)
  return records
}

/** Copy revenue onto rows missing it from same-ticker neighbors within ±windowDays. */
function propagateRevenueNearby(
  records: Record<string, unknown>[],
  windowDays = 10,
): { records: Record<string, unknown>[]; filled: number } {
  const byTicker = new Map<string, Record<string, unknown>[]>()
  for (const rec of records) {
    const t = String(rec.ticker ?? '').toUpperCase()
    if (!t) continue
    const list = byTicker.get(t) ?? []
    list.push(rec)
    byTicker.set(t, list)
  }

  let filled = 0
  for (const group of byTicker.values()) {
    const donors = group.filter((r) =>
      r.revenue_estimate != null || r.revenue_estimate_avg != null || r.revenue_actual != null
    )
    if (donors.length === 0) continue

    for (const rec of group) {
      const needsEst = rec.revenue_estimate == null && rec.revenue_estimate_avg == null
      const needsAct = rec.revenue_actual == null
      if (!needsEst && !needsAct) continue
      const date = String(rec.report_date ?? '')
      const donor = donors
        .filter((d) => d !== rec && calendarDaysBetween(String(d.report_date ?? ''), date) <= windowDays)
        .sort((a, b) => {
          const aAct = a.revenue_actual != null ? 1 : 0
          const bAct = b.revenue_actual != null ? 1 : 0
          if (bAct !== aAct) return bAct - aAct
          return calendarDaysBetween(String(a.report_date ?? ''), date) -
            calendarDaysBetween(String(b.report_date ?? ''), date)
        })[0]
      if (!donor) continue

      if (needsEst) {
        const est = donor.revenue_estimate ?? donor.revenue_estimate_avg
        if (est != null) {
          rec.revenue_estimate = est
          rec.revenue_estimate_avg = est
          filled++
        }
      }
      if (needsAct && donor.revenue_actual != null) {
        rec.revenue_actual = donor.revenue_actual
        rec.revenue = donor.revenue_actual
        filled++
      }
      if (rec.revenue_prior == null && donor.revenue_prior != null) {
        rec.revenue_prior = donor.revenue_prior
        rec.revenue_estimate_year_ago = donor.revenue_prior
      }
      if (
        rec.revenue_actual != null &&
        (rec.revenue_estimate != null || rec.revenue_estimate_avg != null)
      ) {
        const est = Number(rec.revenue_estimate ?? rec.revenue_estimate_avg)
        const act = Number(rec.revenue_actual)
        if (Number.isFinite(est) && est !== 0 && Number.isFinite(act)) {
          rec.revenue_surprise = act - est
          rec.revenue_surprise_percent = ((act - est) / Math.abs(est)) * 100
        }
      }
    }
  }
  return { records, filled }
}

/**
 * Unusual Whales day calendars — FALLBACK gap-fill only for tickers Parse missed.
 * Quality filter: US + no OTC; keep mcap≥$300M OR mid+ size OR estimate/actual.
 */
async function fetchUwDayCalendar(
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<{ records: Record<string, unknown>[]; filteredOut: number; filterReasons: Record<string, number> }> {
  const dates = eachDateInclusive(fromDate, toDate)
  console.log(`[uw] fetching premarket+afterhours for ${dates.length} days (${fromDate}..${toDate})`)
  const records: Record<string, unknown>[] = []
  let skipped = 0
  let filteredOut = 0
  const filterReasons: Record<string, number> = {}

  for (const date of dates) {
    for (const session of ['premarket', 'afterhours'] as const) {
      const marketTiming = session === 'premarket' ? 'BeforeMarket' : 'AfterMarket'
      for (let page = 0; page < 5; page++) {
        let pageItems: Array<Record<string, unknown>> = []
        try {
          pageItems = await fetchUwEarningsPage(apiKey, session, date, page)
        } catch (err) {
          console.warn(
            `[uw] ${session} ${date} page ${page} failed:`,
            err instanceof Error ? err.message : String(err),
          )
          break
        }
        if (pageItems.length === 0) break

        for (const item of pageItems) {
          const rawTicker = String(
            item.symbol ?? item.ticker ?? item.ticker_symbol ?? '',
          )
            .trim()
            .toUpperCase()
          if (!rawTicker || rawTicker.includes(' ') || !/^[A-Z][A-Z0-9.-]{0,11}$/.test(rawTicker)) {
            skipped++
            continue
          }
          const reportDate = String(item.report_date ?? item.date ?? date).slice(0, 10)
          if (!/^\d{4}-\d{2}-\d{2}/.test(reportDate)) {
            skipped++
            continue
          }

          const quality = extractUwEstimateActuals(item)
          const curation = passesUwCurationFilter(item, quality)
          if (!curation.ok) {
            filteredOut++
            const reason = curation.reason ?? 'filtered'
            filterReasons[reason] = (filterReasons[reason] ?? 0) + 1
            continue
          }

          const code = rawTicker.includes('.') ? rawTicker : `${rawTicker}.US`
          const { epsEstimate, epsActual, revenueEstimate, revenueActual } = quality
          const revenuePrior = firstNumber(
            item.revenue_prior, item.revenue_estimate_year_ago, item.revenue_year_ago,
          )
          const companyName =
            (item.full_name as string | undefined) ??
            (item.company_name as string | undefined) ??
            (item.name as string | undefined) ??
            null

          const size = String(item.market_cap_size ?? item.marketcap_size ?? '').toLowerCase()
          let importance = DEFAULT_EARNINGS_IMPORTANCE
          if (size === 'big' || size === 'mega' || item.is_s_p_500 === true) importance = 3
          else if (size === 'large') importance = 2
          else if (size === 'mid') importance = 1

          const exchange = String(
            item.exchange ?? item.venue ?? item.listing_exchange ?? item.primary_exchange ?? '',
          ).trim().toUpperCase() || null

          records.push({
            ticker: rawTicker,
            code,
            company_name: companyName,
            report_date: reportDate,
            report_time: session === 'premarket' ? 'Before Market' : 'After Market',
            quarter: item.ending_fiscal_quarter ?? item.quarter ?? null,

            eps_estimate: epsEstimate,
            estimate: epsEstimate,
            eps: epsActual,
            actual: epsActual,

            revenue_estimate: revenueEstimate,
            revenue_estimate_avg: revenueEstimate,
            revenue: revenueActual,
            revenue_actual: revenueActual,
            revenue_prior: revenuePrior,
            revenue_estimate_year_ago: revenuePrior,

            before_after_market: marketTiming,
            earnings_date_time: deriveEarningsDateTimeIso(reportDate, marketTiming),
            importance,
            // Store real mcap only (no fake $300M tag). Cleanup uses quality rules.
            market_cap: curation.marketCap,
            exchange,

            date: reportDate,
            time: session,
            symbol: rawTicker,
            asset_name: companyName,

            source: 'unusualwhales.com',
            api_source: 'unusualwhales.com',
            currency: 'USD',
            updated_at: new Date().toISOString(),
          })
        }

        if (pageItems.length < 100) break
      }
    }
  }

  console.log(
    `[uw] prepared ${records.length} curated records (skipped ${skipped}, filtered_out ${filteredOut}, reasons=${JSON.stringify(filterReasons)})`,
  )
  return { records, filteredOut, filterReasons }
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
    console.log('Daily Earnings Sync V2 (Parse/earningshub primary) started')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('EARNINGS_API_KEY') || Deno.env.get('PARSE_BOT_API_KEY')
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY')
    const uwApiKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY')
    const finnhubApiKey = Deno.env.get('FINNHUB_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    }
    if (!apiKey && !eodhdApiKey && !uwApiKey && !benzingaApiKey && !finnhubApiKey) {
      throw new Error('Missing EARNINGS_API_KEY / EODHD_API_KEY / UNUSUAL_WHALES_API_KEY / BENZINGA_API_KEY / FINNHUB_API_KEY')
    }

    if (mode === 'debug') {
      console.log('Running Parse diagnostics...')
      const diagnostics = apiKey
        ? await probeAllParseEndpoints(apiKey)
        : [{ error: 'No PARSE key — skipping Parse probes' }]
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

    // 1. PRIMARY — Parse/earningshub upcoming (estimates + revenue_estimate)
    console.log(`[parse] Fetching upcoming earnings (${todayStr} -> ${upcomingEndStr})...`)
    let upcomingItems: ParseEarningsItem[] = []
    let parseUpcomingError: string | null = null
    if (apiKey) {
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
        parseUpcomingError = err instanceof Error ? err.message : String(err)
        console.error('  upcoming failed:', parseUpcomingError)
      }
    } else {
      console.warn('  skipping Parse upcoming — no EARNINGS_API_KEY/PARSE_BOT_API_KEY')
    }

    // 2. PRIMARY — Parse/earningshub reported (actuals + revenue_actual)
    console.log(`[parse] Fetching reported earnings (${reportedStartStr} -> ${todayStr})...`)
    let reportedItems: ParseEarningsItem[] = []
    let parseReportedError: string | null = null
    if (apiKey) {
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
        parseReportedError = err instanceof Error ? err.message : String(err)
        console.error('  reported failed:', parseReportedError)
      }
    } else {
      console.warn('  skipping Parse reported — no EARNINGS_API_KEY/PARSE_BOT_API_KEY')
    }

    // 3. Benzinga — revenue/EPS prior + estimates (critical when Parse hits 402/empty)
    let benzingaRecords: Record<string, unknown>[] = []
    if (benzingaApiKey) {
      try {
        const bzStart = new Date(today); bzStart.setDate(bzStart.getDate() - 14)
        const bzEnd = new Date(today); bzEnd.setDate(bzEnd.getDate() + 45)
        benzingaRecords = await fetchBenzingaCalendar(
          benzingaApiKey,
          bzStart.toISOString().split('T')[0],
          bzEnd.toISOString().split('T')[0],
        )
      } catch (err) {
        console.error('  Benzinga calendar failed:', err instanceof Error ? err.message : String(err))
      }
    } else {
      console.warn('  skipping Benzinga — no BENZINGA_API_KEY')
    }

    // 3b. Finnhub — best broad revenueEstimate/revenueActual coverage when Parse is 402
    let finnhubRecords: Record<string, unknown>[] = []
    if (finnhubApiKey) {
      try {
        const fhStart = new Date(today); fhStart.setDate(fhStart.getDate() - 14)
        const fhEnd = new Date(today); fhEnd.setDate(fhEnd.getDate() + 45)
        finnhubRecords = await fetchFinnhubCalendar(
          finnhubApiKey,
          fhStart.toISOString().split('T')[0],
          fhEnd.toISOString().split('T')[0],
        )
      } catch (err) {
        console.error('  Finnhub calendar failed:', err instanceof Error ? err.message : String(err))
      }
    } else {
      console.warn('  skipping Finnhub — no FINNHUB_API_KEY')
    }

    // 4. Optional EODHD (often missing/invalid key) — never preferred over Parse
    let eodhdRecords: Record<string, unknown>[] = []
    if (eodhdApiKey) {
      try {
        eodhdRecords = await fetchEodhdUsCalendar(eodhdApiKey, reportedStartStr, upcomingEndStr)
      } catch (err) {
        console.error('  EODHD calendar failed:', err instanceof Error ? err.message : String(err))
      }
    } else {
      console.warn('  skipping EODHD — no EODHD_API_KEY')
    }

    // 5. UW FALLBACK — only fill gaps Parse/Benzinga do not cover; curated at write-time
    let uwRecords: Record<string, unknown>[] = []
    let uwFilteredOut = 0
    let uwFilterReasons: Record<string, number> = {}
    const parseOk = upcomingItems.length + reportedItems.length > 0
    if (uwApiKey) {
      try {
        const uwStart = new Date(today); uwStart.setDate(uwStart.getDate() - 7)
        const uwEnd = new Date(today); uwEnd.setDate(uwEnd.getDate() + 14)
        const uwStartStr = uwStart.toISOString().split('T')[0]
        const uwEndStr = uwEnd.toISOString().split('T')[0]
        const uwResult = await fetchUwDayCalendar(uwApiKey, uwStartStr, uwEndStr)
        uwFilteredOut = uwResult.filteredOut
        uwFilterReasons = uwResult.filterReasons

        const coveredExact = new Set<string>()
        for (const item of [...upcomingItems, ...reportedItems]) {
          const t = String(item.ticker ?? '').trim().toUpperCase()
          const d = String(item.report_date ?? '').slice(0, 10)
          if (t && d) coveredExact.add(`${t}|${d}`)
        }
        for (const r of [...benzingaRecords, ...finnhubRecords]) {
          coveredExact.add(`${String(r.ticker ?? '')}|${String(r.report_date ?? '')}`)
        }

        if (parseOk || benzingaRecords.length > 0 || finnhubRecords.length > 0) {
          uwRecords = uwResult.records.filter(
            (r) => !coveredExact.has(`${r.ticker}|${r.report_date}`),
          )
          console.log(
            `[uw] gap-fill: ${uwRecords.length}/${uwResult.records.length} (Parse/Benzinga/Finnhub cover the rest)`,
          )
        } else {
          console.warn('[uw] Parse+Benzinga+Finnhub empty — using curated UW as fallback calendar')
          uwRecords = uwResult.records
        }
      } catch (err) {
        console.error('  UW calendar failed:', err instanceof Error ? err.message : String(err))
      }
    } else {
      console.warn('  skipping UW — no UNUSUAL_WHALES_API_KEY')
    }

    // 6. Build + merge (Parse richest money fields win; nulls never wipe)
    const allItems: ParseEarningsItem[] = [...upcomingItems, ...reportedItems]
    const rawRecords: Record<string, unknown>[] = [
      ...eodhdRecords,
      ...uwRecords,
      ...finnhubRecords,
      ...benzingaRecords,
    ]
    let skipped = 0
    for (const item of allItems) {
      const rec = buildRecord(item)
      if (rec) rawRecords.push(rec)
      else skipped++
    }

    if (rawRecords.length === 0) {
      throw new Error(
        'No earnings from Parse / Benzinga / Finnhub / EODHD / Unusual Whales — check API keys and upstream APIs' +
          (parseUpcomingError || parseReportedError
            ? ` (parse_errors: ${[parseUpcomingError, parseReportedError].filter(Boolean).join(' | ')})`
            : ''),
      )
    }

    const merged = mergeByKey(rawRecords)
    const { records: revenuePropagated, filled: revenueNearbyFilled } = propagateRevenueNearby(merged, 10)
    // כשהמקור עדיין מחזיר תאריכי אומדן ישנים ליד דיווח עם actual — לא לכתוב אותם מחדש
    const records = dropEstimatesNearConfirmedActuals(revenuePropagated)
    const droppedNearConfirmed = revenuePropagated.length - records.length
    console.log(
      `Prepared ${records.length} unique records (raw: ${rawRecords.length}, parse: ${allItems.length}, benzinga: ${benzingaRecords.length}, finnhub: ${finnhubRecords.length}, eodhd: ${eodhdRecords.length}, uw_gapfill: ${uwRecords.length}, skipped: ${skipped}, revenue_nearby_filled: ${revenueNearbyFilled}, dropped_near_confirmed: ${droppedNearConfirmed}, uw_filtered_out: ${uwFilteredOut})`,
    )

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted_count: 0, message: 'No valid records to upsert' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (records.length > 0) {
      console.log('Sample record:', JSON.stringify(records[0], null, 2))
    }

    // 6. Upsert in batches — strip null financials so gap-fill never blanks Parse revenue
    const batchSize = 100
    let insertedCount = 0
    let errorCount = 0

    const stripNullFinancials = (rec: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = { ...rec }
      for (const key of FINANCIAL_COALESCE_KEYS) {
        if (out[key] === null || out[key] === undefined) delete out[key]
      }
      return out
    }

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize).map(stripNullFinancials)

      const { error: tickerError } = await supabase
        .from('earnings_calendar')
        .upsert(batch, {
          onConflict: 'ticker,report_date',
          ignoreDuplicates: false,
          // Critical: missing financial keys must NOT null-out existing Parse/Benzinga revenue
          defaultToNull: false,
        })

      if (!tickerError) {
        insertedCount += batch.length
        continue
      }

      console.warn(`Batch ${i / batchSize + 1}: ticker,report_date upsert failed -> ${tickerError.message}`)

      // Fallback: try code,report_date
      if (tickerError.message?.toLowerCase().includes('constraint')) {
        const { error: codeError } = await supabase
          .from('earnings_calendar')
          .upsert(batch, {
            onConflict: 'code,report_date',
            ignoreDuplicates: false,
            defaultToNull: false,
          })
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

    // 7. נקה תאריכי אומדן ישנים ליד דיווחים עם actual מה-batch
    const confirmedFromBatch = records
      .filter((r) => r.actual != null || r.revenue_actual != null)
      .map((r) => ({
        ticker: String(r.ticker ?? ''),
        code: (r.code as string | null | undefined) ?? undefined,
        reportDate: String(r.report_date ?? ''),
      }))
      .filter((c) => c.ticker && /^\d{4}-\d{2}-\d{2}/.test(c.reportDate))

    const { deleted: staleDeleted } = await purgeStaleEstimateRowsNearConfirmed(
      supabase,
      confirmedFromBatch,
    )

    // 8. Backfill-clean recent UW junk: no estimates AND no actuals AND soft mcap fail
    // Safe: ONLY source=unusualwhales.com (never touches Parse/Benzinga/Finnhub)
    const cleanupStart = new Date(today); cleanupStart.setDate(cleanupStart.getDate() - 14)
    const cleanupEnd = new Date(today); cleanupEnd.setDate(cleanupEnd.getDate() + 21)
    const cleanupStartStr = cleanupStart.toISOString().split('T')[0]
    const cleanupEndStr = cleanupEnd.toISOString().split('T')[0]
    let junkDeleted = 0
    const { data: junkRows, error: junkSelectError } = await supabase
      .from('earnings_calendar')
      .select(
        'id, market_cap, estimate, eps_estimate, actual, revenue_estimate, revenue_estimate_avg, revenue_actual, revenue, exchange',
      )
      .eq('source', 'unusualwhales.com')
      .gte('report_date', cleanupStartStr)
      .lte('report_date', cleanupEndStr)

    if (junkSelectError) {
      console.warn('[cleanup] select failed:', junkSelectError.message)
    } else if (junkRows && junkRows.length > 0) {
      const ids = junkRows
        .filter((r) => {
          const exch = String(r.exchange ?? '').toUpperCase()
          if (exch && UW_OTC_EXCHANGE_RE.test(exch)) return true
          const hasEst =
            r.estimate != null || r.eps_estimate != null ||
            r.revenue_estimate != null || r.revenue_estimate_avg != null
          const hasAct = r.actual != null || r.revenue_actual != null || r.revenue != null
          if (hasEst || hasAct) return false
          const mcap = r.market_cap == null ? null : Number(r.market_cap)
          // Keep UW rows that already cleared the soft $300M floor (even pre-estimate)
          if (mcap !== null && Number.isFinite(mcap) && mcap >= MIN_MARKET_CAP_USD) return false
          // No estimates/actuals + unknown or below floor → junk
          return true
        })
        .map((r) => r.id as string)
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200)
        const { error: delErr, count } = await supabase
          .from('earnings_calendar')
          .delete({ count: 'exact' })
          .in('id', chunk)
        if (delErr) console.warn('[cleanup] delete failed:', delErr.message)
        else junkDeleted += count ?? chunk.length
      }
      console.log(
        `[cleanup] deleted ${junkDeleted}/${junkRows.length} UW junk rows (no estimates/actuals + soft mcap fail or OTC)`,
      )
    }

    // 9. SQL backfill: copy revenue onto null rows from same-ticker neighbors (±10d)
    let dbRevenueBackfilled = 0
    try {
      const { data: needy, error: needyErr } = await supabase
        .from('earnings_calendar')
        .select('id, ticker, report_date, revenue_estimate, revenue_estimate_avg, revenue_actual')
        .gte('report_date', cleanupStartStr)
        .lte('report_date', cleanupEndStr)
        .is('revenue_estimate', null)
        .is('revenue_estimate_avg', null)
        .is('revenue_actual', null)
        .limit(2000)

      if (needyErr) {
        console.warn('[rev-backfill] needy select failed:', needyErr.message)
      } else if (needy && needy.length > 0) {
        const tickers = [...new Set(needy.map((r) => String(r.ticker || '')).filter(Boolean))]
        const { data: donors, error: donorsErr } = await supabase
          .from('earnings_calendar')
          .select(
            'ticker, report_date, revenue_estimate, revenue_estimate_avg, revenue_actual, revenue_prior, revenue_estimate_year_ago',
          )
          .in('ticker', tickers)
          .gte('report_date', cleanupStartStr)
          .lte('report_date', cleanupEndStr)
          .or('revenue_estimate.not.is.null,revenue_estimate_avg.not.is.null,revenue_actual.not.is.null')

        if (donorsErr) {
          console.warn('[rev-backfill] donors select failed:', donorsErr.message)
        } else if (donors && donors.length > 0) {
          const donorsByTicker = new Map<string, typeof donors>()
          for (const d of donors) {
            const t = String(d.ticker || '')
            const list = donorsByTicker.get(t) ?? []
            list.push(d)
            donorsByTicker.set(t, list)
          }

          for (const row of needy) {
            const t = String(row.ticker || '')
            const d = String(row.report_date || '')
            const cands = (donorsByTicker.get(t) ?? [])
              .filter((x) => calendarDaysBetween(String(x.report_date), d) <= 10)
              .sort((a, b) =>
                calendarDaysBetween(String(a.report_date), d) -
                calendarDaysBetween(String(b.report_date), d)
              )
            const donor = cands[0]
            if (!donor) continue
            const est = donor.revenue_estimate ?? donor.revenue_estimate_avg
            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
            if (est != null) {
              patch.revenue_estimate = est
              patch.revenue_estimate_avg = est
            }
            if (donor.revenue_actual != null) {
              patch.revenue_actual = donor.revenue_actual
              patch.revenue = donor.revenue_actual
            }
            if (donor.revenue_prior != null || donor.revenue_estimate_year_ago != null) {
              patch.revenue_prior = donor.revenue_prior ?? donor.revenue_estimate_year_ago
              patch.revenue_estimate_year_ago = donor.revenue_estimate_year_ago ?? donor.revenue_prior
            }
            if (Object.keys(patch).length <= 1) continue
            const { error: upErr } = await supabase
              .from('earnings_calendar')
              .update(patch)
              .eq('id', row.id)
            if (!upErr) dbRevenueBackfilled++
          }
          console.log(`[rev-backfill] filled ${dbRevenueBackfilled}/${needy.length} null-revenue rows from nearby donors`)
        }
      }
    } catch (err) {
      console.warn('[rev-backfill] failed:', err instanceof Error ? err.message : String(err))
    }

    const elapsed = Date.now() - startedAt
    console.log(
      `Done. inserted=${insertedCount} errors=${errorCount} stale_deleted=${staleDeleted} junk_deleted=${junkDeleted} rev_backfill=${dbRevenueBackfilled} elapsed_ms=${elapsed}`,
    )

    return new Response(
      JSON.stringify({
        success: true,
        primary_source: 'earningshub.com (Parse)',
        fallback_sources: ['finnhub.com', 'benzinga.com', 'unusualwhales.com', 'eodhd.com'],
        curation: {
          min_market_cap_usd: MIN_MARKET_CAP_USD,
          uw_allowed_cap_sizes: [...UW_ALLOWED_CAP_SIZES],
          quality_rules: [
            'reject_otc_pink_grey',
            'us_exchange_or_empty_us',
            'keep_mcap_gte_300m',
            'keep_mid_large_big_mega_or_sp500',
            'keep_has_eps_or_revenue_estimate_or_actual',
            'drop_no_quality_signal',
          ],
          note: 'Quality filter at UW write-time only; Parse/Benzinga/Finnhub rows kept as-is. $300M is soft secondary, not a raised floor.',
        },
        scraper_id: PARSE_SCRAPER_ID,
        upcoming_fetched: upcomingItems.length,
        reported_fetched: reportedItems.length,
        parse_upcoming_error: parseUpcomingError,
        parse_reported_error: parseReportedError,
        benzinga_fetched: benzingaRecords.length,
        finnhub_fetched: finnhubRecords.length,
        eodhd_fetched: eodhdRecords.length,
        uw_gapfill_fetched: uwRecords.length,
        uw_filtered_out: uwFilteredOut,
        uw_filter_reasons: uwFilterReasons,
        revenue_nearby_filled: revenueNearbyFilled,
        db_revenue_backfilled: dbRevenueBackfilled,
        total_unique: records.length,
        skipped,
        dropped_near_confirmed: droppedNearConfirmed,
        inserted_count: insertedCount,
        error_count: errorCount,
        stale_estimate_deleted: staleDeleted,
        uw_junk_deleted: junkDeleted,
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
