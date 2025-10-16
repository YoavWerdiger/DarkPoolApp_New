import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EarningsTrend {
  code: string;
  date: string;
  period: string;
  growth: string;
  earningsEstimateAvg: string;
  earningsEstimateLow: string;
  earningsEstimateHigh: string;
  earningsEstimateYearAgoEps: string;
  earningsEstimateNumberOfAnalysts: string;
  earningsEstimateGrowth: string;
  revenueEstimateAvg: string;
  revenueEstimateLow: string;
  revenueEstimateHigh: string;
  revenueEstimateYearAgoEps: string;
  revenueEstimateNumberOfAnalysts: string;
  revenueEstimateGrowth: string;
  epsTrendCurrent: string;
  epsTrend7daysAgo: string;
  epsTrend30daysAgo: string;
  epsTrend60daysAgo: string;
  epsTrend90daysAgo: string;
  epsRevisionsUpLast7days: string;
  epsRevisionsUpLast30days: string;
  epsRevisionsDownLast30days: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Earnings Trends sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // EODHD API Key
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY')!
    if (!eodhdApiKey) {
      throw new Error('EODHD_API_KEY is required')
    }

    // רשימת סימבולים פופולריים
    const symbols = [
      'AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'TSLA.US',
      'META.US', 'NVDA.US', 'BRK-B.US', 'UNH.US', 'JNJ.US',
      'JPM.US', 'V.US', 'PG.US', 'HD.US', 'MA.US',
      'DIS.US', 'PYPL.US', 'ADBE.US', 'NFLX.US', 'CRM.US',
      'INTC.US', 'AMD.US', 'ORCL.US', 'CSCO.US', 'IBM.US'
    ]

    console.log(`📊 Fetching earnings trends for ${symbols.length} symbols...`)

    // קריאה ל-EODHD API
    const apiUrl = `https://eodhd.com/api/calendar/trends?symbols=${symbols.join(',')}&api_token=${eodhdApiKey}&fmt=json`
    console.log('🔗 API URL:', apiUrl.replace(eodhdApiKey, '***'))

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('📈 Received earnings trends data:', data)

    if (!data.trends || !Array.isArray(data.trends)) {
      throw new Error('Invalid response format from EODHD API')
    }

    let totalProcessed = 0
    let totalInserted = 0

    // עיבוד כל סימבול
    for (let i = 0; i < data.trends.length; i++) {
      const symbolTrends = data.trends[i]
      if (!Array.isArray(symbolTrends)) continue

      console.log(`📊 Processing trends for symbol ${i + 1}/${data.trends.length}`)

      for (const trend of symbolTrends) {
        totalProcessed++

        try {
          const trendData = {
            id: `${trend.code}_${trend.date}_${trend.period}`,
            code: trend.code,
            date: trend.date,
            period: trend.period,
            growth: trend.growth ? parseFloat(trend.growth) : null,
            earnings_estimate_avg: trend.earningsEstimateAvg ? parseFloat(trend.earningsEstimateAvg) : null,
            earnings_estimate_low: trend.earningsEstimateLow ? parseFloat(trend.earningsEstimateLow) : null,
            earnings_estimate_high: trend.earningsEstimateHigh ? parseFloat(trend.earningsEstimateHigh) : null,
            earnings_estimate_year_ago: trend.earningsEstimateYearAgoEps ? parseFloat(trend.earningsEstimateYearAgoEps) : null,
            earnings_estimate_analysts_count: trend.earningsEstimateNumberOfAnalysts ? parseInt(trend.earningsEstimateNumberOfAnalysts) : null,
            earnings_estimate_growth: trend.earningsEstimateGrowth ? parseFloat(trend.earningsEstimateGrowth) : null,
            revenue_estimate_avg: trend.revenueEstimateAvg ? parseFloat(trend.revenueEstimateAvg) : null,
            revenue_estimate_low: trend.revenueEstimateLow ? parseFloat(trend.revenueEstimateLow) : null,
            revenue_estimate_high: trend.revenueEstimateHigh ? parseFloat(trend.revenueEstimateHigh) : null,
            revenue_estimate_year_ago: trend.revenueEstimateYearAgoEps ? parseFloat(trend.revenueEstimateYearAgoEps) : null,
            revenue_estimate_analysts_count: trend.revenueEstimateNumberOfAnalysts ? parseInt(trend.revenueEstimateNumberOfAnalysts) : null,
            revenue_estimate_growth: trend.revenueEstimateGrowth ? parseFloat(trend.revenueEstimateGrowth) : null,
            eps_trend_current: trend.epsTrendCurrent ? parseFloat(trend.epsTrendCurrent) : null,
            eps_trend_7days_ago: trend.epsTrend7daysAgo ? parseFloat(trend.epsTrend7daysAgo) : null,
            eps_trend_30days_ago: trend.epsTrend30daysAgo ? parseFloat(trend.epsTrend30daysAgo) : null,
            eps_trend_60days_ago: trend.epsTrend60daysAgo ? parseFloat(trend.epsTrend60daysAgo) : null,
            eps_trend_90days_ago: trend.epsTrend90daysAgo ? parseFloat(trend.epsTrend90daysAgo) : null,
            eps_revisions_up_last_7days: trend.epsRevisionsUpLast7days ? parseInt(trend.epsRevisionsUpLast7days) : null,
            eps_revisions_up_last_30days: trend.epsRevisionsUpLast30days ? parseInt(trend.epsRevisionsUpLast30days) : null,
            eps_revisions_down_last_30days: trend.epsRevisionsDownLast30days ? parseInt(trend.epsRevisionsDownLast30days) : null,
            source: 'EODHD',
            updated_at: new Date().toISOString()
          }

          // הכנסה/עדכון במסד הנתונים
          const { error } = await supabase
            .from('earnings_trends')
            .upsert(trendData, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })

          if (error) {
            console.error('❌ Error upserting trend:', error)
          } else {
            totalInserted++
          }

        } catch (error) {
          console.error('❌ Error processing trend:', error)
        }
      }
    }

    console.log(`✅ Earnings trends sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings trends synchronized successfully',
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
    console.error('❌ Earnings trends sync error:', error)

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