// Check Today Economic Results - Finnhub Version
// בודקת ומעדכנת תוצאות (actual values) רק לאירועים של היום באמצעות Finnhub API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY') ?? ''
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send'

// 🔑 Expo Access Token נדרש לשליחת התראות ל-production builds
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || ''

// המרת תאריך מ-Finnhub (ISO 8601) לתאריך ושעה
function parseFinnhubDateTime(timeString: string): { date: string; time: string; fullDateTime: Date } {
  try {
    const date = new Date(timeString)
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date string')
    }
    
    // המרה לישראל
    const israelDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
    
    const dateStr = israelDate.toISOString().split('T')[0]
    const hours = israelDate.getHours().toString().padStart(2, '0')
    const minutes = israelDate.getMinutes().toString().padStart(2, '0')
    const timeStr = `${hours}:${minutes}`
    
    return { date: dateStr, time: timeStr, fullDateTime: israelDate }
  } catch (error) {
    console.log('❌ Error parsing Finnhub date/time:', timeString, error)
    const datePart = timeString.split('T')[0]
    return { 
      date: datePart, 
      time: '08:30',
      fullDateTime: new Date(datePart + 'T08:30:00')
    }
  }
}

// יצירת ID לאירוע - בהתאם לפורמט שמשמש ב-daily-economic-sync
function createEventId(title: string, date: string, time: string): string {
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_')
  const cleanTime = time.replace(':', '')
  return `finnhub_${cleanTitle}_${date}_${cleanTime}`
}

