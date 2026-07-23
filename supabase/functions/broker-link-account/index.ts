// supabase/functions/broker-link-account/index.ts
// ----------------------------------------------------------------------------
// Edge Function: יצירת תיק חדש מסונכרן ל-broker_account מסוים.
//
// קלט:
//   {
//     brokerAccountId: string,         // ה-UUID של broker_accounts (לא ה-id החיצוני!)
//     name?: string,                   // שם תיק (default: account_name של ה-broker)
//     currency?: string,
//     description?: string,
//     triggerSync?: boolean            // אם true – יחל סנכרון מלא מיד
//   }
//
// פלט:
//   { portfolioId, brokerAccountId, brokerExternalId, name }
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LinkRequest {
  brokerAccountId?: string;
  name?: string;
  currency?: string;
  description?: string;
  triggerSync?: boolean;
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

  let body: LinkRequest = {};
  try {
    body = (await req.json()) as LinkRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (!body.brokerAccountId) return jsonResponse({ error: 'missing_brokerAccountId' }, 400);

  const { data: acc, error: accErr } = await sb
    .from('broker_accounts')
    .select('id,user_id,connection_id,broker_account_id,account_name,currency,portfolio_id')
    .eq('id', body.brokerAccountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (accErr || !acc) return jsonResponse({ error: 'broker_account_not_found' }, 404);

  if (acc.portfolio_id) {
    return jsonResponse({
      portfolioId: acc.portfolio_id,
      brokerAccountId: acc.id,
      brokerExternalId: acc.broker_account_id,
      name: body.name ?? acc.account_name,
      alreadyLinked: true,
    });
  }

  const portfolioName = (body.name || acc.account_name || `Colmex ${acc.broker_account_id}`).slice(0, 128);
  const currency = body.currency || acc.currency || 'USD';

  // create portfolio
  const { data: portfolio, error: pErr } = await sb
    .from('portfolios')
    .insert({
      user_id: userId,
      name: portfolioName,
      currency,
      risk_free_rate: 4.0,
      benchmark_symbol: 'SPY',
      auto_adjust_splits: true,
      description: body.description ?? `מסונכרן מ-Colmex Pro · חשבון ${acc.broker_account_id}`,
      is_public: false,
      is_archived: false,
      source: 'colmex_pro',
      broker_account_id: acc.id,
      read_only: true,
    })
    .select('id')
    .single();
  if (pErr || !portfolio) {
    return jsonResponse({ error: 'portfolio_create_failed', detail: pErr?.message }, 500);
  }

  await sb
    .from('broker_accounts')
    .update({ portfolio_id: portfolio.id })
    .eq('id', acc.id);

  // trigger sync (best-effort)
  if (body.triggerSync) {
    try {
      const syncUrl = `${SUPABASE_URL}/functions/v1/broker-colmex-sync`;
      await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ connectionId: acc.connection_id, full: true }),
      });
    } catch (e) {
      console.warn('sync trigger failed:', (e as Error).message);
    }
  }

  return jsonResponse({
    portfolioId: portfolio.id,
    brokerAccountId: acc.id,
    brokerExternalId: acc.broker_account_id,
    name: portfolioName,
  });
});
