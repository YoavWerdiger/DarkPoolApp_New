// supabase/functions/broker-link-account/index.ts
// ----------------------------------------------------------------------------
// Edge Function: יצירת תיק חדש מסונכרן ל-broker_account מסוים.
//
// קלט:
//   {
//     brokerAccountId: string,         // ה-UUID של broker_accounts (לא ה-id החיצוני!)
//     name?: string,                   // שם תיק (default: שם ניטרלי "תיק Colmex Pro")
//     currency?: string,
//     description?: string,
//     triggerSync?: boolean            // אם true – יחל סנכרון מלא מיד
//   }
//
// פלט:
//   { portfolioId, brokerAccountId, brokerExternalId, name, alreadyLinked?, syncOk?, syncError? }
//
// אחרי יצירת/קישור תיק מריצים תמיד sync מלא (אלא אם triggerSync=false),
// כולל גשר positions→trades — כדי שלא יישאר תיק עם מזומן בלבד.
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

const BASE_PORTFOLIO_NAME = 'תיק Colmex Pro';

/**
 * שם ניטרלי לתיק ברוקר — בלי שם משתמש / מספר חשבון של הברוקר.
 * אם למשתמש כבר יש "תיק Colmex Pro", מוסיפים סיפרה עולה.
 */
async function nextNeutralPortfolioName(
  sb: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await sb
    .from('portfolios')
    .select('name')
    .eq('user_id', userId)
    .like('name', `${BASE_PORTFOLIO_NAME}%`);

  const taken = new Set((data ?? []).map((r: { name: string }) => r.name));
  if (!taken.has(BASE_PORTFOLIO_NAME)) return BASE_PORTFOLIO_NAME;
  for (let i = 2; i < 100; i++) {
    const candidate = `${BASE_PORTFOLIO_NAME} ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return BASE_PORTFOLIO_NAME;
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
    .select('id,user_id,connection_id,broker_account_id,currency,portfolio_id')
    .eq('id', body.brokerAccountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (accErr || !acc) return jsonResponse({ error: 'broker_account_not_found' }, 404);

  // שם התיק לעולם לא נגזר מ-account_name / login של הברוקר (מידע רגיש שעלול
  // להיחשף בתיק ציבורי). ברירת המחדל ניטרלית, וממוספרת אם למשתמש כבר יש תיק כזה.
  let portfolioId: string = acc.portfolio_id;
  let portfolioName = (body.name || (await nextNeutralPortfolioName(sb, userId))).slice(0, 128);
  let alreadyLinked = false;

  if (acc.portfolio_id) {
    alreadyLinked = true;
    const { data: existingPf } = await sb
      .from('portfolios')
      .select('id,name,source')
      .eq('id', acc.portfolio_id)
      .maybeSingle();
    if (existingPf?.name) portfolioName = existingPf.name;
    // אם התיק הישן נותק ל-manual — מחזירים אותו ל-colmex_pro לפני sync
    if (existingPf && existingPf.source !== 'colmex_pro') {
      await sb
        .from('portfolios')
        .update({
          source: 'colmex_pro',
          broker_account_id: acc.id,
          read_only: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', acc.portfolio_id);
    }
  } else {
    const currency = body.currency || acc.currency || 'USD';

    const { data: portfolio, error: pErr } = await sb
      .from('portfolios')
      .insert({
        user_id: userId,
        name: portfolioName,
        currency,
        risk_free_rate: 4.0,
        benchmark_symbol: 'SPY',
        auto_adjust_splits: true,
        description: body.description ?? 'מסונכרן אוטומטית מחשבון Colmex Pro',
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

    portfolioId = portfolio.id;
    await sb
      .from('broker_accounts')
      .update({ portfolio_id: portfolio.id })
      .eq('id', acc.id);
  }

  // סנכרון מלא חובה אחרי link/clone — positions→trades, executions, statements, snapshots
  let syncOk = false;
  let syncError: string | null = null;
  if (body.triggerSync !== false) {
    try {
      const syncUrl = `${SUPABASE_URL}/functions/v1/broker-colmex-sync`;
      const syncRes = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          connectionId: acc.connection_id,
          brokerAccountIds: [acc.broker_account_id],
          full: true,
        }),
      });
      if (!syncRes.ok) {
        syncError = `sync_http_${syncRes.status}`;
        console.warn('sync trigger failed:', syncError, await syncRes.text().catch(() => ''));
      } else {
        const syncBody = (await syncRes.json().catch(() => null)) as {
          ok?: boolean;
          results?: Array<{ status?: string; error?: string }>;
        } | null;
        const first = syncBody?.results?.[0];
        syncOk = first?.status === 'success' || first?.status === 'partial' || syncBody?.ok === true;
        if (!syncOk) syncError = first?.error ?? 'sync_failed';
        // לאחר sync: ודא שפוזיציות עברו ל-trades (גם אם ingest כבר רץ ב-sync)
        await sb.rpc('sync_broker_positions_to_trades', {
          p_broker_account_id: acc.id,
        });
      }
    } catch (e) {
      syncError = (e as Error).message;
      console.warn('sync trigger failed:', syncError);
    }
  }

  return jsonResponse({
    portfolioId,
    brokerAccountId: acc.id,
    brokerExternalId: acc.broker_account_id,
    name: portfolioName,
    alreadyLinked,
    syncOk,
    syncError,
  });
});
