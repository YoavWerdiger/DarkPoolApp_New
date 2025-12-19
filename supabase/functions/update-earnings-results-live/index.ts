import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EarningsEntry {
  company_name: string;
  eps_actual?: string | number | null;
  eps_estimate?: string | number | null;
  quarter?: string | null;
  report_date: string;
  report_time?: string | null;
  revenue_actual?: string | number | null;
  revenue_estimate?: string | number | null;
  ticker: string;
}

// פונקציה להמרת מספרים (B, M, K)
function parseNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  
  let str = val.toString().trim().toUpperCase();
  let multiplier = 1;
  
  if (str.endsWith('B')) {
    multiplier = 1_000_000_000;
    str = str.slice(0, -1);
  } else if (str.endsWith('M')) {
    multiplier = 1_000_000;
    str = str.slice(0, -1);
  } else if (str.endsWith('K')) {
    multiplier = 1_000;
    str = str.slice(0, -1);
  }
  
  // הסרת $ וסימנים אחרים
  str = str.replace(/[$,]/g, '');
  const num = parseFloat(str);
  
  if (isNaN(num)) return null;
  return num * multiplier;
}

// פונקציה להמרת report_time ל-before_after_market
function parseReportTime(reportTime: string | null | undefined): string | null {
  if (!reportTime) return null;
  
  const time = reportTime.toLowerCase();
  if (time.includes('before') || time.includes('pre-market')) {
    return 'BeforeMarket';
  }
  if (time.includes('after') || time.includes('post-market') || time.includes('after market close')) {
    return 'AfterMarket';
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Live Earnings Results Update...')

    // בדיקת שעות - רק בזמני דיווחים (שעון ישראל)
    const now = new Date();
    // המרה לשעון ישראל
    const israelTimeStr = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Jerusalem',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    const [israelHour, israelMinute] = israelTimeStr.split(':').map(Number);
    const israelTimeMinutes = israelHour * 60 + israelMinute; // המרה לדקות מהתחלת היום
    
    // זמני דיווחים (שעון ישראל):
    // אחרי צהריים: 15:30-17:00 (אחרי סגירה)
    // לילה: 22:30-00:00 (אחרי סגירה)
    const afternoonStart = 15 * 60 + 30; // 15:30
    const afternoonEnd = 17 * 60; // 17:00
    const nightStart = 22 * 60 + 30; // 22:30
    const nightEnd = 24 * 60; // 00:00 (24:00 = סוף היום)
    
    const isAfternoonWindow = israelTimeMinutes >= afternoonStart && israelTimeMinutes < afternoonEnd;
    // לילה: 22:30-00:00 = מ-22:30 עד סוף היום (24:00) או מ-00:00 עד 00:00 (אבל זה לא נכון, אז רק 22:30-24:00)
    const isNightWindow = israelTimeMinutes >= nightStart; // 22:30 עד סוף היום
    
    if (!isAfternoonWindow && !isNightWindow) {
      console.log(`⏰ Outside earnings release windows (current time: ${israelTimeStr} Israel time). Skipping update.`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Outside earnings release windows - update skipped',
          current_time_israel: israelTimeStr,
          release_windows: {
            afternoon: '15:30-17:00 Israel time',
            night: '22:30-00:00 Israel time'
          },
          updated_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Within earnings release window (time: ${israelTimeStr} Israel time - ${isAfternoonWindow ? 'Afternoon' : 'Night'} window)`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const earningsApiKey = Deno.env.get('EARNINGS_API_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    if (!earningsApiKey) {
      throw new Error('Missing EARNINGS_API_KEY environment variable')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // שליפת תוצאות היום מה-API החדש
    console.log('📡 Fetching today\'s actuals from API...')
    const updateUrl = 'https://api.parse.bot/scraper/19f29e4b-4d7f-4a6e-9fd5-61a2a712543d/update_actuals_for_today'
    
    const apiResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': earningsApiKey
      },
      body: JSON.stringify({})
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      throw new Error(`Failed to fetch today's actuals: ${apiResponse.status} - ${errorText}`)
    }

    const filteredEntries: EarningsEntry[] = await apiResponse.json()

    if (!Array.isArray(filteredEntries)) {
      throw new Error('Invalid API response format - expected array')
    }

    console.log(`✅ Fetched ${filteredEntries.length} entries with actuals for today`)

    if (filteredEntries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No earnings entries with actuals found',
          updated_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // שלב 4: עדכון הטבלה עם התוצאות
    console.log('💾 Step 4: Updating database with actual results...')
    let updatedCount = 0
    let errorCount = 0

    for (const entry of filteredEntries) {
      try {
        const ticker = entry.ticker.toUpperCase()
        const code = `${ticker}.US`
        const reportDate = entry.report_date

        // המרת ערכים
        const epsActual = parseNumber(entry.eps_actual)
        const epsEstimate = parseNumber(entry.eps_estimate)
        const revenueActual = parseNumber(entry.revenue_actual)
        const revenueEstimate = parseNumber(entry.revenue_estimate)
        const beforeAfterMarket = parseReportTime(entry.report_time)

        // חישוב surprise אם יש actual ו-estimate
        let epsSurprise = null
        let epsSurprisePercent = null
        if (epsActual !== null && epsEstimate !== null && epsEstimate !== 0) {
          epsSurprise = epsActual - epsEstimate
          epsSurprisePercent = ((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100
        }

        let revenueSurprise = null
        let revenueSurprisePercent = null
        if (revenueActual !== null && revenueEstimate !== null && revenueEstimate !== 0) {
          revenueSurprise = revenueActual - revenueEstimate
          revenueSurprisePercent = ((revenueActual - revenueEstimate) / Math.abs(revenueEstimate)) * 100
        }

        // חיפוש רשומה קיימת - נחפש לפי ticker או code
        const { data: existingRecords, error: searchError } = await supabase
          .from('earnings_calendar')
          .select('id, ticker, code, report_date')
          .eq('report_date', reportDate)
          .or(`ticker.eq.${ticker},code.eq.${code}`)
          .limit(1)

        if (searchError) {
          console.error(`❌ Error searching for ${code} (${reportDate}):`, searchError)
          errorCount++
        } else {

        const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null

        if (existing) {
          // עדכון רשומה קיימת
          const updateData: any = {
            updated_at: new Date().toISOString()
          }

          // עדכון EPS אם יש
          if (epsActual !== null) {
            updateData.actual = epsActual
            if (epsEstimate !== null) {
              updateData.estimate = epsEstimate
            }
            if (epsSurprise !== null) {
              updateData.difference = epsSurprise
            }
            if (epsSurprisePercent !== null) {
              updateData.percent = epsSurprisePercent
            }
          }

          // עדכון Revenue אם יש
          if (revenueActual !== null) {
            updateData.revenue_actual = revenueActual
            if (revenueEstimate !== null) {
              updateData.revenue_estimate_avg = revenueEstimate
              updateData.revenue_estimate = revenueEstimate
            }
            if (revenueSurprise !== null) {
              updateData.revenue_surprise = revenueSurprise
            }
            if (revenueSurprisePercent !== null) {
              updateData.revenue_surprise_percent = revenueSurprisePercent
            }
          }

          // עדכון שדות נוספים
          if (beforeAfterMarket) {
            updateData.before_after_market = beforeAfterMarket
          }
          if (entry.company_name) {
            updateData.company_name = entry.company_name
            updateData.asset_name = entry.company_name
          }
          if (entry.quarter) {
            updateData.quarter = entry.quarter
          }

          const { error: updateError } = await supabase
            .from('earnings_calendar')
            .update(updateData)
            .eq('id', existing.id)

          if (updateError) {
            console.error(`❌ Error updating ${code} (${reportDate}):`, updateError)
            errorCount++
          } else {
            console.log(`✅ Updated ${code} (${reportDate})`)
            updatedCount++
          }
        } else {
          console.log(`⚠️ No existing record found for ${code} (${reportDate}) - skipping`)
          // אפשר להוסיף יצירת רשומה חדשה כאן אם צריך
        }
        } // סוגר את ה-else של searchError
      } catch (error) {
        console.error(`❌ Error processing entry ${entry.ticker}:`, error)
        errorCount++
      }
    }

    console.log(`✅ Update completed: ${updatedCount} updated, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings results updated successfully',
        updated_count: updatedCount,
        error_count: errorCount,
        total_entries: filteredEntries.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in update-earnings-results-live:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})




