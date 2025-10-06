import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { method } = req
    const url = new URL(req.url)
    const path = url.pathname

    // Route handling
    if (method === 'POST') {
      if (path.endsWith('/webhook')) {
        return await handleWebhook(req, supabaseClient)
      } else if (path.endsWith('/trigger-update')) {
        return await handleTriggerUpdate(req, supabaseClient)
      } else if (path.endsWith('/status')) {
        return await handleStatus(req, supabaseClient)
      }
    } else if (method === 'GET') {
      if (path.endsWith('/status')) {
        return await handleStatus(req, supabaseClient)
      } else if (path.endsWith('/stats')) {
        return await handleStats(req, supabaseClient)
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
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Handle webhook events
async function handleWebhook(req: Request, supabaseClient: any) {
  try {
    const body = await req.json()
    const { event_type, event_data, source } = body

    console.log('Received webhook:', { event_type, source })

    // Validate required fields
    if (!event_type || !event_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event_type, event_data' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Insert webhook event
    const { data, error } = await supabaseClient
      .from('economic_webhook_events')
      .insert({
        event_type,
        event_data,
        processed: false,
        source: source || 'external'
      })

    if (error) {
      throw error
    }

    // Process the event based on type
    await processWebhookEvent(event_type, event_data, supabaseClient)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        event_id: data?.[0]?.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Handle manual trigger update
async function handleTriggerUpdate(req: Request, supabaseClient: any) {
  try {
    const body = await req.json()
    const { update_type, date, indicator } = body

    console.log('Manual trigger update:', { update_type, date, indicator })

    // Create webhook event for manual update
    const { data, error } = await supabaseClient
      .from('economic_webhook_events')
      .insert({
        event_type: 'MANUAL_UPDATE_TRIGGERED',
        event_data: { update_type, date, indicator, timestamp: new Date().toISOString() },
        processed: false
      })

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Update triggered successfully',
        event_id: data?.[0]?.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Trigger update error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Handle status request
async function handleStatus(req: Request, supabaseClient: any) {
  try {
    // Get cache metadata
    const { data: cacheData, error: cacheError } = await supabaseClient
      .from('economic_data_cache_meta')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    if (cacheError) {
      throw cacheError
    }

    // Get total events count
    const { count: totalEvents } = await supabaseClient
      .from('economic_events')
      .select('*', { count: 'exact', head: true })

    // Get upcoming events count
    const { count: upcomingEvents } = await supabaseClient
      .from('economic_events')
      .select('*', { count: 'exact', head: true })
      .eq('is_upcoming', true)

    return new Response(
      JSON.stringify({
        status: 'active',
        last_update: cacheData?.last_updated || 'Never',
        next_update: cacheData?.next_update || 'Unknown',
        total_events: totalEvents || 0,
        upcoming_events: upcomingEvents || 0,
        cache_active: cacheData?.is_active || false,
        error_count: cacheData?.error_count || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Status error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Handle stats request
async function handleStats(req: Request, supabaseClient: any) {
  try {
    // Get events by source
    const { data: sourceData } = await supabaseClient
      .from('economic_events')
      .select('source')
      .not('source', 'is', null)

    const sources: { [key: string]: number } = {}
    sourceData?.forEach((item: any) => {
      sources[item.source] = (sources[item.source] || 0) + 1
    })

    // Get events by importance
    const { data: importanceData } = await supabaseClient
      .from('economic_events')
      .select('importance')
      .not('importance', 'is', null)

    const importance: { [key: string]: number } = {}
    importanceData?.forEach((item: any) => {
      importance[item.importance] = (importance[item.importance] || 0) + 1
    })

    // Get recent webhook events
    const { data: webhookData } = await supabaseClient
      .from('economic_webhook_events')
      .select('event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    return new Response(
      JSON.stringify({
        sources,
        importance,
        recent_webhooks: webhookData || []
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Stats error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Process webhook events
async function processWebhookEvent(eventType: string, eventData: any, supabaseClient: any) {
  try {
    switch (eventType) {
      case 'CACHE_REFRESHED':
        console.log('Cache refreshed event processed')
        break
        
      case 'NEW_EVENT':
        console.log('New event detected:', eventData)
        // Here you could trigger real-time notifications
        break
        
      case 'UPDATE_ERROR':
        console.log('Update error detected:', eventData)
        // Here you could trigger error notifications
        break
        
      case 'MANUAL_UPDATE_TRIGGERED':
        console.log('Manual update triggered:', eventData)
        // Here you could trigger the actual update process
        break
        
      default:
        console.log('Unknown event type:', eventType)
    }

    // Mark webhook event as processed
    await supabaseClient
      .from('economic_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_type', eventType)
      .eq('processed', false)

  } catch (error) {
    console.error('Error processing webhook event:', error)
  }
}


