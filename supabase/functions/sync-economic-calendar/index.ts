// Sync Economic Calendar - New Clean Function
// שולף אירועי יומן כלכלי מ-EODHD

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import { resolveEconomicEventImportance } from '../_shared/economicEventImportance.ts'

const EODHD_API_KEY = Deno.env.get('EODHD_API_KEY') ?? ''

// תרגום כותרות לעברית
function translateTitle(eventType: string): string {
  const type = eventType.toLowerCase();
  
  const translations: { [key: string]: string } = {
    // מדיניות מוניטרית
    'fomc statement': '📢 הצהרת הפד',
    'fomc meeting': '🏦 ישיבת הפד',
    'fed chair powell speech': '🎤 נאום יו"ר הפד',
    'fed chair speech': '🎤 נאום יו"ר הפד',
    'fed waller speech': '🎤 נאום פד - וולר',
    'fed collins speech': '🎤 נאום פד - קולינס',
    'fed bowman speech': '🎤 נאום פד - באומן',
    'interest rate decision': '💰 החלטת ריבית',
    'beige book': '📖 ספר בז\' של הפד',
    'fed beige book': '📖 ספר בז\' של הפד',
    
    // אינפלציה
    'cpi s.a': '📊 CPI - מדד מחירים לצרכן',
    'inflation rate': '📊 שיעור אינפלציה',
    'core inflation rate': '📊 אינפלציה ליבה',
    'ppi': '🏭 PPI - מדד מחירי יצרן',
    'pce price index': '💳 מדד מחירי PCE',
    'core pce price index': '💳 PCE ליבה',
    
    // תעסוקה
    'non farm payrolls': '👔 NFP - משרות חדשות',
    'nonfarm payrolls private': '👔 NFP - משרות פרטיות',
    'unemployment rate': '📉 שיעור אבטלה',
    'initial jobless claims': '📋 תביעות אבטלה ראשוניות',
    'jobless claims': '📋 תביעות אבטלה',
    'average hourly earnings': '💰 שכר ממוצע לשעה',
    'employment cost index': '💰 מדד עלות תעסוקה',
    'employment wages': '💰 שכר תעסוקה',
    'nfib business optimism': '😊 אופטימיות עסקית NFIB',
    
    // צמיחה
    'gdp': '🌍 GDP - תוצר',
    'retail sales': '🛍️ מכירות קמעונאיות',
    'wholesale sales': '🏭 מכירות סיטונאיות',
    'industrial production': '🏭 ייצור תעשייתי',
    'personal income': '💵 הכנסה אישית',
    'personal spending': '💳 הוצאות אישיות',
    
    // סקרים
    'michigan consumer sentiment': '😊 סנטימנט צרכן מישיגן',
    'michigan inflation expectations': '📊 ציפיות אינפלציה',
    'michigan consumer expectations': '😊 ציפיות צרכן',
    'michigan current conditions': '📊 תנאים נוכחיים',
    'consumer confidence': '😊 אמון צרכן',
    'chicago pmi': '🏭 PMI שיקגו',
    
    // נדל"ן
    'housing starts': '🏗️ התחלות בנייה',
    'building permits': '📋 היתרי בנייה',
    'construction spending': '🏗️ הוצאות בנייה',
    '30-year mortgage rate': '🏠 ריבית משכנתא 30 שנה',
    '15-year mortgage rate': '🏠 ריבית משכנתא 15 שנה',
    
    // סחר ותקציב
    'trade balance': '🌐 מאזן סחר',
    'budget balance': '💰 מאזן תקציבי',
    'federal budget': '💰 תקציב פדרלי',
    
    // אנרגיה
    'baker hughes oil rig count': '🛢️ מספר אסדות נפט',
    'api crude oil stock change': '🛢️ שינוי מלאי נפט API',
    'eia crude oil stocks': '🛢️ מלאי נפט EIA',
    'eia natural gas stocks': '⚡ מלאי גז טבעי',
    
    // אחר
    'opec monthly report': '🛢️ דו"ח חודשי OPEC',
    'imf meeting': '🌐 פגישת IMF',
    'wasde report': '🌾 דו"ח WASDE',
    'redbook': '📊 רדבוק',
  };
  
  for (const [key, value] of Object.entries(translations)) {
    if (type.includes(key)) return value;
  }
  
  // תרגומים כלליים
  if (type.includes('speech')) return `🎤 נאום - ${eventType}`;
  if (type.includes('auction')) return `💵 מכירה פומבית - ${eventType}`;
  
  return eventType;
}

