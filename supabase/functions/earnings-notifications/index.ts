import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import {
  buildEarningsUpcomingBody,
  earningsUpcomingTitle,
} from '../_shared/notificationBidi.ts'

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

interface EarningsReport {
  id: string;
  code: string;
  ticker: string | null;
  company_name: string | null;
  report_date: string;
  earnings_date_time: string | null;
  before_after_market: string | null;
  actual: number | null;
  estimate: number | null;
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
    
    // המרת הזמן הנוכחי לשעון ישראל (כשעות ודקות)
    const israelNowStr = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Jerusalem',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    const [israelHour, israelMinute, israelSecond] = israelNowStr.split(':').map(Number)
    const israelNowMinutes = israelHour * 60 + israelMinute
    
    // בדיקת דיווחים ב-15 דקות הקרובות
    const minutesFromNow = 15
    
    // חיפוש דיווחים שעדיין לא פורסמו (אין actual) ושצפויים ב-15 דקות הקרובות
    const { data: upcomingReports, error: reportsError } = await supabase
      .from('earnings_calendar')
      .select('id, code, ticker, company_name, report_date, earnings_date_time, before_after_market, actual, estimate, revenue_estimate_avg, revenue_estimate')
      .eq('report_date', now.toISOString().split('T')[0])
      .is('actual', null) // רק דיווחים שעדיין לא פורסמו
      .gte('importance', 3) // רק חשובים
      .like('code', '%.US')
      .order('earnings_date_time', { ascending: true })
      .limit(50)

    if (reportsError) {
      throw new Error(`Failed to fetch upcoming reports: ${reportsError.message}`)
    }

    console.log(`📊 Found ${upcomingReports?.length || 0} upcoming reports`)

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

    // קבלת כל המשתמשים עם התראות earnings מופעלות
    const { data: usersWithNotifications, error: usersError } = await supabase
      .from('user_notification_settings')
      .select('user_id')
      .eq('notifications_enabled', true)
      .eq('earnings_notifications', true)

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

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

    const formatRevenue = (val: number | null | undefined): string => {
      if (val == null || isNaN(val)) return ''
      const abs = Math.abs(val)
      if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
      if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `$${(val / 1e6).toFixed(1)}M`
      if (abs >= 1e3) return `$${(val / 1e3).toFixed(1)}K`
      return `$${val.toFixed(2)}`
    }

    // יצירת התראות לכל דיווח קרוב
    for (const report of upcomingReports) {
      // בדיקת זמן הדיווח
      if (!report.earnings_date_time) continue
      
      // המרת זמן הדיווח לשעון ישראל
      const reportTimeUTC = new Date(report.earnings_date_time)
      const reportTimeIsraelStr = reportTimeUTC.toLocaleString('en-US', { 
        timeZone: 'Asia/Jerusalem',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      const [reportHour, reportMinute, reportSecond] = reportTimeIsraelStr.split(':').map(Number)
      const reportTimeMinutes = reportHour * 60 + reportMinute
      
      // חישוב ההבדל בדקות (בשעון ישראל)
      let minutesDiff = reportTimeMinutes - israelNowMinutes
      
      // אם הדיווח למחר (reportTimeMinutes קטן מ-israelNowMinutes), נדלג
      if (minutesDiff < 0) {
        // יכול להיות שהדיווח הוא למחר - נבדוק לפי report_date
        const reportDate = new Date(report.report_date)
        const todayDate = new Date(now.toISOString().split('T')[0])
        if (reportDate.getTime() > todayDate.getTime()) {
          // זה למחר - נחשב את ההבדל כולל יום
          minutesDiff = (24 * 60 - israelNowMinutes) + reportTimeMinutes
        } else {
          continue // זה אתמול - נדלג
        }
      }
      
      // רק אם הדיווח ב-15 דקות הקרובות (עם טולרנס של 2 דקות)
      if (minutesDiff > minutesFromNow + 2) continue

      const timeDisplay = report.before_after_market === 'BeforeMarket' ? 'לפני פתיחה' : 'אחרי סגירה'
      const ticker = report.ticker || report.code.replace('.US', '')
      const companyName = report.company_name || ticker

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

      // יצירת התראה לכל משתמש
      for (const user of usersWithNotifications) {
        // בדיקת כפילות לפי מזהה דיווח (לא is_sent) — אחרי שליחה השורה נשארת is_sent=true
        // אחרת ה-cron יחזור על אותו דיווח וייצר עוד push
        const { data: existingAny } = await supabase
          .from('pending_notifications')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('notification_type', 'earnings')
          .contains('data', { type: 'earnings', earnings_report_id: report.id })
          .limit(1)

        if (existingAny && existingAny.length > 0) {
          continue
        }

        // יצירת התראה
        const { error: insertError } = await supabase
          .from('pending_notifications')
          .insert({
            user_id: user.user_id,
            notification_type: 'earnings',
            title: earningsUpcomingTitle(companyName),
            body,
            data: {
              type: 'earnings',
              earnings_report_id: report.id,
              ticker: ticker,
              company_name: companyName,
              code: report.code,
              report_date: report.report_date,
              before_after_market: report.before_after_market,
              earnings_date_time: report.earnings_date_time,
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
      }
    }

    console.log(`✅ Created ${notificationsCreated} notifications`)

    if (notificationsCreated > 0) {
      await flushPendingNotifications(supabaseUrl, supabaseServiceKey)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings notifications check completed',
        upcoming_reports: upcomingReports.length,
        users_with_notifications: usersWithNotifications.length,
        notifications_created: notificationsCreated
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





