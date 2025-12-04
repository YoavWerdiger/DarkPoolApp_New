// Daily Earnings Update - Triggered by n8n webhook
// מעדכן את כל דיווחי הרווחים של היום

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
    console.log('🔄 Earnings Daily Update started')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY') || '68e3c3af900997.85677801'
    
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

    // קריאה ל-EODHD ללא symbols - מחזיר את כל הדיווחים!
    const apiUrl = `https://eodhd.com/api/calendar/earnings?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    
    console.log(`📡 Calling EODHD API...`)
    
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.earnings || !Array.isArray(data.earnings)) {
      throw new Error('Invalid response format from EODHD')
    }

    console.log(`📊 Received ${data.earnings.length} earnings reports`)

    let totalUpdated = 0
    let totalWithActual = 0
    const updates = []

    for (const earnings of data.earnings) {
      try {
        const prepared = prepareEarningsRecord(earnings, {
          requireUSCode: true,
          skipPreferredShares: true
        })

        if (!prepared || prepared.record.actual === null) {
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
      totalChecked: data.earnings.length,
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

