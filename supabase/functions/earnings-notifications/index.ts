import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      .select('id, code, ticker, company_name, report_date, earnings_date_time, before_after_market, actual, estimate')
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

      // יצירת התראה לכל משתמש
      for (const user of usersWithNotifications) {
        // בדיקה אם כבר יש התראה על הדיווח הזה למשתמש הזה
        const { data: existingNotification } = await supabase
          .from('pending_notifications')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('notification_type', 'earnings')
          .eq('is_sent', false)
          .like('body', `%${ticker}%`)
          .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // ב-30 דקות האחרונות
          .limit(1)

        if (existingNotification && existingNotification.length > 0) {
          continue // כבר יש התראה
        }

        // יצירת התראה
        const { error: insertError } = await supabase
          .from('pending_notifications')
          .insert({
            user_id: user.user_id,
            notification_type: 'earnings',
            title: `דיווח רווחים ${timeDisplay}`,
            body: `${companyName} (${ticker}) - דיווח ${timeDisplay} בעוד ${minutesDiff} דקות`,
            data: {
              type: 'earnings',
              ticker: ticker,
              code: report.code,
              report_date: report.report_date,
              before_after_market: report.before_after_market,
              earnings_date_time: report.earnings_date_time,
              minutes_until: minutesDiff
            },
            is_sent: false
          })

        if (insertError) {
          console.error(`❌ Error creating notification for ${ticker}:`, insertError)
        } else {
          notificationsCreated++
          console.log(`✅ Created notification for ${ticker} (${companyName}) - ${minutesDiff} minutes`)
        }
      }
    }

    console.log(`✅ Created ${notificationsCreated} notifications`)

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





