import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// EODHD API configuration
const EODHD_API_KEY = '68c99499978585.44924748';
const EODHD_BASE_URL = 'https://eodhd.com/api';

// FRED API configuration  
const FRED_API_KEY = 'f4d63bd9fddd00b175c1c99ca49b4247';
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
    let source = 'FRED';

    // Try EODHD first
    try {
      console.log('📊 Trying EODHD API...')
      const eodhdEvents = await fetchEODHDEvents();
      if (eodhdEvents.length > 0) {
        await saveEventsToDatabase(supabaseClient, eodhdEvents, 'EODHD');
        totalEvents += eodhdEvents.length;
        source = 'EODHD';
        console.log(`✅ EODHD: Loaded ${eodhdEvents.length} events`)
      }
    } catch (eodhdError) {
      console.log('⚠️ EODHD failed, trying FRED:', eodhdError.message)
    }

    // Fallback to FRED if EODHD failed or returned no data
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

// Fetch events from EODHD API
async function fetchEODHDEvents() {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 30);
  
  const todayStr = today.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  const url = `${EODHD_BASE_URL}/economic-events?api_token=${EODHD_API_KEY}&fmt=json&country=US&from=${todayStr}&to=${futureStr}&limit=100`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`EODHD API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((event: any) => ({
    event_id: `eodhd_${event.id || event.date}_${event.time}`,
    title: event.event || event.type || 'Economic Event',
    description: `${event.type} - ${event.country}`,
    country: 'US',
    currency: 'USD',
    importance: mapImportance(event.importance),
    event_date: event.date,
    event_time: event.time || '00:00',
    actual_value: event.actual?.toString(),
    forecast_value: event.estimate?.toString(),
    previous_value: event.previous?.toString(),
    category: mapCategory(event.type),
    source: 'EODHD',
    event_type: event.type,
    period: event.period,
    comparison_type: event.comparison,
    is_historical: new Date(event.date) < new Date(),
    is_upcoming: new Date(event.date) >= new Date(),
    last_fetched_at: new Date().toISOString()
  }));
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


