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
    console.log('🚀 Starting Earnings sync with EODHD API...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY') || '68e3c3af900997.85677801'
    
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

    // קריאת פרמטרים מה-body או שימוש בברירת מחדל
    const body = await req.json().catch(() => ({}))
    const fromDate = body.date_from || body.from || (() => {
      const date = new Date()
      date.setMonth(date.getMonth() - 3) // 3 חודשים אחורה
      return date.toISOString().split('T')[0]
    })()
    const toDate = body.date_to || body.to || (() => {
      const date = new Date()
      date.setMonth(date.getMonth() + 12) // שנה קדימה
      return date.toISOString().split('T')[0]
    })()

    console.log(`📅 Fetching earnings from EODHD: ${fromDate} to ${toDate}`)

    // קריאה ל-EODHD API
    // EODHD מחזיר אובייקט שבו המפתחות הם תאריכים והערכים הם מערכים של דיווחים
    const apiUrl = `https://eodhd.com/api/calendar/earnings?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    
    console.log(`📡 Calling EODHD API...`)
    console.log(`📡 URL: ${apiUrl.replace(eodhdApiKey, '***')}`)
    
    const response = await fetch(apiUrl)
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ EODHD API Error: ${errorText.substring(0, 500)}`)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `EODHD API error: ${response.status} ${response.statusText}`,
          details: errorText.substring(0, 200)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const data = await response.json()
    
    console.log(`📊 EODHD Response type: ${typeof data}`)
    console.log(`📊 EODHD Response keys: ${data && typeof data === 'object' ? Object.keys(data).slice(0, 10).join(', ') : 'N/A'}`)
    
    // EODHD מחזיר אובייקט שבו המפתחות הם תאריכים
    // פורמט: { "2025-01-15": [...], "2025-01-16": [...], ... }
    let allEarnings: any[] = []
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      // המרת האובייקט למערך של דיווחים
      Object.entries(data).forEach(([date, reports]: [string, any]) => {
        if (Array.isArray(reports)) {
          const dateReports = reports.map((report: any) => ({
            ...report,
            report_date: date,
            date: report.date || date,
            // המרה לפורמט Benzinga-like כדי ש-prepareEarningsRecord יעבוד
            code: report.code || report.symbol,
            ticker: report.ticker || report.code?.replace('.US', '') || report.symbol?.replace('.US', ''),
            name: report.name || report.company_name,
            exchange: report.exchange || 'US',
            period: report.period || report.quarter,
            period_year: report.period_year || report.year,
            eps: report.eps || report.eps_actual,
            eps_est: report.eps_est || report.eps_estimate,
            eps_prior: report.eps_prior || report.eps_previous,
            revenue: report.revenue || report.revenue_actual,
            revenue_est: report.revenue_est || report.revenue_estimate,
            revenue_prior: report.revenue_prior || report.revenue_previous,
            time: report.time || report.announcement_time || '08:00:00',
            currency: report.currency || 'USD',
            importance: report.importance || 3,
            updated: report.updated || Date.now()
          }))
          allEarnings.push(...dateReports)
        }
      })
      
      console.log(`✅ Parsed ${allEarnings.length} earnings from EODHD`)
    } else if (Array.isArray(data)) {
      // אם זה מערך ישיר
      allEarnings = data
      console.log(`✅ Received ${allEarnings.length} earnings as array`)
    } else {
      console.error(`❌ Unexpected EODHD response format:`, typeof data)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unexpected EODHD response format',
          responseType: typeof data
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    if (allEarnings.length === 0) {
      console.log(`⚠️ WARNING: No earnings fetched from EODHD!`)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No earnings found in date range',
          total: 0,
          dateRange: `${fromDate} to ${toDate}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`📈 Total earnings fetched: ${allEarnings.length}`)

    // עיבוד ושמירה
    const processedRecords: any[] = []
    const duplicates = new Set<string>()
    let skipped = 0

    for (const earning of allEarnings) {
      try {
        // המרה לפורמט שמובן ל-prepareEarningsRecord
        const prepared = prepareEarningsRecord(earning, {
          // NO FILTERING - שומרים את כל מה שיש
        })

        if (!prepared) {
          skipped++
          continue
        }

        // בדיקת כפילויות
        const recordId = `${prepared.record.code}_${prepared.record.report_date}_${prepared.record.period}_${prepared.record.period_year}`
        if (duplicates.has(recordId)) {
          skipped++
          continue
        }
        duplicates.add(recordId)

        processedRecords.push(prepared.record)
      } catch (error) {
        console.error(`❌ Error processing earnings record:`, error)
        skipped++
      }
    }

    console.log(`📊 Processed ${processedRecords.length} unique earnings`)
    console.log(`   ├─ Skipped: ${skipped}`)
    console.log(`   └─ Unique: ${processedRecords.length}`)

    // שמירה ב-batch
    if (processedRecords.length > 0) {
      console.log(`💾 Saving ${processedRecords.length} earnings to database...`)
      
      const { error } = await supabase
        .from('earnings_calendar')
        .upsert(processedRecords, { 
          onConflict: 'id',
          ignoreDuplicates: false
        })

      if (error) {
        console.error('❌ Error saving to DB:', error)
        throw error
      }
      
      console.log(`✅ Successfully saved ${processedRecords.length} earnings`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Earnings sync completed`,
        total: processedRecords.length,
        skipped: skipped,
        dateRange: `${fromDate} to ${toDate}`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Earnings sync error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})





