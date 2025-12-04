import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { prepareEarningsRecord } from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting Earnings sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing Supabase configuration'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Benzinga API Key
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY') || 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC'
    
    // חישוב טווח תאריכים - שבוע אחורה + 3 חודשים קדימה
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 7)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]

    console.log(`📅 Fetching earnings from ${fromDate} to ${toDate}...`)

    // קריאה ל-Benziga API
    const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/earnings')
    apiUrl.searchParams.append('token', benzingaApiKey)
    apiUrl.searchParams.append('accept', 'application/json')
    apiUrl.searchParams.append('parameters[date_from]', fromDate)
    apiUrl.searchParams.append('parameters[date_to]', toDate)
    apiUrl.searchParams.append('pagesize', '1000')
    
    const response = await fetch(apiUrl.toString())
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Benzinga API error: ${response.status} ${response.statusText}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const data = await response.json()
    console.log('📈 Received earnings data:', data)

    if (!data.earnings || !Array.isArray(data.earnings)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid response format from Benzinga API'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // המרת Benzinga earnings לפורמט EODHD (תואם ל-earnings-utils)
    const convertedEarnings = data.earnings.map((earning: any) => {
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
    })

    let totalProcessed = 0
    let totalInserted = 0

    // עיבוד כל דיווח תוצאות
    for (const earnings of convertedEarnings) {
      totalProcessed++

      try {
        const prepared = prepareEarningsRecord(earnings, {
          requireUSCode: true,
          skipPreferredShares: true
        })

        if (!prepared) {
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
          console.error('❌ Error upserting earnings:', error)
        } else {
          totalInserted++
        }

      } catch (error) {
        console.error('❌ Error processing earnings:', error)
      }
    }

    console.log(`✅ Earnings sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings synchronized successfully',
        processed: totalProcessed,
        inserted: totalInserted,
        dateRange: `${fromDate} to ${toDate}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Earnings sync error:', error)
    
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? String(error.message) 
      : 'Unknown error occurred'

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
