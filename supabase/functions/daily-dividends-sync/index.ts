import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Dividends sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // EODHD API Key
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY')!
    if (!eodhdApiKey) {
      throw new Error('EODHD_API_KEY is required')
    }

    // רשימת סימבולים פופולריים שמשלמים דיבידנדים
    const symbols = [
      'AAPL.US', 'MSFT.US', 'JNJ.US', 'PG.US', 'KO.US',
      'PEP.US', 'WMT.US', 'JPM.US', 'BAC.US', 'T.US',
      'VZ.US', 'XOM.US', 'CVX.US', 'ABBV.US', 'MRK.US',
      'PFE.US', 'HD.US', 'MCD.US', 'NKE.US', 'DIS.US',
      'V.US', 'MA.US', 'ADBE.US', 'NFLX.US', 'CRM.US'
    ]

    console.log(`💰 Fetching dividends for ${symbols.length} symbols...`)

    let totalProcessed = 0
    let totalInserted = 0

    // עיבוד כל סימבול
    for (const symbol of symbols) {
      try {
        console.log(`📊 Processing dividends for ${symbol}...`)
        
        // קריאה ל-EODHD API
        const apiUrl = `https://eodhd.com/api/calendar/dividends?filter[symbol]=${symbol}&api_token=${eodhdApiKey}&fmt=json`
        
        const response = await fetch(apiUrl)
        if (!response.ok) {
          console.error(`❌ Error fetching dividends for ${symbol}: ${response.status}`)
          continue
        }

        const data = await response.json()
        
        if (!data.data || !Array.isArray(data.data)) {
          console.log(`⚠️ No dividends data for ${symbol}`)
          continue
        }

        // עיבוד כל דיבידנד
        for (const dividend of data.data) {
          totalProcessed++

          try {
            const dividendData = {
              id: `dividend_${dividend.symbol}_${dividend.date}`,
              symbol: dividend.symbol,
              date: dividend.date,
              source: 'EODHD',
              updated_at: new Date().toISOString()
            }

            // הכנסה/עדכון במסד הנתונים
            const { error } = await supabase
              .from('dividends_calendar')
              .upsert(dividendData, { 
                onConflict: 'id',
                ignoreDuplicates: false 
              })

            if (error) {
              console.error('❌ Error upserting dividend:', error)
            } else {
              totalInserted++
            }

          } catch (error) {
            console.error('❌ Error processing dividend:', error)
          }
        }

        // המתנה קצרה בין בקשות
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`❌ Error processing symbol ${symbol}:`, error)
      }
    }

    console.log(`✅ Dividends sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dividends synchronized successfully',
        processed: totalProcessed,
        inserted: totalInserted,
        symbols: symbols.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Dividends sync error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})