// חילוץ תאריך ושעה נכון מ-EODHD API
function parseEventDateTime(eodhdDateString: string): { date: string; time: string; fullDateTime: Date } {
  try {
    // EODHD API מחזיר פורמט: "YYYY-MM-DD HH:MM:SS" או "YYYY-MM-DD"
    // האירועים הכלכליים בארה"ב בדרך כלל בשעה המקומית (EST/EDT) או UTC
    // ננסה לפרסר כמה פורמטים
    
    if (!eodhdDateString || eodhdDateString.trim() === '') {
      throw new Error('Empty date string');
    }
    
    let dateTimeStr = eodhdDateString.trim();
    
    // אם אין שעה, נניח 08:30 (זמן פרסום נפוץ בארה"ב)
    if (!dateTimeStr.includes(' ')) {
      dateTimeStr = `${dateTimeStr} 08:30:00`;
    }
    
    // ניסיון 1: פרסר ישירות (JavaScript מפרש לפי local time)
    let parsedDate = new Date(dateTimeStr);
    
    // ניסיון 2: אם נכשל, ננסה כ-UTC
    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date(dateTimeStr + ' UTC');
    }
    
    // ניסיון 3: בנייה ידנית מ-components
    if (isNaN(parsedDate.getTime())) {
      const [datePart, timePart] = dateTimeStr.split(' ');
      if (datePart && timePart) {
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        
        // נניח שזה EST/EDT (אירועים כלכליים בארה"ב)
        // EST = UTC-5, EDT = UTC-4
        // לכן נוסיף 5-6 שעות כדי לקבל UTC, ואז נוסיף 2-3 לשעון ישראל
        const tempDate = new Date(year, month - 1, day);
        const estOffset = isEDT(tempDate) ? 4 : 5; // שעות הפרש מ-UTC
        const utcHour = (hour || 8) + estOffset;
        parsedDate = new Date(Date.UTC(year, month - 1, day, utcHour, minute || 30, second || 0));
      }
    }
    
    // אם עדיין נכשל, fallback פשוט
    if (isNaN(parsedDate.getTime())) {
      const [datePart, timePart] = dateTimeStr.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = (timePart || '08:30').split(':').map(Number);
      parsedDate = new Date(Date.UTC(year, month - 1, day, hour || 8, minute || 30, 0));
    }
    
    // המרה לשעון ישראל (UTC+2 בחורף, UTC+3 בקיץ)
    // אם parsedDate כבר ב-UTC, נוסיף את הפרש השעות
    const isDST = isIsraelDST(parsedDate);
    const israelOffsetHours = isDST ? 3 : 2;
    
    // יצירת תאריך בשעון ישראל
    const israelDate = new Date(parsedDate.getTime() + israelOffsetHours * 60 * 60 * 1000);
    
    // חילוץ תאריך ושעה בפורמט שלנו (בשעון ישראל)
    const date = israelDate.toISOString().split('T')[0];
    const hours = israelDate.getHours().toString().padStart(2, '0');
    const minutes = israelDate.getMinutes().toString().padStart(2, '0');
    const time = `${hours}:${minutes}`;
    
    return { date, time, fullDateTime: israelDate };
  } catch (error) {
    console.log('❌ Error parsing date/time:', eodhdDateString, error);
    // fallback - חילוץ פשוט
    const datePart = eodhdDateString.split(' ')[0];
    const timePart = eodhdDateString.includes(' ') ? eodhdDateString.split(' ')[1].substring(0, 5) : '08:30';
    return { 
      date: datePart, 
      time: timePart,
      fullDateTime: new Date(datePart + 'T' + timePart)
    };
  }
}

// בדיקה אם ארה"ב ב-EDT (Daylight Saving Time)
function isEDT(date: Date): boolean {
  const month = date.getMonth() + 1; // 1-12
  // EDT: מרץ-נובמבר (בערך)
  return month >= 4 && month <= 10;
}

// בדיקה אם ישראל ב-DST (Daylight Saving Time)
function isIsraelDST(date: Date): boolean {
  // DST בישראל: מארס-אוקטובר (בערך)
  const month = date.getUTCMonth() + 1; // 1-12
  // דיוק יותר: DST מתחיל בסוף מרץ ומסתיים בסוף אוקטובר
  // לצורך פשטות, נשתמש בחישוב משוער
  return month >= 4 && month <= 9;
}

