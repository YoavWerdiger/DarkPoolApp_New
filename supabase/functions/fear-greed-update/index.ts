import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * CNN Fear & Greed (stock market) — RapidAPI listing was removed (404 "API doesn't exists").
 * Dataviz (Varnish) returns 418 for non-browser / datacenter clients unless headers look real.
 * Edge IPs still get intermittent 418 — retry + date URL fallback.
 */
const CNN_FGI_BASE = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'

const CNN_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Origin: 'https://www.cnn.com',
  Referer: 'https://www.cnn.com/markets/fear-and-greed',
  'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
}

const RETRYABLE = new Set([418, 403, 429, 500, 502, 503, 504])

function utcDateStrings(now = new Date()): string[] {
  const iso = now.toISOString().slice(0, 10)
  const yday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  return [iso, yday]
}

function cnnCandidateUrls(now = new Date()): string[] {
  const dates = utcDateStrings(now)
  return [
    ...dates.map((d) => `${CNN_FGI_BASE}/${d}`),
    CNN_FGI_BASE,
  ]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchCnnFearGreed(): Promise<Record<string, unknown>> {
  const urls = cnnCandidateUrls()
  const attempts = 4
  let lastError = 'unknown'

  for (let attempt = 0; attempt < attempts; attempt++) {
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: CNN_HEADERS,
          redirect: 'follow',
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          lastError = `${response.status} ${response.statusText} @ ${url}${
            body ? ` — ${body.slice(0, 80)}` : ''
          }`
          console.warn(`CNN fetch attempt ${attempt + 1} failed:`, lastError)
          if (!RETRYABLE.has(response.status)) {
            throw new Error(`CNN API Error: ${lastError}`)
          }
          continue
        }

        const cnn = await response.json()
        if (!cnn?.fear_and_greed) {
          lastError = `missing fear_and_greed @ ${url}`
          console.warn(`CNN fetch attempt ${attempt + 1}:`, lastError)
          continue
        }

        console.log(`CNN fetch ok (attempt ${attempt + 1}):`, url)
        return cnn as Record<string, unknown>
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.warn(`CNN fetch attempt ${attempt + 1} threw:`, lastError)
      }
    }

    // Backoff before next round (helps with intermittent Varnish 418 on edge IPs).
    if (attempt < attempts - 1) {
      await sleep(400 * Math.pow(2, attempt) + Math.floor(Math.random() * 200))
    }
  }

  throw new Error(`CNN API Error after retries: ${lastError}`)
}

function normalizeRating(rating: unknown, score: number): string {
  const raw = typeof rating === 'string' ? rating.trim().toLowerCase() : ''
  if (raw.includes('extreme') && raw.includes('fear')) return 'Extreme Fear'
  if (raw.includes('extreme') && raw.includes('greed')) return 'Extreme Greed'
  if (raw === 'fear') return 'Fear'
  if (raw === 'greed') return 'Greed'
  if (raw === 'neutral') return 'Neutral'
  if (score >= 75) return 'Extreme Greed'
  if (score >= 55) return 'Greed'
  if (score >= 45) return 'Neutral'
  if (score >= 25) return 'Fear'
  return 'Extreme Fear'
}

function toScore(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

function toUnixSeconds(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw)
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const ms = Date.parse(raw)
    if (Number.isFinite(ms)) return Math.floor(ms / 1000)
  }
  return Math.floor(Date.now() / 1000)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Fear and Greed Index: Starting update (CNN)...')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    const cnn = await fetchCnnFearGreed()
    const fg = cnn.fear_and_greed as Record<string, unknown>

    const scoreRaw = toScore(fg.score)
    if (scoreRaw == null) {
      throw new Error(
        `CNN returned no numeric score (raw=${JSON.stringify(fg).slice(0, 200)})`,
      )
    }

    const value = Math.max(0, Math.min(100, Math.round(scoreRaw)))
    const valueClassification = normalizeRating(fg.rating, value)
    const timestamp = toUnixSeconds(fg.timestamp)

    const histPoint = (score: unknown) => {
      const s = toScore(score)
      if (s == null) return null
      const v = Math.max(0, Math.min(100, Math.round(s)))
      return {
        value: v,
        valueText: normalizeRating(null, v),
        valueClassification: normalizeRating(null, v),
        timestamp,
      }
    }

    // Shape expected by the mobile client (`fearAndGreedService.buildFromSupabaseRow`).
    const raw_data = {
      source: 'cnn-dataviz',
      fgi: {
        now: {
          value,
          valueText: valueClassification,
          valueClassification,
          timestamp,
        },
        previousClose: histPoint(fg.previous_close),
        oneWeekAgo: histPoint(fg.previous_1_week),
        oneMonthAgo: histPoint(fg.previous_1_month),
        oneYearAgo: histPoint(fg.previous_1_year),
      },
      cnn_fear_and_greed: fg,
    }

    const { error: dbError } = await supabaseClient
      .from('fear_and_greed_index')
      .upsert(
        {
          id: 1,
          value,
          value_classification: valueClassification,
          timestamp,
          updated_at: new Date().toISOString(),
          raw_data,
        },
        { onConflict: 'id' },
      )

    if (dbError) {
      console.error('❌ Fear and Greed Index: Database error:', dbError)
      throw dbError
    }

    console.log('✅ Fear and Greed Index: Successfully updated', {
      value,
      classification: valueClassification,
      timestamp: new Date(timestamp * 1000).toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fear and Greed Index updated successfully',
        data: {
          value,
          valueClassification,
          timestamp,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Fear and Greed Index: Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
