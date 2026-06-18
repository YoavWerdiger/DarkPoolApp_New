// supabase/functions/broker-colmex-connect/index.ts
// ----------------------------------------------------------------------------
// Edge Function: יצירת חיבור Colmex Pro למשתמש.
//
// זרימה:
//   1. validate auth Supabase של המשתמש (JWT)
//   2. קבלת username + password מה-body
//   3. POST /authorize אל TraderEvolution → access/refresh tokens
//   4. שמירת credentials + tokens ב-vault.secrets (מוצפנים ע"י Supabase)
//   5. יצירת broker_connections row (status=active)
//   6. GET /accounts → רישום broker_accounts
//   7. GET /config → cache ב-broker_panel_config
//   8. החזרת רשימת accounts ל-app (המשתמש בוחר איזה לחבר לתיק)
//
// קלט (POST JSON):
//   { username: string, password: string, environment?: 'uat'|'prod' }
//
// פלט:
//   { connectionId, accounts: [{ brokerAccountId, name, type, currency, status }] }
//
// אבטחה: ה-Edge Function דורש Supabase JWT באותו אופן כמו כל endpoint רגיל.
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  type ColmexEnv,
  type ColmexAccount,
  authorizeWithPassword,
  listAccounts,
  getConfig,
  listInstruments,
  colmexInstrumentToMapRow,
} from '../_shared/colmex.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ConnectRequest {
  username?: string;
  password?: string;
  environment?: ColmexEnv;
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

  // ---------- 1. Auth user (JWT) ----------
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const jwt = authHeader.slice('Bearer '.length);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  // client לאימות הזהות
  const sbAuth = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sbAuth.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'unauthorized', detail: userErr?.message }, 401);
  }
  const userId = userData.user.id;

  // client עבור כתיבות (service role — עוקף RLS)
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ---------- 2. body validation ----------
  let body: ConnectRequest;
  try {
    body = (await req.json()) as ConnectRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  const username = body.username?.trim();
  const password = body.password;
  const env: ColmexEnv = body.environment === 'prod' ? 'prod' : 'uat';
  if (!username || !password) {
    return jsonResponse({ error: 'missing_credentials' }, 400);
  }

  // ---------- 3. authorize against TraderEvolution ----------
  let tokens;
  try {
    tokens = await authorizeWithPassword(env, { username, password });
  } catch (e) {
    return jsonResponse({ error: 'broker_auth_failed', detail: (e as Error).message }, 401);
  }

  // ---------- 4. שמירת secrets ב-vault.secrets ----------
  // שם secret ייחודי – נשתמש ב-user_id כדי לאפשר rotation
  const credSecretName = `colmex:${env}:cred:${userId}`;
  const tokenSecretName = `colmex:${env}:tok:${userId}`;

  const credJson = JSON.stringify({ username, password });
  const tokenJson = JSON.stringify(tokens);

  const credSecretId = await upsertVaultSecret(sb, credSecretName, credJson, `Colmex ${env} credentials for ${userId}`);
  const tokenSecretId = await upsertVaultSecret(sb, tokenSecretName, tokenJson, `Colmex ${env} tokens for ${userId}`);

  if (!credSecretId) {
    return jsonResponse({ error: 'vault_write_failed' }, 500);
  }

  // ---------- 5. broker_connections upsert ----------
  const { data: conn, error: connErr } = await sb
    .from('broker_connections')
    .upsert(
      {
        user_id: userId,
        broker: 'colmex_pro',
        environment: env,
        display_name: 'Colmex Pro',
        status: 'active',
        vault_secret_name: credSecretName,
        vault_token_secret_name: tokenSecretName,
        token_expires_at: new Date(tokens.expiresAt).toISOString(),
        last_sync_at: null,
        last_sync_status: null,
        last_sync_error: null,
      },
      { onConflict: 'user_id,broker,environment' }
    )
    .select()
    .single();

  if (connErr || !conn) {
    return jsonResponse({ error: 'connection_save_failed', detail: connErr?.message }, 500);
  }

  // ---------- 6. accounts + 7. config ----------
  let accounts: ColmexAccount[] = [];
  try {
    accounts = await listAccounts(env, tokens);
  } catch (e) {
    return jsonResponse({ error: 'broker_accounts_failed', detail: (e as Error).message }, 502);
  }

  if (accounts.length === 0) {
    return jsonResponse({ error: 'no_accounts_found' }, 404);
  }

  const accountRows = accounts.map((a) => ({
    connection_id: conn.id,
    user_id: userId,
    broker_account_id: a.id,
    account_name: a.name,
    account_type: (a.type ?? null) as string | null,
    currency: a.currency ?? 'USD',
    status: a.status ?? null,
    trading_rules: a.tradingRules ?? null,
    risk_rules: a.riskRules ?? null,
    margin_rules: a.marginRules ?? null,
  }));

  const { error: accErr } = await sb
    .from('broker_accounts')
    .upsert(accountRows, { onConflict: 'connection_id,broker_account_id' });

  if (accErr) {
    return jsonResponse({ error: 'accounts_save_failed', detail: accErr.message }, 500);
  }

  // cache /config – שמות עמודות לפאנלים
  try {
    const config = await getConfig(env, tokens);
    if (config) {
      const panels: Array<{ id: string; cfg: { columns?: { id: string; description?: string }[] } | undefined }> = [
        { id: 'positions',       cfg: config.positionsConfig },
        { id: 'orders',          cfg: config.ordersConfig },
        { id: 'ordersHistory',   cfg: config.ordersHistoryConfig },
        { id: 'filledOrders',    cfg: config.filledOrdersConfig },
        { id: 'accountDetails',  cfg: config.accountDetailsConfig },
        { id: 'statements',      cfg: config.statementsConfig },
      ];
      for (const p of panels) {
        if (!p.cfg?.columns?.length) continue;
        await sb.from('broker_panel_config').upsert(
          {
            broker: 'colmex_pro',
            panel_id: p.id,
            columns: p.cfg.columns,
            customer_access: config.customerAccess ?? null,
            rate_limits: config.rateLimits ?? null,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'broker,panel_id' }
        );
      }
    }
  } catch (e) {
    console.warn('config cache failed (non-fatal):', (e as Error).message);
  }

  // bootstrap instrument map for primary account (best-effort)
  try {
    const firstAcc = accounts[0];
    const instruments = await listInstruments(env, tokens, firstAcc.id);
    if (instruments.length > 0) {
      const rows = instruments.map((i) => colmexInstrumentToMapRow(i, 'colmex_pro'));
      // batched upsert (chunk to avoid massive request)
      const chunk = 500;
      for (let i = 0; i < rows.length; i += chunk) {
        await sb
          .from('broker_instrument_map')
          .upsert(rows.slice(i, i + chunk), { onConflict: 'broker,tradable_instrument_id' });
      }
    }
  } catch (e) {
    console.warn('instrument map bootstrap failed (non-fatal):', (e as Error).message);
  }

  return jsonResponse({
    connectionId: conn.id,
    environment: env,
    accounts: accounts.map((a) => ({
      brokerAccountId: a.id,
      name: a.name,
      type: a.type ?? null,
      currency: a.currency ?? 'USD',
      status: a.status ?? null,
    })),
  });
});

/**
 * שומר secret ב-vault.secrets דרך RPC עזר (broker_upsert_vault_secret).
 * ה-RPC מוגדר ב-migration 027_broker_integration.sql ומשמש רק עם service_role.
 */
async function upsertVaultSecret(
  sb: ReturnType<typeof createClient>,
  name: string,
  secret: string,
  description: string
): Promise<string | null> {
  const { data, error } = await sb.rpc('broker_upsert_vault_secret', {
    p_name: name,
    p_secret: secret,
    p_description: description,
  });
  if (error) {
    console.error('upsertVaultSecret error:', error.message);
    return null;
  }
  return (data as string | null) ?? null;
}
