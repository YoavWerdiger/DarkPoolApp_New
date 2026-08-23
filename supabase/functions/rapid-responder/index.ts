/**
 * rapid-responder — CardCom webhook + GetLpResult validation
 *
 * Unauthenticated webhook; authenticity via GetLpResult (timeout 5s, retry×1).
 * Match orders by LowProfileId only (never ReturnValue as primary key).
 * Do not show CardCom Description to buyers.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  activateSubscriptionFromPayment,
  extractCardDisplayFromLp,
  getLpResult,
  loadCardComConfig,
  mapVerifiedStatus,
  resolveCardComDocumentUrl,
} from '../_shared/cardcom.ts';

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

async function parseWebhookBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const data = await req.json().catch(() => ({}));
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }
  // CardCom may post form-urlencoded / multipart
  try {
    const form = await req.formData();
    return Object.fromEntries(form.entries()) as Record<string, unknown>;
  } catch {
    const text = await req.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function webViewHtml(isSuccess: boolean, transactionId: string, status: string) {
  const messageType = isSuccess ? 'payment_success' : 'payment_failed';
  const message = isSuccess ? 'התשלום הושלם בהצלחה' : 'התשלום נכשל';
  return `<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>תשלום</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#fff;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}
.box{padding:32px;max-width:360px}.ok{color:#00E654}.bad{color:#FF4444}
</style></head><body><div class="box">
<div class="${isSuccess ? 'ok' : 'bad'}" style="font-size:48px">${isSuccess ? '✓' : '✕'}</div>
<h1>${message}</h1>
<p>${isSuccess ? 'המנוי שלך הופעל בהצלחה' : 'אנא נסו שוב או פנו לתמיכה'}</p>
</div>
<script>
var msg={type:'${messageType}',transactionId:'${transactionId}',status:'${status}',message:'${message}'};
if(window.parent&&window.parent!==window)window.parent.postMessage(JSON.stringify(msg),'*');
if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(msg));
</script></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const wantsHtml = (req.headers.get('accept') || '').includes('text/html');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const webhook = await parseWebhookBody(req);
    const lowProfileId = String(webhook.LowProfileId || webhook.lowProfileId || '').trim();

    if (!lowProfileId) {
      console.error('[rapid-responder] HIGH missing LowProfileId', webhook);
      return json({ success: false, error: 'Missing LowProfileId' }, 400);
    }

    const { data: order, error: orderErr } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('cardcom_low_profile_id', lowProfileId)
      .maybeSingle();

    if (orderErr || !order) {
      console.error('[rapid-responder] HIGH order not found for LowProfileId', lowProfileId, orderErr);
      return json({ success: false, error: 'Order not found' }, 404);
    }

    // Idempotent: already has cardcom_transaction_id (incl. "0" for CreateTokenOnly)
    if (order.cardcom_transaction_id != null && String(order.cardcom_transaction_id).length > 0) {
      console.log('[rapid-responder] idempotent skip', order.id, order.cardcom_transaction_id);
      if (wantsHtml) {
        const ok = order.status === 'success';
        return new Response(webViewHtml(ok, order.id, order.status), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return json({ success: true, idempotent: true, status: order.status });
    }

    const config = await loadCardComConfig(supabase);
    if (!config) {
      console.error('[rapid-responder] HIGH CardCom config missing');
      return json({ success: false, error: 'Payment config unavailable' }, 500);
    }

    let lp: Awaited<ReturnType<typeof getLpResult>>;
    try {
      lp = await getLpResult(config, lowProfileId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[rapid-responder] GetLpResult failed after retry', msg);
      return json({ success: false, error: msg }, 500);
    }

    const responseCode = Number(lp.ResponseCode);
    const operation = lp.Operation != null ? String(lp.Operation) : order.cardcom_operation;
    const mapped = mapVerifiedStatus(responseCode, operation);

    let cardcomTxnId = mapped.transactionIdToStore;
    if (mapped.status === 'success') {
      cardcomTxnId =
        lp.TranzactionId != null && Number(lp.TranzactionId) !== 0
          ? String(lp.TranzactionId)
          : order.cardcom_transaction_id;
      // Ensure non-null for idempotency on success
      if (!cardcomTxnId) cardcomTxnId = `ok_${order.id}`;
    }

    const tokenInfo = lp.TokenInfo || {};
    const docInfo = lp.DocumentInfo || {};

    const documentType = docInfo.DocumentType != null ? String(docInfo.DocumentType) : null;
    const documentNumber =
      docInfo.DocumentNumber != null ? Number(docInfo.DocumentNumber) : null;
    let documentUrl: string | null = null;
    if (mapped.status === 'success' || mapped.status === 'pending_charge') {
      documentUrl = await resolveCardComDocumentUrl(config, {
        documentUrl: docInfo.DocumentUrl,
        documentNumber,
        documentType,
      });
    }

    const patch: Record<string, unknown> = {
      status: mapped.status,
      cardcom_operation: operation || order.cardcom_operation,
      cardcom_response_code: String(lp.ResponseCode ?? ''),
      cardcom_description: lp.Description ?? null,
      cardcom_document_type: documentType,
      cardcom_document_number: documentNumber,
      cardcom_document_url: documentUrl,
      cardcom_token: tokenInfo.Token ?? null,
      cardcom_token_card_year: tokenInfo.CardYear != null ? Number(tokenInfo.CardYear) : null,
      cardcom_token_card_month: tokenInfo.CardMonth != null ? Number(tokenInfo.CardMonth) : null,
      cardcom_token_token_approval_number: tokenInfo.TokenApprovalNumber ?? null,
      cardcom_token_card_owner_identity_number: tokenInfo.CardOwnerIdentityNumber ?? null,
      callback_data: { webhook, getLpResult: lp },
      updated_at: new Date().toISOString(),
    };
    if (cardcomTxnId != null) patch.cardcom_transaction_id = cardcomTxnId;

    const { error: updErr } = await supabase
      .from('payment_transactions')
      .update(patch)
      .eq('id', order.id);

    if (updErr) {
      console.error('[rapid-responder] update order failed', updErr);
      return json({ success: false, error: 'DB update failed' }, 500);
    }

    // Activate subscription only after verified success (not pending_charge / failed)
    if (mapped.activateSubscription && mapped.status === 'success' && order.user_id && order.plan_id) {
      const cardDisplay = extractCardDisplayFromLp(lp);
      const act = await activateSubscriptionFromPayment(supabase, {
        userId: order.user_id,
        planId: order.plan_id,
        sourceTransactionId: order.id,
        paymentToken: tokenInfo.Token ? String(tokenInfo.Token) : null,
        tokenExpDate: tokenInfo.TokenExDate ? String(tokenInfo.TokenExDate) : null,
        cardLast4: cardDisplay.last4 ?? undefined,
        cardBrand: cardDisplay.brand ?? undefined,
      });
      if (!act.ok) console.error('[rapid-responder] subscription activate failed', act.error);
      else console.log('[rapid-responder] subscription activated', { already: act.alreadyGranted });
    } else if (mapped.status === 'pending_charge') {
      console.log('[rapid-responder] pending_charge — no subscription activation (Task 7 deferred charge)', order.id);
    }

    if (wantsHtml) {
      return new Response(
        webViewHtml(mapped.status === 'success', order.id, mapped.status),
        { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    return json({ success: true, status: mapped.status, transactionId: order.id });
  } catch (error) {
    console.error('[rapid-responder] unexpected', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    }, 500);
  }
});
