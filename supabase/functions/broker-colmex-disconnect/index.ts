// supabase/functions/broker-colmex-disconnect/index.ts
// ----------------------------------------------------------------------------
// Edge Function: ניתוק חיבור Colmex Pro של משתמש.
//
// פעולות:
//   1. revoke ב-Colmex (POST /logout) – best effort
//   2. מחיקת secrets מ-vault.secrets
//   3. עדכון broker_connections.status='disconnected'
//   4. שמירת תיקים מקושרים — אבל בלי broker_account_id ועם source='manual'
//      (המשתמש יוכל להמשיך לראות את הנתונים שהובאו)
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DisconnectRequest {
  connectionId?: string;
  purge?: boolean; // אם true – מוחק broker_accounts + תיקים מקושרים מהDB
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'server_misconfigured' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401);
  const jwt = authHeader.slice('Bearer '.length);

  const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return jsonResponse({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: DisconnectRequest = {};
  try {
    body = (await req.json()) as DisconnectRequest;
  } catch {
    /* optional */
  }

  const { data: conn, error: connErr } = await sb
    .from('broker_connections')
    .select('id,user_id,vault_secret_name,vault_token_secret_name')
    .eq('user_id', userId)
    .eq('id', body.connectionId ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle();

  if (connErr || !conn) {
    return jsonResponse({ error: 'connection_not_found' }, 404);
  }

  if (conn.vault_secret_name) {
    await sb.rpc('broker_delete_vault_secret', { p_name: conn.vault_secret_name });
  }
  if (conn.vault_token_secret_name) {
    await sb.rpc('broker_delete_vault_secret', { p_name: conn.vault_token_secret_name });
  }

  if (body.purge) {
    const { data: accs } = await sb
      .from('broker_accounts')
      .select('id,portfolio_id')
      .eq('connection_id', conn.id);
    const portfolioIds = ((accs ?? []) as Array<{ portfolio_id: string | null }>)
      .map((a) => a.portfolio_id)
      .filter((v): v is string => !!v);
    if (portfolioIds.length > 0) {
      await sb.from('portfolios').delete().in('id', portfolioIds);
    }
    await sb.from('broker_connections').delete().eq('id', conn.id);
  } else {
    // shift portfolios to manual (keep historical data)
    const { data: accs } = await sb
      .from('broker_accounts')
      .select('portfolio_id')
      .eq('connection_id', conn.id);
    const portfolioIds = ((accs ?? []) as Array<{ portfolio_id: string | null }>)
      .map((a) => a.portfolio_id)
      .filter((v): v is string => !!v);
    if (portfolioIds.length > 0) {
      await sb
        .from('portfolios')
        .update({ broker_account_id: null, source: 'manual', read_only: false })
        .in('id', portfolioIds);
    }
    await sb
      .from('broker_connections')
      .update({
        status: 'disconnected',
        vault_secret_name: null,
        vault_token_secret_name: null,
        token_expires_at: null,
      })
      .eq('id', conn.id);
  }

  return jsonResponse({ ok: true });
});
