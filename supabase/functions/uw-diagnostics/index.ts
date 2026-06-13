// uw-diagnostics — בדיקת גישה ל-endpoints של Unusual Whales (service role בלבד)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { uwProbe, type UwProbeResult } from '../_shared/unusualWhales.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAMPLE_POLITICIAN_ID = 'e138f347-ae92-4cfb-8f41-7036ff09a213'; // Zoe Lofgren — מדוק UW

interface DiagnosticsPayload {
  api_key_present: boolean;
  uw_client_api_id: string;
  politician_id_tested: string;
  probes: UwProbeResult[];
  summary: {
    portfolio_snapshot_available: boolean;
    trades_available: boolean;
    insider_available: boolean;
    darkpool_available: boolean;
    recommendation: string;
  };
  fetched_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (!isAuthorized(req)) {
    return json({ error: 'service_role required' }, 401);
  }

  const apiKey = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  if (!apiKey) {
    return json({ error: 'UNUSUAL_WHALES_API_KEY missing in Supabase secrets' }, 400);
  }

  let politicianId = SAMPLE_POLITICIAN_ID;
  try {
    const body = await req.json();
    if (body?.politician_id) {
      politicianId = String(body.politician_id).trim();
    }
  } catch {
    /* empty body ok */
  }

  const probes: UwProbeResult[] = [];

  const steps: Array<{
    id: string;
    label: string;
    path: string;
    params?: Record<string, string | number | boolean | undefined>;
  }> = [
    {
      id: 'congress_politicians',
      label: 'רשימת פוליטיקאים',
      path: '/api/congress/politicians',
      params: { last_traded_within_months: 24 },
    },
    {
      id: 'politician_trades',
      label: 'עסקאות פוליטיקאים',
      path: '/api/politician-portfolios/recent_trades',
      params: { limit: 5, page: 0 },
    },
    {
      id: 'politician_people',
      label: 'אנשי politician-portfolios',
      path: '/api/politician-portfolios/people',
    },
    {
      id: 'portfolio_snapshot',
      label: '⭐ snapshot תיק (שנתי)',
      path: `/api/politician-portfolios/${politicianId}`,
      params: { aggregate_all_portfolios: true },
    },
    {
      id: 'portfolio_disclosures',
      label: 'דיווחים שנתיים',
      path: '/api/politician-portfolios/disclosures',
      params: { politician_id: politicianId, latest_only: true },
    },
    {
      id: 'insider_transactions',
      label: 'עסקאות בכירים',
      path: '/api/insider/transactions',
      params: { limit: 5 },
    },
    {
      id: 'darkpool_recent',
      label: 'Dark pool',
      path: '/api/darkpool/recent',
      params: { limit: 5, min_premium: 50000 },
    },
    {
      id: 'congress_recent',
      label: 'עסקאות קונגרס',
      path: '/api/congress/recent-trades',
      params: { limit: 5 },
    },
  ];

  for (const step of steps) {
    probes.push(await uwProbe(apiKey, step.id, step.label, step.path, step.params));
    await delay(120);
  }

  const byId = (id: string) => probes.find((p) => p.id === id);

  const portfolio = byId('portfolio_snapshot');
  const trades = byId('politician_trades');
  const insider = byId('insider_transactions');
  const darkpool = byId('darkpool_recent');

  const portfolioOk = portfolio?.ok === true;
  const tradesOk = trades?.ok === true;
  const insiderOk = insider?.ok === true;
  const darkpoolOk = darkpool?.ok === true;

  let recommendation: string;
  if (portfolioOk) {
    recommendation =
      'ה-tier שלך כולל snapshot תיקים. פרופיל פוליטיקאי יכול להציג אחזקות שנתיות אמיתיות.';
  } else if (portfolio?.status === 403) {
    recommendation =
      'snapshot תיקים חסום (403). Basic API כנראה לא כולל politician-portfolios/{id}. פנה ל-UW לשדרוג או השתמש רק בעסקאות STIR.';
  } else if (portfolio?.status === 200 && (portfolio.data_count ?? 0) === 0) {
    recommendation =
      'ה-endpoint נפתח אבל אין holdings לפוליטיקאי שנבדק. נסה politician_id אחר או בדוק disclosures.';
  } else if (!tradesOk && !insiderOk) {
    recommendation = 'בעיה במפתח או במכסה — רוב ה-endpoints נכשלו.';
  } else {
    recommendation =
      'עסקאות/בכירים/dark pool עובדים, אבל snapshot תיק לא. המוצר יציג עסקאות — לא תיק שנתי מלא.';
  }

  const payload: DiagnosticsPayload = {
    api_key_present: true,
    uw_client_api_id: Deno.env.get('UW_CLIENT_API_ID') || '100001',
    politician_id_tested: politicianId,
    probes,
    summary: {
      portfolio_snapshot_available: portfolioOk,
      trades_available: tradesOk,
      insider_available: insiderOk,
      darkpool_available: darkpoolOk,
      recommendation,
    },
    fetched_at: new Date().toISOString(),
  };

  return json(payload, 200);
});

function isAuthorized(req: Request): boolean {
  const auth = (req.headers.get('Authorization') ?? '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (!serviceKey) return false;
  return auth === `Bearer ${serviceKey}`;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
