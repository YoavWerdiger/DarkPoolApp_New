// Daily Economic Sync - EODHD Economic Events Only
// שולף אירועי מאקרו כלכליים 3 חודשים קדימה + 3 חודשים אחורה

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EODHD_API_KEY = '68e3c3af900997.85677801'
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

function determineImportance(eventType: string): 'high' | 'medium' | 'low' {
  const type = eventType.toLowerCase();
  const highKeywords = ['cpi', 'pce', 'nfp', 'employment', 'unemployment', 'jobless', 'gdp', 'fomc', 'rate decision', 'ppi', 'retail sales'];
  if (highKeywords.some(k => type.includes(k))) return 'high';
  return 'medium';
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

// המרת שעה מ-EST/EDT לשעון ישראל
function convertToIsraelTime(dateStr: string, timeStr: string): string {
  try {
    // רוב האירועים הכלכליים בארה"ב יוצאים ב-8:30 AM EST
    // EST = GMT-5, EDT = GMT-4 (קיץ)
    // ישראל = GMT+2 (חורף) או GMT+3 (קיץ)
    // הפרש: בדרך כלל 7-8 שעות
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    if (isNaN(hours)) return timeStr;
    
    // המרה משוערת: EST+7 שעות = IST
    let israelHours = hours + 7;
    
    if (israelHours >= 24) {
      israelHours -= 24;
    }
    
    return `${israelHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    console.log('Error converting time:', error);
    return timeStr;
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
      const data = await response.json()
      
      if (Array.isArray(data)) {
        console.log(`📊 Fetched ${data.length} events`)
        
        data.forEach((event: any) => {
          // חילוץ תאריך ושעה מהפורמט של EODHD
          const eventDate = event.date.split(' ')[0]
          const eventTimeUS = event.date.includes(' ') ? event.date.split(' ')[1].substring(0, 5) : '00:00'
          
          // המרה לשעון ישראל
          const eventTimeIsrael = convertToIsraelTime(eventDate, eventTimeUS)
          
          events.push({
            id: `eodhd_${event.type}_${event.date}`.replace(/[^a-zA-Z0-9_]/g, '_'),
            title: event.type || 'Economic Event',
            country: 'United States',
            currency: 'USD',
            importance: determineImportance(event.type || ''),
            date: eventDate,
            time: eventTimeIsrael,
            actual: event.actual?.toString() || '',
            forecast: event.estimate?.toString() || '',
            previous: event.previous?.toString() || '',
            description: event.type || '',
            category: determineCategory(event.type || ''),
            impact: determineImportance(event.type || ''),
            source: 'EODHD'
          })
        })
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
