import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const { token, title, body } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'token is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    
    if (EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`;
    }

    const message = {
      to: token,
      sound: 'default',
      title: title || 'Test',
      body: body || 'Test notification',
    };

    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify([message]),
    });

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: response.ok,
        hasToken: !!EXPO_ACCESS_TOKEN,
        result,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

