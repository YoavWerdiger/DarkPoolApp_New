// תובנות לטיקר — UW + Form4API (חדשות, GEX, flow, בכירים, cluster signals)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  fetchUwDarkpoolByTicker,
  fetchUwFlowAlertsForTicker,
  fetchUwInsiderTickerFlow,
  fetchUwInsiderTransactions,
  fetchUwInsidersForTicker,
  fetchUwNewsHeadlines,
  fetchUwSpotGexSummary,
  resolveUwLogoUrl,
} from '../_shared/unusualWhales.ts';
import {
  fetchForm4Company,
  fetchForm4CompanyInsiders,
  fetchForm4Sentiment,
  fetchForm4Signals,
  fetchForm4Transactions,
  formatForm4InsiderName,
  mapForm4Transaction,
  resolveForm4ApiKey,
  yearsAgoIso,
} from '../_shared/form4api.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TickerInsightsPayload {
  ticker: string;
  news: Array<{
    id: string;
    title: string;
    source: string | null;
    date: string | null;
    sentiment: string | null;
    is_major: boolean;
  }>;
  gex: { net_gamma: number; label: string; strike_count: number } | null;
  flow_alerts: Array<{
    id: string;
    ticker: string;
    premium: number;
    type: string;
    rule: string;
  }>;
  insider_live: Array<{
    id: string;
    owner_name: string;
    txn_label: string;
    amount_label: string | null;
    date: string | null;
    logo_url: string | null;
  }>;
  insider_flow: Array<{
    date: string | null;
    premium: number;
    transactions: number;
  }>;
  darkpool_prints: Array<{
    id: string;
    price: number;
    size: number;
    premium: number;
    executed_at: string;
    market_center: string | null;
  }>;
  form4_company: {
    name: string;
    sector: string | null;
    active_insiders: number;
  } | null;
  cluster_signal: {
    date: string;
    is_cluster_buy: boolean;
    is_cluster_sell: boolean;
    insider_count: number;
  } | null;
  insider_sentiment: {
    period: string;
    score: number;
    buy_count: number;
    sell_count: number;
  } | null;
  warnings: string[];
  fetched_at: string;
  source: 'unusualwhales' | 'mixed' | 'form4api';
}

const cache = new Map<string, { at: number; payload: TickerInsightsPayload }>();
const CACHE_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  const form4Key = resolveForm4ApiKey();
  if (!uwKey && !form4Key) {
    return json({ error: 'UNUSUAL_WHALES_API_KEY or FORM4_API_KEY required' }, 400);
  }

  let ticker = '';
  let force = false;
  try {
    const body = await req.json();
    ticker = String(body?.ticker ?? '').trim().toUpperCase();
    force = body?.force === true;
  } catch {
    return json({ error: 'ticker required' }, 400);
  }
  if (!ticker) return json({ error: 'ticker required' }, 400);

  const hit = cache.get(ticker);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) {
    return json(hit.payload, 200);
  }

  try {
    const payload = await buildTickerInsights({ uwKey, form4Key, ticker });
    cache.set(ticker, { at: Date.now(), payload });
    return json(payload, 200);
  } catch (e) {
    if (hit) return json(hit.payload, 200);
    return json({ error: (e as Error).message }, 500);
  }
});

