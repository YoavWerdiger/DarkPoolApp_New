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

interface FundamentalData {
  Code: string;
  MarketCapitalization: number;
  Currency: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Filtered Earnings sync started')

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

    // Fetch earnings data
    const earningsUrl = `https://eodhd.com/api/calendar/earnings?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    
    const earningsResponse = await fetch(earningsUrl)
    if (!earningsResponse.ok) {
      throw new Error(`EODHD API error: ${earningsResponse.status}`)
    }

    const earningsData = await earningsResponse.json()
    
    if (!earningsData.earnings || !Array.isArray(earningsData.earnings)) {
      throw new Error('Invalid API response format')
    }

    console.log(`📊 Received ${earningsData.earnings.length} earnings records`)

    // Filter for US stocks only
    const usEarnings = earningsData.earnings.filter((earning: any) => 
      earning.code && earning.code.endsWith('.US')
    )

    console.log(`🇺🇸 Filtered to ${usEarnings.length} US stocks`)

    // Get unique symbols for fundamental data lookup
    const symbols = [...new Set(usEarnings.map((e: any) => e.code))]
    console.log(`🔍 Looking up market cap for ${symbols.length} symbols`)

    // Fetch fundamental data for market cap filtering
    const fundamentalPromises = symbols.map(async (symbol: string) => {
      try {
        const fundamentalUrl = `https://eodhd.com/api/fundamentals/${symbol}?api_token=${eodhdApiKey}&fmt=json`
        const response = await fetch(fundamentalUrl)
        
        if (response.ok) {
          const data = await response.json()
          return {
            code: symbol,
            marketCap: data.General?.MarketCapitalization || 0,
            currency: data.General?.CurrencyCode || 'USD'
          }
        }
        return { code: symbol, marketCap: 0, currency: 'USD' }
      } catch (error) {
        console.log(`⚠️ Failed to get market cap for ${symbol}`)
        return { code: symbol, marketCap: 0, currency: 'USD' }
      }
    })

    // Wait for all fundamental data requests
    const fundamentalResults = await Promise.all(fundamentalPromises)
    
    // Create market cap lookup map
    const marketCapMap = new Map()
    fundamentalResults.forEach(result => {
      if (result.marketCap > 0) {
        marketCapMap.set(result.code, result.marketCap)
      }
    })

    console.log(`📈 Got market cap data for ${marketCapMap.size} stocks`)

    // Filter by minimum market cap (1 billion USD)
    const minMarketCap = 1000000000 // 1 billion USD
    const filteredEarnings = usEarnings.filter((earning: any) => {
      const marketCap = marketCapMap.get(earning.code)
      return marketCap && marketCap >= minMarketCap
    })

    console.log(`💎 Filtered to ${filteredEarnings.length} stocks with market cap >= $1B`)

    let inserted = 0
    let errors = 0

    // Process each earning
    for (const earning of filteredEarnings) {
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

    console.log(`✅ Filtered sync completed: ${inserted} inserted, ${errors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Filtered earnings synchronized',
        processed: usEarnings.length,
        filtered: filteredEarnings.length,
        inserted: inserted,
        errors: errors,
        dateRange: { from: fromDate, to: toDate },
        minMarketCap: minMarketCap
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
