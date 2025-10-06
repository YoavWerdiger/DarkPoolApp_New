import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    console.log('🕐 Economic Cron Job triggered at:', new Date().toISOString())

    // Get Supabase URL and service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Call the economic scheduler function
    const schedulerUrl = `${supabaseUrl}/functions/v1/economic-scheduler/update-economic-data`;
    
    const response = await fetch(schedulerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scheduler call failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Economic data update result:', result);

    // Also trigger cleanup if it's been a while
    const cleanupResponse = await fetch(`${supabaseUrl}/functions/v1/economic-scheduler/cleanup-old-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (cleanupResponse.ok) {
      const cleanupResult = await cleanupResponse.json();
      console.log('🧹 Cleanup result:', cleanupResult);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cron job completed successfully',
        timestamp: new Date().toISOString(),
        update_result: result
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Cron job failed:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})


