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
    console.log('🔄 Starting Live Economic Results Update...')

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
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY')
    if (!benzingaApiKey) {
      return new Response(JSON.stringify({ error: 'BENZINGA_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    // חישוב טווח תאריכים - אתמול + היום (כולל)
    // EODHD/Benzinga מעדכנים עם עיכוב, אז בודקים גם אתמול
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const fromDate = yesterday.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    console.log(`📅 Checking events from ${fromDate} to ${toDate} for updated results...`)

    // איסוף כל האירועים עם pagination
    const allEvents: BenzingaEconomicEvent[] = []
    let currentPage = 0
    const pageSize = 1000
    let hasMore = true
    let totalFetched = 0

    while (hasMore) {
      console.log(`📄 Fetching page ${currentPage}...`)
      
      // קריאה ל-Benzinga API
      const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/economics')
      apiUrl.searchParams.append('token', benzingaApiKey)
      apiUrl.searchParams.append('accept', 'application/json')
      apiUrl.searchParams.append('parameters[date_from]', fromDate)
      apiUrl.searchParams.append('parameters[date_to]', toDate)
      apiUrl.searchParams.append('country', 'USA')
      apiUrl.searchParams.append('parameters[importance]', '2') // חשיבות 2 ומעלה
      apiUrl.searchParams.append('page', currentPage.toString())
      apiUrl.searchParams.append('pagesize', pageSize.toString())
      
      const response = await fetch(apiUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      console.log(`📡 Response status: ${response.status} ${response.statusText}`)
      
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
        data = await response.json()
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        // XML response - ננסה לפרסר XML ידנית
        const xmlText = await response.text()
        console.log(`⚠️ Received XML instead of JSON, attempting to parse XML...`)
        
        try {
          const items: any[] = []
          const itemRegex = /<item>(.*?)<\/item>/gs
          const matches = xmlText.matchAll(itemRegex)
          
          for (const match of matches) {
            const itemXml = match[1]
            const item: any = {}
            
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
              details: 'The API endpoint may require a different format parameter'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500,
            }
          )
        }
      } else {
        const responseText = await response.text()
        console.error(`❌ Unexpected content type: ${contentType}`)
        
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
        if (data.economics.length < pageSize) {
          hasMore = false
          console.log(`📄 Reached last page (got ${data.economics.length} < ${pageSize})`)
        } else {
          currentPage++
          if (currentPage >= 10) {
            hasMore = false
            console.log(`⚠️ Reached maximum pages (10 pages = 10,000 records)`)
          }
        }
      } else {
        hasMore = false
        console.log(`⚠️ No events found in response or invalid format`)
      }
    } // סוף while loop

    console.log(`📈 Total events fetched: ${totalFetched} from ${currentPage + 1} pages`)

    if (!allEvents || allEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No events found in date range',
          updated: 0,
          checked: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // פונקציה להמרת שעה מ-EST/EDT לשעון ישראל
    const convertToIsraelTime = (timeStr: string, eventDate: string): string => {
      if (!timeStr || timeStr === '') return '00:00';
      
      try {
        const parts = timeStr.split(':');
        if (parts.length < 2) return '00:00';
        
        let hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        
        const eventDateObj = new Date(eventDate + 'T12:00:00Z');
        const month = eventDateObj.getUTCMonth() + 1;
        
        const isEDT = month >= 3 && month <= 10;
        const isIsraelSummer = month >= 3 && month <= 10;
        
        let offsetHours = 0;
        if (isEDT) {
          offsetHours = isIsraelSummer ? 7 : 6;
        } else {
          offsetHours = isIsraelSummer ? 8 : 7;
        }
        
        hours += offsetHours;
        
        if (hours >= 24) {
          hours -= 24;
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } catch (error) {
        console.error(`Error converting time ${timeStr}:`, error);
        return '00:00';
      }
    };

    // פונקציה לניקוי ערכים
    const cleanValue = (value: string | null | undefined): string | null => {
      if (!value || value === '' || value === '0' || value === '0.0' || value === '0.00' || value === '0.000' || value === '0.0000') {
        return null;
      }
      const num = parseFloat(value);
      if (isNaN(num)) return null;
      if (num % 1 === 0) {
        return num.toString();
      }
      return num.toFixed(2).replace(/\.?0+$/, '');
    };

    // עיבוד אירועים - עדכון רק אם יש actual חדש
    let totalChecked = 0
    let totalUpdated = 0
    let totalSkipped = 0

    for (const event of allEvents) {
      totalChecked++
      
      try {
        // חיפוש האירוע ב-DB לפי תאריך, שעה וכותרת
        const israelTime = convertToIsraelTime(event.time || '', event.date)
        
        const { data: existingEvents, error: searchError } = await supabase
          .from('economic_events')
          .select('id, title, actual, forecast, previous, date, time')
          .eq('date', event.date)
          .eq('time', israelTime)
          .ilike('title', `%${event.event_name}%`)
          .limit(1)
        
        if (searchError) {
          console.error(`❌ Error searching for event:`, searchError)
          totalSkipped++
          continue
        }
        
        if (!existingEvents || existingEvents.length === 0) {
          totalSkipped++
          continue // האירוע לא נמצא - נדלג
        }
        
        const existingEvent = existingEvents[0]
        const oldActual = existingEvent.actual || ''
        const newActual = cleanValue(event.actual)
        const newActualStr = newActual || ''
        
        // בדיקה אם צריך לעדכן
        if (oldActual === newActualStr && oldActual !== '') {
          totalSkipped++
          continue // כבר מעודכן
        }
        
        // עדכון התוצאה
        const { error: updateError } = await supabase
          .from('economic_events')
          .update({
            actual: newActualStr,
            forecast: cleanValue(event.consensus) || existingEvent.forecast || null,
            previous: cleanValue(event.prior) || existingEvent.previous || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEvent.id)
        
        if (updateError) {
          console.error(`❌ Error updating event ${existingEvent.id}:`, updateError)
          totalSkipped++
          continue
        }
        
        totalUpdated++
        console.log(`✅ Updated: ${event.event_name} on ${event.date} ${israelTime} - Actual: ${newActualStr || 'N/A'}`)
        
      } catch (error) {
        console.error(`❌ Error processing event:`, error)
        totalSkipped++
        continue
      }
    }
    
    console.log(`📊 Update complete: ${totalUpdated}/${totalChecked} events updated, ${totalSkipped} skipped`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Live economic results updated successfully',
        checked: totalChecked,
        updated: totalUpdated,
        skipped: totalSkipped,
        dateRange: `${fromDate} to ${toDate}`,
        source: 'Benzinga'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Live economic results update error:', error)
    
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









