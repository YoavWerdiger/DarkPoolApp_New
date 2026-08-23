/**
 * payment-invoices — authenticated end-user invoice/payment history + document URL resolve.
 *
 * Secrets (ApiPassword) stay server-side. Callers only get their own rows (auth.uid()).
 *
 * POST body:
 *   { action: 'list' }
 *   { action: 'resolve_url', transactionId: string }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  loadCardComConfig,
  resolveCardComDocumentUrl,
} from '../_shared/cardcom.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HISTORY_SELECT =
  'id, amount, currency, status, plan_id, created_at, cardcom_document_type, cardcom_document_number, cardcom_document_url';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mapInvoiceRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency ?? 'ILS',
    status: row.status,
    plan_id: row.plan_id,
    created_at: row.created_at,
    document_type: row.cardcom_document_type ?? null,
    document_number: row.cardcom_document_number ?? null,
    document_url: row.cardcom_document_url ?? null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
    const userId = authData.user.id;

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'list');

    if (action === 'list') {
      // All billable statuses — do NOT require cardcom_document_*; UI shows "מסמך בהכנה" when missing.
      const { data, error } = await svc
        .from('payment_transactions')
        .select(HISTORY_SELECT)
        .eq('user_id', userId)
        .in('status', ['success', 'refunded', 'pending_charge'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[payment-invoices] list failed', error);
        return json({ success: false, error: 'Failed to load invoices' }, 500);
      }

      return json({
        success: true,
        invoices: (data || []).map((row) => mapInvoiceRow(row as Record<string, unknown>)),
      });
    }

    if (action === 'resolve_url') {
      const transactionId = String(body?.transactionId || '').trim();
      if (!transactionId) {
        return json({ success: false, error: 'Missing transactionId' }, 400);
      }

      const { data: order, error: orderErr } = await svc
        .from('payment_transactions')
        .select(
          'id, user_id, status, cardcom_document_type, cardcom_document_number, cardcom_document_url, callback_data',
        )
        .eq('id', transactionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (orderErr || !order) {
        return json({ success: false, error: 'Transaction not found' }, 404);
      }

      const existing =
        typeof order.cardcom_document_url === 'string' ? order.cardcom_document_url.trim() : '';
      if (existing.startsWith('http')) {
        return json({ success: true, document_url: existing, cached: true });
      }

      let fromCallback: string | null = null;
      const cb = order.callback_data;
      if (cb && typeof cb === 'object') {
        const lp = (cb as { getLpResult?: { DocumentInfo?: { DocumentUrl?: string } } })
          .getLpResult;
        const u = lp?.DocumentInfo?.DocumentUrl;
        if (typeof u === 'string' && u.trim().startsWith('http')) fromCallback = u.trim();
        const deferred = (cb as { deferred_charge?: { DocumentUrl?: string } }).deferred_charge;
        const d = deferred?.DocumentUrl;
        if (!fromCallback && typeof d === 'string' && d.trim().startsWith('http')) {
          fromCallback = d.trim();
        }
      }

      const config = await loadCardComConfig(svc);
      if (!config && !fromCallback) {
        return json({ success: false, error: 'Document URL unavailable' }, 503);
      }

      const documentUrl =
        fromCallback ||
        (config
          ? await resolveCardComDocumentUrl(config, {
              documentUrl: null,
              documentNumber: order.cardcom_document_number,
              documentType: order.cardcom_document_type,
            })
          : null);

      if (!documentUrl) {
        return json({
          success: false,
          error: 'Document URL unavailable',
          document_number: order.cardcom_document_number ?? null,
          document_type: order.cardcom_document_type ?? null,
        }, 404);
      }

      await svc
        .from('payment_transactions')
        .update({
          cardcom_document_url: documentUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('user_id', userId);

      return json({ success: true, document_url: documentUrl, cached: false });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[payment-invoices] unexpected', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    }, 500);
  }
});
