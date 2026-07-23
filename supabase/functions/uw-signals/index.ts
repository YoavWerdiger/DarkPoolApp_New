// uw-signals — סיגנלי אופציות + סקירת פוליטיקה מ-Unusual Whales (לטאב סקירה/פיד)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  fetchUwCongressRecent,
  fetchUwMarketTide,
  uwGet,
  type UwMarketTidePoint,
} from '../_shared/unusualWhales.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlowAlertItem {
  id: string;
  ticker: string;
  type: 'call' | 'put';
  premium: number;
  rule: string;
  strike: string | null;
  expiry: string | null;
  volume_oi_ratio: number | null;
}

interface PoliticsOverviewSlice {
  most_held: Array<{ ticker: string; count?: number }>;
  buy_volume_low: number | null;
  buy_volume_high: number | null;
}

interface UwSignalsPayload {
  flow_alerts: FlowAlertItem[];
  market_tide: {
    label: string;
    net_call_premium: number | null;
    net_put_premium: number | null;
    recorded_at: string | null;
  } | null;
  politics: PoliticsOverviewSlice | null;
  fetched_at: string;
}

let signalsCache: { at: number; payload: UwSignalsPayload } | null = null;
const SIGNALS_CACHE_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const key = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  if (!key) return json({ error: 'UNUSUAL_WHALES_API_KEY missing' }, 400);

  if (signalsCache && Date.now() - signalsCache.at < SIGNALS_CACHE_MS) {
    return json(signalsCache.payload, 200);
  }

  try {
    const payload = await buildSignals(key);
    signalsCache = { at: Date.now(), payload };
    return json(payload, 200);
  } catch (e) {
    console.error('uw-signals', e);
    if (signalsCache) return json(signalsCache.payload, 200);
    return json({ error: (e as Error).message }, 500);
  }
});

async function buildSignals(apiKey: string): Promise<UwSignalsPayload> {
  const flowRaw = await fetchFlowAlerts(apiKey).catch((e) => {
    console.warn('flow', e);
    return [] as Record<string, unknown>[];
  });
  await delay(400);
  const tide = await fetchUwMarketTide(apiKey).catch(() => [] as UwMarketTidePoint[]);
  await delay(400);
  const politicsRaw = await fetchPoliticsOverview(apiKey).catch((e) => {
    console.warn('politics', e);
    return null;
  });

  return {
    flow_alerts: mapFlowAlerts(flowRaw).slice(0, 12),
    market_tide: summarizeTide(tide),
    politics: politicsRaw,
    fetched_at: new Date().toISOString(),
  };
}

async function fetchFlowAlerts(apiKey: string): Promise<Record<string, unknown>[]> {
  const url = new URL('https://api.unusualwhales.com/api/option-trades/flow-alerts');
  url.searchParams.set('limit', '30');
  url.searchParams.set('min_premium', '100000');
  url.searchParams.append('issue_types[]', 'Common Stock');
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'UW-CLIENT-API-ID': Deno.env.get('UW_CLIENT_API_ID') || '100001',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`flow-alerts ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Record<string, unknown>[] };
  return json.data ?? [];
}

function mapFlowAlerts(rows: Record<string, unknown>[]): FlowAlertItem[] {
  return rows
    .map((r) => {
      const ticker = String(r.ticker ?? r.ticker_symbol ?? '').trim().toUpperCase();
      if (!ticker || ticker === 'SPX' || ticker === 'SPXW') return null;
      const prem = Number(r.total_premium ?? r.premium) || 0;
      return {
        id: String(r.id ?? `${ticker}-${r.created_at}`),
        ticker,
        type: String(r.type ?? '').toLowerCase() === 'put' ? 'put' : 'call',
        premium: prem,
        rule: String(r.alert_rule ?? r.rule_name ?? 'Flow'),
        strike: r.strike != null ? String(r.strike) : null,
        expiry: r.expiry != null ? String(r.expiry).slice(0, 10) : null,
        volume_oi_ratio: r.volume_oi_ratio != null ? Number(r.volume_oi_ratio) : null,
      } satisfies FlowAlertItem;
    })
    .filter((x): x is FlowAlertItem => x != null)
    .sort((a, b) => b.premium - a.premium);
}

async function fetchPoliticsOverview(apiKey: string): Promise<PoliticsOverviewSlice | null> {
  for (const path of ['/api/politics/overview', '/api/congress/overview']) {
    const res = await fetch(`https://api.unusualwhales.com${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'UW-CLIENT-API-ID': Deno.env.get('UW_CLIENT_API_ID') || '100001',
      },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as {
      data?: {
        most_held?: Array<{ ticker?: string; count?: number }>;
        daily_volume?: { buy_low?: number; buy_high?: number };
      };
    };
    const d = json.data;
    if (d?.most_held?.length) {
      return {
        most_held: d.most_held
          .map((m) => ({ ticker: String(m.ticker ?? '').toUpperCase(), count: m.count }))
          .filter((m) => m.ticker),
        buy_volume_low: d.daily_volume?.buy_low ?? null,
        buy_volume_high: d.daily_volume?.buy_high ?? null,
      };
    }
  }

  const trades = await fetchUwCongressRecent(apiKey, 120);
  const counts = new Map<string, number>();
  for (const t of trades) {
    const ticker = String(t.ticker ?? '').trim().toUpperCase();
    if (!ticker) continue;
    counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
  }
  const most_held = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ticker, count]) => ({ ticker, count }));
  if (!most_held.length) return null;
  return { most_held, buy_volume_low: null, buy_volume_high: null };
}

function summarizeTide(points: UwMarketTidePoint[]): UwSignalsPayload['market_tide'] {
  const last = points[points.length - 1];
  if (!last) return null;
  const call = Number(last.net_call_premium);
  const put = Number(last.net_put_premium);
  const net = (Number.isFinite(call) ? call : 0) - (Number.isFinite(put) ? put : 0);
  return {
    net_call_premium: Number.isFinite(call) ? call : null,
    net_put_premium: Number.isFinite(put) ? put : null,
    label: net > 0 ? 'בולי' : net < 0 ? 'דובי' : 'ניטרלי',
    recorded_at: last.timestamp ?? null,
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
