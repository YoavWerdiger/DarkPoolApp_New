// Update Economic Results - Edge Function
// מעדכן תוצאות (actual values) בלייב ושולח Push Notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EODHD_API_KEY = '68e3c3af900997.85677801'
const EODHD_BASE_URL = 'https://eodhd.com/api'
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send'

// חילוץ תאריך ושעה נכון מ-EODHD API - בדיוק כמו ב-daily-economic-sync-simple
function parseEventDateTime(eodhdDateString: string): { date: string; time: string; fullDateTime: Date } {
  try {
    if (!eodhdDateString || eodhdDateString.trim() === '') {
      throw new Error('Empty date string');
    }
    
    let dateTimeStr = eodhdDateString.trim();
    
    if (!dateTimeStr.includes(' ')) {
      dateTimeStr = `${dateTimeStr} 08:30:00`;
    }
    
    let parsedDate = new Date(dateTimeStr);
    
    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date(dateTimeStr + ' UTC');
    }
    
    if (isNaN(parsedDate.getTime())) {
      const [datePart, timePart] = dateTimeStr.split(' ');
      if (datePart && timePart) {
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        const tempDate = new Date(year, month - 1, day);
        const estOffset = isEDT(tempDate) ? 4 : 5;
        const utcHour = (hour || 8) + estOffset;
        parsedDate = new Date(Date.UTC(year, month - 1, day, utcHour, minute || 30, second || 0));
      }
    }
    
    if (isNaN(parsedDate.getTime())) {
      const [datePart, timePart] = dateTimeStr.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = (timePart || '08:30').split(':').map(Number);
      parsedDate = new Date(Date.UTC(year, month - 1, day, hour || 8, minute || 30, 0));
    }
    
    const isDST = isIsraelDST(parsedDate);
    const israelOffsetHours = isDST ? 3 : 2;
    const israelDate = new Date(parsedDate.getTime() + israelOffsetHours * 60 * 60 * 1000);
    
    const date = israelDate.toISOString().split('T')[0];
    const hours = israelDate.getHours().toString().padStart(2, '0');
    const minutes = israelDate.getMinutes().toString().padStart(2, '0');
    const time = `${hours}:${minutes}`;
    
    return { date, time, fullDateTime: israelDate };
  } catch (error) {
    console.log('❌ Error parsing date/time:', eodhdDateString, error);
    const datePart = eodhdDateString.split(' ')[0];
    const timePart = eodhdDateString.includes(' ') ? eodhdDateString.split(' ')[1].substring(0, 5) : '08:30';
    return { 
      date: datePart, 
      time: timePart,
      fullDateTime: new Date(datePart + 'T' + timePart)
    };
  }
}

function isEDT(date: Date): boolean {
  const month = date.getMonth() + 1;
  return month >= 4 && month <= 10;
}

function isIsraelDST(date: Date): boolean {
  const month = date.getUTCMonth() + 1;
  return month >= 4 && month <= 9;
}

function adjustDateForEarlyEvents(date: string, time: string): string {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes < 6 * 60) {
      const eventDate = new Date(date);
      eventDate.setDate(eventDate.getDate() - 1);
      return eventDate.toISOString().split('T')[0];
    }
    
    return date;
  } catch (error) {
    console.log('Error adjusting date:', error);
    return date;
  }
}

interface EconomicEvent {
  id: string
  title: string
  date: string
  time: string
  actual?: string
  forecast?: string
  previous?: string
  importance?: 'high' | 'medium' | 'low'
}

