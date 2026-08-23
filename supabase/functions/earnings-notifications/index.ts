import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import {
  buildEarningsUpcomingBody,
  earningsUpcomingTitle,
} from '../_shared/notificationBidi.ts'
import {
  claimEarningsNotificationSlot,
  deriveEarningsDateTimeIso,
  fetchEarningsNotificationUsers,
  normalizeEarningsTicker,
} from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

function dateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 Starting Earnings Notifications Check...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    // יום מסחר לפי ET (לא UTC) — דיווחי AMC ליד חצות לא ייעלמו בטעות
    const etToday = dateInTimeZone(now, 'America/New_York')
    const minutesFromNow = 15

    const { data: upcomingReports, error: reportsError } = await supabase
      .from('earnings_calendar')
      .select('id, code, ticker, company_name, report_date, earnings_date_time, before_after_market, actual, estimate, revenue_estimate_avg, revenue_estimate, reminder_push_sent_at')
      .eq('report_date', etToday)
      .is('actual', null)
      .is('reminder_push_sent_at', null)
      .or('importance.gte.3,importance.is.null')
      .like('code', '%.US')
      .order('earnings_date_time', { ascending: true })
      .limit(50)

    if (reportsError) {
      throw new Error(`Failed to fetch upcoming reports: ${reportsError.message}`)
    }

    console.log(`📊 Found ${upcomingReports?.length || 0} upcoming reports for ET date ${etToday}`)

    if (!upcomingReports || upcomingReports.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No upcoming earnings reports',
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

    const formatRevenue = (val: number | null | undefined): string => {
      if (val == null || isNaN(val)) return ''
      const abs = Math.abs(val)
      if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
      if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `$${(val / 1e6).toFixed(1)}M`
      if (abs >= 1e3) return `$${(val / 1e3).toFixed(1)}K`
      return `$${val.toFixed(2)}`
    }

    for (const report of upcomingReports) {
      const earningsDateTime =
        report.earnings_date_time
        ?? deriveEarningsDateTimeIso(report.report_date, report.before_after_market)

      const reportTimeUTC = new Date(earningsDateTime)
      if (Number.isNaN(reportTimeUTC.getTime())) {
        console.warn(`⚠️ Invalid earnings_date_time for ${report.code}: ${earningsDateTime}`)
        continue
      }

      // השוואה אבסולוטית ב-UTC — לא minute-of-day בשעון ישראל
      // (שגרמה לכל BMO להיראות כ-15:00 ישראל בגלל 12:00Z)
      const minutesDiff = Math.round((reportTimeUTC.getTime() - now.getTime()) / 60000)

      // רק חלון 0..17 דקות לפני זמן הדיווח המשוער (BMO/AMC)
      if (minutesDiff < 0 || minutesDiff > minutesFromNow + 2) continue

      const timeDisplay = report.before_after_market === 'BeforeMarket' ? 'לפני פתיחה' : 'אחרי סגירה'
      const ticker = normalizeEarningsTicker(report.ticker, report.code)
      const companyName = report.company_name || ticker
      const reportDate = String(report.report_date ?? '').slice(0, 10)

      if (!ticker || !reportDate) continue

      const revEstimate = report.revenue_estimate_avg ?? report.revenue_estimate ?? null
      let revenueEstimateStr: string | null = null
      if (revEstimate != null && !isNaN(Number(revEstimate))) {
        revenueEstimateStr = formatRevenue(Number(revEstimate))
      }

      const epsEstimateStr =
        report.estimate != null && !isNaN(Number(report.estimate))
          ? `$${Number(report.estimate).toFixed(2)}`
          : null

      const body = buildEarningsUpcomingBody(
        timeDisplay,
        minutesDiff,
        epsEstimateStr,
        revenueEstimateStr,
      )

      let processedUsers = 0

      for (const user of usersWithNotifications) {
        const claimed = await claimEarningsNotificationSlot(supabase, {
          userId: user.user_id,
          ticker,
          reportDate,
          notificationType: 'reminder_15m',
          earningsReportId: report.id ?? null,
        })
        if (!claimed) {
          skippedAlreadySent++
          processedUsers++
          continue
        }

        const { error: insertError } = await supabase
          .from('pending_notifications')
          .insert({
            user_id: user.user_id,
            notification_type: 'earnings',
            title: earningsUpcomingTitle(companyName),
            body,
            data: {
              type: 'earnings',
              durable_type: 'reminder_15m',
              earnings_report_id: report.id,
              ticker: ticker,
              company_name: companyName,
              code: report.code,
              report_date: reportDate,
              before_after_market: report.before_after_market,
              earnings_date_time: earningsDateTime,
              minutes_until: minutesDiff
            },
            is_sent: false
          })

        if (insertError) {
          if ((insertError as { code?: string }).code === '23505') {
            console.log(`⏭️ Upcoming notification already exists (unique) for user ${user.user_id} / ${ticker}`)
          } else {
            console.error(`❌ Error creating notification for ${ticker}:`, insertError)
          }
        } else {
          notificationsCreated++
          console.log(`✅ Created notification for ${ticker} (${companyName}) - ${minutesDiff} minutes`)
        }
        processedUsers++
      }

      if (processedUsers >= usersWithNotifications.length && report.id) {
        await supabase
          .from('earnings_calendar')
          .update({ reminder_push_sent_at: new Date().toISOString() })
          .eq('id', report.id)
      }
    }

    console.log(
      `✅ Created ${notificationsCreated} notifications (skipped_already_sent=${skippedAlreadySent})`,
    )

    if (notificationsCreated > 0) {
      await flushPendingNotifications(supabaseUrl, supabaseServiceKey)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings notifications check completed',
        et_trading_date: etToday,
        upcoming_reports: upcomingReports.length,
        users_with_notifications: usersWithNotifications.length,
        notifications_created: notificationsCreated,
        skipped_already_sent: skippedAlreadySent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in earnings-notifications:', error)
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
