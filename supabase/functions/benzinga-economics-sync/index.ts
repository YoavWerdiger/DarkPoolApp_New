import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY') || 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC'
    
    // חישוב טווח תאריכים - שבוע אחורה + 3 חודשים קדימה
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 7)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]

    console.log(`📅 Fetching economic events from ${fromDate} to ${toDate}...`)

    // קריאה ל-Benzinga API - אירועים בעלי חשיבות 2+ בלבד (medium-high)
    const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/economics')
    apiUrl.searchParams.append('token', benzingaApiKey)
    apiUrl.searchParams.append('parameters[date_from]', fromDate)
    apiUrl.searchParams.append('parameters[date_to]', toDate)
    apiUrl.searchParams.append('parameters[country]', 'US') // רק ארה"ב כרגע
    apiUrl.searchParams.append('parameters[importance]', '2') // חשיבות 2 ומעלה
    apiUrl.searchParams.append('pagesize', '1000')
    
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

    // בדיקה שזה JSON ולא XML
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
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

    const data: BenzingaEconomicsResponse = await response.json()
    console.log(`📊 Received ${data.economics?.length || 0} economic events`)

    if (!data.economics || !Array.isArray(data.economics)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid response format from Benzinga API'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // המרת אירועים לפורמט האפליקציה
    const convertedEvents = data.economics.map((event: BenzingaEconomicEvent) => {
      // ממיר importance של Benzinga (0-5) לפורמט של האפליקציה (high/medium/low)
      let importance: 'high' | 'medium' | 'low' = 'low';
      if (event.importance >= 4) {
        importance = 'high';
      } else if (event.importance >= 2) {
        importance = 'medium';
      }

      return {
        id: event.id,
        title: event.event_name,
        description: event.description || '',
        date: event.date,
        time: event.time || '00:00:00',
        country: event.country || 'US',
        importance,
        actual: event.actual || null,
        forecast: event.consensus || null,
        previous: event.prior || null,
        period: event.event_period || null,
        source: 'Benzinga',
        last_updated: new Date(event.updated * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };
    })

    let totalProcessed = 0
    let totalInserted = 0
    let totalUpdated = 0

    // עיבוד כל אירוע
    for (const event of convertedEvents) {
      totalProcessed++

      try {
        const { error } = await supabase
          .from('economic_events_cache')
          .upsert(event, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (error) {
          console.error('❌ Error upserting economic event:', error)
        } else {
          totalInserted++
        }

      } catch (error) {
        console.error('❌ Error processing economic event:', error)
      }
    }

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

