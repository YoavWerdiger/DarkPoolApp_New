// Daily Economic Sync - EODHD Economic Events Only
// שולף אירועי מאקרו כלכליים 3 חודשים קדימה + 3 חודשים אחורה

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import { resolveEconomicEventImportance } from '../_shared/economicEventImportance.ts'

const EODHD_API_KEY = Deno.env.get('EODHD_API_KEY') ?? ''
const EODHD_BASE_URL = 'https://eodhd.com/api'

interface EconomicEvent {
  id: string
  title: string
  country: string
  currency: string
  importance: 'high' | 'medium' | 'low'
  date: string
  time: string
  actual: string
  forecast: string
  previous: string
  description: string
  category: string
  impact: string
  source: string
}

function determineImportance(eventType: string, translatedTitle?: string): 'high' | 'medium' | 'low' {
  // טקסונומיית אדום/כתום; מחוץ לרשימה — low (טייר נמוך יותר)
  return resolveEconomicEventImportance(eventType || '', 'low', translatedTitle);
}

function determineCategory(eventType: string): string {
  const type = eventType.toLowerCase();
  if (type.includes('cpi') || type.includes('ppi') || type.includes('inflation') || type.includes('pce')) return 'Inflation';
  if (type.includes('employ') || type.includes('nfp') || type.includes('jobless')) return 'Employment';
  if (type.includes('gdp')) return 'Growth';
  if (type.includes('fed') || type.includes('fomc') || type.includes('rate')) return 'Monetary Policy';
  if (type.includes('retail')) return 'Consumer';
  if (type.includes('housing') || type.includes('building')) return 'Housing';
  if (type.includes('trade')) return 'Trade';
  if (type.includes('ism') || type.includes('pmi')) return 'Sentiment';
  return 'Economic';
}

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
    'cpi': '📊 CPI - מדד מחירים לצרכן',
    'inflation rate': '📊 שיעור אינפלציה',
    'core inflation rate': '📊 אינפלציה ליבה',
    'ppi': '🏭 PPI - מדד מחירי יצרן',
    'pce price index': '💳 מדד מחירי PCE',
    'core pce price index': '💳 PCE ליבה',
    
    // תעסוקה
    'non farm payrolls': '👔 NFP - משרות חדשות',
    'nonfarm payrolls': '👔 NFP - משרות חדשות',
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
    console.log('🚀 Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    // 3 חודשים אחורה + 6 חודשים קדימה (כדי לתפוס יותר אירועים)
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 6)
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log(`📅 From ${startDateStr} to ${endDateStr}`)
    
    const events: EconomicEvent[] = []
    
    // שליפה מ-EODHD (עם limit גבוה כדי לקבל את כל האירועים)
    const url = `${EODHD_BASE_URL}/economic-events?api_token=${EODHD_API_KEY}&from=${startDateStr}&to=${endDateStr}&country=US&limit=1000&fmt=json`
    
    const response = await fetch(url)
    
    if (response.ok) {
      const raw = await response.json()
      // EODHD יכול להחזיר מערך ישיר או אובייקט עם מערך (למשל { data: [...] })
      const data = Array.isArray(raw)
        ? raw
        : (raw?.data ?? raw?.events ?? raw?.results ?? [])
      const eventsArray = Array.isArray(data) ? data : []

      if (eventsArray.length > 0) {
        console.log(`📊 Fetched ${eventsArray.length} events`)

        eventsArray.forEach((event: any) => {
          try {
            // חילוץ תאריך ושעה נכון מ-EODHD API
            const { date: parsedDate, time: parsedTime } = parseEventDateTime(event.date || '');
            
            // תיקון תאריך - אירועים מוקדמים (00:00-06:00) עוברים ליום הקודם
            const adjustedDate = adjustDateForEarlyEvents(parsedDate, parsedTime);
            
            // יצירת ID ייחודי
            const eventId = `eodhd_${(event.type || '').replace(/[^a-zA-Z0-9]/g, '_')}_${adjustedDate}_${parsedTime.replace(':', '')}`.replace(/[^a-zA-Z0-9_]/g, '_');
            
            const originalType = event.type || 'Economic Event'
            const translatedTitle = translateTitle(originalType)
            
            console.log(`📅 Event: ${originalType} → "${translatedTitle}" - Original: ${event.date} → Parsed: ${adjustedDate} ${parsedTime}`);
            
            const importance = determineImportance(originalType, translatedTitle);
            events.push({
              id: eventId,
              title: translatedTitle, // תרגום לעברית!
              country: 'ארצות הברית',
              currency: 'USD',
              importance,
              date: adjustedDate,
              time: parsedTime,
              actual: event.actual?.toString() || '',
              forecast: event.estimate?.toString() || '',
              previous: event.previous?.toString() || '',
              description: event.type || '',
              category: determineCategory(event.type || ''),
              impact: importance,
              source: 'EODHD'
            })
          } catch (error) {
            console.error('❌ Error processing event:', event, error);
          }
        })
      } else {
        console.log('📊 EODHD returned no array (or empty). Keys:', typeof raw === 'object' && raw ? Object.keys(raw) : 'not object')
      }
    }
    
    // הסרת כפילויות
    const uniqueEvents = events.filter((event, index, self) => 
      index === self.findIndex((e) => e.id === event.id)
    )
    
    console.log(`📊 Unique: ${uniqueEvents.length}`)
    
    // שמירה
    if (uniqueEvents.length > 0) {
      const { error } = await supabase
        .from('economic_events')
        .upsert(uniqueEvents, { onConflict: 'id' })
      
      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500
        })
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      eventsCount: uniqueEvents.length,
      dateRange: `${startDateStr} to ${endDateStr}`,
      info: 'EODHD Economic Events API returns only scheduled future events'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
