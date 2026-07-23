// supabase/functions/dark-pool-alerts/index.ts
// ----------------------------------------------------------------------------
// סורק dark_pool_signals חדשים, חוצה עם dark_pool_watchlists, שולח Push
// למשתמשי Premium בלבד, ושומר ב-dark_pool_alerts_log למניעת כפילויות.
//
// מופעל ע"י Scheduled Function כל דקה (אופציונלי — ניתן גם כ-DB trigger).
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PREMIUM_ROLES = ['plus_user', 'premium_user', 'vip_user', 'admin'];

interface SignalRow {
  id: string;
  ticker: string;
  signal_type: string;
  score: number;
  reason: string | null;
  ai_summary: string | null;
  metrics: Record<string, unknown>;
  detected_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // 1. Take recent high-quality signals (last 15 minutes, score >= 60).
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: signals, error: sErr } = await supabase
      .from('dark_pool_signals')
      .select('id, ticker, signal_type, score, reason, ai_summary, metrics, detected_at')
      .gte('detected_at', since)
      .gte('score', 60)
      .order('detected_at', { ascending: true });
    if (sErr) throw sErr;
    if (!signals?.length) return jsonOk({ sent: 0 });

    // 2. Group by ticker for batch fan-out.
    const tickers = Array.from(new Set((signals as SignalRow[]).map((s) => s.ticker)));

    // 3. Premium watchers per ticker.
    const { data: watchers } = await supabase
      .from('dark_pool_watchlists')
      .select('user_id, ticker, alerts_on')
      .in('ticker', tickers)
      .eq('alerts_on', true);
    if (!watchers?.length) return jsonOk({ sent: 0 });

    const watcherIds = Array.from(new Set(watchers.map((w) => w.user_id)));

    // 4. Filter only premium users.
    const { data: subs } = await supabase
      .from('user_subscriptions')
      .select('user_id, status, subscription_plans!inner(role)')
      .in('user_id', watcherIds)
      .eq('status', 'active');

    const premiumUserIds = new Set<string>();
    for (const r of (subs || []) as Array<{
      user_id: string;
      subscription_plans?: { role?: string } | null;
    }>) {
      const role = r.subscription_plans?.role || '';
      if (PREMIUM_ROLES.includes(role)) premiumUserIds.add(r.user_id);
    }
    if (premiumUserIds.size === 0) return jsonOk({ sent: 0 });

    // 5. Build fan-out matrix (user, signal).
    const fanout: Array<{ user_id: string; signal: SignalRow }> = [];
    for (const sig of signals as SignalRow[]) {
      for (const w of watchers) {
        if (w.ticker !== sig.ticker) continue;
        if (!premiumUserIds.has(w.user_id)) continue;
        fanout.push({ user_id: w.user_id, signal: sig });
      }
    }
    if (!fanout.length) return jsonOk({ sent: 0 });

    // 6. Filter already-sent rows.
    const { data: existing } = await supabase
      .from('dark_pool_alerts_log')
      .select('user_id, signal_id')
      .in('user_id', Array.from(premiumUserIds))
      .in('signal_id', fanout.map((f) => f.signal.id));
    const sent = new Set((existing || []).map((e) => `${e.user_id}|${e.signal_id}`));
    const pending = fanout.filter((f) => !sent.has(`${f.user_id}|${f.signal.id}`));
    if (!pending.length) return jsonOk({ sent: 0 });

    // 7. Lookup device tokens.
    const userIds = Array.from(new Set(pending.map((p) => p.user_id)));
    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('user_id, expo_push_token, is_active')
      .in('user_id', userIds)
      .eq('is_active', true);
    const tokensByUser = new Map<string, string[]>();
    for (const t of (tokens || []) as Array<{ user_id: string; expo_push_token: string }>) {
      const list = tokensByUser.get(t.user_id) || [];
      list.push(t.expo_push_token);
      tokensByUser.set(t.user_id, list);
    }

    // 8. Send via Expo.
    const messages: Array<Record<string, unknown>> = [];
    const logEntries: Array<{ user_id: string; signal_id: string }> = [];
    for (const p of pending) {
      const userTokens = tokensByUser.get(p.user_id) || [];
      if (!userTokens.length) continue;
      const title = buildTitle(p.signal);
      const body = p.signal.ai_summary || p.signal.reason || 'סיגנל Dark Pool חדש';
      for (const to of userTokens) {
        messages.push({
          to,
          title,
          body,
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          data: {
            kind: 'dark_pool_signal',
            signal_id: p.signal.id,
            ticker: p.signal.ticker,
            signal_type: p.signal.signal_type,
          },
        });
      }
      logEntries.push({ user_id: p.user_id, signal_id: p.signal.id });
    }

    if (!messages.length) return jsonOk({ sent: 0 });

    let pushOk = 0;
    const CHUNK = 100;
    for (let i = 0; i < messages.length; i += CHUNK) {
      const slice = messages.slice(i, i + CHUNK);
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(slice),
        });
        if (res.ok) pushOk += slice.length;
      } catch (e) {
        console.error('expo push error', e);
      }
    }

    // 9. Log to alerts_log (idempotent thanks to UNIQUE constraint).
    if (logEntries.length) {
      await supabase
        .from('dark_pool_alerts_log')
        .upsert(logEntries, { onConflict: 'user_id,signal_id', ignoreDuplicates: true });
    }

    return jsonOk({ sent: pushOk, pending: pending.length });
  } catch (e) {
    console.error('dark-pool-alerts error', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'internal' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildTitle(s: SignalRow): string {
  const ticker = s.ticker;
  switch (s.signal_type) {
    case 'WHALE':
      return `🐋 ${ticker} — הדפסת ענק ב-Dark Pool`;
    case 'UNUSUAL_VOLUME':
      return `${ticker} — נפח חריג ב-Dark Pool`;
    case 'SWEEP':
      return `${ticker} — סוויפ ב-Dark Pool`;
    case 'HIDDEN_ACCUMULATION':
      return `${ticker} — צבירה מוסדית`;
    case 'INSIDER_DARKPOOL_CONFLUENCE':
      return `${ticker} — Insider × Dark Pool`;
    default:
      return `${ticker} — סיגנל Dark Pool`;
  }
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
