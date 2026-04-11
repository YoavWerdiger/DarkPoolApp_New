import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        if (!report.actual || report.actual === 0) {
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
    
    // אם אין נתונים מה-trigger, נחפש ידנית (רק למקרה של קריאה ידנית לבדיקה)
    if (publishedReports.length === 0) {
      console.log('🔍 Searching for recently published reports manually...')
      const { data: manualReports, error: reportsError } = await supabase
        .from('earnings_calendar')
        .select('id, code, ticker, company_name, report_date, actual, estimate, percent, revenue_actual, revenue_estimate_avg, revenue_surprise_percent, before_after_market, updated_at')
        .eq('report_date', new Date().toISOString().split('T')[0])
        .not('actual', 'is', null)
        .gte('importance', 3)
        .like('code', '%.US')
        .gte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(50)

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

    // ─── עזר: סמל עליה/ירידה
    const surpriseIcon = (pct: number | null | undefined): string => {
      if (pct == null) return ''
      return pct >= 0 ? ' ✅' : ' ❌'
    }

    // ─── עזר: פורמט אחוז הפתעה
    const formatPct = (pct: number | null | undefined): string => {
      if (pct == null) return ''
      const sign = pct >= 0 ? '+' : ''
      return ` (${sign}${pct.toFixed(1)}%)`
    }

    // יצירת התראות לכל דיווח שפורסם
    for (const report of publishedReports) {
      const ticker = report.ticker || report.code.replace('.US', '')
      const companyName = report.company_name || ticker

      // ─── אמוג'י כותרת לפי ה-EPS surprise
      const epsSurprise: number | null = report.percent ?? null
      let titleEmoji = '📊'
      if (epsSurprise != null) {
        if (epsSurprise > 5)  titleEmoji = '🚀'
        else if (epsSurprise < -5) titleEmoji = '📉'
      }

      // ─── כותרת: "Apple דיווחה דוח רבעוני 🚀"
      const notificationTitle = `${companyName} דיווחה דוח רבעוני ${titleEmoji}`

      // ─── שורת EPS
      const epsActual   = formatEps(report.actual)
      const epsEstimate = formatEps(report.estimate)
      const epsLine = `EPS: ${epsActual} vs ${epsEstimate} צפוי${formatPct(epsSurprise)}${surpriseIcon(epsSurprise)}`

      // ─── שורת Revenue (אם קיים)
      const revActual   = report.revenue_actual   ?? null
      const revEstimate = report.revenue_estimate_avg ?? report.revenue_estimate ?? null
      const revSurprisePct: number | null = report.revenue_surprise_percent ?? null
      let revLine = ''
      if (revActual != null) {
        revLine = `\nRevenue: ${formatRevenue(revActual)} vs ${revEstimate != null ? formatRevenue(revEstimate) : 'N/A'} צפוי${formatPct(revSurprisePct)}${surpriseIcon(revSurprisePct)}`
      }

      const notificationBody = epsLine + revLine

      // יצירת התראה לכל משתמש
      for (const user of usersWithNotifications) {
        // בדיקה אם כבר יש התראה על הדיווח הזה למשתמש הזה (ב-30 דקות האחרונות)
        const { data: existingNotification } = await supabase
          .from('pending_notifications')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('notification_type', 'earnings')
          .eq('is_sent', false)
          .like('title', `%${companyName}%`)
          .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .limit(1)

        if (existingNotification && existingNotification.length > 0) {
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
              ticker: ticker,
              code: report.code,
              report_date: report.report_date,
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
          console.error(`❌ Error creating notification for ${ticker}:`, insertError)
        } else {
          notificationsCreated++
          console.log(`✅ Created results notification for ${ticker} (${companyName})`)
        }
      }
    }

    console.log(`✅ Created ${notificationsCreated} result notifications`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings results notifications check completed',
        published_reports: publishedReports.length,
        users_with_notifications: usersWithNotifications.length,
        notifications_created: notificationsCreated
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





