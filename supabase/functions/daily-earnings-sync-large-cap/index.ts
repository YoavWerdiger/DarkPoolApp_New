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
    console.log('🚀 Large Cap Earnings sync started')

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

    // Large Cap symbols (predefined list)
    const largeCapSymbols = [
      'AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'NVDA.US',
      'TSLA.US', 'META.US', 'BRK-B.US', 'AVGO.US', 'JPM.US',
      'UNH.US', 'V.US', 'XOM.US', 'PG.US', 'JNJ.US',
      'HD.US', 'MA.US', 'CVX.US', 'PFE.US', 'ABBV.US',
      'BAC.US', 'LLY.US', 'KO.US', 'PEP.US', 'COST.US',
      'WMT.US', 'DHR.US', 'MRK.US', 'ACN.US', 'TMO.US',
      'VZ.US', 'ADBE.US', 'CRM.US', 'NFLX.US', 'CMCSA.US',
      'INTC.US', 'AMD.US', 'TXN.US', 'QCOM.US', 'HON.US',
      'LIN.US', 'COP.US', 'ABT.US', 'NKE.US', 'DHR.US',
      'T.US', 'PM.US', 'LOW.US', 'NEE.US', 'DIS.US',
      'RTX.US', 'SPGI.US', 'IBM.US', 'GE.US', 'CAT.US',
      'AXP.US', 'BKNG.US', 'AMGN.US', 'GILD.US', 'MDLZ.US',
      'ADP.US', 'ISRG.US', 'VRTX.US', 'BLK.US', 'CI.US',
      'SO.US', 'DUK.US', 'PGR.US', 'MMM.US', 'USB.US',
      'EOG.US', 'PNC.US', 'TGT.US', 'LMT.US', 'FIS.US',
      'NSC.US', 'ITW.US', 'TJX.US', 'SCHW.US', 'CVS.US',
      'GS.US', 'MS.US', 'C.US', 'WFC.US', 'BA.US',
      'GM.US', 'F.US', 'DE.US', 'UPS.US', 'FDX.US'
    ]

    console.log(`🏢 Fetching earnings for ${largeCapSymbols.length} large cap stocks`)

    // Fetch earnings for each symbol (batch by 10)
    let allEarnings: any[] = []
    const batchSize = 10

    for (let i = 0; i < largeCapSymbols.length; i += batchSize) {
      const batch = largeCapSymbols.slice(i, i + batchSize)
      const symbolsString = batch.join(',')
      
      try {
        const earningsUrl = `https://eodhd.com/api/calendar/earnings?symbols=${symbolsString}&from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
        
        const response = await fetch(earningsUrl)
        if (response.ok) {
          const data = await response.json()
          if (data.earnings && Array.isArray(data.earnings)) {
            allEarnings.push(...data.earnings)
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`❌ Error fetching batch ${i}-${i + batchSize}:`, error)
      }
    }

    console.log(`📊 Total earnings records: ${allEarnings.length}`)

    // Remove duplicates based on code + report_date
    const uniqueEarnings = allEarnings.filter((earning, index, self) => 
      index === self.findIndex(e => e.code === earning.code && e.report_date === earning.report_date)
    )

    console.log(`🔄 After deduplication: ${uniqueEarnings.length} records`)

    let inserted = 0
    let errors = 0

    // Process each earning
    for (const earning of uniqueEarnings) {
      try {
        const record = {
          id: `earnings_${earning.code}_${earning.report_date}`,
          code: earning.code,
          report_date: earning.report_date,
          date: earning.date,
          before_after_market: earning.before_after_market || null,
          currency: earning.currency || null,
          actual: earning.actual || null,
          estimate: earning.estimate || null,
          difference: earning.difference || null,
          percent: earning.percent || null,
          source: 'EODHD',
          updated_at: new Date().toISOString()
        }

        const { error: upsertError } = await supabase
          .from('earnings_calendar')
          .upsert(record, { 
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

    console.log(`✅ Large Cap sync completed: ${inserted} inserted, ${errors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Large Cap earnings synchronized',
        totalRecords: allEarnings.length,
        uniqueRecords: uniqueEarnings.length,
        inserted: inserted,
        errors: errors,
        dateRange: { from: fromDate, to: toDate },
        symbolsProcessed: largeCapSymbols.length
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
