// Daily Economic Sync - Edge Function
// שולף נתונים כלכליים מ-FRED API ומעדכן את Supabase DB

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FRED_API_KEY = 'f4d63bd9fddd00b175c1c99ca49b4247'
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred'

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
  actual?: string
  forecast?: string
  previous?: string
  description?: string
  category?: string
  impact?: string
  source?: string
  createdAt?: string
  dateObject?: Date
}

// פונקציה לשליפת Economic Events מ-EODHD
async function fetchEODHDEconomicEvents(startDate: string, endDate: string): Promise<EconomicEvent[]> {
  try {
    const url = `${EODHD_BASE_URL}/economic-events?api_token=${EODHD_API_KEY}&from=${startDate}&to=${endDate}&country=US&fmt=json`
    
    console.log(`📡 EODHD Economic Events API: ${url}`)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.log(`❌ EODHD Economic Events API error: HTTP ${response.status}`)
      return []
    }
    
    const data = await response.json()
    const events: EconomicEvent[] = []
    
    if (Array.isArray(data)) {
      data.forEach((event: any) => {
        // מיפוי נתונים מ-EODHD לפורמט שלנו
        const eventDate = new Date(event.date)
        
        events.push({
          id: `eodhd_${event.type}_${event.date}`,
          title: `📊 ${event.type}`,
          country: event.country === 'US' ? 'ארצות הברית' : event.country,
          currency: event.country === 'US' ? 'USD' : '',
          importance: mapEODHDImportance(event.type),
          date: event.date.split(' ')[0], // רק התאריך ללא השעה
          time: event.date.includes(' ') ? event.date.split(' ')[1].substring(0, 5) : '',
          actual: event.actual?.toString() || '',
          forecast: event.estimate?.toString() || '',
          previous: event.previous?.toString() || '',
          description: `${event.type}${event.period ? ` (${event.period})` : ''}${event.comparison ? ` - ${event.comparison}` : ''}`,
          category: mapEODHDCategory(event.type),
          impact: mapEODHDImportance(event.type),
          source: 'EODHD Economic Events',
          createdAt: new Date().toISOString(),
          dateObject: eventDate
        })
      })
    }
    
    return events
    
  } catch (error) {
    console.log('❌ EODHD Economic Events fetch error:', error)
    return []
  }
}

// מיפוי חשיבות EODHD
function mapEODHDImportance(eventType: string): 'high' | 'medium' | 'low' {
  const highImportance = [
    'CPI', 'Consumer Price Index', 'NFP', 'Nonfarm Payroll', 'Employment', 'GDP',
    'FOMC', 'Federal Funds Rate', 'Interest Rate', 'PPI', 'Producer Price Index',
    'Unemployment Rate', 'Retail Sales', 'Industrial Production', 'Housing Starts'
  ]
  
  const mediumImportance = [
    'Manufacturing', 'Housing', 'Building Permits', 'Consumer Confidence',
    'Durable Goods', 'Trade Balance', 'Import', 'Export'
  ]
  
  const type = eventType.toLowerCase()
  
  if (highImportance.some(imp => type.includes(imp.toLowerCase()))) return 'high'
  if (mediumImportance.some(imp => type.includes(imp.toLowerCase()))) return 'medium'
  return 'low'
}

// מיפוי קטגוריה EODHD
function mapEODHDCategory(eventType: string): string {
  const type = eventType.toLowerCase()
  
  if (type.includes('cpi') || type.includes('ppi') || type.includes('inflation') || type.includes('price')) return 'אינפלציה'
  if (type.includes('employment') || type.includes('nfp') || type.includes('unemployment') || type.includes('jobless')) return 'תעסוקה'
  if (type.includes('gdp') || type.includes('growth') || type.includes('production')) return 'צמיחה כלכלית'
  if (type.includes('retail') || type.includes('sales') || type.includes('consumer')) return 'צריכה'
  if (type.includes('housing') || type.includes('construction') || type.includes('building')) return 'נדל"ן'
  if (type.includes('manufacturing') || type.includes('industrial')) return 'תעשייה'
  if (type.includes('fed') || type.includes('fomc') || type.includes('interest') || type.includes('rate')) return 'מדיניות מוניטרית'
  if (type.includes('trade') || type.includes('import') || type.includes('export')) return 'סחר חוץ'
  
  return 'כלכלה כללית'
}

