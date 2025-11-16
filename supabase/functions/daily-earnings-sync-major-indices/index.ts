import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// רשימת מניות מהאינדקסים הגדולים
const MAJOR_INDICES_SYMBOLS = [
  // S&P 500 Major Companies
  "AAPL.US", "MSFT.US", "GOOGL.US", "AMZN.US", "NVDA.US", "META.US", "TSLA.US",
  "BRK-A.US", "BRK-B.US", "JPM.US", "JNJ.US", "V.US", "UNH.US", "PG.US",
  "XOM.US", "HD.US", "MA.US", "LLY.US", "CVX.US", "MRK.US", "BAC.US",
  "KO.US", "PEP.US", "PFE.US", "WMT.US", "COST.US", "ABBV.US", "AVGO.US",
  "CMCSA.US", "ADBE.US", "CRM.US", "CSCO.US", "DIS.US", "DHR.US", "TMO.US",
  "NKE.US", "ORCL.US", "QCOM.US", "SBUX.US", "TXN.US", "VZ.US", "WFC.US",
  "ACN.US", "AMD.US", "AMGN.US", "BA.US", "BMY.US", "C.US", "CAT.US",
  "CHTR.US", "CL.US", "CMG.US", "COP.US", "DE.US", "DUK.US", "EMR.US",
  "ETN.US", "FDX.US", "GD.US", "GE.US", "GILD.US", "GM.US", "GS.US",
  "HON.US", "IBM.US", "INTC.US", "ISRG.US", "KHC.US", "LMT.US", "LOW.US",
  "MCD.US", "MDLZ.US", "MMM.US", "MO.US", "MDT.US", "MU.US", "NEE.US",
  "NFLX.US", "NOW.US", "PANW.US", "PYPL.US", "RTX.US", "SCHW.US", "SPG.US",
  "SYK.US", "TGT.US", "TJX.US", "TMUS.US", "UNP.US", "UPS.US", "VRTX.US",
  "WM.US", "ZTS.US", "BLK.US", "CVS.US", "CI.US", "ELV.US", "EW.US",
  "ICE.US", "INTU.US", "LULU.US", "MPC.US", "PGR.US", "PSX.US", "REGN.US",
  "SO.US", "SQ.US", "SYF.US", "TRV.US", "USB.US"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Major Indices Earnings sync function started')
    console.log('🔄 Starting Major Indices Earnings sync...')

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

    // טווח תאריכים מדויק: 08/10/2025 עד 03/10/2026
    const fromDate = '2025-10-08'
    const toDate = '2026-10-03'

    console.log(`📅 Fetching major indices earnings from ${fromDate} to ${toDate}...`)
    console.log(`📊 Range: October 8, 2025 → October 3, 2026 (almost 1 year)`)

    let totalProcessed = 0
    let totalInserted = 0
    const batchSize = 50 // Process symbols in batches

    // עיבוד המניות בקבוצות
    for (let i = 0; i < MAJOR_INDICES_SYMBOLS.length; i += batchSize) {
      const batch = MAJOR_INDICES_SYMBOLS.slice(i, i + batchSize)
      const symbolsParam = batch.join(',')

      console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(MAJOR_INDICES_SYMBOLS.length/batchSize)}`)

      // קריאה ל-EODHD API
      const apiUrl = `https://eodhd.com/api/calendar/earnings?symbols=${symbolsParam}&from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
      
      const response = await fetch(apiUrl)
      if (!response.ok) {
        console.warn(`⚠️ API error for batch: ${response.status} ${response.statusText}`)
        continue
      }

      const data = await response.json()
      
      if (!data.earnings || !Array.isArray(data.earnings)) {
        console.warn(`⚠️ Invalid response format for batch`)
        continue
      }

      // עיבוד כל דיווח תוצאות בקבוצה
      for (const earnings of data.earnings) {
        totalProcessed++

        try {
          // סינון: רק מניות אמריקאיות (.US)
          if (!earnings.code || !earnings.code.endsWith('.US')) {
            console.log(`⏭️ Skipping non-US stock: ${earnings.code}`)
            continue
          }

          // תיקון תאריך: אם יש תוצאה בפועל (actual) והתאריך הוא עתידי, 
          // זה אומר שהדיווח כבר יצא והתאריך צריך להיות היום או אתמול
          let correctedReportDate = earnings.report_date
          const today = new Date()
          const todayStr = today.toISOString().split('T')[0]
          const reportDate = new Date(earnings.report_date)
          
          // אם יש תוצאה בפועל והתאריך הוא עתידי (מחר ומעלה)
          if (earnings.actual !== null && earnings.actual !== undefined && 
              earnings.report_date > todayStr) {
            console.log(`⚠️ ${earnings.code}: תאריך עתידי (${earnings.report_date}) עם תוצאה בפועל - מתקן לתאריך היום`)
            
            // לוגיקה מתוקנת: אם הדיווח הוא "אחרי סגירה" בארה"ב והשעה בישראל היא 
            // אחרי חצות, התאריך צריך להיות היום. אחרת, אתמול.
            const israelHour = today.getHours()
            
            if (earnings.before_after_market === 'AfterMarket' && israelHour >= 0 && israelHour < 6) {
              // אם הדיווח היה אחרי סגירה בארה"ב והשעה בישראל היא 00:00-06:00,
              // זה אומר שהדיווח יצא "אתמול" בארה"ב אבל "היום" בישראל
              correctedReportDate = todayStr
            } else if (earnings.before_after_market === 'BeforeMarket') {
              // אם הדיווח הוא לפני פתיחה, זה אומר שהוא צריך להיות היום
              correctedReportDate = todayStr
            } else {
              // במקרים אחרים, נשאיר את התאריך כמו שהוא
              // (הדיווח עדיין לא יצא בפועל למרות שיש תוצאה מוערכת)
            }
          }

          const earningsData = {
            id: `earnings_${earnings.code}_${correctedReportDate}`,
            code: earnings.code,
            report_date: correctedReportDate,
            date: earnings.date,
            before_after_market: earnings.before_after_market || null,
            currency: earnings.currency || null,
            actual: earnings.actual || null,
            estimate: earnings.estimate || null,
            difference: earnings.difference || null,
            percent: earnings.percent || null,
            source: 'EODHD',
            updated_at: new Date().toISOString()
          }

          // הכנסה/עדכון במסד הנתונים
          const { error } = await supabase
            .from('earnings_calendar')
            .upsert(earningsData, { 
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

      // הפסקה קצרה בין קבוצות
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`✅ Major Indices Earnings sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Major Indices Earnings synchronized successfully',
        processed: totalProcessed,
        inserted: totalInserted,
        symbolsProcessed: MAJOR_INDICES_SYMBOLS.length,
        dateRange: `${fromDate} to ${toDate}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Major Indices Earnings sync error:', error)

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
