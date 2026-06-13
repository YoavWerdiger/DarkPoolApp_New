import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// RapidAPI configuration
const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') ?? '';
const RAPIDAPI_BASE_URL = 'https://fear-and-greed-index.p.rapidapi.com';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Fear and Greed Index: Starting update...');

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

    // Fetch data from RapidAPI
    const response = await fetch(`${RAPIDAPI_BASE_URL}/v1/fgi`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'fear-and-greed-index.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json();
    console.log('📊 Fear and Greed Index: Raw API response received');

    // Parse the response
    let value: number | null = null;
    let valueClassification: string;
    let timestamp: number;

    if (rawData.fgi?.now) {
      // חשוב: אנחנו **לא** מחליפים value חסר ב-50 כברירת מחדל —
      // עדיף לזרוק שגיאה ולשמור על הערך הקודם בטבלה מאשר לדרוס נתון
      // אמיתי בערך "ניטרלי" סינתטי שילבש מסכת אמת ב-UI.
      const rawValue = rawData.fgi.now.value;
      if (typeof rawValue === 'number') {
        value = rawValue;
      } else if (typeof rawValue === 'string' && rawValue.trim() !== '') {
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed)) value = parsed;
      }
      valueClassification = rawData.fgi.now.valueText ||
                          rawData.fgi.now.valueClassification ||
                          'Neutral';
      timestamp = rawData.fgi.now.timestamp ||
                 rawData.fgi.now.lastUpdated?.epochUnixSeconds ||
                 Math.floor(Date.now() / 1000);
    } else if (rawData.value !== undefined) {
      const rawValue = rawData.value;
      if (typeof rawValue === 'number') {
        value = rawValue;
      } else if (typeof rawValue === 'string' && rawValue.trim() !== '') {
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed)) value = parsed;
      }
      valueClassification = rawData.valueClassification || rawData.valueText || 'Neutral';
      timestamp = rawData.timestamp || Math.floor(Date.now() / 1000);
    } else {
      throw new Error('Unexpected API response format');
    }

    if (value == null || !Number.isFinite(value)) {
      throw new Error(
        `Fear and Greed API returned no numeric value (raw=${JSON.stringify(rawData).slice(0, 200)})`
      );
    }

    // Ensure value is within 0-100 range
    value = Math.max(0, Math.min(100, value));

    // Save to database (upsert - update if exists, insert if not)
    const { error: dbError } = await supabaseClient
      .from('fear_and_greed_index')
      .upsert({
        id: 1, // Single row for current value
        value: value,
        value_classification: valueClassification,
        timestamp: timestamp,
        updated_at: new Date().toISOString(),
        raw_data: rawData, // Store full response for reference
      }, {
        onConflict: 'id'
      });

    if (dbError) {
      console.error('❌ Fear and Greed Index: Database error:', dbError);
      throw dbError;
    }

    console.log('✅ Fear and Greed Index: Successfully updated', {
      value,
      classification: valueClassification,
      timestamp: new Date(timestamp * 1000).toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fear and Greed Index updated successfully',
        data: {
          value,
          valueClassification,
          timestamp,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Fear and Greed Index: Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
})