serve(async (req) => {
  try {
    console.log('🔄 Update Economic Results Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    // טווח: 7 ימים אחורה עד היום כולל - אירועים שכבר התרחשו
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 7)
    const endDate = new Date(today) // כולל היום!
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log(`📅 Checking events from ${startDateStr} to ${endDateStr} (including today) for results`)
    
    // שליפה מ-EODHD לאירועים שכבר התרחשו
    const url = `${EODHD_BASE_URL}/economic-events?api_token=${EODHD_API_KEY}&from=${startDateStr}&to=${endDateStr}&country=US&limit=1000&fmt=json`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid API response')
    }
    
    console.log(`📊 Fetched ${data.length} events from EODHD`)
    
    let updatedCount = 0
    let skippedCount = 0
    let notificationsSent = 0
    const newResults: Array<{ event: any; oldActual: string; newActual: string }> = []
    
    // עיבוד כל אירוע
    for (const event of data) {
      try {
        // בדיקה אם יש actual value חדש
        if (!event.actual) {
          skippedCount++
          continue // אין תוצאה חדשה - נדלג
        }
        
        // חילוץ תאריך ושעה - כמו בפונקציה הראשית (parseEventDateTime)
        const { date: parsedDate, time: parsedTime } = parseEventDateTime(event.date || '');
        
        // תיקון תאריך - אירועים מוקדמים (00:00-06:00) עוברים ליום הקודם
        const adjustedDate = adjustDateForEarlyEvents(parsedDate, parsedTime);
        
        // יצירת ID כמו בפונקציה הראשית (חייב להיות זהה!)
        const eventId = `eodhd_${(event.type || '').replace(/[^a-zA-Z0-9]/g, '_')}_${adjustedDate}_${parsedTime.replace(':', '')}`.replace(/[^a-zA-Z0-9_]/g, '_')
        
        // חיפוש האירוע במסד הנתונים לפי ID (הכי מדויק)
        let { data: existingEvents, error: searchError } = await supabase
          .from('economic_events')
          .select('id, title, actual, forecast, previous, importance, date, time')
          .eq('id', eventId)
          .limit(1)
        
        // אם לא נמצא לפי ID, נחפש לפי תאריך ושעה וסוג
        if ((!existingEvents || existingEvents.length === 0) && event.type) {
          const { data: altEvents } = await supabase
            .from('economic_events')
            .select('id, title, actual, forecast, previous, importance, date, time')
            .eq('date', adjustedDate)
            .eq('time', parsedTime)
            .ilike('title', `%${event.type}%`)
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
          skippedCount++
          continue // האירוע לא נמצא - נדלג
        }
        
        const existingEvent = existingEvents[0]
        const oldActual = existingEvent.actual || ''
        const newActual = event.actual?.toString() || ''
        
        // בדיקה אם צריך לעדכן
        if (oldActual === newActual && oldActual !== '') {
          skippedCount++
          continue // כבר מעודכן
        }
        
        // עדכון התוצאה
        const { error: updateError } = await supabase
          .from('economic_events')
          .update({
            actual: newActual,
            forecast: event.estimate?.toString() || existingEvent.forecast || '',
            previous: event.previous?.toString() || existingEvent.previous || ''
          })
          .eq('id', existingEvent.id)
        
        if (updateError) {
          console.error(`❌ Error updating event ${existingEvent.id}:`, updateError)
          continue
        }
        
        updatedCount++
        console.log(`✅ Updated: ${event.type || existingEvent.title} on ${adjustedDate} ${parsedTime} - Actual: ${newActual}`)
        
        // שמירת תוצאות חדשות לשליחת התראות (רק אם יש תוצאה חדשה)
        if (newActual && (!oldActual || oldActual === '')) {
          newResults.push({
            event: {
              ...existingEvent,
              forecast: event.estimate?.toString() || existingEvent.forecast || ''
            },
            oldActual,
            newActual
          })
        }
        
      } catch (error) {
        console.error(`❌ Error processing event:`, error)
        continue
      }
    }
    
    // שליחת Push Notifications על תוצאות חדשות (רק לאירועים חשובים)
    if (newResults.length > 0) {
      console.log(`📱 Sending push notifications for ${newResults.length} new results`)
      
      // קבלת כל ה-users שיש להם device tokens
      const { data: allUsers, error: usersError } = await supabase
        .from('device_tokens')
        .select('user_id, expo_push_token')
        .eq('is_active', true)
        .not('expo_push_token', 'is', null)
      
      if (!usersError && allUsers && allUsers.length > 0) {
        // יצירת הודעות push רק לתוצאות חשובות (high importance)
        const importantResults = newResults.filter(r => {
          // בדיקה אם האירוע חשוב - נשתמש בכותרת או נחפש בטבלה
          const eventTitle = r.event.title?.toLowerCase() || ''
          const isImportant = eventTitle.includes('cpi') || 
                             eventTitle.includes('nfp') || 
                             eventTitle.includes('fomc') ||
                             eventTitle.includes('ppi') ||
                             eventTitle.includes('gdp') ||
                             eventTitle.includes('unemployment') ||
                             r.event.importance === 'high'
          return isImportant
        })
        
        if (importantResults.length > 0) {
          // קבוצת tokens לפי user
          const userTokens = new Map<string, string[]>()
          for (const user of allUsers) {
            if (!userTokens.has(user.user_id)) {
              userTokens.set(user.user_id, [])
            }
            userTokens.get(user.user_id)!.push(user.expo_push_token)
          }
          
          // יצירת הודעות push לכל תוצאה חשובה
          const messages: any[] = []
          
          for (const result of importantResults) {
            const eventTitle = result.event.title || 'Economic Event'
            const actualValue = result.newActual
            
            // יצירת הודעה יפה
            let notificationTitle = '📊 תוצאה כלכלית חדשה'
            let notificationBody = `${eventTitle}: ${actualValue}`
            
            // השוואה לתחזית (אם יש)
            if (result.event.forecast) {
              const forecast = parseFloat(result.event.forecast)
              const actual = parseFloat(actualValue)
              if (!isNaN(forecast) && !isNaN(actual)) {
                const diff = actual - forecast
                const percentDiff = ((diff / Math.abs(forecast)) * 100).toFixed(1)
                
                if (diff > 0) {
                  notificationBody = `${eventTitle}: ${actualValue} ✅ (תחזית: ${result.event.forecast}, +${percentDiff}%)`
                } else if (diff < 0) {
                  notificationBody = `${eventTitle}: ${actualValue} ⬇️ (תחזית: ${result.event.forecast}, ${percentDiff}%)`
                } else {
                  notificationBody = `${eventTitle}: ${actualValue} = (תחזית: ${result.event.forecast})`
                }
              }
            }
            
            // הוספת הודעה לכל token
            for (const tokens of userTokens.values()) {
              for (const token of tokens) {
                messages.push({
                  to: token,
                  sound: 'default',
                  title: notificationTitle,
                  body: notificationBody,
                  data: {
                    type: 'economic_result',
                    eventId: result.event.id,
                    eventTitle: eventTitle,
                    actual: actualValue,
                    forecast: result.event.forecast || null,
                    date: result.event.date
                  },
                  priority: 'high',
                  channelId: 'economic_events'
                })
              }
            }
          }
          
          // שליחת התראות דרך Expo Push API
          if (messages.length > 0) {
            try {
              const pushResponse = await fetch(EXPO_PUSH_API_URL, {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Accept-Encoding': 'gzip, deflate',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
              })
              
              if (pushResponse.ok) {
                const pushResult = await pushResponse.json()
                const successCount = pushResult.data?.filter((r: any) => r.status === 'ok').length || 0
                notificationsSent = successCount
                console.log(`📱 Sent ${successCount}/${messages.length} push notifications`)
              } else {
                console.error('❌ Failed to send push notifications:', await pushResponse.text())
              }
            } catch (pushError) {
              console.error('❌ Error sending push notifications:', pushError)
            }
          }
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      notificationsSent,
      newResults: newResults.length,
      total: data.length,
      dateRange: `${startDateStr} to ${endDateStr}`
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

