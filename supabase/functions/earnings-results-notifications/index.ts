import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import {
  buildEarningsMetricLine,
  earningsResultsTitle,
} from '../_shared/notificationBidi.ts'
import {
  claimEarningsNotificationSlot,
  fetchEarningsNotificationUsers,
  normalizeEarningsTicker,
} from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** מגביל הצפה כשסנכרון ממלא עשרות/מאות actuals בבת אחת (sweep בלבד) */
const MAX_REPORTS_PER_SWEEP = 30

async function flushPendingNotifications(supabaseUrl: string, serviceKey: string): Promise<void> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/process-pending-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: '{}',
    })
    if (!res.ok) {
      console.warn('⚠️ process-pending-notifications returned', res.status, await res.text())
    }
  } catch (e) {
    console.warn('⚠️ Failed to invoke process-pending-notifications:', e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 Starting Earnings Results Notifications...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // קבלת נתונים מה-trigger (אם נשלח)
    let report: any = null
    try {
      const body = await req.json()
      if (body && body.record) {
        report = body.record
        console.log(`📨 Received trigger data for ${report.ticker || report.code || report.id}`)
        
        // בדיקה שהרשומה עומדת בתנאים
        // actual=0 הוא תוצאה לגיטימית (EPS אפסי) — מדלגים רק כשאין ערך בכלל
        if (report.actual == null) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Report has no actual value - skipping',
              notifications_created: 0
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } catch (e) {
      // אין body או שגיאה - זה בסדר, נמשיך עם חיפוש ידני (למקרה של קריאה ידנית)
      console.log('📝 No trigger data, will search manually (manual call)')
    }

    // אם יש נתונים מה-trigger, נשתמש בהם
    const publishedReports: any[] = report ? [report] : []
    const isSweep = publishedReports.length === 0
    
    // Sweep / קריאה ידנית: תופס actuals שפוספסו (טריגר/pg_net) — יום מסחר ET היום+אתמול
    // רק שורות שעדיין לא סומנו כ-results_push_sent_at (זיכרון ברמת דיווח)
    if (isSweep) {
      console.log('🔍 Searching for recently published reports (ET window sweep)...')
      const etToday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())
      const etYesterdayDate = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
      )
      etYesterdayDate.setDate(etYesterdayDate.getDate() - 1)
      const etYesterday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(etYesterdayDate)

      const { data: manualReports, error: reportsError } = await supabase
        .from('earnings_calendar')
        .select('id, code, ticker, company_name, report_date, actual, estimate, percent, revenue_actual, revenue_estimate_avg, revenue_surprise_percent, before_after_market, updated_at, results_push_sent_at')
        .in('report_date', [etToday, etYesterday])
        .not('actual', 'is', null)
        .is('results_push_sent_at', null)
        .or('importance.gte.3,importance.is.null')
        .like('code', '%.US')
        .gte('updated_at', new Date(Date.now() - 45 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(MAX_REPORTS_PER_SWEEP)

      if (reportsError) {
        throw new Error(`Failed to fetch published reports: ${reportsError.message}`)
      }

      if (manualReports && manualReports.length > 0) {
        publishedReports.push(...manualReports)
      }
    }

    console.log(`📊 Processing ${publishedReports.length} report(s)`)

    if (publishedReports.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No earnings reports to process',
          notifications_created: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const usersWithNotifications = await fetchEarningsNotificationUsers(supabase)

    console.log(`👥 Found ${usersWithNotifications?.length || 0} users with earnings notifications enabled`)

    if (!usersWithNotifications || usersWithNotifications.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users with earnings notifications enabled',
          notifications_created: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let notificationsCreated = 0
    let skippedAlreadySent = 0
    const reportsMarked: string[] = []

    // ─── עזר: פורמט מספר גדול כ-$XB / $XM / $XK
    const formatRevenue = (val: number | null | undefined): string => {
      if (val == null || isNaN(val)) return 'N/A'
      const abs = Math.abs(val)
      if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
      if (abs >= 1e9)  return `$${(val / 1e9).toFixed(2)}B`
      if (abs >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`
      if (abs >= 1e3)  return `$${(val / 1e3).toFixed(1)}K`
      return `$${val.toFixed(2)}`
    }

    // ─── עזר: פורמט EPS
    const formatEps = (val: number | null | undefined): string => {
      if (val == null || isNaN(val)) return 'N/A'
      return `$${val.toFixed(2)}`
    }

    // יצירת התראות לכל דיווח שפורסם
    for (const report of publishedReports) {
      const ticker = normalizeEarningsTicker(report.ticker, report.code)
      const companyName = report.company_name || ticker
      const reportDate = String(report.report_date ?? '').slice(0, 10)

      if (!ticker || !reportDate) {
        console.warn('⚠️ Skipping report without ticker/report_date', report.id)
        continue
      }

      const epsLine = buildEarningsMetricLine(
        'רווחיות',
        'EPS',
        formatEps(report.actual),
        formatEps(report.estimate),
        report.percent ?? null,
      )

      const revActual = report.revenue_actual ?? null
      const revEstimate = report.revenue_estimate_avg ?? report.revenue_estimate ?? null
      const revSurprisePct: number | null = report.revenue_surprise_percent ?? null

      const lines = [epsLine]
      if (revActual != null) {
        lines.push(
          buildEarningsMetricLine(
            'הכנסות',
            'Revenue',
            formatRevenue(revActual),
            revEstimate != null ? formatRevenue(revEstimate) : null,
            revSurprisePct,
          ),
        )
      }

      const notificationTitle = earningsResultsTitle(companyName)
      const notificationBody = lines.join('\n')

      let processedUsers = 0

      // יצירת התראה לכל משתמש
      for (const user of usersWithNotifications) {
        // זיכרון עמיד: (user, ticker, date, results_available) — גם אם report.id התחלף
        const claimed = await claimEarningsNotificationSlot(supabase, {
          userId: user.user_id,
          ticker,
          reportDate,
          notificationType: 'results_available',
          earningsReportId: report.id ?? null,
        })
        if (!claimed) {
          skippedAlreadySent++
          processedUsers++
          continue
        }

        // יצירת התראה
        const { error: insertError } = await supabase
          .from('pending_notifications')
          .insert({
            user_id: user.user_id,
            notification_type: 'earnings',
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'earnings_results',
              durable_type: 'results_available',
              earnings_report_id: report.id,
              ticker: ticker,
              company_name: companyName,
              code: report.code,
              report_date: reportDate,
              actual: report.actual,
              estimate: report.estimate,
              percent: report.percent,
              revenue_actual: report.revenue_actual,
              revenue_estimate_avg: report.revenue_estimate_avg,
              revenue_surprise_percent: report.revenue_surprise_percent
            },
            is_sent: false
          })

        if (insertError) {
          if ((insertError as { code?: string }).code === '23505') {
            console.log(
              `⏭️ Results notification already exists (unique) for user ${user.user_id} / ${ticker}`
            )
          } else {
            console.error(`❌ Error creating notification for ${ticker}:`, insertError)
          }
        } else {
          notificationsCreated++
          console.log(`✅ Created results notification for ${ticker} (${companyName})`)
        }
        processedUsers++
      }

      // סמן ברמת הדיווח כדי ש-sweep לא יחזור על אותו טיקר+תאריך
      if (processedUsers >= usersWithNotifications.length && report.id) {
        const { error: markError } = await supabase
          .from('earnings_calendar')
          .update({ results_push_sent_at: new Date().toISOString() })
          .eq('id', report.id)
        if (markError) {
          // fallback לפי ticker+date אם id לא קיים בטריגר ישן
          await supabase
            .from('earnings_calendar')
            .update({ results_push_sent_at: new Date().toISOString() })
            .eq('report_date', reportDate)
            .or(`ticker.eq.${ticker},code.eq.${ticker}.US`)
        }
        reportsMarked.push(ticker)
      }
    }

    console.log(
      `✅ Created ${notificationsCreated} result notifications (skipped_already_sent=${skippedAlreadySent}, marked=${reportsMarked.length})`,
    )

    if (notificationsCreated > 0) {
      await flushPendingNotifications(supabaseUrl, supabaseServiceKey)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings results notifications check completed',
        published_reports: publishedReports.length,
        users_with_notifications: usersWithNotifications.length,
        notifications_created: notificationsCreated,
        skipped_already_sent: skippedAlreadySent,
        reports_marked: reportsMarked.length,
        is_sweep: isSweep,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in earnings-results-notifications:', error)
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