async function buildTickerInsights(opts: {
  uwKey: string;
  form4Key: string | null;
  ticker: string;
}): Promise<TickerInsightsPayload> {
  const { uwKey, form4Key, ticker } = opts;
  const warnings: string[] = [];

  const newsRaw = uwKey
    ? await fetchUwNewsHeadlines(uwKey, ticker, 8).catch((e) => {
        warnings.push(`news: ${(e as Error).message}`);
        return [];
      })
    : [];

  await delay(uwKey ? 400 : 0);
  const gex = uwKey
    ? await fetchUwSpotGexSummary(uwKey, ticker).catch((e) => {
        warnings.push(`gex: ${(e as Error).message}`);
        return null;
      })
    : null;

  await delay(uwKey ? 400 : 0);
  const flow = uwKey
    ? await fetchUwFlowAlertsForTicker(uwKey, ticker, 5).catch((e) => {
        warnings.push(`flow: ${(e as Error).message}`);
        return [];
      })
    : [];

  await delay(uwKey ? 400 : 0);
  const insiderTx = uwKey
    ? await fetchUwInsiderTransactions(uwKey, {
        ticker_symbol: ticker,
        limit: 30,
        maxPages: 1,
        transactionCodes: ['P', 'S'],
      }).catch((e) => {
        warnings.push(`insider: ${(e as Error).message}`);
        return [];
      })
    : [];

  let roster: Awaited<ReturnType<typeof fetchUwInsidersForTicker>> = [];
  if (uwKey) {
    try {
      roster = await fetchUwInsidersForTicker(uwKey, ticker);
    } catch {
      /* optional */
    }
  }

  await delay(uwKey ? 400 : 0);
  const insiderFlowRaw = uwKey
    ? await fetchUwInsiderTickerFlow(uwKey, ticker, 30).catch((e) => {
        warnings.push(`insider-flow: ${(e as Error).message}`);
        return [];
      })
    : [];

  await delay(uwKey ? 400 : 0);
  const darkpoolRaw = uwKey
    ? await fetchUwDarkpoolByTicker(uwKey, ticker, {
        limit: 20,
        min_premium: 25_000,
      }).catch((e) => {
        warnings.push(`darkpool: ${(e as Error).message}`);
        return [];
      })
    : [];

  let form4Company: Awaited<ReturnType<typeof fetchForm4Company>> = null;
  let form4Insiders: Awaited<ReturnType<typeof fetchForm4CompanyInsiders>> = [];
  let form4TxRaw: Awaited<ReturnType<typeof fetchForm4Transactions>> = [];
  let form4Signals: Awaited<ReturnType<typeof fetchForm4Signals>> = [];
  let form4Sentiment: Awaited<ReturnType<typeof fetchForm4Sentiment>> = null;

  if (form4Key) {
    try {
      [form4Company, form4Insiders, form4TxRaw, form4Signals, form4Sentiment] =
        await Promise.all([
          fetchForm4Company(form4Key, ticker),
          fetchForm4CompanyInsiders(form4Key, ticker),
          fetchForm4Transactions(form4Key, {
            ticker,
            from: yearsAgoIso(1),
            maxPages: 2,
          }),
          fetchForm4Signals(form4Key, { ticker, maxPages: 1 }),
          fetchForm4Sentiment(form4Key, ticker, 6),
        ]);
    } catch (e) {
      warnings.push(`form4: ${(e as Error).message}`);
    }
  }

  const news = newsRaw.map((n, i) => ({
    id: `news-${i}-${n.created_at ?? ''}`,
    title: String(n.headline ?? n.title ?? '').trim() || '—',
    source: n.source?.trim() || null,
    date: (n.published_at ?? n.created_at ?? '').slice(0, 10) || null,
    sentiment: n.sentiment?.trim() || null,
    is_major: !!n.is_major,
  }));

  const uwInsiderLive = insiderTx.slice(0, 12).map((t) => {
    const name = t.owner_name?.trim() || 'בכיר';
    const match = roster.find((r) =>
      namesLooseMatch(name, r.display_name || r.name || '')
    );
    return {
      id: String(t.id ?? `${ticker}-${name}`),
      owner_name: formatName(name),
      txn_label: t.transaction_code === 'S' ? 'מכירה' : 'רכישה',
      amount_label: t.amount != null ? `${t.amount} מניות` : null,
      date: (t.transaction_date ?? t.filing_date ?? '').slice(0, 10) || null,
      logo_url: match ? resolveUwLogoUrl(match) : null,
    };
  });

  const form4InsiderLive = form4TxRaw
    .map((r) => mapForm4Transaction(r))
    .filter(Boolean)
    .slice(0, 12)
    .map((t, i) => {
      const name = formatForm4InsiderName(t!.insider_name || 'בכיר');
      const match = roster.find((r) =>
        namesLooseMatch(name, r.display_name || r.name || '')
      );
      return {
        id: `f4-${t!.external_id}-${i}`,
        owner_name: name,
        txn_label: t!.transaction_type === 'S' ? 'מכירה' : 'רכישה',
        amount_label: `${t!.shares} מניות`,
        date: t!.transaction_date,
        logo_url: match ? resolveUwLogoUrl(match) : null,
      };
    });

  const insider_live =
    form4InsiderLive.length >= uwInsiderLive.length ? form4InsiderLive : uwInsiderLive;

  const insider_flow = insiderFlowRaw.slice(0, 24).map((p) => ({
    date: (p.date ?? '').slice(0, 10) || null,
    premium: Number(p.premium) || 0,
    transactions: Number(p.transactions) || 0,
  }));

  const darkpool_prints = darkpoolRaw.slice(0, 15).map((r, i) => {
    const price = Number(r.price);
    const size = Number(r.size);
    const premium = Number(r.premium) || Math.round(price * size * 100) / 100;
    return {
      id: String(r.tracking_id ?? `dp-${i}`),
      price,
      size,
      premium,
      executed_at: r.executed_at,
      market_center: r.market_center?.trim() || null,
    };
  });

  const latestSignal = form4Signals[0];
  const latestSentiment = form4Sentiment?.monthly?.[0];

  const source: TickerInsightsPayload['source'] = uwKey && form4Key
    ? 'mixed'
    : form4Key
      ? 'form4api'
      : 'unusualwhales';

  return {
    ticker,
    news,
    gex,
    flow_alerts: flow,
    insider_live,
    insider_flow,
    darkpool_prints,
    form4_company: form4Company
      ? {
          name: form4Company.name || ticker,
          sector: form4Company.sicDescription?.trim() || null,
          active_insiders: form4Company.activeInsiders ?? form4Insiders.length,
        }
      : null,
    cluster_signal: latestSignal?.signalDate
      ? {
          date: latestSignal.signalDate.slice(0, 10),
          is_cluster_buy: !!latestSignal.isClusterBuy,
          is_cluster_sell: !!latestSignal.isClusterSell,
          insider_count: latestSignal.insiderCount ?? 0,
        }
      : null,
    insider_sentiment: latestSentiment
      ? {
          period: latestSentiment.period,
          score: latestSentiment.score,
          buy_count: latestSentiment.buyCount,
          sell_count: latestSentiment.sellCount,
        }
      : null,
    warnings,
    fetched_at: new Date().toISOString(),
    source,
  };
}

function formatName(raw: string): string {
  const p = raw.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return raw;
  return `${p.slice(1).join(' ')} ${p[0]}`.trim();
}

function namesLooseMatch(a: string, b: string): boolean {
  const ta = new Set(
    a.toUpperCase().replace(/[.,']/g, '').split(' ').filter((t) => t.length > 1)
  );
  const tb = new Set(
    b.toUpperCase().replace(/[.,']/g, '').split(' ').filter((t) => t.length > 1)
  );
  if (!ta.size || !tb.size) return false;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap >= Math.min(2, Math.min(ta.size, tb.size));
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
