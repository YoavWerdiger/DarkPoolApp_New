// Smart Economic Poller - Edge Function
// בודק אירועים חשובים בקרוב ומעדכן תדירות polling

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

serve(async (req) => {
  try {
    console.log('🔍 Smart Economic Poller started')
    
    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)
    
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const dayAfterStr = dayAfter.toISOString().split('T')[0]
    
    console.log(`📅 Checking for important events on ${tomorrowStr} and ${dayAfterStr}`)
    
    // חיפוש אירועים חשובים בקרוב
    const { data: upcomingEvents, error } = await supabase
      .from('economic_events')
      .select('*')
      .in('importance', ['high', 'medium']) // אדום + כתום
      .gte('date', tomorrowStr)
      .lte('date', dayAfterStr)
      .order('date', { ascending: true })
    
    if (error) {
      console.log('❌ Error fetching upcoming events:', error)
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), { status: 500 })
    }
    
    console.log(`📊 Found ${upcomingEvents?.length || 0} important upcoming events`)
    
    if (upcomingEvents && upcomingEvents.length > 0) {
      // יש אירועים חשובים - נעדכן תדירות polling
      console.log('🚨 Important events detected - increasing polling frequency')
      
      // כאן נוכל להוסיף לוגיקה לעדכון תדירות polling
      // לדוגמה: עדכון cron job או שליחת התראות
      
      // שליחת התראות למשתמשים
      const notifications = upcomingEvents.map(event => ({
        title: `אירוע כלכלי חשוב מחר`,
        body: `${event.title} - ${event.date}`,
        data: {
          eventId: event.id,
          date: event.date,
          importance: event.importance
        }
      }))
      
      console.log(`📱 Prepared ${notifications.length} notifications`)
      
      // TODO: Send push notifications to users
      
      return new Response(JSON.stringify({
        success: true,
        message: `Found ${upcomingEvents.length} important upcoming events`,
        events: upcomingEvents,
        notifications: notifications,
        pollingFrequency: 'high' // נגיד למערכת להגדיל תדירות
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    } else {
      // אין אירועים חשובים - נחזיר לתדירות רגילה
      console.log('✅ No important events upcoming - normal polling frequency')
      
      return new Response(JSON.stringify({
        success: true,
        message: 'No important upcoming events',
        events: [],
        pollingFrequency: 'normal'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }
    
  } catch (error) {
    console.error('❌ Smart Economic Poller error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

