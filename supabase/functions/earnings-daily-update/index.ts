// Daily Earnings Update - Triggered by n8n webhook
// מעדכן את כל דיווחי הרווחים של היום

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
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
    console.log('🔄 Earnings Daily Update started')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY')
    if (!benzingaApiKey) {
      return new Response(JSON.stringify({ error: 'BENZINGA_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // שליפת כל דיווחי הרווחים של היום + 3 ימים אחורה
    const today = new Date()
    const pastDate = new Date()
    pastDate.setDate(today.getDate() - 3)
    
    const fromDate = pastDate.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    console.log(`📅 Fetching ALL earnings for: ${fromDate} → ${toDate}`)

    // קריאה ל-Benziga API - מחזיר את כל הדיווחים!
    const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/earnings')
    apiUrl.searchParams.append('token', benzingaApiKey)
    apiUrl.searchParams.append('accept', 'application/json')
    apiUrl.searchParams.append('parameters[date_from]', fromDate)
    apiUrl.searchParams.append('parameters[date_to]', toDate)
    apiUrl.searchParams.append('pagesize', '1000')
    
    console.log(`📡 Calling Benzinga API...`)
    
    const response = await fetch(apiUrl.toString())
    
    if (!response.ok) {
      throw new Error(`Benzinga API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.earnings || !Array.isArray(data.earnings)) {
      throw new Error('Invalid response format from Benzinga')
    }

    console.log(`📊 Received ${data.earnings.length} earnings reports`)

    // המרת Benzinga earnings לפורמט EODHD (תואם ל-earnings-utils)
    const convertedEarnings = data.earnings.map((earning: any) => {
      // קובע לפני/אחרי שוק לפי השעה
      let before_after_market: string | null = null;
      if (earning.time) {
        const hour = parseInt(earning.time.split(':')[0]);
        if (hour >= 4 && hour < 10) {
          before_after_market = 'Before Market';
        } else if (hour >= 16 && hour < 20) {
          before_after_market = 'After Market';
        }
      }

      // מחשב difference ו-percent מ-EPS
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

      // טיקר בפורמט .US
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

    let totalUpdated = 0
    let totalWithActual = 0
    const updates = []

    for (const earnings of convertedEarnings) {
      try {
        const prepared = prepareEarningsRecord(earnings, {
          requireUSCode: true,
          skipPreferredShares: true
        })

        if (!prepared) {
          continue
        }

        if (prepared.record.actual === null) {
          continue
        }

        totalWithActual++

        if (prepared.meta.adjusted) {
          console.log(
            `🕒 Adjusted ${earnings.code} report date ${earnings.report_date} → ${prepared.record.report_date} (${prepared.meta.adjustmentReason})`
          )
        }

        updates.push(prepared.record)

      } catch (error) {
        console.error('❌ Error processing earnings:', error)
      }
    }

    // שמירה ב-batch אחד
    if (updates.length > 0) {
      console.log(`💾 Saving ${updates.length} earnings with actual values...`)
      
      const { error } = await supabase
        .from('earnings_calendar')
        .upsert(updates, { 
          onConflict: 'id'
        })

      if (error) {
        console.error('❌ Error saving to DB:', error)
        throw error
      }
      
      totalUpdated = updates.length
      console.log(`✅ Successfully updated ${totalUpdated} earnings`)
      
      // שמירת top 5 לדוגמה
      const topUpdates = updates.slice(0, 5).map(e => ({
        code: e.code,
        actual: e.actual,
        estimate: e.estimate,
        difference: e.difference
      }))
      
      console.log('📋 Sample updates:', JSON.stringify(topUpdates, null, 2))
    } else {
      console.log('ℹ️ No earnings with actual values found')
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${totalUpdated} earnings reports`,
      totalChecked: convertedEarnings.length,
      totalWithActual: totalWithActual,
      totalUpdated: totalUpdated,
      dateRange: `${fromDate} to ${toDate}`,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('❌ Earnings update error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

