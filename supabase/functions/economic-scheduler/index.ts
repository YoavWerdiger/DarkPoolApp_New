import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import { resolveEconomicEventImportance } from '../_shared/economicEventImportance.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BENZINGA_API_KEY = Deno.env.get('BENZINGA_API_KEY') ?? '';
const BENZINGA_BASE_URL = 'https://api.benzinga.com/api/v2';

const FRED_API_KEY = Deno.env.get('FRED_API_KEY') ?? '';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { method } = req;
    const url = new URL(req.url);
    const path = url.pathname;

    // Route handling
    if (method === 'POST') {
      if (path.endsWith('/update-economic-data')) {
        return await updateEconomicData(supabaseClient);
      } else if (path.endsWith('/cleanup-old-data')) {
        return await cleanupOldData(supabaseClient);
      } else if (path.endsWith('/test-connection')) {
        return await testConnection(supabaseClient);
      }
    } else if (method === 'GET') {
      if (path.endsWith('/status')) {
        return await getStatus(supabaseClient);
      }
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Economic Scheduler error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Update economic data from APIs
async function updateEconomicData(supabaseClient: any) {
  try {
    console.log('🔄 Starting economic data update...')
    
    const startTime = Date.now();
    let totalEvents = 0;
    let source = 'Benzinga';

    // Try Benzinga first
    try {
      console.log('📊 Trying Benzinga API...')
      const benzingaEvents = await fetchBenzingaEvents();
      if (benzingaEvents.length > 0) {
        await saveEventsToDatabase(supabaseClient, benzingaEvents, 'Benzinga');
        totalEvents += benzingaEvents.length;
        source = 'Benzinga';
        console.log(`✅ Benzinga: Loaded ${benzingaEvents.length} events`)
      }
    } catch (benzingaError) {
      console.log('⚠️ Benzinga failed, trying FRED:', benzingaError.message)
    }

    // Fallback to FRED if Benzinga failed or returned no data
    if (totalEvents === 0) {
      console.log('📊 Trying FRED API...')
      const fredEvents = await fetchFREDEvents();
      await saveEventsToDatabase(supabaseClient, fredEvents, 'FRED');
      totalEvents += fredEvents.length;
      source = 'FRED';
      console.log(`✅ FRED: Loaded ${fredEvents.length} events`)
    }

    // Update cache metadata
    await updateCacheMetadata(supabaseClient, source, totalEvents);

    const duration = Date.now() - startTime;
    console.log(`✅ Update completed: ${totalEvents} events from ${source} in ${duration}ms`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${totalEvents} events from ${source}`,
        duration_ms: duration,
        total_events: totalEvents,
        source
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Update failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Fetch events from Benzinga API
async function fetchBenzingaEvents() {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 7); // שבוע אחורה
  const futureDate = new Date(today);
  futureDate.setMonth(futureDate.getMonth() + 3); // 3 חודשים קדימה
  
  const fromDate = startDate.toISOString().split('T')[0];
  const toDate = futureDate.toISOString().split('T')[0];

  const url = new URL(`${BENZINGA_BASE_URL}/calendar/economics`);
  url.searchParams.append('token', BENZINGA_API_KEY);
  url.searchParams.append('accept', 'application/json');
  url.searchParams.append('parameters[date_from]', fromDate);
  url.searchParams.append('parameters[date_to]', toDate);
  url.searchParams.append('parameters[country]', 'US');
  url.searchParams.append('parameters[importance]', '2'); // חשיבות 2 ומעלה
  url.searchParams.append('pagesize', '1000');
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Benzinga API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.economics || !Array.isArray(data.economics)) {
    return [];
  }

  return data.economics.map((event: any) => {
    // ממיר importance של Benzinga (0-5) לפורמט של האפליקציה
    let providerImportance: 'high' | 'medium' | 'low' = 'low';
    if (event.importance >= 4) {
      providerImportance = 'high';
    } else if (event.importance >= 2) {
      providerImportance = 'medium';
    }
    const importance = resolveEconomicEventImportance(
      event.event_name || '',
      providerImportance,
      event.description || '',
    );

    return {
      event_id: `benzinga_${event.id}`,
      title: event.event_name,
      description: event.description || event.event_name,
      country: event.country || 'US',
      currency: 'USD',
      importance,
      event_date: event.date,
      event_time: event.time || '00:00:00',
      actual_value: event.actual || null,
      forecast_value: event.consensus || null,
      previous_value: event.prior || null,
      category: mapCategory(event.event_name),
      source: 'Benzinga',
      event_type: event.event_name,
      period: event.event_period || null,
      is_historical: new Date(event.date) < new Date(),
      is_upcoming: new Date(event.date) >= new Date(),
      last_fetched_at: new Date().toISOString()
    };
  });
}

// Fetch events from FRED API
async function fetchFREDEvents() {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 1);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = today.toISOString().split('T')[0];

  // Key FRED series for economic events
  const series = [
    { id: 'FEDFUNDS', name: 'FOMC Rate Decision', category: 'מדיניות מוניטרית', importance: 'high' },
    { id: 'CPIAUCSL', name: 'CPI - Consumer Price Index', category: 'אינפלציה', importance: 'high' },
    { id: 'PAYEMS', name: 'NFP - Non-Farm Payrolls', category: 'תעסוקה', importance: 'high' },
    { id: 'UNRATE', name: 'Unemployment Rate', category: 'תעסוקה', importance: 'high' },
    { id: 'GDPC1', name: 'GDP - Gross Domestic Product', category: 'צמיחה כלכלית', importance: 'high' },
    { id: 'RSAFS', name: 'Retail Sales', category: 'צריכה', importance: 'high' }
  ];

  const events = [];

  for (const s of series) {
    try {
      const url = `${FRED_BASE_URL}/series/observations?series_id=${s.id}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startStr}&observation_end=${endStr}&sort_order=desc&limit=10`;
      
      const response = await fetch(url);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.observations) {
        for (const obs of data.observations) {
          if (obs.value && obs.value !== '.') {
            events.push({
              event_id: `fred_${s.id}_${obs.date}`,
              title: s.name,
              description: `${s.name}: ${obs.value}`,
              country: 'US',
              currency: 'USD',
              importance: s.importance,
              event_date: obs.date,
              event_time: '15:30',
              actual_value: obs.value,
              forecast_value: '',
              previous_value: '',
              category: s.category,
              source: 'FRED',
              event_type: s.id,
              period: obs.date,
              is_historical: true,
              is_upcoming: false,
              last_fetched_at: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.log(`Error fetching ${s.id}:`, error.message);
    }
  }

  return events;
}

// Save events to database
async function saveEventsToDatabase(supabaseClient: any, events: any[], source: string) {
  if (events.length === 0) return;

  const { error } = await supabaseClient
    .from('economic_events')
    .upsert(events, {
      onConflict: 'event_id',
      ignoreDuplicates: false
    });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }
}

// Update cache metadata
async function updateCacheMetadata(supabaseClient: any, source: string, totalEvents: number) {
  const nextUpdate = new Date();
  nextUpdate.setHours(nextUpdate.getHours() + 6);

  const { error } = await supabaseClient
    .from('economic_data_cache_meta')
    .upsert({
      cache_key: 'US_all',
      last_updated: new Date().toISOString(),
      next_update: nextUpdate.toISOString(),
      total_events: totalEvents,
      source,
      country: 'US',
      is_active: true,
      error_count: 0,
      last_error: null
    }, {
      onConflict: 'cache_key'
    });

  if (error) {
    console.error('Error updating cache metadata:', error);
  }
}

// Cleanup old data
async function cleanupOldData(supabaseClient: any) {
  try {
    const { data, error } = await supabaseClient
      .rpc('cleanup_old_economic_events');

    if (error) {
      throw error;
    }

    console.log(`🧹 Cleaned up ${data} old events`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleaned up ${data} old events`,
        cleaned_count: data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Cleanup failed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Test connection
async function testConnection(supabaseClient: any) {
  try {
    const { data, error } = await supabaseClient
      .from('economic_events')
      .select('count', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful',
        total_events: data || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Get status
async function getStatus(supabaseClient: any) {
  try {
    const { data: cacheData } = await supabaseClient
      .from('economic_data_cache_meta')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    const { count: totalEvents } = await supabaseClient
      .from('economic_events')
      .select('*', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({
        status: 'active',
        last_update: cacheData?.last_updated || 'Never',
        next_update: cacheData?.next_update || 'Unknown',
        total_events: totalEvents || 0,
        cache_active: cacheData?.is_active || false,
        error_count: cacheData?.error_count || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Helper functions
function mapImportance(importance: string): 'high' | 'medium' | 'low' {
  if (!importance) return 'medium';
  const imp = importance.toLowerCase();
  if (imp.includes('high') || imp === '3') return 'high';
  if (imp.includes('low') || imp === '1') return 'low';
  return 'medium';
}

function mapCategory(type: string): string {
  if (!type) return 'כללי';
  const t = type.toLowerCase();
  if (t.includes('cpi') || t.includes('ppi') || t.includes('inflation')) return 'אינפלציה';
  if (t.includes('employment') || t.includes('nfp') || t.includes('unemployment')) return 'תעסוקה';
  if (t.includes('gdp') || t.includes('growth')) return 'צמיחה כלכלית';
  if (t.includes('retail') || t.includes('consumer')) return 'צריכה';
  if (t.includes('fed') || t.includes('fomc') || t.includes('rate')) return 'מדיניות מוניטרית';
  return 'כללי';
}


