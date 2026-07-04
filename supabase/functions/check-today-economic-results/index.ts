// Check Today Economic Results - Edge Function (Optimized for EODHD Latency)
// בודקת ומעדכנת תוצאות (actual values) לאירועים של היום ואתמול
// EODHD מעדכן actual values עם עיכוב של 5-120 דקות, לכן בודקים גם אירועים מאתמול

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const EODHD_API_KEY = Deno.env.get('EODHD_API_KEY') ?? ''
const EODHD_BASE_URL = 'https://eodhd.com/api'

// כמה דקות לחכות לפני שמוותרים על אירוע שעבר בלי actual
const MINUTES_AFTER_EVENT_TO_WAIT = 180 // 3 שעות

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

serve(async (req) => {
  try {
    console.log('🔄 Check Today Economic Results Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    // הוספת אתמול - EODHD מעדכן actual values עם עיכוב, אז אירועים מאתמול עשויים להתעדכן היום
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    console.log(`📅 Checking events for: ${yesterdayStr} → ${todayStr}`)
    console.log(`ℹ️  EODHD latency: 5-120 minutes. Checking yesterday's events too.`)
    
    // שליפה מ-EODHD לאירועים מאתמול ועד היום
    const url = `${EODHD_BASE_URL}/economic-events?api_token=${EODHD_API_KEY}&from=${yesterdayStr}&to=${todayStr}&country=US&limit=1000&fmt=json`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid API response')
    }
    
    console.log(`📊 Fetched ${data.length} events from EODHD (${yesterdayStr} to ${todayStr})`)
    
    // סינון - עובדים רק על אירועים של היום (אבל בודקים גם אירועים מאתמול אם הם עדיין לא התעדכנו)
    const eventsToProcess = data.filter((event: any) => {
      if (!event.date) return false
      const { date: parsedDate, time: parsedTime } = parseEventDateTime(event.date)
      const adjustedDate = adjustDateForEarlyEvents(parsedDate, parsedTime)
      // נבדוק אירועים של היום או מאתמול
      return adjustedDate === todayStr || adjustedDate === yesterdayStr
    })
    
    console.log(`🎯 Processing ${eventsToProcess.length} relevant events (today + recent yesterday events)`)
    
    // סטטיסטיקות על האירועים מה-API
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
    
    let eventsWithActual = 0
    let eventsWithoutActual = 0
    let eventsPassed = 0
    let eventsUpcoming = 0
    let eventsWithActualProcessed = 0 // כמה אירועים עם actual הגיעו לחיפוש במסד הנתונים
    
    // בדיקה כמה אירועים יש במסד הנתונים לתאריך של היום
    const { count: dbCount, data: dbEvents } = await supabase
      .from('economic_events')
      .select('id, title, date, time', { count: 'exact' })
      .eq('date', todayStr)
    
    console.log(`📊 Found ${dbCount || 0} events in DB for date ${todayStr}`)
    if (dbCount && dbCount > 0 && dbCount < 10) {
      console.log(`   Sample DB event IDs: ${dbEvents?.slice(0, 3).map((e: any) => e.id).join(', ')}`)
    }
    
    let updatedCount = 0
    let skippedCount = 0
    let skippedNoActual = 0
    let skippedNotFound = 0
    let skippedAlreadyUpdated = 0
    let skippedDateRange = 0
    let skippedTooOld = 0
    let skippedEmptyValues = 0
    let notificationsSent = 0
    const newResults: Array<{ event: any; oldActual: string; newActual: string }> = []
    
    // עיבוד כל אירוע
    for (const event of eventsToProcess) {
      try {
        // חילוץ תאריך ושעה - כמו ב-daily-economic-sync-simple
        const { date: parsedDate, time: parsedTime } = parseEventDateTime(event.date || '');
        
        // תיקון תאריך - אירועים מוקדמים (00:00-06:00) עוברים ליום הקודם
        const adjustedDate = adjustDateForEarlyEvents(parsedDate, parsedTime);
        
        // בדיקה אם האירוע כבר קרה - חישוב מדויק יותר עם תאריך ושעה
        const { fullDateTime: eventDateTime } = parseEventDateTime(event.date || '')
        const hasPassed = eventDateTime <= now
        const minutesSinceEvent = Math.floor((now.getTime() - eventDateTime.getTime()) / (1000 * 60))
        
        if (hasPassed) {
          eventsPassed++
        } else {
          eventsUpcoming++
        }
        
        // בדיקה אם יש actual value
        if (event.actual) {
          eventsWithActual++
        } else {
          eventsWithoutActual++
        }
        
        // בדיקה אם יש actual value חדש
        if (!event.actual) {
          skippedNoActual++
          skippedCount++
          
          if (hasPassed) {
            if (minutesSinceEvent > MINUTES_AFTER_EVENT_TO_WAIT) {
              console.log(`⏰ Event "${event.type}" at ${parsedTime} passed ${minutesSinceEvent} minutes ago (>${MINUTES_AFTER_EVENT_TO_WAIT}m) - likely won't get actual value, skipping permanently`)
            } else {
              console.log(`⏰ Event "${event.type}" at ${parsedTime} passed ${minutesSinceEvent} minutes ago (<${MINUTES_AFTER_EVENT_TO_WAIT}m) - EODHD latency, will retry later`)
            }
          }
          continue // אין תוצאה חדשה - נדלג
        }
        
        // יש actual value! נבדוק אותו
        console.log(`✅ Event "${event.type}" HAS actual value: ${event.actual} at ${parsedTime}`)
        eventsWithActualProcessed++
        
        // בדיקה - רק אירועים של היום או מאתמול
        // אם יש actual value, נעדכן תמיד (גם אם האירוע ישן)
        if (adjustedDate !== todayStr && adjustedDate !== yesterdayStr) {
          console.log(`⚠️ Event "${event.type}" date ${adjustedDate} not in range (${yesterdayStr}-${todayStr}) - skipping`)
          skippedDateRange++
          skippedCount++
          continue
        }
        
        // הערה: אם יש actual value, תמיד נעדכן - לא נבדוק אם האירוע "ישן מדי"
        // הפילטר tooOld רלוונטי רק לאירועים בלי actual (שכבר נדלגו למעלה)
        
        // יצירת ID כמו ב-daily-economic-sync-simple (חייב להיות זהה!)
        const eventId = `eodhd_${(event.type || '').replace(/[^a-zA-Z0-9]/g, '_')}_${adjustedDate}_${parsedTime.replace(':', '')}`.replace(/[^a-zA-Z0-9_]/g, '_')
        
        console.log(`🔍 Searching for event: "${event.type}"`)
        console.log(`   Parsed: ${adjustedDate} ${parsedTime}`)
        console.log(`   Generated ID: ${eventId}`)
        
        // חיפוש האירוע במסד הנתונים לפי ID
        let { data: existingEvents, error: searchError } = await supabase
          .from('economic_events')
          .select('id, title, actual, forecast, previous, importance, date, time')
          .eq('id', eventId)
          .limit(1)
        
        console.log(`   Found by ID: ${existingEvents?.length || 0} events`)
        
        // אם לא נמצא לפי ID, נחפש לפי תאריך ושעה וסוג
        if ((!existingEvents || existingEvents.length === 0) && event.type) {
          console.log(`   Trying alternative search by date/time/title...`)
          const { data: altEvents } = await supabase
            .from('economic_events')
            .select('id, title, actual, forecast, previous, importance, date, time')
            .eq('date', adjustedDate)
            .eq('time', parsedTime)
            .ilike('title', `%${event.type}%`)
            .limit(5) // נגדיל ל-5 כדי לראות מה יש
            
          console.log(`   Found by alternative: ${altEvents?.length || 0} events`)
          if (altEvents && altEvents.length > 0) {
            console.log(`   Alternative IDs: ${altEvents.map(e => e.id).join(', ')}`)
            existingEvents = [altEvents[0]] // נקח את הראשון
          } else {
            // נוסיף חיפוש לפי תאריך ושעה בלבד (ללא title)
            const { data: dateTimeEvents } = await supabase
              .from('economic_events')
              .select('id, title, actual, forecast, previous, importance, date, time')
              .eq('date', adjustedDate)
              .eq('time', parsedTime)
              .limit(5)
            
            console.log(`   Found by date/time only: ${dateTimeEvents?.length || 0} events`)
            if (dateTimeEvents && dateTimeEvents.length > 0) {
              console.log(`   Date/time only IDs: ${dateTimeEvents.map(e => e.id).join(', ')}`)
            }
          }
        }
        
        if (searchError) {
          console.error(`❌ Error searching for event:`, searchError)
          continue
        }
        
        if (!existingEvents || existingEvents.length === 0) {
          console.log(`   ⚠️ Event "${event.type}" not found in DB - skipping`)
          console.log(`   📍 Searched for: date=${adjustedDate}, time=${parsedTime}, title contains "${event.type}"`)
          skippedNotFound++
          skippedCount++
          continue // האירוע לא נמצא - נדלג
        }
        
        console.log(`   ✅ Found! ID: ${existingEvents[0].id}, Title: ${existingEvents[0].title}`)
        
        const existingEvent = existingEvents[0]
        const oldActual = existingEvent.actual || ''
        const newActual = event.actual?.toString() || ''
        
        // בדיקה אם צריך לעדכן
        console.log(`   🔄 Checking update:`)
        console.log(`      Old actual: "${oldActual || '(empty)'}"`)
        console.log(`      New actual: "${newActual || '(empty)'}"`)
        console.log(`      Old forecast: "${existingEvent.forecast || '(empty)'}"`)
        console.log(`      New forecast: "${event.estimate?.toString() || '(empty)'}"`)
        
        if (oldActual === newActual && oldActual !== '') {
          console.log(`   ✅ Already updated with same actual value - skipping`)
          skippedAlreadyUpdated++
          skippedCount++
          continue // כבר מעודכן
        }
        
        if (oldActual === newActual && oldActual === '') {
          console.log(`   ⚠️ Both old and new actual are empty - skipping`)
          skippedEmptyValues++
          skippedCount++
          continue
        }
        
        // בדיקה אם הערך החדש באמת שונה (גם אחרי trim)
        const oldActualTrimmed = (oldActual || '').trim()
        const newActualTrimmed = (newActual || '').trim()
        
        if (oldActualTrimmed === newActualTrimmed && oldActualTrimmed !== '') {
          console.log(`   ✅ Already updated (values match after trim) - skipping`)
          skippedAlreadyUpdated++
          skippedCount++
          continue
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
        console.log(`✅ Updated: ${event.type || existingEvent.title} at ${parsedTime} - Actual: ${newActual}`)
        
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
    
    // Push נשלח דרך טריגר DB על economic_events (send_economic_calendar_notification)
    if (newResults.length > 0) {
      console.log(`📱 ${newResults.length} new results — notifications queued via DB trigger`);
    }
    
    // סיכום סטטיסטיקות
    console.log(`\n📊 SUMMARY:`)
    console.log(`   Date range checked: ${yesterdayStr} → ${todayStr}`)
    console.log(`   Total events from API: ${data.length}`)
    console.log(`   Events processed: ${eventsToProcess.length}`)
    console.log(`   Events with actual: ${eventsWithActual}`)
    console.log(`   Events with actual processed (passed filters): ${eventsWithActualProcessed}`)
    console.log(`   Events without actual: ${eventsWithoutActual}`)
    console.log(`   Events that passed: ${eventsPassed}`)
    console.log(`   Events upcoming: ${eventsUpcoming}`)
    console.log(`   Events in DB for today: ${dbCount || 0}`)
    console.log(`   Updated: ${updatedCount}`)
    console.log(`   Skipped: ${skippedCount}`)
    console.log(`     - No actual value: ${skippedNoActual}`)
    console.log(`     - Not found in DB: ${skippedNotFound}`)
    console.log(`     - Already updated: ${skippedAlreadyUpdated}`)
    console.log(`     - Date out of range: ${skippedDateRange}`)
    console.log(`     - Too old (yesterday): ${skippedTooOld}`)
    console.log(`     - Empty values: ${skippedEmptyValues}`)
    console.log(`   Current time: ${currentTimeStr}`)
    console.log(`   ⏱️  Waiting ${MINUTES_AFTER_EVENT_TO_WAIT} minutes before giving up on events`)
    
    return new Response(JSON.stringify({
      success: true,
      date: todayStr,
      currentTime: currentTimeStr,
      updated: updatedCount,
      skipped: skippedCount,
      skippedDetails: {
        noActual: skippedNoActual,
        notFound: skippedNotFound,
        alreadyUpdated: skippedAlreadyUpdated,
        dateRange: skippedDateRange,
        tooOld: skippedTooOld,
        emptyValues: skippedEmptyValues
      },
        statistics: {
        total: data.length,
        processed: eventsToProcess.length,
        withActual: eventsWithActual,
        withActualProcessed: eventsWithActualProcessed,
        withoutActual: eventsWithoutActual,
        passed: eventsPassed,
        upcoming: eventsUpcoming,
        inDB: dbCount || 0,
        dateRange: {
          from: yesterdayStr,
          to: todayStr
        }
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

