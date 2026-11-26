/**
 * iap-apple-notifications — App Store Server Notifications V2 (חידוש, ביטול, החזר, grace).
 * URL ב-App Store Connect → App Information → App Store Server Notifications (Production + Sandbox).
 *
 * לא סומכים על תוכן ההתראה: לוקחים ממנה רק transactionId ושולפים את המצב מחדש מ-Apple.
 * פריסה: supabase functions deploy iap-apple-notifications --no-verify-jwt
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import { applyIapState, decodeJwsPayload, fetchAppleState, resolveOwner } from '../_shared/iap.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let transactionId: string | null = null;
  let notificationType = '';
  try {
    const { signedPayload } = await req.json();
    const payload = decodeJwsPayload<{ notificationType?: string; data?: { signedTransactionInfo?: string } }>(
      String(signedPayload ?? ''),
    );
    notificationType = payload.notificationType ?? '';
    if (payload.data?.signedTransactionInfo) {
      transactionId = decodeJwsPayload<{ transactionId?: string }>(payload.data.signedTransactionInfo).transactionId ?? null;
    }
  } catch {
    return new Response('Bad payload', { status: 400 });
  }
  if (!transactionId) return new Response('ok'); // TEST / CONSUMPTION_REQUEST וכו׳ — אין מה לעדכן

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const state = await fetchAppleState(transactionId);
    const owner = await resolveOwner(supabase, state);
    if (!owner) {
      console.warn('[iap-apple] no owner yet', { notificationType, storeKey: state.storeKey });
      return new Response('ok');
    }
    const res = await applyIapState(supabase, state, owner);
    console.log('[iap-apple]', { notificationType, owner, status: state.status, ok: res.ok, err: res.error });
    return new Response('ok');
  } catch (e) {
    console.error('[iap-apple] failed', { notificationType, err: String(e) });
    return new Response('retry', { status: 500 }); // Apple ינסה שוב
  }
});
