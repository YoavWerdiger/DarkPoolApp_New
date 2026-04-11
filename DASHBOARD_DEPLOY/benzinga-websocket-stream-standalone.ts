// Benzinga WebSocket Stream - Real-time Earnings Updates
// גרסה standalone לפריסה דרך Dashboard

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// Helper Functions (inline from earnings-utils)
// ============================================

const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';
const DEFAULT_SOURCE = 'Benzinga';

const numberOrNull = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getDateFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

const getTimeFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const getDateInTimeZone = (date: Date, timeZone: string): string =>
  getDateFormatter(timeZone).format(date);

const sanitizeDateString = (value?: string | null, fallback?: string): string => {
  if (value && /\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }
  return fallback ?? getDateInTimeZone(new Date(), DEFAULT_TIME_ZONE);
};

interface RawEarningsEvent {
  code?: string;
  report_date?: string;
  date?: string;
  before_after_market?: string | null;
  currency?: string | null;
  actual?: number | string | null;
  estimate?: number | string | null;
  difference?: number | string | null;
  percent?: number | string | null;
}

interface EarningsRecord {
  id: string;
  code: string;
  report_date: string;
  date: string;
  before_after_market: string | null;
  currency: string | null;
  actual: number | null;
  estimate: number | null;
  difference: number | null;
  percent: number | null;
  source: string;
  updated_at: string;
}

const prepareEarningsRecord = (
  raw: RawEarningsEvent,
  options: { requireUSCode?: boolean; skipPreferredShares?: boolean; source?: string } = {}
): { record: EarningsRecord; meta: { adjusted: boolean; adjustmentReason?: string } } | null => {
  if (!raw?.code) return null;
  if (!raw.report_date) return null;

  if (options.requireUSCode && !raw.code.endsWith('.US')) return null;
  if (options.skipPreferredShares && (raw.code.includes('-P') || raw.code.includes('-W'))) {
    return null;
  }

  const now = new Date();
  const timeZone = DEFAULT_TIME_ZONE;
  const today = getDateInTimeZone(now, timeZone);
  const tomorrow = getDateInTimeZone(addDays(now, 1), timeZone);

  let normalizedDate = sanitizeDateString(raw.report_date, today);
  let adjusted = false;
  let adjustmentReason: string | undefined;

  const actualValue = numberOrNull(raw.actual);

  if (actualValue !== null && normalizedDate > today) {
    normalizedDate = today;
    adjusted = true;
    adjustmentReason = 'actual_in_future';
  }

  const timeParts = getTimeFormatter(timeZone).formatToParts(now);
  const hourPart = timeParts.find((part) => part.type === 'hour')?.value ?? '0';
  const israelHour = Number(hourPart);

  if (
    raw.before_after_market === 'AfterMarket' &&
    normalizedDate === tomorrow &&
    israelHour >= 0 &&
    israelHour < 6
  ) {
    normalizedDate = today;
    adjusted = true;
    adjustmentReason = adjustmentReason ?? 'after_market_timezone_shift';
  }

  const record: EarningsRecord = {
    id: `earnings_${raw.code}_${normalizedDate}`,
    code: raw.code,
    report_date: normalizedDate,
    date: sanitizeDateString(raw.date, normalizedDate),
    before_after_market: raw.before_after_market ?? null,
    currency: raw.currency ?? 'USD',
    actual: actualValue,
    estimate: numberOrNull(raw.estimate),
    difference: numberOrNull(raw.difference),
    percent: numberOrNull(raw.percent),
    source: options.source ?? DEFAULT_SOURCE,
    updated_at: now.toISOString()
  };

  return {
    record,
    meta: {
      adjusted,
      adjustmentReason
    }
  };
};