// תיקון תאריך לפי פריסה נכונה - אירועים ב-00:00-06:00 עוברים ליום הקודם
function adjustDateForEarlyEvents(date: string, time: string): string {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    // אם השעה היא בין 00:00-06:00, העבר ליום הקודם
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
    console.log('🚀 Economic Calendar Sync Started')
    
    // חיבור ל-Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // חישוב תאריכים: 3 חודשים אחורה + 3 קדימה מהיום
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)
    
    const from = startDate.toISOString().split('T')[0]
    const to = endDate.toISOString().split('T')[0]
    
    console.log(`📅 Today: ${todayStr}`)
    console.log(`📅 Range: ${from} to ${to}`)
    
    // שליפה מ-EODHD
    const url = `https://eodhd.com/api/economic-events?api_token=${EODHD_API_KEY}&from=${from}&to=${to}&country=US&limit=1000&fmt=json`
    console.log(`🔄 Calling EODHD...`)
    
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    
    const apiData = await res.json()
    if (!Array.isArray(apiData)) throw new Error('Invalid API response')
    
    console.log(`📊 EODHD returned: ${apiData.length} events`)
    
    // המרה לפורמט שלנו
    const events = apiData.map((e: any) => {
      try {
        // חילוץ תאריך ושעה נכון מ-EODHD API
        const { date: parsedDate, time: parsedTime } = parseEventDateTime(e.date || '');
        
        // תיקון תאריך - אירועים מוקדמים (00:00-06:00) עוברים ליום הקודם
        const adjustedDate = adjustDateForEarlyEvents(parsedDate, parsedTime);
        
        const originalType = e.type || 'Economic Event'
        const translatedTitle = translateTitle(originalType)
        
        console.log(`🔄 "${originalType}" → "${translatedTitle}" - Date: ${e.date} → ${adjustedDate} ${parsedTime}`)
        
        const type = originalType.toLowerCase()
        const importance = resolveEconomicEventImportance(originalType, 'low', translatedTitle)
        
        // קטגוריה
        let category = 'כלכלה'
        if (type.includes('cpi') || type.includes('ppi') || type.includes('inflation') || type.includes('pce')) category = 'אינפלציה'
        else if (type.includes('employ') || type.includes('nfp') || type.includes('jobless')) category = 'תעסוקה'
        else if (type.includes('gdp')) category = 'צמיחה'
        else if (type.includes('fed') || type.includes('fomc') || type.includes('rate')) category = 'מדיניות מוניטרית'
        
        // יצירת ID ייחודי
        const eventId = `econ_${(e.type || '').replace(/[^a-zA-Z0-9]/g, '_')}_${adjustedDate}_${parsedTime.replace(':', '')}`.replace(/[^a-zA-Z0-9_]/g, '_');
        
        return {
          id: eventId,
          title: translatedTitle,
          country: 'ארצות הברית',
          currency: 'USD',
          importance,
          date: adjustedDate,
          time: parsedTime,
          actual: e.actual?.toString() || '',
          forecast: e.estimate?.toString() || '',
          previous: e.previous?.toString() || '',
          description: `${e.type}${e.period ? ` (${e.period})` : ''}`,
          category,
          impact: importance,
          source: 'EODHD'
        }
      } catch (error) {
        console.error('❌ Error processing event:', e, error);
        // fallback פשוט
        const [date, time] = (e.date || '').split(' ');
        const shortTime = time ? time.substring(0, 5) : '00:00';
        return {
          id: `econ_${(e.type || 'event').replace(/[^a-zA-Z0-9_]/g, '_')}_${date}_${shortTime.replace(':', '')}`,
          title: e.type || 'Economic Event',
          country: 'ארצות הברית',
          currency: 'USD',
          importance: 'medium',
          date: date || new Date().toISOString().split('T')[0],
          time: shortTime,
          actual: e.actual?.toString() || '',
          forecast: e.estimate?.toString() || '',
          previous: e.previous?.toString() || '',
          description: e.type || '',
          category: 'כלכלה',
          impact: 'medium',
          source: 'EODHD'
        };
      }
    })
    
    console.log(`📊 Processed: ${events.length} events`)
    
    // הסרת כפילויות
    const unique = events.filter((e, i, arr) => 
      arr.findIndex(x => x.id === e.id) === i
    )
    
    console.log(`📊 Unique: ${unique.length} events`)
    
    // שמירה במסד נתונים
    if (unique.length > 0) {
      const { error } = await supabase
        .from('economic_events')
        .upsert(unique, { onConflict: 'id' })
      
      if (error) {
        console.error('❌ DB Error:', error)
        throw error
      }
      
      console.log(`✅ Saved to DB`)
    }
    
    // סטטיסטיקות
    const todayCount = unique.filter(e => e.date === todayStr).length
    const highCount = unique.filter(e => e.importance === 'high').length
    
    return new Response(JSON.stringify({
      success: true,
      total: unique.length,
      range: `${from} to ${to}`,
      today: todayCount,
      highImportance: highCount
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

