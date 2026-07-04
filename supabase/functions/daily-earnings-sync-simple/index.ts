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
    console.log('🚀 Starting Earnings sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing Supabase configuration'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Benzinga API Key
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY')
    if (!benzingaApiKey) {
      return new Response(JSON.stringify({ error: 'BENZINGA_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    // חישוב טווח תאריכים - שבוע אחורה + 3 חודשים קדימה
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 7)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]
    const pageSize = 1000

    console.log(`📅 Fetching earnings from ${fromDate} to ${toDate} (with pagination)...`)

    const allEarnings: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/earnings')
      apiUrl.searchParams.append('token', benzingaApiKey)
      apiUrl.searchParams.append('accept', 'application/json')
      apiUrl.searchParams.append('parameters[date_from]', fromDate)
      apiUrl.searchParams.append('parameters[date_to]', toDate)
      apiUrl.searchParams.append('pagesize', String(pageSize))
      apiUrl.searchParams.append('parameters[page]', String(page))

      const response = await fetch(apiUrl.toString())
      if (!response.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Benzinga API error: ${response.status} ${response.statusText}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      const rawText = await response.text()
      let data: { earnings?: any[] }

      if (rawText.trimStart().startsWith('<')) {
        const items: any[] = []
        const itemRegex = /<item>(.*?)<\/item>/gs
        const matches = rawText.matchAll(itemRegex)
        for (const match of matches) {
          const itemXml = match[1]
          const tickerMatch = itemXml.match(/<ticker>(.*?)<\/ticker>/)
          const dateMatch = itemXml.match(/<date>(.*?)<\/date>/)
          const timeMatch = itemXml.match(/<time>(.*?)<\/time>/)
          const nameMatch = itemXml.match(/<name>(.*?)<\/name>/)
          const epsMatch = itemXml.match(/<eps>(.*?)<\/eps>/)
          const epsEstMatch = itemXml.match(/<eps_est>(.*?)<\/eps_est>/)
          const revenueMatch = itemXml.match(/<revenue>(.*?)<\/revenue>/)
          const revenueEstMatch = itemXml.match(/<revenue_est>(.*?)<\/revenue_est>/)
          const currencyMatch = itemXml.match(/<currency>(.*?)<\/currency>/)
          if (tickerMatch && dateMatch) {
            items.push({
              ticker: tickerMatch[1],
              date: dateMatch[1],
              time: timeMatch?.[1] ?? '',
              name: nameMatch?.[1] ?? tickerMatch[1],
              eps: epsMatch?.[1] ?? '',
              eps_est: epsEstMatch?.[1] ?? '',
              revenue: revenueMatch?.[1] ?? '',
              revenue_est: revenueEstMatch?.[1] ?? '',
              currency: currencyMatch?.[1] ?? 'USD'
            })
          }
        }
        data = { earnings: items }
      } else {
        try {
          data = JSON.parse(rawText)
        } catch {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Benzinga API returned invalid JSON (and not XML)'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
      }

      const pageEarnings = data?.earnings ?? []
      allEarnings.push(...pageEarnings)
      console.log(`📈 Page ${page}: received ${pageEarnings.length} items (total so far: ${allEarnings.length})`)

      if (pageEarnings.length < pageSize) {
        hasMore = false
      } else {
        page++
        if (page > 20) {
          console.log('⚠️ Stopping after 20 pages to avoid timeout')
          hasMore = false
        } else {
          await new Promise(r => setTimeout(r, 300))
        }
      }
    }

    const data = { earnings: allEarnings }
    console.log('📈 Received earnings data (all pages):', data.earnings.length, 'items')

    if (!data.earnings || !Array.isArray(data.earnings)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid response format from Benzinga API'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // המרת Benzinga earnings לפורמט EODHD (תואם ל-earnings-utils)
    const convertedEarnings = data.earnings.map((earning: any) => {
      let before_after_market: string | null = null;
      if (earning.time) {
        const hour = parseInt(earning.time.split(':')[0]);
        if (hour >= 4 && hour < 10) {
          before_after_market = 'Before Market';
        } else if (hour >= 16 && hour < 20) {
          before_after_market = 'After Market';
        }
      }

      let actual: number | null = null;
      let estimate: number | null = null;
      let difference: number | null = null;
      let percent: number | null = null;

      if (earning.eps && earning.eps !== '') {
        actual = parseFloat(earning.eps);
        if (!isNaN(actual)) {
          if (earning.eps_est && earning.eps_est !== '') {
            estimate = parseFloat(earning.eps_est);
            if (!isNaN(estimate)) {
              difference = actual - estimate;
              percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
            }
          }
        }
      } else if (earning.revenue && earning.revenue !== '') {
        actual = parseFloat(earning.revenue);
        if (!isNaN(actual)) {
          if (earning.revenue_est && earning.revenue_est !== '') {
            estimate = parseFloat(earning.revenue_est);
            if (!isNaN(estimate)) {
              difference = actual - estimate;
              percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
            }
          }
        }
      }

      const tickerCode = earning.ticker.includes('.') ? earning.ticker : `${earning.ticker}.US`;

      return {
        code: tickerCode,
        name: earning.name || earning.ticker,
        report_date: earning.date,
        date: earning.date,
        before_after_market,
        currency: earning.currency || 'USD',
        actual,
        estimate,
        difference,
        percent,
      };
    })

    let totalProcessed = 0
    let totalInserted = 0

    // עיבוד כל דיווח תוצאות
    for (const earnings of convertedEarnings) {
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

        // הטבלה: id=UUID, unique(code,report_date). שולחים רק עמודות שקיימות בטבלה.
        const r = prepared.record
        const recordForUpsert: Record<string, unknown> = {
          code: r.code,
          report_date: r.report_date,
          date: r.date,
          before_after_market: r.before_after_market,
          currency: r.currency,
          actual: r.actual,
          estimate: r.estimate,
          difference: r.difference,
          percent: r.percent,
          source: r.source,
          updated_at: r.updated_at,
          company_name: r.company_name ?? null,
          period: r.period ?? null,
          period_year: r.period_year ?? null,
          time: r.time ?? null,
          eps_prior: r.eps_prior ?? null,
          eps_surprise: r.eps_surprise ?? null,
          eps_surprise_percent: r.eps_surprise_percent ?? null,
          revenue_actual: r.revenue_actual ?? null,
          revenue_estimate_avg: r.revenue_estimate_avg ?? null,
          importance: r.importance ?? null,
        }
        const { error } = await supabase
          .from('earnings_calendar')
          .upsert(recordForUpsert, {
            onConflict: 'code,report_date',
            ignoreDuplicates: false
          })

        if (error) {
          console.error('❌ Error upserting earnings:', error.message, error.details)
        } else {
          totalInserted++
        }

      } catch (error) {
        console.error('❌ Error processing earnings:', error)
      }
    }

    console.log(`✅ Earnings sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings synchronized successfully',
        processed: totalProcessed,
        inserted: totalInserted,
        dateRange: `${fromDate} to ${toDate}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Earnings sync error:', error)
    
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? String(error.message) 
      : 'Unknown error occurred'

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