// ============================================
// Main Function
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Benzinga WebSocket stream handler')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY')
    if (!benzingaApiKey) {
      throw new Error('BENZINGA_API_KEY not configured')
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const convertBenzingaToEODHDFormat = (earning: any) => {
      let before_after_market: string | null = null;
      if (earning.time) {
        const hour = parseInt(earning.time.split(':')[0]);
        if (hour >= 4 && hour < 10) {
          before_after_market = 'Before Market';
        } else if (hour >= 16 && hour < 20) {
          before_after_market = 'After Market';
        }
      }

      let actual: number | null = null;
      let estimate: number | null = null;
      let difference: number | null = null;
      let percent: number | null = null;

      if (earning.eps && earning.eps !== '') {
        actual = parseFloat(earning.eps);
        if (!isNaN(actual)) {
          if (earning.eps_est && earning.eps_est !== '') {
            estimate = parseFloat(earning.eps_est);
            if (!isNaN(estimate)) {
              difference = actual - estimate;
              percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
            }
          }
        }
      } else if (earning.revenue && earning.revenue !== '') {
        actual = parseFloat(earning.revenue);
        if (!isNaN(actual)) {
          if (earning.revenue_est && earning.revenue_est !== '') {
            estimate = parseFloat(earning.revenue_est);
            if (!isNaN(estimate)) {
              difference = actual - estimate;
              percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
            }
          }
        }
      }

      const tickerCode = earning.ticker.includes('.') ? earning.ticker : `${earning.ticker}.US`;

      return {
        code: tickerCode,
        name: earning.name || earning.ticker,
        report_date: earning.date,
        date: earning.date,
        before_after_market,
        currency: earning.currency || 'USD',
        actual,
        estimate,
        difference,
        percent,
      };
    };

    const wsUrl = `wss://api.benzinga.com/api/v2.1/calendar/earnings/stream?token=${benzingaApiKey}`
    
    console.log(`🔌 Connecting to Benzinga WebSocket: ${wsUrl.replace(benzingaApiKey, '***')}`)

    const ws = new WebSocket(wsUrl)
    
    let messageCount = 0
    let updateCount = 0
    let errorCount = 0
    const startTime = Date.now()

    ws.onopen = () => {
      console.log('✅ Connected to Benzinga WebSocket stream')
      console.log('📡 Listening for real-time earnings updates...')
    }

    ws.onmessage = async (event) => {
      try {
        messageCount++
        const data = JSON.parse(event.data)

        if (data.kind === 'data/v2.1/calendar/earnings' && data.data) {
          const earningData = data.data.content
          const action = data.data.action

          console.log(`📨 Received ${action} event for ${earningData.ticker}`)

          const convertedEarning = convertBenzingaToEODHDFormat(earningData)

          const prepared = prepareEarningsRecord(convertedEarning, {
            requireUSCode: true,
            skipPreferredShares: true,
            source: 'Benzinga'
          })

          if (!prepared) {
            console.log(`⚠️ Skipped ${earningData.ticker} - invalid record`)
            return
          }

          if (action === 'created' || action === 'updated') {
            const { error } = await supabase
              .from('earnings_calendar')
              .upsert(prepared.record, { 
                onConflict: 'id',
                ignoreDuplicates: false 
              })

            if (error) {
              console.error(`❌ Error upserting ${earningData.ticker}:`, error)
              errorCount++
            } else {
              updateCount++
              console.log(`✅ ${action === 'created' ? 'Created' : 'Updated'} ${earningData.ticker} - EPS: ${earningData.eps || 'N/A'}, Revenue: ${earningData.revenue || 'N/A'}`)
            }
          } else if (action === 'deleted') {
            console.log(`🗑️ Deleted event for ${earningData.ticker} (not removing from DB)`)
          }
        } else if (data.kind === 'status' || data.type === 'ping') {
          console.log('💓 WebSocket ping/status message')
        }
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error)
        errorCount++
      }
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      errorCount++
    }

    ws.onclose = (event) => {
      const duration = Math.round((Date.now() - startTime) / 1000)
      console.log(`🔌 WebSocket closed after ${duration}s`)
      console.log(`📊 Stats: ${messageCount} messages, ${updateCount} updates, ${errorCount} errors`)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'WebSocket stream started',
      websocket: {
        connected: true,
        url: wsUrl.replace(benzingaApiKey, '***')
      },
      note: 'This function maintains a persistent WebSocket connection. Check logs for updates.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('❌ WebSocket stream error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})










