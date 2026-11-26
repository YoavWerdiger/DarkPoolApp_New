/**
 * iap-google-notifications — Google Play Real-time Developer Notifications (Pub/Sub push).
 * Push endpoint: https://<project>.supabase.co/functions/v1/iap-google-notifications?secret=<IAP_GOOGLE_PUSH_SECRET>
 *
 * לא סומכים על תוכן ההודעה: לוקחים purchaseToken + productId ושולפים את המצב מחדש מ-Google.
 * פריסה: supabase functions deploy iap-google-notifications --no-verify-jwt
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import { applyIapState, fetchGoogleState, resolveOwner } from '../_shared/iap.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const expected = Deno.env.get('IAP_GOOGLE_PUSH_SECRET');
  if (!expected || new URL(req.url).searchParams.get('secret') !== expected) {
    return new Response('Forbidden', { status: 403 });
  }

  let token: string | null = null;
  let productId: string | null = null;
  try {
    const body = await req.json();
    const data = JSON.parse(atob(String(body?.message?.data ?? '')));
    if (data.subscriptionNotification) {
      token = data.subscriptionNotification.purchaseToken;
      productId = data.subscriptionNotification.subscriptionId;
    } else if (data.oneTimeProductNotification) {
      token = data.oneTimeProductNotification.purchaseToken;
      productId = data.oneTimeProductNotification.sku;
    } else if (data.voidedPurchaseNotification) {
      token = data.voidedPurchaseNotification.purchaseToken;
    }
  } catch {
    return new Response('ok'); // הודעה לא תקינה — לא לבקש שליחה חוזרת
  }
  if (!token) return new Response('ok');

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!productId) {
    // voided purchase מגיע בלי מזהה מוצר — לוקחים אותו מהרכישה השמורה
    const { data } = await supabase
      .from('iap_purchases')
      .select('product_id')
      .eq('platform', 'android')
      .eq('store_key', token)
      .maybeSingle();
    productId = (data?.product_id as string) ?? null;
    if (!productId) return new Response('ok');
  }

  try {
    const state = await fetchGoogleState(token, productId);
    const owner = await resolveOwner(supabase, state);
    if (!owner) {
      console.warn('[iap-google] no owner yet', { productId });
      return new Response('ok');
    }
    const res = await applyIapState(supabase, state, owner);
    console.log('[iap-google]', { productId, owner, status: state.status, ok: res.ok, err: res.error });
    return new Response('ok');
  } catch (e) {
    console.error('[iap-google] failed', { productId, err: String(e) });
    return new Response('retry', { status: 500 });
  }
});