serve(async (req) => {
  try {
    console.log('🚀 Daily Economic Sync started')
    
    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // קבלת תאריכים
    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3) // 3 חודשים אחורה
    
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3) // 3 חודשים קדימה
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log(`📅 Fetching data from ${startDateStr} to ${endDateStr}`)
    
    // מדדים חשובים מ-FRED
    const fredSeries = [
      // 🏛️ FOMC Rate Decision
      { id: 'FEDFUNDS', name: 'FOMC Rate Decision - ריבית פדרל ריזרב', category: 'מדיניות מוניטרית', importance: 'high' },
      
      // 📊 Inflation
      { id: 'CPIAUCSL', name: 'CPI Headline - מדד המחירים לצרכן', category: 'אינפלציה', importance: 'high' },
      { id: 'CPILFESL', name: 'CPI Core - CPI ליבה', category: 'אינפלציה', importance: 'high' },
      { id: 'PPIFIS', name: 'PPI - מדד מחירי יצרן', category: 'אינפלציה', importance: 'high' },
      
      // 💼 Employment
      { id: 'PAYEMS', name: 'NFP - תעסוקה לא-חקלאית', category: 'תעסוקה', importance: 'high' },
      { id: 'UNRATE', name: 'Unemployment Rate - שיעור אבטלה', category: 'תעסוקה', importance: 'high' },
      { id: 'ICSA', name: 'Initial Jobless Claims - תביעות אבטלה', category: 'תעסוקה', importance: 'high' },
      
      // 📈 GDP
      { id: 'GDPC1', name: 'GDP - תמ"ג ריאלי', category: 'צמיחה כלכלית', importance: 'high' },
      
      // 🛒 Consumer
      { id: 'RSAFS', name: 'Retail Sales - מכירות קמעונאיות', category: 'צריכה', importance: 'high' },
      { id: 'UMCSENT', name: 'Consumer Confidence - אמון צרכנים', category: 'צריכה', importance: 'high' },
      
      // 🏠 Housing
      { id: 'HOUST', name: 'Housing Starts - התחלות בנייה', category: 'נדל"ן', importance: 'high' },
      
      // 📊 Treasury Yields
      { id: 'GS10', name: 'Treasury 10Y - אג"ח 10 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
      { id: 'GS2', name: 'Treasury 2Y - אג"ח 2 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
      { id: 'GS30', name: 'Treasury 30Y - אג"ח 30 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
      
      // 📊 VIX
      { id: 'VIXCLS', name: 'VIX - מדד תנודתיות', category: 'שוקי הון', importance: 'high' }
    ]
    
    const events: EconomicEvent[] = []
    
    // שליפה מקבילה של כל הסדרות
    const promises = fredSeries.map(async (series) => {
      try {
        const url = `${FRED_BASE_URL}/series/observations?series_id=${series.id}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDateStr}&observation_end=${endDateStr}&sort_order=desc&limit=50`
        
        const response = await fetch(url)
        
        if (!response.ok) {
          console.log(`❌ FRED API error for ${series.name}: HTTP ${response.status}`)
          return []
        }
        
        const data = await response.json()
        const seriesEvents: EconomicEvent[] = []
        
        if (data && data.observations && data.observations.length > 0) {
          for (let i = 0; i < Math.min(data.observations.length, 30); i++) {
            const current = data.observations[i]
            const previous = i < data.observations.length - 1 ? data.observations[i + 1] : null
            
            if (!current.value || current.value === '.') continue
            
            const change = previous && current.value !== '.' && previous.value !== '.' 
              ? (parseFloat(current.value) - parseFloat(previous.value)).toFixed(2)
              : ''
            
            seriesEvents.push({
              id: `fred_${series.id}_${current.date}`,
              title: `📊 ${series.name}`,
              country: 'ארצות הברית',
              currency: 'USD',
              importance: series.importance as 'high' | 'medium' | 'low',
              date: current.date,
              time: '',
              actual: current.value,
              forecast: '',
              previous: (previous && previous.value !== '.') ? previous.value : '',
              description: `${series.name}: ${current.value}. ${change ? `שינוי מהנתון הקודם: ${change}` : ''}`,
              category: series.category,
              impact: series.importance as 'high' | 'medium' | 'low',
              source: 'FRED - Federal Reserve',
              createdAt: new Date().toISOString(),
              dateObject: new Date(current.date)
            })
          }
        }
        
        return seriesEvents
        
      } catch (error) {
        console.log(`❌ Failed to fetch FRED series ${series.id}: ${error}`)
        return []
      }
    })
    
    // המתנה לכל הקריאות
    const results = await Promise.all(promises)
    
    // איחוד התוצאות
    results.forEach(seriesEvents => {
      events.push(...seriesEvents)
    })
    
    console.log(`📊 Fetched ${events.length} economic events from FRED`)
    
    // הוספת Economic Events מ-EODHD
    try {
      console.log('🔄 Fetching Economic Events from EODHD...')
      const eodhdEvents = await fetchEODHDEconomicEvents(startDateStr, endDateStr)
      events.push(...eodhdEvents)
      console.log(`📊 Added ${eodhdEvents.length} events from EODHD`)
    } catch (error) {
      console.log('❌ Failed to fetch EODHD Economic Events:', error)
    }
    
    // שמירה ב-Supabase
    if (events.length > 0) {
      // הוספת נתונים חדשים עם upsert (עדכון אם קיים, הוספה אם לא)
      const { error: insertError } = await supabase
        .from('economic_events')
        .upsert(events, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
      
      if (insertError) {
        console.log('❌ Error inserting new events:', insertError)
      } else {
        console.log(`✅ Successfully saved ${events.length} events to database`)
      }
    }
    
    // שליחת התראות Push לאירועים חשובים היום
    const todayStr = today.toISOString().split('T')[0]
    const todayEvents = events.filter(event => 
      event.date === todayStr && event.importance === 'high'
    )
    
    if (todayEvents.length > 0) {
      console.log(`📱 Found ${todayEvents.length} important events today`)
      
      // כאן נוכל להוסיף שליחת Push Notifications
      // TODO: Implement push notifications
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully synced ${events.length} economic events`,
      eventsCount: events.length,
      todayImportantEvents: todayEvents.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    console.error('❌ Daily Economic Sync error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
