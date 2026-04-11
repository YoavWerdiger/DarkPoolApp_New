import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ממשק ליומן כלכלי Benzinga
interface BenzingaEconomicEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  country: string;
  event_name: string;
  event_period: string;
  period_year: number; // YYYY
  actual: string; // float
  actual_t: string;
  consensus: string; // float
  consensus_t: string;
  prior: string; // float
  prior_t: string;
  importance: number; // 0-5
  updated: number; // Unix timestamp
  description: string;
}

interface BenzingaEconomicsResponse {
  economics: BenzingaEconomicEvent[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting Benzinga Economic Calendar sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing Supabase configuration'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Benzinga API Key
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY') ?? ''
    
    // חישוב טווח תאריכים - חודש אחורה + 6 חודשים קדימה
    // מטרה: טווח זמן מכובד קדימה שיש EST (אירועים כלכליים)
    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 1) // חודש אחורה
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 6) // 6 חודשים קדימה

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]

    console.log(`📅 Fetching economic events from ${fromDate} to ${toDate}...`)

    // איסוף כל האירועים עם pagination
    const allEvents: BenzingaEconomicEvent[] = []
    let currentPage = 0
    const pageSize = 1000
    let hasMore = true
    let totalFetched = 0

    while (hasMore) {
      console.log(`📄 Fetching page ${currentPage}...`)
      
      // קריאה ל-Benzinga API - אירועים בעלי חשיבות 2+ בלבד (medium-high)
      // לפי התיעוד:
      // - page ו-pagesize הם פרמטרים ישירים
      // - country הוא פרמטר ישיר (לא parameters[country])
      // - parameters[date_from], parameters[date_to], parameters[importance] הם parameters[...]
      const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/economics')
      apiUrl.searchParams.append('token', benzingaApiKey)
      apiUrl.searchParams.append('accept', 'application/json')
      apiUrl.searchParams.append('parameters[date_from]', fromDate)
      apiUrl.searchParams.append('parameters[date_to]', toDate)
      apiUrl.searchParams.append('country', 'USA') // 3-Digit Country Code - USA לא US!
      apiUrl.searchParams.append('parameters[importance]', '2') // חשיבות 2 ומעלה
      apiUrl.searchParams.append('page', currentPage.toString())
      apiUrl.searchParams.append('pagesize', pageSize.toString())
      
      console.log(`📡 API URL: ${apiUrl.toString()}`)
      
      const response = await fetch(apiUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      console.log(`📡 Response status: ${response.status} ${response.statusText}`)
      console.log(`📡 Content-Type: ${response.headers.get('content-type')}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ API Error Response: ${errorText.substring(0, 500)}`)
        
        return new Response(
          JSON.stringify({
            success: false,
            error: `Benzinga API error: ${response.status} ${response.statusText}`,
            details: errorText.substring(0, 200)
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      // בדיקה ופרסור התגובה
      const contentType = response.headers.get('content-type') || ''
      let data: BenzingaEconomicsResponse
    
    if (contentType.includes('application/json')) {
      // JSON response
      data = await response.json()
    } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      // XML response - ננסה לפרסר XML ידנית
      const xmlText = await response.text()
      console.log(`⚠️ Received XML instead of JSON, attempting to parse XML...`)
      console.log(`📄 XML preview: ${xmlText.substring(0, 500)}`)
      
      try {
        // ננסה לפרסר XML פשוט - חיפוש אחר <item> או <economics>
        // Benzinga XML structure: <result><economics><item>...</item></economics></result>
        const items: any[] = []
        const itemRegex = /<item>(.*?)<\/item>/gs
        const matches = xmlText.matchAll(itemRegex)
        
        for (const match of matches) {
          const itemXml = match[1]
          const item: any = {}
          
          // חילוץ שדות בסיסיים
          const idMatch = itemXml.match(/<id>(.*?)<\/id>/)
          const dateMatch = itemXml.match(/<date>(.*?)<\/date>/)
          const timeMatch = itemXml.match(/<time>(.*?)<\/time>/)
          const eventNameMatch = itemXml.match(/<event_name>(.*?)<\/event_name>/)
          const countryMatch = itemXml.match(/<country>(.*?)<\/country>/)
          const importanceMatch = itemXml.match(/<importance>(.*?)<\/importance>/)
          const actualMatch = itemXml.match(/<actual>(.*?)<\/actual>/)
          const consensusMatch = itemXml.match(/<consensus>(.*?)<\/consensus>/)
          const priorMatch = itemXml.match(/<prior>(.*?)<\/prior>/)
          const descriptionMatch = itemXml.match(/<description>(.*?)<\/description>/)
          
          if (idMatch) item.id = idMatch[1]
          if (dateMatch) item.date = dateMatch[1]
          if (timeMatch) item.time = timeMatch[1]
          if (eventNameMatch) item.event_name = eventNameMatch[1]
          if (countryMatch) item.country = countryMatch[1]
          if (importanceMatch) item.importance = parseInt(importanceMatch[1]) || 0
          if (actualMatch) item.actual = actualMatch[1]
          if (consensusMatch) item.consensus = consensusMatch[1]
          if (priorMatch) item.prior = priorMatch[1]
          if (descriptionMatch) item.description = descriptionMatch[1]
          
          if (item.id && item.date) {
            items.push(item)
          }
        }
        
        if (items.length > 0) {
          console.log(`✅ Parsed ${items.length} events from XML`)
          data = { economics: items } as BenzingaEconomicsResponse
        } else {
          throw new Error('No items found in XML')
        }
      } catch (parseError) {
        console.error(`❌ Failed to parse XML:`, parseError)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Benzinga API returned XML but failed to parse',
            details: 'The API endpoint may require a different format parameter or the endpoint URL may be incorrect',
            xmlPreview: xmlText.substring(0, 500)
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }
    } else {
      // Unknown format
      const responseText = await response.text()
      console.error(`❌ Unexpected content type: ${contentType}`)
      console.error(`❌ Response: ${responseText.substring(0, 500)}`)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unexpected response type: ${contentType}`,
          response: responseText.substring(0, 200)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
      }

      // הוספת events מהדף הנוכחי
      if (data.economics && Array.isArray(data.economics)) {
        allEvents.push(...data.economics)
        totalFetched += data.economics.length
        console.log(`✅ Page ${currentPage}: Received ${data.economics.length} events (Total: ${totalFetched})`)
        
        // בדיקה אם יש עוד דפים
        // אם קיבלנו פחות מ-pageSize, כנראה שזה הדף האחרון
        if (data.economics.length < pageSize) {
          hasMore = false
          console.log(`📄 Reached last page (got ${data.economics.length} < ${pageSize})`)
        } else {
          currentPage++
          // הגבלה: מקסימום 10 דפים (10,000 רשומות) למניעת לולאה אינסופית
          if (currentPage >= 10) {
            hasMore = false
            console.log(`⚠️ Reached maximum pages (10 pages = 10,000 records)`)
          }
        }
      } else {
        // אין events או פורמט לא תקין
        hasMore = false
        console.log(`⚠️ No events found in response or invalid format`)
      }
    } // סוף while loop

    console.log(`📈 Total events fetched: ${totalFetched} from ${currentPage + 1} pages`)

    if (!allEvents || allEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No economic events found in the specified date range'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    // פונקציה להמרת שעה מ-EST/EDT לשעון ישראל
    // Benzinga מחזיר שעה ב-EST/EDT (Eastern Time)
    // EST = UTC-5 (חורף), EDT = UTC-4 (קיץ)
    // ישראל = UTC+2 (חורף) או UTC+3 (קיץ)
    // הפרש: 7 שעות (EST→ישראל בחורף) או 8 שעות (EST→ישראל בקיץ)
    //       6 שעות (EDT→ישראל בחורף) או 7 שעות (EDT→ישראל בקיץ)
    const convertToIsraelTime = (timeStr: string, eventDate: string): string => {
      if (!timeStr || timeStr === '') return '00:00';
      
      try {
        // מפרסר את השעה (HH:MM:SS או HH:MM)
        const parts = timeStr.split(':');
        if (parts.length < 2) return '00:00';
        
        let hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        
        // חישוב ההפרש המדויק לפי התאריך
        // EST/EDT: מרץ-נובמבר = EDT (קיץ), נובמבר-מרץ = EST (חורף)
        // ישראל: מרץ-אוקטובר = קיץ (UTC+3), אוקטובר-מרץ = חורף (UTC+2)
        const eventDateObj = new Date(eventDate + 'T12:00:00Z'); // UTC midday
        const month = eventDateObj.getUTCMonth() + 1; // 1-12
        
        // בדיקה אם זה EDT (קיץ בארה"ב) - מרץ עד נובמבר
        const isEDT = month >= 3 && month <= 10;
        
        // בדיקה אם זה קיץ בישראל - מרץ עד אוקטובר
        const isIsraelSummer = month >= 3 && month <= 10;
        
        // חישוב ההפרש:
        // EST (UTC-5) → ישראל חורף (UTC+2) = 7 שעות
        // EST (UTC-5) → ישראל קיץ (UTC+3) = 8 שעות
        // EDT (UTC-4) → ישראל חורף (UTC+2) = 6 שעות
        // EDT (UTC-4) → ישראל קיץ (UTC+3) = 7 שעות
        let offsetHours = 0;
        if (isEDT) {
          // EDT (קיץ בארה"ב)
          offsetHours = isIsraelSummer ? 7 : 6; // קיץ/חורף בישראל
        } else {
          // EST (חורף בארה"ב)
          offsetHours = isIsraelSummer ? 8 : 7; // קיץ/חורף בישראל
        }
        
        // המרה לשעון ישראל
        hours += offsetHours;
        
        // אם עבר את חצות, נוסיף יום (אבל לא נשנה את התאריך כאן)
        if (hours >= 24) {
          hours -= 24;
        }
        
        // פורמט HH:MM (ללא שניות)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } catch (error) {
        console.error(`Error converting time ${timeStr}:`, error);
        return '00:00';
      }
    };

    // המרת אירועים לפורמט האפליקציה
    const convertedEvents = allEvents.map((event: BenzingaEconomicEvent) => {
      // ממיר importance של Benzinga (0-5) לפורמט של האפליקציה (high/medium/low)
      let importance: 'high' | 'medium' | 'low' = 'low';
      if (event.importance >= 4) {
        importance = 'high';
      } else if (event.importance >= 2) {
        importance = 'medium';
      }

      // המרת שעה לשעון ישראל ופורמט HH:MM
      const israelTime = convertToIsraelTime(event.time || '', event.date);

      // פונקציה לניקוי ערכים - הסרת אפסים מיותרים
      const cleanValue = (value: string | null | undefined): string | null => {
        if (!value || value === '' || value === '0' || value === '0.0' || value === '0.00' || value === '0.000' || value === '0.0000') {
          return null;
        }
        // הסרת אפסים מיותרים בסוף
        const num = parseFloat(value);
        if (isNaN(num)) return null;
        // אם זה מספר שלם, החזר בלי נקודה עשרונית
        if (num % 1 === 0) {
          return num.toString();
        }
        // אחרת, החזר עם עד 2 מקומות עשרוניים
        return num.toFixed(2).replace(/\.?0+$/, '');
      };

      return {
        id: `benzinga_${event.id}`,
        title: event.event_name, // נשמור את השם המקורי - התרגום יעשה באפליקציה
        description: event.description || '',
        country: event.country || 'US',
        currency: 'USD',
        importance,
        date: event.date,
        time: israelTime,
        actual: cleanValue(event.actual),
        forecast: cleanValue(event.consensus),
        previous: cleanValue(event.prior),
        category: null,
        impact: null,
        source: 'Benzinga'
      };
    })

    let totalProcessed = 0
    let totalInserted = 0
    let totalUpdated = 0

    // בדיקה שהטבלה קיימת
    const { data: tableCheck, error: tableError } = await supabase
      .from('economic_events')
      .select('id')
      .limit(1)
    
    if (tableError && tableError.code === '42P01') {
      console.error('❌ Table economic_events does not exist!')
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Table economic_events does not exist',
          solution: 'Please create the economic_events table first'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log(`📝 Starting to insert ${convertedEvents.length} events into economic_events...`)

    // עיבוד כל אירוע
    for (const event of convertedEvents) {
      totalProcessed++

      try {
        const { data, error } = await supabase
          .from('economic_events')
          .upsert(event, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (error) {
          console.error(`❌ Error upserting event ${event.id}:`, error)
          console.error(`   Event data:`, JSON.stringify(event).substring(0, 200))
        } else {
          totalInserted++
          if (totalInserted % 100 === 0) {
            console.log(`✅ Inserted ${totalInserted}/${totalProcessed} events so far...`)
          }
        }

      } catch (error) {
        console.error(`❌ Error processing event ${event.id}:`, error)
      }
    }
    
    console.log(`📊 Insertion complete: ${totalInserted}/${totalProcessed} events inserted`)

    // עדכון metadata
    try {
      await supabase
        .from('economic_cache_metadata')
        .upsert({
          id: 'benzinga_us',
          source: 'Benzinga',
          country: 'US',
          last_update: new Date().toISOString(),
          total_events: totalInserted,
          date_range_start: fromDate,
          date_range_end: toDate,
        }, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
    } catch (error) {
      console.log('⚠️ Could not update metadata (table may not exist):', error)
    }

    console.log(`✅ Economic calendar sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Economic calendar synchronized successfully',
        processed: totalProcessed,
        inserted: totalInserted,
        updated: totalUpdated,
        dateRange: `${fromDate} to ${toDate}`,
        source: 'Benzinga'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Economic calendar sync error:', error)
    
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? String(error.message) 
      : 'Unknown error occurred'

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

