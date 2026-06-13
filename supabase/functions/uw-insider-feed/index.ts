// פיד חי מ-UW — גיבוי כש-DB ריק; cache 5 דקות למניעת 429

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  fetchUwInsiderTransactions,
  fetchUwInsidersForTicker,
  resolveUwLogoUrl,
  type UwInsiderTradeAgg,
} from '../_shared/unusualWhales.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsiderFeedRow {
  id: string;
  external_id: string;
  ticker: string;
  company_name: string | null;
  insider_name: string | null;
  insider_role: string | null;
  insider_logo_url: string | null;
  transaction_type: 'P' | 'S';
  shares: number;
  price: number;
  value: number;
  filed_at: string;
  transaction_date: string;
  source: 'unusualwhales';
}

let feedCache: { at: number; trades: InsiderFeedRow[] } | null = null;
const FEED_CACHE_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const key = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  if (!key) return json({ error: 'UNUSUAL_WHALES_API_KEY missing' }, 400);

  let limit = 40;
  let force = false;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(60, Math.max(5, Number(body.limit)));
    force = body?.force === true;
  } catch {
    /* empty */
  }

  if (!force && feedCache && Date.now() - feedCache.at < FEED_CACHE_MS) {
    return json(
      {
        trades: feedCache.trades.slice(0, limit),
        fetched_at: new Date(feedCache.at).toISOString(),
        source: 'unusualwhales',
        cached: true,
      },
      200
    );
  }

  try {
    const txs = await fetchUwInsiderTransactions(key, {
      limit: 80,
      maxPages: 1,
      transactionCodes: ['P', 'S'],
      group: true,
      commonStockOnly: true,
    });

    const rows = await mapToFeedRows(key, txs).then((r) => r.slice(0, limit));
    feedCache = { at: Date.now(), trades: rows };

    return json(
      { trades: rows, fetched_at: new Date().toISOString(), source: 'unusualwhales' },
      200
    );
  } catch (e) {
    console.error('uw-insider-feed', e);
    if (feedCache) {
      return json(
        {
          trades: feedCache.trades.slice(0, limit),
          fetched_at: new Date(feedCache.at).toISOString(),
          source: 'unusualwhales',
          cached: true,
          warning: (e as Error).message,
        },
        200
      );
    }
    return json({ error: (e as Error).message }, 500);
  }
});

async function mapToFeedRows(
  apiKey: string,
  txs: UwInsiderTradeAgg[]
): Promise<InsiderFeedRow[]> {
  const out: InsiderFeedRow[] = [];
  const rosterCache = new Map<string, Awaited<ReturnType<typeof fetchUwInsidersForTicker>>>();
  let rosterFetches = 0;

  for (const t of txs) {
    const ticker = (t.ticker || '').toUpperCase();
    const name = t.owner_name?.trim();
    if (!ticker || !name) continue;

    let logo: string | null = null;
    if (rosterFetches < 2) {
      let roster = rosterCache.get(ticker);
      if (!roster) {
        try {
          roster = await fetchUwInsidersForTicker(apiKey, ticker);
          rosterFetches += 1;
        } catch {
          roster = [];
        }
        rosterCache.set(ticker, roster);
        await delay(300);
      }
      const match = roster.find((r) =>
        namesLooseMatch(name, r.display_name || r.name || '')
      );
      logo = match ? resolveUwLogoUrl(match) : null;
    }

    const shares = Math.abs(Number(t.amount) || 0);
    const price = Number(t.price ?? t.stock_price) || 0;
    const txDate = String(t.transaction_date ?? t.filing_date ?? '').slice(0, 10);
    const filed = String(t.filing_date ?? t.transaction_date ?? txDate).slice(0, 10);
    const code = t.transaction_code === 'S' ? 'S' : 'P';

    out.push({
      id: `uw-live:${t.id ?? `${ticker}-${name}-${txDate}`}`,
      external_id: String(t.id ?? `${ticker}-${txDate}-${name}`),
      ticker,
      company_name: null,
      insider_name: formatInsiderName(name),
      insider_role: t.officer_title ?? null,
      insider_logo_url: logo,
      transaction_type: code,
      shares,
      price,
      value: shares * price,
      filed_at: filed ? `${filed}T12:00:00Z` : new Date().toISOString(),
      transaction_date: txDate || filed,
      source: 'unusualwhales',
    });
  }

  return out.sort(
    (a, b) => new Date(b.filed_at).getTime() - new Date(a.filed_at).getTime()
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatInsiderName(raw: string): string {
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
