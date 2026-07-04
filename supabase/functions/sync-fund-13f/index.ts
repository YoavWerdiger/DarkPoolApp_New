// sync-fund-13f — sec-api 13F → dark_pool_fund_managers + dark_pool_fund_holdings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { fetch13fHistoryForCik } from '../_shared/secApi13f.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const apiKey = Deno.env.get('SEC_API_KEY')?.trim();
  if (!apiKey) return json({ error: 'SEC_API_KEY missing' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  let cikFilter: string[] | null = null;
  let historyLimit = 12;
  try {
    const body = await req.json();
    if (Array.isArray(body?.ciks)) {
      cikFilter = body.ciks.map((c: unknown) => String(c).trim()).filter(Boolean);
    }
    if (body?.history_limit != null) {
      historyLimit = Math.min(24, Math.max(1, Number(body.history_limit) || 12));
    }
  } catch {
    /* empty */
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
    filings?: number;
    holdings?: number;
    error?: string;
  }> = [];

  for (const fund of targets) {
    const cik = String(fund.cik);
    try {
      const filings = await fetch13fHistoryForCik(apiKey, cik, historyLimit);
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
          name: latestFiling.manager_name || fund.name,
          last_filing_date: latestFiling.filing_date,
          last_value_usd: latestFiling.total_value_usd,
          holdings_count: latestFiling.holdings.length,
          synced_at: new Date().toISOString(),
          source: 'secapi',
        },
        { onConflict: 'cik' }
      );

      results.push({
        cik,
        ok: true,
        filings: filings.length,
        holdings: totalHoldingsUpserted,
      });
      await delay(500);
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

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
