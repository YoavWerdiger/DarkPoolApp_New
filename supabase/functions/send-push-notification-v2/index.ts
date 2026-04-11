import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

// 🔑 Expo Access Token נדרש לשליחת התראות ל-production builds
// יש להוסיף את הטוקן ב-Supabase Dashboard > Edge Functions > Secrets
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const { userIds, title, body, data, sound = 'default', priority = 'high' } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'userIds is required and must be a non-empty array',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!title || !body) {
      return new Response(
        JSON.stringify({
          error: 'title and body are required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // קבלת כל ה-device tokens של המשתמשים
    const { data: deviceTokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('expo_push_token')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching device tokens:', tokensError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch device tokens',
          details: tokensError.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('No active device tokens found for users:', userIds);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active device tokens found',
          sent: 0,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // יצירת הודעות push לכל ה-tokens
    const messages = deviceTokens.map((token) => ({
      to: token.expo_push_token,
      sound: sound,
      title: title,
      body: body,
      data: data || {},
      priority: priority,
      channelId: 'default',
    }));

    // שליחת התראות דרך Expo Push API
    // 🔑 Access Token נדרש עבור production builds
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    
    // הוסף Authorization header אם יש Access Token
    if (EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`;
      console.log('🔑 Using Expo Access Token for authentication');
    } else {
      console.warn('⚠️ No EXPO_ACCESS_TOKEN found - push notifications may fail for production builds!');
      console.warn('💡 Add EXPO_ACCESS_TOKEN to Supabase Edge Functions secrets');
    }
    
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Expo Push API error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Failed to send push notifications',
          details: errorText,
        }),
        {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const result = await response.json();
    const successCount = result.data?.filter((r) => r.status === 'ok').length || 0;

    console.log(`✅ Sent ${successCount}/${messages.length} push notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: messages.length,
        details: result,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
