import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import { prepareEarningsRecord } from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// רשימת מניות מהאינדקסים הגדולים (S&P 500, NASDAQ, DOW)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🌅 Starting daily earnings sync - pulling 30 days forward...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY') || '68e3c3af900997.85677801'
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // טווח תאריכים: היום + 30 יום קדימה
    const today = new Date()
    const fromDate = today.toISOString().split('T')[0]
    
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + 30)
    const toDate = futureDate.toISOString().split('T')[0]

    console.log(`📅 Date range: ${fromDate} → ${toDate}`)

    let totalProcessed = 0
    let totalInserted = 0
    const batchSize = 50

    // עיבוד במקבץ
    for (let i = 0; i < MAJOR_STOCKS.length; i += batchSize) {
      const batch = MAJOR_STOCKS.slice(i, i + batchSize)
      const symbolsParam = batch.join(',')

      console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(MAJOR_STOCKS.length/batchSize)}`)

      const apiUrl = `https://eodhd.com/api/calendar/earnings?symbols=${symbolsParam}&from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
      
      const response = await fetch(apiUrl)
      if (!response.ok) {
        console.warn(`⚠️ API error: ${response.status}`)
        continue
      }

      const data = await response.json()
      
      if (!data.earnings || !Array.isArray(data.earnings)) {
        console.warn(`⚠️ Invalid response format`)
        continue
      }

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
            console.error('❌ Error upserting:', error)
          } else {
            totalInserted++
          }

        } catch (error) {
          console.error('❌ Error processing earnings:', error)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`✅ Daily sync completed: ${totalInserted}/${totalProcessed} records`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily earnings sync completed',
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
    console.error('❌ Daily sync error:', error)

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

