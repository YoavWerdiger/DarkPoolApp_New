/**
 * iap-verify — הלקוח שולח רכישה מ-Apple/Google אחרי requestPurchase; השרת שולף את המצב
 * מה-API של החנות, מעניק זכאות, ורק אם הצליח הלקוח קורא ל-finishTransaction.
 *
 * Body: { platform: 'ios', transactionId } | { platform: 'android', purchaseToken, productId }
 * Response: { ok, entitled, planId, status, expiresAt } | { error }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import { applyIapState, fetchAppleState, fetchGoogleState, type IapState } from '../_shared/iap.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(authHeader.slice('Bearer '.length));
  if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);
  const userId = authData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  let state: IapState;
  try {
    if (body.platform === 'ios' && typeof body.transactionId === 'string' && body.transactionId) {
      state = await fetchAppleState(body.transactionId);
    } else if (
      body.platform === 'android' &&
      typeof body.purchaseToken === 'string' &&
      body.purchaseToken &&
      typeof body.productId === 'string'
    ) {
      state = await fetchGoogleState(body.purchaseToken, body.productId);
    } else {
      return json({ error: 'Invalid purchase payload' }, 400);
    }
  } catch (e) {
    console.error('[iap-verify] store lookup failed', { userId, err: String(e) });
    return json({ error: 'store_verification_failed' }, 502);
  }

  if (state.status === 'pending') {
    return json({ ok: true, entitled: false, status: 'pending', planId: state.planId, expiresAt: null });
  }

  const result = await applyIapState(supabase, state, userId);
  if (!result.ok) {
    console.error('[iap-verify] apply failed', { userId, storeKey: state.storeKey, err: result.error });
    return json({ error: result.error ?? 'apply_failed' }, result.error === 'owned_by_other_account' ? 409 : 500);
  }
  console.log('[iap-verify] ok', { userId, platform: state.platform, planId: state.planId, status: state.status });
  return json({
    ok: true,
    entitled: result.entitled,
    status: state.status,
    planId: state.planId,
    expiresAt: state.expiresAt,
  });
});
