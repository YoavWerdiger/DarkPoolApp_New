// Earnings Results Update - עדכון תוצאות למניות גדולות
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
  options: { requireUSCode?: boolean; skipPreferredShares?: boolean } = {}
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
    source: DEFAULT_SOURCE,
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

// רשימת מניות מהאינדקסים הגדולים
const MAJOR_STOCKS = [
  "AAPL.US", "MSFT.US", "GOOGL.US", "AMZN.US", "NVDA.US", "META.US", "TSLA.US",
  "BRK-B.US", "JPM.US", "JNJ.US", "V.US", "UNH.US", "PG.US", "XOM.US", "HD.US",
  "MA.US", "LLY.US", "CVX.US", "MRK.US", "BAC.US", "KO.US", "PEP.US", "PFE.US",
  "WMT.US", "COST.US", "ABBV.US", "AVGO.US", "CMCSA.US", "ADBE.US", "CRM.US",
  "CSCO.US", "DIS.US", "DHR.US", "TMO.US", "NKE.US", "ORCL.US", "QCOM.US",
  "SBUX.US", "TXN.US", "VZ.US", "WFC.US", "ACN.US", "AMD.US", "AMGN.US",
  "BA.US", "BMY.US", "C.US", "CAT.US", "CL.US", "COP.US", "DE.US",
  "GE.US", "GILD.US", "GM.US", "GS.US", "HON.US", "IBM.US", "INTC.US",
  "LMT.US", "LOW.US", "MCD.US", "MMM.US", "MO.US", "MU.US", "NFLX.US",
  "RTX.US", "SPG.US", "TGT.US", "UNP.US", "UPS.US"
];

// ============================================
// Main Function
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting earnings results update (actual values)...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY') || 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC'
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const today = new Date()
    const pastDate = new Date()
    pastDate.setDate(today.getDate() - 3)
    
    const fromDate = pastDate.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    console.log(`📅 Updating results for: ${fromDate} → ${toDate}`)

    let totalProcessed = 0
    let totalUpdated = 0
    const batchSize = 50

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

    for (let i = 0; i < MAJOR_STOCKS.length; i += batchSize) {
      const batch = MAJOR_STOCKS.slice(i, i + batchSize)
      const cleanSymbols = batch.map(s => s.replace('.US', '')).join(',')

      console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(MAJOR_STOCKS.length/batchSize)}`)

      const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/earnings')
      apiUrl.searchParams.append('token', benzingaApiKey)
      apiUrl.searchParams.append('accept', 'application/json')
      apiUrl.searchParams.append('parameters[date_from]', fromDate)
      apiUrl.searchParams.append('parameters[date_to]', toDate)
      apiUrl.searchParams.append('parameters[tickers]', cleanSymbols)
      apiUrl.searchParams.append('pagesize', '1000')
      
      const response = await fetch(apiUrl.toString())
      if (!response.ok) {
        console.warn(`⚠️ API error: ${response.status}`)
        continue
      }

      const data = await response.json()
      
      if (!data.earnings || !Array.isArray(data.earnings)) {
        console.warn(`⚠️ Invalid response format`)
        continue
      }

      const convertedEarnings = data.earnings.map(convertBenzingaToEODHDFormat)

      for (const earnings of convertedEarnings) {
        totalProcessed++

        try {
          const prepared = prepareEarningsRecord(earnings, {
            requireUSCode: true,
            skipPreferredShares: true
          })

          if (!prepared || prepared.record.actual === null) {
            continue
          }

          if (prepared.meta.adjusted) {
            console.log(
              `🕒 Adjusted ${earnings.code} report date ${earnings.report_date} → ${prepared.record.report_date} (${prepared.meta.adjustmentReason})`
            )
          }

          const { error } = await supabase
            .from('earnings_calendar')
            .upsert(prepared.record, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })

          if (error) {
            console.error('❌ Error updating:', error)
          } else {
            totalUpdated++
            console.log(`✅ Updated ${earnings.code} - Actual: ${prepared.record.actual}`)
          }

        } catch (error) {
          console.error('❌ Error processing earnings:', error)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`✅ Results update completed: ${totalUpdated}/${totalProcessed} records updated`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings results updated',
        processed: totalProcessed,
        updated: totalUpdated,
        dateRange: `${fromDate} to ${toDate}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Results update error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})


