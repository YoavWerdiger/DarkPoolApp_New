// sync-fund-13f — sec-api / Unusual Whales 13F → dark_pool_fund_managers + holdings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { fetch13fHistoryForCik } from '../_shared/secApi13f.ts';
import { fetchUw13fHistoryForCik } from '../_shared/unusualWhales.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KNOWN_FUNDS: Record<string, { name: string; manager: string; image?: string }> = {
  '1067983': {
    name: 'Berkshire Hathaway Inc',
    manager: 'Warren Buffett',
    image: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg',
  },
  '1697748': {
    name: 'ARK Investment Management LLC',
    manager: 'Cathie Wood',
    image: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg',
  },
  '1336528': {
    name: 'Pershing Square Capital Management LP',
    manager: 'Bill Ackman',
    image:
      'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg',
  },
};

type FilingLike = {
  cik: string;
  filing_date: string;
  report_date: string | null;
  manager_name: string | null;
  holdings: Array<{
    ticker: string;
    issuer_name: string | null;
    cusip: string | null;
    shares: number;
    value_usd: number;
  }>;
  total_value_usd: number;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const secApiKey = Deno.env.get('SEC_API_KEY')?.trim();
  const uwApiKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim();
  if (!secApiKey && !uwApiKey) {
    return json({ error: 'SEC_API_KEY or UNUSUAL_WHALES_API_KEY required' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  let cikFilter: string[] | null = null;
  // 16 רבעונים ≈ 4 שנים; מקסימום 24 (~6 שנים) — SEC/UW כבר במנוי
  let historyLimit = Number(Deno.env.get('FUND_13F_HISTORY_LIMIT') || '16');
  historyLimit = Math.min(24, Math.max(1, Number.isFinite(historyLimit) ? historyLimit : 16));
  try {
    const body = await req.json();
    if (Array.isArray(body?.ciks)) {
      cikFilter = body.ciks.map((c: unknown) => String(c).trim()).filter(Boolean);
    }
    if (body?.history_limit != null) {
      historyLimit = Math.min(24, Math.max(1, Number(body.history_limit) || 16));
    }
  } catch {
    /* empty */
  }

  // אם ביקשו CIKים ספציפיים — וודא שיש שורות מנהל לפני הסנכרון
  if (cikFilter?.length) {
    const seeds = cikFilter.map((cik) => ({
      cik,
      name: KNOWN_FUNDS[cik]?.name ?? `Fund ${cik}`,
      manager_name: KNOWN_FUNDS[cik]?.manager ?? null,
      image_url: KNOWN_FUNDS[cik]?.image ?? null,
      source: 'seed',
    }));
    await supabase.from('dark_pool_fund_managers').upsert(seeds, { onConflict: 'cik' });
  } else {
    // ברירת מחדל: ודא ששלושת הקרנות המרכזיות קיימות
    const seeds = Object.entries(KNOWN_FUNDS).map(([cik, meta]) => ({
      cik,
      name: meta.name,
      manager_name: meta.manager,
      image_url: meta.image ?? null,
      source: 'seed',
    }));
    await supabase.from('dark_pool_fund_managers').upsert(seeds, { onConflict: 'cik' });
  }

  const { data: funds, error: loadErr } = await supabase
    .from('dark_pool_fund_managers')
    .select('cik, name')
    .order('cik');

  if (loadErr) return json({ error: loadErr.message }, 500);

  const targets = (funds ?? []).filter(
    (f) => !cikFilter?.length || cikFilter.includes(String(f.cik))
  );

  const results: Array<{
    cik: string;
    ok: boolean;
    source?: string;
    filings?: number;
    holdings?: number;
    error?: string;
  }> = [];

  for (const fund of targets) {
    const cik = String(fund.cik);
    try {
      const { filings, source } = await loadFilings(cik, historyLimit, secApiKey, uwApiKey);
      if (!filings.length) {
        results.push({ cik, ok: false, error: 'no filings' });
        continue;
      }

      type HoldingRow = {
        fund_cik: string;
        filing_date: string;
        ticker: string;
        issuer_name: string | null;
        cusip: string | null;
        shares: number;
        value_usd: number;
        allocation_pct: number;
        synced_at: string;
      };

      let latestFiling = filings[filings.length - 1];
      let totalHoldingsUpserted = 0;

      for (const filing of filings) {
        const total = filing.total_value_usd || 1;
        const byTicker = new Map<string, HoldingRow>();
        for (const h of filing.holdings) {
          const row: HoldingRow = {
            fund_cik: cik,
            filing_date: filing.filing_date,
            ticker: h.ticker,
            issuer_name: h.issuer_name,
            cusip: h.cusip,
            shares: h.shares,
            value_usd: h.value_usd,
            allocation_pct: Math.round((h.value_usd / total) * 1000) / 10,
            synced_at: new Date().toISOString(),
          };
          const prev = byTicker.get(h.ticker);
          if (!prev || (row.value_usd ?? 0) > (prev.value_usd ?? 0)) {
            byTicker.set(h.ticker, row);
          }
        }
        const rows = Array.from(byTicker.values());
        if (!rows.length) continue;

        const { error: upsertErr } = await supabase
          .from('dark_pool_fund_holdings')
          .upsert(rows, { onConflict: 'fund_cik,filing_date,ticker' });

        if (upsertErr) throw upsertErr;
        totalHoldingsUpserted += rows.length;
        if (filing.filing_date >= latestFiling.filing_date) latestFiling = filing;
      }

      await supabase.from('dark_pool_fund_managers').upsert(
        {
          cik,
          name: latestFiling.manager_name || fund.name || KNOWN_FUNDS[cik]?.name,
          manager_name: KNOWN_FUNDS[cik]?.manager ?? latestFiling.manager_name,
          image_url: KNOWN_FUNDS[cik]?.image ?? null,
          last_filing_date: latestFiling.filing_date,
          last_value_usd: latestFiling.total_value_usd,
          holdings_count: latestFiling.holdings.length,
          synced_at: new Date().toISOString(),
          source,
        },
        { onConflict: 'cik' }
      );

      results.push({
        cik,
        ok: true,
        source,
        filings: filings.length,
        holdings: totalHoldingsUpserted,
      });
      await delay(400);
    } catch (e) {
      results.push({ cik, ok: false, error: (e as Error).message });
    }
  }

  return json({
    ok: true,
    synced: results.filter((r) => r.ok).length,
    results,
    synced_at: new Date().toISOString(),
  });
});

async function loadFilings(
  cik: string,
  historyLimit: number,
  secApiKey: string | undefined,
  uwApiKey: string | undefined
): Promise<{ filings: FilingLike[]; source: string }> {
  let secError: string | null = null;
  if (secApiKey) {
    try {
      const filings = await fetch13fHistoryForCik(secApiKey, cik, historyLimit);
      if (filings.length) return { filings, source: 'secapi' };
      secError = 'no filings';
    } catch (e) {
      secError = (e as Error).message;
    }
  }

  if (uwApiKey) {
    const filings = await fetchUw13fHistoryForCik(uwApiKey, cik, historyLimit);
    if (filings.length) return { filings, source: 'unusualwhales' };
  }

  throw new Error(secError || 'no 13F source available');
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
