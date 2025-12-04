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
    console.log('🌅 Starting optimized daily earnings sync...')

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

    // חלוקה למקבצים קטנים - רק 50 מניות בכל פעם
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
      "RTX.US", "SPG.US", "TGT.US", "UNP.US", "UPS.US", "ABT.US", "ACN.US",
      "ADP.US", "AMT.US", "AXP.US", "BLK.US", "BMY.US", "C.US", "CAT.US",
      "CL.US", "CME.US", "COP.US", "CSX.US", "CVS.US", "D.US", "DE.US",
      "DUK.US", "EMR.US", "EOG.US", "FDX.US", "FIS.US", "FISV.US", "GD.US",
      "GE.US", "GIS.US", "GLW.US", "GM.US", "GPN.US", "HCA.US", "HES.US",
      "HUM.US", "IBM.US", "ICE.US", "IEX.US", "ILMN.US", "INTU.US", "ISRG.US",
      "ITW.US", "JCI.US", "K.US", "KDP.US", "KHC.US", "KLAC.US", "KMB.US",
      "KMI.US", "KR.US", "LEN.US", "LHX.US", "LIN.US", "LKQ.US", "LMT.US",
      "LOW.US", "LULU.US", "MA.US", "MCD.US", "MDLZ.US", "MDT.US", "MET.US",
      "MKC.US", "MMC.US", "MMM.US", "MO.US", "MOS.US", "MPC.US", "MRK.US",
      "MRNA.US", "MSI.US", "MTB.US", "MU.US", "NCLH.US", "NEE.US", "NFLX.US",
      "NOC.US", "NOW.US", "NRG.US", "NSC.US", "NTRS.US", "NUE.US", "NVDA.US",
      "NVR.US", "NWL.US", "NWS.US", "O.US", "ODFL.US", "OGN.US", "OMC.US",
      "ORCL.US", "OTIS.US", "OXY.US", "PAYC.US", "PAYX.US", "PCAR.US", "PCG.US",
      "PEAK.US", "PEG.US", "PEP.US", "PFE.US", "PG.US", "PGR.US", "PLD.US",
      "PM.US", "PNC.US", "PNR.US", "PNW.US", "PPG.US", "PPL.US", "PRU.US",
      "PSA.US", "PSX.US", "PWR.US", "PXD.US", "PYPL.US", "QCOM.US", "QRVO.US",
      "RCL.US", "RE.US", "REG.US", "REGN.US", "RF.US", "RHI.US", "RMD.US",
      "ROK.US", "ROL.US", "ROP.US", "ROST.US", "RSG.US", "RTX.US", "SBAC.US",
      "SBUX.US", "SCHW.US", "SEDG.US", "SEE.US", "SHW.US", "SIVB.US", "SJM.US",
      "SLB.US", "SNA.US", "SNPS.US", "SO.US", "SPG.US", "SPGI.US", "SRE.US",
      "STE.US", "STT.US", "STZ.US", "SWK.US", "SWKS.US", "SYK.US", "SYY.US",
      "T.US", "TAP.US", "TDG.US", "TDY.US", "TECH.US", "TEL.US", "TER.US",
      "TFC.US", "TFX.US", "TGT.US", "TJX.US", "TMO.US", "TMUS.US", "TPG.US",
      "TROW.US", "TRV.US", "TSCO.US", "TSN.US", "TT.US", "TTWO.US", "TXN.US",
      "TXT.US", "TYL.US", "UDR.US", "UHS.US", "ULTA.US", "UNH.US", "UNP.US",
      "UPS.US", "URI.US", "USB.US", "V.US", "VFC.US", "VICI.US", "VLO.US",
      "VMC.US", "VRSK.US", "VRSN.US", "VRTX.US", "VTR.US", "VTRS.US", "VZ.US",
      "WAB.US", "WAT.US", "WBA.US", "WEC.US", "WELL.US", "WFC.US", "WHR.US",
      "WLTW.US", "WM.US", "WMB.US", "WMT.US", "WRB.US", "WRK.US", "WST.US",
      "WU.US", "WY.US", "WYNN.US", "XEL.US", "XOM.US", "XRAY.US", "XYL.US",
      "YUM.US", "ZBH.US", "ZBRA.US", "ZION.US", "ZTS.US"
    ];

    let totalProcessed = 0
    let totalInserted = 0
    const batchSize = 25 // מקבץ קטן יותר

    // עיבוד במקבצים קטנים
    for (let i = 0; i < MAJOR_STOCKS.length; i += batchSize) {
      const batch = MAJOR_STOCKS.slice(i, i + batchSize)
      const symbolsParam = batch.join(',')

      console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(MAJOR_STOCKS.length/batchSize)} (${batch.length} stocks)`)

      const apiUrl = `https://eodhd.com/api/calendar/earnings?symbols=${symbolsParam}&from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
      
      const response = await fetch(apiUrl)
      if (!response.ok) {
        console.warn(`⚠️ API error for batch: ${response.status}`)
        continue
      }

      const data = await response.json()
      
      if (!data.earnings || !Array.isArray(data.earnings)) {
        console.warn(`⚠️ Invalid response format for batch`)
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

      // הפסקה קצרה בין מקבצים
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`✅ Optimized daily sync completed: ${totalInserted}/${totalProcessed} records`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Optimized daily earnings sync completed',
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
    console.error('❌ Optimized daily sync error:', error)

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
