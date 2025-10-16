import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting LIGHT earnings sync...')

    // קבלת משתני סביבה
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY') || '68e3c3af900997.85677801'
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing environment variables' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // רק 10 המניות הכי חשובות
    const TOP_10_STOCKS = [
      "AAPL.US", "MSFT.US", "GOOGL.US", "AMZN.US", "NVDA.US", 
      "META.US", "TSLA.US", "JPM.US", "JNJ.US", "V.US"
    ];

    // רק 3 ימים קדימה
    const today = new Date()
    const fromDate = today.toISOString().split('T')[0]
    
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + 3)
    const toDate = futureDate.toISOString().split('T')[0]

    console.log(`📅 Light sync: ${fromDate} to ${toDate}`)

    const symbolsParam = TOP_10_STOCKS.join(',')

    // קריאה אחת ל-API
    const apiUrl = `https://eodhd.com/api/calendar/earnings?symbols=${symbolsParam}&from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    
    const response = await fetch(apiUrl)
    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `API failed: ${response.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const data = await response.json()
    
    if (!data || !Array.isArray(data.earnings)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    let inserted = 0

    // עיבוד פשוט
    for (const earnings of data.earnings) {
      try {
        if (!earnings.code || !earnings.code.endsWith('.US')) continue
        if (earnings.code.includes('-P')) continue

        const earningsData = {
          id: `earnings_${earnings.code}_${earnings.report_date}`,
          code: earnings.code,
          report_date: earnings.report_date,
          date: earnings.date,
          before_after_market: earnings.before_after_market || null,
          currency: earnings.currency || 'USD',
          actual: earnings.actual || null,
          estimate: earnings.estimate || null,
          difference: earnings.difference || null,
          percent: earnings.percent || null,
          source: 'EODHD',
          updated_at: new Date().toISOString()
        }

        const result = await supabase
          .from('earnings_calendar')
          .upsert(earningsData, { onConflict: 'id' })

        if (!result.error) {
          inserted++
        }

      } catch (error) {
        console.error(`Error: ${earnings.code}`)
      }
    }

    console.log(`✅ Light sync completed: ${inserted} records`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Light earnings sync completed',
        inserted: inserted,
        processed: data.earnings.length,
        stocks: TOP_10_STOCKS.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Error:', error)

    return new Response(
      JSON.stringify({ success: false, error: 'Sync failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
