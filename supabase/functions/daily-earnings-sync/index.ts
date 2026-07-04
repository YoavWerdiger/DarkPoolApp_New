import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import { prepareEarningsRecord } from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EarningsData {
  code: string;
  report_date: string;
  date: string;
  before_after_market: string;
  currency: string;
  actual: number;
  estimate: number;
  difference: number;
  percent: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Earnings sync function started')
    console.log('🔄 Starting Earnings sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // EODHD API Key
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY') || '68e3c3af900997.85677801'
    if (!eodhdApiKey) {
      throw new Error('EODHD_API_KEY is required')
    }

    // חישוב טווח תאריכים - שבוע אחורה + 3 חודשים קדימה
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 7) // שבוע אחורה
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3) // 3 חודשים קדימה

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]

    console.log(`📅 Fetching earnings from ${fromDate} to ${toDate}...`)

    // קריאה ל-EODHD API
    const apiUrl = `https://eodhd.com/api/calendar/earnings?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    console.log('🔗 API URL:', apiUrl.replace(eodhdApiKey, '***'))

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('📈 Received earnings data:', data)

    if (!data.earnings || !Array.isArray(data.earnings)) {
      throw new Error('Invalid response format from EODHD API')
    }

    let totalProcessed = 0
    let totalInserted = 0

    // עיבוד כל דיווח תוצאות
    for (const earnings of data.earnings) {
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
      },
    )

  } catch (error) {
    console.error('❌ Earnings sync error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})