serve(async (req) => {
  try {
    console.log('🔄 Check Today Economic Results (Finnhub) Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const currentTimeStr = today.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
    
    console.log(`📅 Checking events for TODAY: ${todayStr} (Current time: ${currentTimeStr})`)
    
    // שליפה מ-Finnhub רק לאירועים של היום
    const url = `${FINNHUB_BASE_URL}/calendar/economic?token=${FINNHUB_API_KEY}&from=${todayStr}&to=${todayStr}`
    
    console.log(`🌐 Fetching from Finnhub: ${url}`)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 429) {
        console.log('⚠️ Finnhub rate limit exceeded')
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          date: todayStr
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 429
        })
      }
      
      const errorText = await response.text()
      console.log(`❌ Finnhub API error: ${response.status} - ${errorText}`)
      
      // אם זה 403 או 401, זה אומר שאין גישה ל-Economic Calendar (צריך מנוי)
      if (response.status === 403 || response.status === 401) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Finnhub Economic Calendar requires paid subscription. Falling back to EODHD.',
          date: todayStr,
          requiresSubscription: true
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 403
        })
      }
      
      throw new Error(`Finnhub API error: ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`📊 Finnhub response:`, JSON.stringify(data).substring(0, 500))
    
    // Finnhub מחזיר { economicCalendar: [...] }
    const events = data.economicCalendar || data || []
    
    if (!Array.isArray(events)) {
      console.log('⚠️ Finnhub did not return an array:', typeof events)
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid response format from Finnhub',
        date: todayStr
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      })
    }
    
    console.log(`✅ Found ${events.length} events from Finnhub for ${todayStr}`)
    
    if (events.length === 0) {
      console.log('ℹ️ No events found for today')
      return new Response(JSON.stringify({
        success: true,
        date: todayStr,
        currentTime: currentTimeStr,
        updated: 0,
        skipped: 0,
        statistics: {
          total: 0,
          withActual: 0,
          withoutActual: 0,
          passed: 0,
          upcoming: 0,
          inDB: 0
        },
        notificationsSent: 0,
        newResults: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }
    
    // סטטיסטיקות
    let updatedCount = 0
    let skippedCount = 0
    let skippedNoActual = 0
    let skippedNotFound = 0
    let skippedAlreadyUpdated = 0
    let eventsWithActual = 0
    let eventsWithoutActual = 0
    let eventsPassed = 0
    let eventsUpcoming = 0
    let notificationsSent = 0
    const newResults: Array<{ event: any; oldActual: string; newActual: string }> = []
    
    const now = new Date()
    
    // ספירת אירועים במסד הנתונים
    const { count: dbCount } = await supabase
      .from('economic_events')
      .select('*', { count: 'exact', head: true })
      .eq('date', todayStr)
    
    console.log(`📊 Statistics before processing:`)
    console.log(`   Total events from Finnhub: ${events.length}`)
    console.log(`   Events in DB for today: ${dbCount || 0}`)
    
    // עיבוד כל אירוע
    for (const event of events) {
      try {
        // חילוץ תאריך ושעה מ-Finnhub
        const { date: parsedDate, time: parsedTime, fullDateTime: eventDateTime } = parseFinnhubDateTime(event.time)
        
        // בדיקה אם האירוע כבר קרה
        const hasPassed = eventDateTime <= now
        
        if (hasPassed) {
          eventsPassed++
        } else {
          eventsUpcoming++
        }
        
        // ספירת אירועים עם/בלי actual
        if (event.actual !== null && event.actual !== undefined) {
          eventsWithActual++
        } else {
          eventsWithoutActual++
        }
        
        // בדיקה אם יש actual value חדש - רק אם השעה עברה נבדוק
        if (event.actual === null || event.actual === undefined) {
          skippedNoActual++
          skippedCount++
          if (hasPassed) {
            console.log(`⏰ Event "${event.event}" at ${parsedTime} already passed but no actual value yet`)
          }
          continue // אין תוצאה חדשה - נדלג
        }
        
        // בדיקה - אם התאריך המתוקן לא היום, נדלג
        if (parsedDate !== todayStr) {
          skippedCount++
          continue
        }
        
        // יצירת ID - צריך להתאים למה שמשמש ב-sync
        // ננסה כמה פורמטים
        const eventId1 = createEventId(event.event, parsedDate, parsedTime)
        const eventId2 = `finnhub_${event.event.replace(/[^a-zA-Z0-9]/g, '_')}_${parsedDate}_${parsedTime.replace(':', '')}`
        
        // חיפוש האירוע במסד הנתונים
        let { data: existingEvents, error: searchError } = await supabase
          .from('economic_events')
          .select('id, title, actual, forecast, previous, importance, date, time')
          .or(`id.eq.${eventId1},id.eq.${eventId2}`)
          .limit(1)
        
        // אם לא נמצא לפי ID, נחפש לפי תאריך ושעה וכותרת
        if ((!existingEvents || existingEvents.length === 0) && event.event) {
          const { data: altEvents } = await supabase
            .from('economic_events')
            .select('id, title, actual, forecast, previous, importance, date, time')
            .eq('date', parsedDate)
            .eq('time', parsedTime)
            .ilike('title', `%${event.event}%`)
            .limit(1)
          
          if (altEvents && altEvents.length > 0) {
            existingEvents = altEvents
          }
        }
        
        if (searchError) {
          console.error(`❌ Error searching for event:`, searchError)
          continue
        }
        
        if (!existingEvents || existingEvents.length === 0) {
          skippedNotFound++
          skippedCount++
          console.log(`⚠️ Event "${event.event}" not found in database`)
          continue
        }
        
        const existingEvent = existingEvents[0]
        const oldActual = existingEvent.actual || ''
        const newActual = event.actual?.toString() || ''
        
        // בדיקה אם הערך כבר מעודכן
        if (oldActual === newActual && oldActual !== '') {
          skippedAlreadyUpdated++
          skippedCount++
          continue
        }
        
        // עדכון האירוע
        const { error: updateError } = await supabase
          .from('economic_events')
          .update({
            actual: newActual,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEvent.id)
        
        if (updateError) {
          console.error(`❌ Error updating event ${existingEvent.id}:`, updateError)
          continue
        }
        
        updatedCount++
        console.log(`✅ Updated event "${event.event}": ${oldActual || 'empty'} → ${newActual}`)
        
        // שמירת פרטים לעדכון
        if (oldActual !== newActual) {
          newResults.push({
            event: {
              title: event.event,
              date: parsedDate,
              time: parsedTime
            },
            oldActual,
            newActual
          })
          
          // שליחת Push Notification לאירועים חשובים
          if (event.impact === 'high' && newActual) {
            try {
              // קבלת כל ה-device tokens
              const { data: tokens, error: tokensError } = await supabase
                .from('device_tokens')
                .select('token')
              
              if (!tokensError && tokens && tokens.length > 0) {
                const pushMessages = tokens.map(t => ({
                  to: t.token,
                  sound: 'default',
                  title: '📊 תוצאה כלכלית חדשה',
                  body: `${event.event}: ${newActual}${event.unit ? ' ' + event.unit : ''}`,
                  data: {
                    type: 'economic_result',
                    eventId: existingEvent.id
                  }
                }))
                
                // 🔑 Access Token נדרש עבור production builds
                const pushHeaders: Record<string, string> = {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                }
                if (EXPO_ACCESS_TOKEN) {
                  pushHeaders['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`
                }
                
                const pushResponse = await fetch(EXPO_PUSH_API_URL, {
                  method: 'POST',
                  headers: pushHeaders,
                  body: JSON.stringify(pushMessages)
                })
                
                if (pushResponse.ok) {
                  notificationsSent += tokens.length
                  console.log(`📲 Sent ${tokens.length} push notifications for "${event.event}"`)
                }
              }
            } catch (pushError) {
              console.error('❌ Error sending push notifications:', pushError)
            }
          }
        }
        
      } catch (eventError) {
        console.error(`❌ Error processing event:`, eventError)
        skippedCount++
      }
    }
    
    // סיכום
    console.log(`📊 Statistics:`)
    console.log(`   Total events: ${events.length}`)
    console.log(`   Events with actual: ${eventsWithActual}`)
    console.log(`   Events without actual: ${eventsWithoutActual}`)
    console.log(`   Events that passed: ${eventsPassed}`)
    console.log(`   Events upcoming: ${eventsUpcoming}`)
    console.log(`   Events in DB for today: ${dbCount || 0}`)
    console.log(`   Updated: ${updatedCount}`)
    console.log(`   Skipped: ${skippedCount}`)
    console.log(`     - No actual value: ${skippedNoActual}`)
    console.log(`     - Not found in DB: ${skippedNotFound}`)
    console.log(`     - Already updated: ${skippedAlreadyUpdated}`)
    console.log(`   Current time: ${currentTimeStr}`)
    
    return new Response(JSON.stringify({
      success: true,
      date: todayStr,
      currentTime: currentTimeStr,
      updated: updatedCount,
      skipped: skippedCount,
      skippedDetails: {
        noActual: skippedNoActual,
        notFound: skippedNotFound,
        alreadyUpdated: skippedAlreadyUpdated
      },
      statistics: {
        total: events.length,
        withActual: eventsWithActual,
        withoutActual: eventsWithoutActual,
        passed: eventsPassed,
        upcoming: eventsUpcoming,
        inDB: dbCount || 0
      },
      notificationsSent,
      newResults: newResults.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error: any) {
    console.error('❌ Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})


