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
    console.log('🚀 Earnings sync started')

    // Get Supabase config
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // EODHD API Key
    const eodhdApiKey = '68e3c3af900997.85677801'
    
    // Calculate date range - 7 days back + 3 months forward
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 7)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]

    console.log(`📅 Fetching earnings from ${fromDate} to ${toDate}`)

    // Fetch from EODHD API
    const apiUrl = `https://eodhd.com/api/calendar/earnings?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.earnings || !Array.isArray(data.earnings)) {
      throw new Error('Invalid API response format')
    }

    console.log(`📊 Received ${data.earnings.length} earnings records`)

    let inserted = 0
    let errors = 0

    // Process each earning
    for (const earning of data.earnings) {
      try {
        const prepared = prepareEarningsRecord(earning, {
          requireUSCode: true,
          skipPreferredShares: true
        })

        if (!prepared) {
          continue
        }

        if (prepared.meta.adjusted) {
          console.log(
            `🕒 Adjusted ${earning.code} report date ${earning.report_date} → ${prepared.record.report_date} (${prepared.meta.adjustmentReason})`
          )
        }

        const { error: upsertError } = await supabase
          .from('earnings_calendar')
          .upsert(prepared.record, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (upsertError) {
          console.error('Upsert error:', upsertError)
          errors++
        } else {
          inserted++
        }

      } catch (err) {
        console.error('Processing error:', err)
        errors++
      }
    }

    console.log(`✅ Sync completed: ${inserted} inserted, ${errors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings synchronized',
        processed: data.earnings.length,
        inserted: inserted,
        errors: errors,
        dateRange: { from: fromDate, to: toDate }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (err) {
    console.error('Function error:', err)
    
    const errorMsg = err instanceof Error ? err.message : String(err)

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
