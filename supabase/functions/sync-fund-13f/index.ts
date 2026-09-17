// sync-fund-13f — Quiver sec13f (תקופה אחרונה בצד הלקוח) + sec13fchanges (owner-filtered)
// → dark_pool_fund_managers + holdings + snapshot לפיד/פרופילים
// Prefer Quiver for curated fund managers; sec-api / UW רק כ-fallback.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { fetch13fHistoryForCik } from '../_shared/secApi13f.ts';
import { fetchUw13fHistoryForCik } from '../_shared/unusualWhales.ts';
import {
  CURATED_FUND_QUIVER_OWNERS,
  QUIVER_FUND_CHANGES_CACHE_KEY,
  fetchQuiverCuratedFundChanges,
  fetchQuiverLiveSec13fChanges,
  fetchQuiverSec13fByOwner,
  parseQuiverUsd,
  quiverSec13fChangePct,
  quiverSec13fChangeShares,
  quiverSec13fFundName,
  quiverSec13fShares,
  quiverSec13fValueUsd,
  resolveQuiverApiKey,
  type QuiverSec13fChange,
  type QuiverSec13fHolding,
} from '../_shared/quiverQuant.ts';

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

const CURATED_CIKS = new Set(Object.keys(CURATED_FUND_QUIVER_OWNERS));

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

  const quiverKey = resolveQuiverApiKey();
  const secApiKey = Deno.env.get('SEC_API_KEY')?.trim();
  const uwApiKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim();
  if (!quiverKey && !secApiKey && !uwApiKey) {
    return json(
      { error: 'QUIVER_API_KEY or SEC_API_KEY or UNUSUAL_WHALES_API_KEY required' },
      400
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  let cikFilter: string[] | null = null;
  let historyLimit = Number(Deno.env.get('FUND_13F_HISTORY_LIMIT') || '16');
  historyLimit = Math.min(24, Math.max(1, Number.isFinite(historyLimit) ? historyLimit : 16));
  let syncChanges = true;
  let probeOnly = false;
  try {
    const body = await req.json();
    if (Array.isArray(body?.ciks)) {
      cikFilter = body.ciks.map((c: unknown) => String(c).trim()).filter(Boolean);
    }
    if (body?.history_limit != null) {
      historyLimit = Math.min(24, Math.max(1, Number(body.history_limit) || 16));
    }
    if (body?.changes === false) syncChanges = false;
    if (body?.probe === true) probeOnly = true;
  } catch {
    /* empty */
  }

  // Probe: ספירות בלבד מול Quiver (owner-filtered) — בלי secrets / בלי כתיבה
  if (probeOnly) {
    if (!quiverKey) return json({ error: 'QUIVER_API_KEY required for probe' }, 400);
    const probe = await probeQuiverFundEndpoints(quiverKey);
    return json({ ok: true, probe, probed_at: new Date().toISOString() });
  }

  if (cikFilter?.length) {
    const seeds = cikFilter.map((cik) => ({
      cik,
      name: KNOWN_FUNDS[cik]?.name ?? CURATED_FUND_QUIVER_OWNERS[cik]?.name ?? `Fund ${cik}`,
      manager_name:
        KNOWN_FUNDS[cik]?.manager ?? CURATED_FUND_QUIVER_OWNERS[cik]?.manager ?? null,
      image_url: KNOWN_FUNDS[cik]?.image ?? null,
      source: 'seed',
    }));
    await supabase.from('dark_pool_fund_managers').upsert(seeds, { onConflict: 'cik' });
  } else {
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
    quiver_owner?: string;
    error?: string;
  }> = [];

  for (const fund of targets) {
    const cik = String(fund.cik);
    try {
      const { filings, source, quiverOwner } = await loadFilings(
        cik,
        historyLimit,
        quiverKey,
        secApiKey,
        uwApiKey
      );
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
      const syncedFilingDates = new Set<string>();

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
        syncedFilingDates.add(filing.filing_date);

        const { error: upsertErr } = await supabase
          .from('dark_pool_fund_holdings')
          .upsert(rows, { onConflict: 'fund_cik,filing_date,ticker' });

        if (upsertErr) throw upsertErr;
        totalHoldingsUpserted += rows.length;
        if (filing.filing_date >= latestFiling.filing_date) latestFiling = filing;
      }

      if (source === 'quiverquant' && syncedFilingDates.size) {
        const { data: allDates } = await supabase
          .from('dark_pool_fund_holdings')
          .select('filing_date')
          .eq('fund_cik', cik);
        const staleDates = Array.from(
          new Set(
            (allDates ?? [])
              .map((r) => String(r.filing_date).slice(0, 10))
              .filter((d) => d && !syncedFilingDates.has(d))
          )
        );
        for (const d of staleDates) {
          await supabase
            .from('dark_pool_fund_holdings')
            .delete()
            .eq('fund_cik', cik)
            .eq('filing_date', d);
        }
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
        quiver_owner: quiverOwner,
      });
      await delay(400);
    } catch (e) {
      results.push({ cik, ok: false, error: (e as Error).message });
    }
  }

  let changesCount = 0;
  let changesByOwner: Record<string, number> = {};
  if (syncChanges && quiverKey) {
    try {
      const { changes, by_owner } = await fetchQuiverCuratedFundChanges(quiverKey, {
        mostRecent: true,
        pageSize: 200,
        maxPerOwner: 800,
      });
      changesByOwner = by_owner;
      const normalized = changes.map(normalizeChange).filter((c) => c.ticker);
      // כתיבת שינויים גם כהיסטוריית אחזקות (Held / Change_Pct) לפי תאריך דיווח
      await upsertChangesAsHoldings(supabase, normalized);
      const payload = {
        synced_at: new Date().toISOString(),
        count: normalized.length,
        by_owner,
        source: 'quiverquant_owner_filtered',
        changes: normalized.slice(0, 600),
      };
      changesCount = payload.changes.length;
      await supabase.from('dark_pool_uw_snapshots').upsert(
        {
          cache_key: QUIVER_FUND_CHANGES_CACHE_KEY,
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'cache_key' }
      );

      // רענון last_filing אחרי שינויים שנכתבו כהיסטוריה
      for (const cik of Object.keys(CURATED_FUND_QUIVER_OWNERS)) {
        if (cikFilter?.length && !cikFilter.includes(cik)) continue;
        const { data: top } = await supabase
          .from('dark_pool_fund_holdings')
          .select('filing_date, value_usd')
          .eq('fund_cik', cik)
          .order('filing_date', { ascending: false })
          .limit(500);
        if (!top?.length) continue;
        const maxDate = String(top[0].filing_date).slice(0, 10);
        const latestRows = top.filter(
          (r) => String(r.filing_date).slice(0, 10) === maxDate
        );
        const total = latestRows.reduce((s, r) => s + (Number(r.value_usd) || 0), 0);
        await supabase
          .from('dark_pool_fund_managers')
          .update({
            last_filing_date: maxDate,
            last_value_usd: total,
            holdings_count: latestRows.length,
            synced_at: new Date().toISOString(),
            source: 'quiverquant',
          })
          .eq('cik', cik);
      }
    } catch (e) {
      console.warn('quiver sec13fchanges', (e as Error).message);
    }
  }

  return json({
    ok: true,
    synced: results.filter((r) => r.ok).length,
    results,
    sec13f_changes: changesCount,
    sec13f_changes_by_owner: changesByOwner,
    synced_at: new Date().toISOString(),
  });
});

async function probeQuiverFundEndpoints(quiverKey: string) {
  const holdings: Record<string, { owner_used: string | null; rows: number; sample_keys: string[] }> =
    {};
  const changes: Record<string, { owner_used: string | null; rows: number; sample_keys: string[] }> =
    {};

  for (const [cik, meta] of Object.entries(CURATED_FUND_QUIVER_OWNERS)) {
    let holdOwner: string | null = null;
    let holdRows = 0;
    let holdKeys: string[] = [];
    for (const owner of meta.owners) {
      try {
        const rows = await fetchQuiverSec13fByOwner(quiverKey, owner, {
          pageSize: 200,
          maxRows: 2000,
        });
        if (rows.length > holdRows) {
          holdRows = rows.length;
          holdOwner = owner;
          holdKeys = rows[0] ? Object.keys(rows[0]).slice(0, 12) : [];
        }
        if (rows.length > 0) break;
      } catch {
        /* try next alias */
      }
      await delay(100);
    }
    holdings[cik] = { owner_used: holdOwner, rows: holdRows, sample_keys: holdKeys };

    let chOwner: string | null = null;
    let chRows = 0;
    let chKeys: string[] = [];
    for (const owner of meta.owners) {
      try {
        const rows = await fetchQuiverLiveSec13fChanges(quiverKey, {
          owner,
          mostRecent: true,
          pageSize: 200,
          maxRows: 1500,
        });
        if (rows.length > chRows) {
          chRows = rows.length;
          chOwner = owner;
          chKeys = rows[0] ? Object.keys(rows[0]).slice(0, 14) : [];
        }
        if (rows.length > 0) break;
      } catch {
        /* try next */
      }
      await delay(100);
    }
    changes[cik] = { owner_used: chOwner, rows: chRows, sample_keys: chKeys };
  }

  // השוואה: קריאה בלי owner (מוגבלת) — רק כדי להראות כמה גדול ה-dump
  let unfiltered_sample = 0;
  const pershing_fund_hits: string[] = [];
  try {
    const dump = await fetchQuiverLiveSec13fChanges(quiverKey, {
      mostRecent: true,
      pageSize: 200,
      maxRows: 800,
      page: 1,
    });
    unfiltered_sample = dump.length;
    const seen = new Set<string>();
    for (const row of dump) {
      const fund = String(row.Fund ?? row.Owner ?? '').trim();
      if (!fund) continue;
      const fl = fund.toLowerCase();
      if (
        (fl.includes('pershing') || fl.includes('ackman')) &&
        !seen.has(fund)
      ) {
        seen.add(fund);
        pershing_fund_hits.push(fund);
      }
    }
    // אם לא מצאנו בעמוד 1 — נסה aliases נוספים ל-Pershing
    if (!pershing_fund_hits.length && changes['1336528']?.rows === 0) {
      const extraOwners = [
        'Pershing Square Capital Management, L.P.',
        'Pershing Square Capital Management L.P.',
        'PERSHING SQUARE CAPITAL MANAGEMENT, L.P.',
        'PERSHING SQUARE CAPITAL MANAGEMENT L.P.',
        'Pershing Square Holdings',
        'Ackman',
      ];
      for (const owner of extraOwners) {
        try {
          const rows = await fetchQuiverLiveSec13fChanges(quiverKey, {
            owner,
            mostRecent: true,
            pageSize: 50,
            maxRows: 50,
          });
          if (rows.length) {
            pershing_fund_hits.push(`${owner} => ${rows.length}`);
            changes['1336528'] = {
              owner_used: owner,
              rows: rows.length,
              sample_keys: rows[0] ? Object.keys(rows[0]).slice(0, 14) : [],
            };
            const holdRows = await fetchQuiverSec13fByOwner(quiverKey, owner, {
              pageSize: 200,
              maxRows: 500,
            });
            if (holdRows.length) {
              holdings['1336528'] = {
                owner_used: owner,
                rows: holdRows.length,
                sample_keys: holdRows[0]
                  ? Object.keys(holdRows[0]).slice(0, 12)
                  : [],
              };
            }
            break;
          }
        } catch {
          /* next */
        }
        await delay(80);
      }
    }
  } catch {
    unfiltered_sample = -1;
  }

  return {
    holdings,
    changes,
    unfiltered_changes_page1_cap200: unfiltered_sample,
    pershing_fund_hits,
    note: 'owner-filtered counts for curated funds; unfiltered page capped',
  };
}

async function loadFilings(
  cik: string,
  historyLimit: number,
  quiverKey: string | undefined,
  secApiKey: string | undefined,
  uwApiKey: string | undefined
): Promise<{ filings: FilingLike[]; source: string; quiverOwner?: string }> {
  // Quiver קודם לקרנות מאוצרות — אחזקות התקופה האחרונה
  if (quiverKey) {
    try {
      const meta = CURATED_FUND_QUIVER_OWNERS[cik];
      const owners = meta?.owners?.length
        ? meta.owners
        : [meta?.owner || KNOWN_FUNDS[cik]?.name || ''].filter(Boolean);
      for (const owner of owners) {
        const holdings = await fetchQuiverSec13fByOwner(quiverKey, owner, {
          pageSize: 500,
          maxRows: 2000,
        });
        const filing = quiverHoldingsToFiling(cik, holdings, owner);
        if (filing?.holdings.length) {
          // שינויים → היסטוריית תקופות נוספת (ReportPeriod) כשיש
          const history = await quiverChangesToHistoryFilings(quiverKey, cik, owner, filing);
          return {
            filings: history.length ? history : [filing],
            source: 'quiverquant',
            quiverOwner: owner,
          };
        }
        await delay(120);
      }
      if (CURATED_CIKS.has(cik)) {
        console.warn(`quiver sec13f empty for curated ${cik}; trying fallbacks`);
      }
    } catch (e) {
      console.warn(`quiver sec13f ${cik}:`, (e as Error).message);
    }
  }

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

/** בונה snapshots היסטוריים מ-sec13fchanges (Held לפי ReportPeriod) */
async function quiverChangesToHistoryFilings(
  apiKey: string,
  cik: string,
  owner: string,
  latest: FilingLike
): Promise<FilingLike[]> {
  try {
    const rows = await fetchQuiverLiveSec13fChanges(apiKey, {
      owner,
      mostRecent: false,
      pageSize: 200,
      maxRows: 1200,
    });
    if (!rows.length) return [latest];

    const byPeriod = new Map<string, QuiverSec13fHolding[]>();
    for (const r of rows) {
      const period = String(r.ReportPeriod ?? r.Date ?? r.FilingDate ?? '')
        .slice(0, 10);
      if (!period) continue;
      const asHolding: QuiverSec13fHolding = {
        Ticker: r.Ticker,
        Company: r.Company,
        Fund: r.Fund ?? r.Owner,
        Held: r.Held,
        Held_Normalized: r.Held_Normalized,
        Close: r.Close,
        Shares: r.Shares,
        Value: r.Value,
        ReportDate: r.ReportPeriod ?? r.ReportDate,
        FilingDate: r.Date ?? r.FilingDate,
      };
      const list = byPeriod.get(period) ?? [];
      list.push(asHolding);
      byPeriod.set(period, list);
    }

    const filings: FilingLike[] = [];
    const periods = Array.from(byPeriod.keys()).sort();
    for (const period of periods.slice(-16)) {
      const filing = quiverHoldingsToFiling(cik, byPeriod.get(period)!, owner);
      if (filing?.holdings.length) {
        filing.filing_date = period;
        filing.report_date = period;
        filings.push(filing);
      }
    }

    // ודא שהאחזקות של התקופה האחרונה מ-sec13f נשמרות
    const hasLatest = filings.some((f) => f.filing_date === latest.filing_date);
    if (!hasLatest) filings.push(latest);
    filings.sort((a, b) => a.filing_date.localeCompare(b.filing_date));
    return filings.length ? filings : [latest];
  } catch (e) {
    console.warn(`quiver changes history ${cik}:`, (e as Error).message);
    return [latest];
  }
}

function quiverHoldingsToFiling(
  cik: string,
  holdings: QuiverSec13fHolding[],
  owner: string
): FilingLike | null {
  // /beta/live/sec13f מחזיר כמה ReportPeriod — שומרים רק את האחרון.
  // זה גם מה שמחליף את הפרמטר most_recent שלא מתועד ל-endpoint הזה.
  const periods = holdings
    .map((h) => String(h.ReportPeriod ?? h.ReportDate ?? h.Date ?? h.FilingDate ?? '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const latestPeriod = periods.length
    ? periods.reduce((a, b) => (a >= b ? a : b))
    : null;
  const scoped = latestPeriod
    ? holdings.filter((h) => {
        const p = String(
          h.ReportPeriod ?? h.ReportDate ?? h.Date ?? h.FilingDate ?? ''
        ).slice(0, 10);
        return !p || p === latestPeriod;
      })
    : holdings;

  const mapped = scoped
    .map((h) => {
      const ticker = String(h.Ticker ?? '')
        .trim()
        .toUpperCase();
      if (!ticker || ticker.length > 6) return null;
      const shares = quiverSec13fShares(h) ?? 0;
      const value_usd = quiverSec13fValueUsd(h) ?? 0;
      if (!(shares > 0) && !(value_usd > 0)) return null;
      return {
        ticker,
        issuer_name: (h.Name ?? h.Company)?.trim() || null,
        cusip: h.CUSIP?.trim() || null,
        shares,
        value_usd,
      };
    })
    .filter(Boolean) as FilingLike['holdings'];

  if (!mapped.length) return null;
  const filing_date =
    latestPeriod ||
    String(
      scoped[0]?.FilingDate ??
        scoped[0]?.Date ??
        scoped[0]?.ReportDate ??
        scoped[0]?.ReportPeriod ??
        ''
    ).slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const report_date =
    latestPeriod ||
    String(
      scoped[0]?.ReportPeriod ??
        scoped[0]?.ReportDate ??
        scoped[0]?.FilingDate ??
        scoped[0]?.Date ??
        ''
    ).slice(0, 10) ||
    null;
  const total_value_usd = mapped.reduce((s, h) => s + (h.value_usd || 0), 0);
  return {
    cik,
    filing_date,
    report_date,
    manager_name: quiverSec13fFundName(scoped[0] ?? {}) || owner,
    holdings: mapped,
    total_value_usd,
  };
}

type NormalizedChange = {
  ticker: string;
  company: string | null;
  owner: string | null;
  shares: number | null;
  value: number | null;
  change: number | null;
  change_pct: number | null;
  held: number | null;
  close: number | null;
  action: string | null;
  report_date: string | null;
  filing_date: string | null;
  report_period: string | null;
};

function normalizeChange(c: QuiverSec13fChange): NormalizedChange {
  const held = quiverSec13fShares(c);
  const close = parseQuiverUsd(c.Close);
  const value = quiverSec13fValueUsd(c);
  const change = quiverSec13fChangeShares(c);
  const change_pct = quiverSec13fChangePct(c);
  let action = c.Action?.trim() || null;
  if (!action && change != null) {
    if (change > 0) action = 'increase';
    else if (change < 0) action = 'decrease';
    else action = 'unchanged';
  }
  return {
    ticker: String(c.Ticker ?? '')
      .trim()
      .toUpperCase(),
    company: c.Company?.trim() || null,
    owner: quiverSec13fFundName(c) || null,
    shares: held,
    value,
    change,
    change_pct,
    held,
    close,
    action,
    report_date: String(c.ReportPeriod ?? c.ReportDate ?? '').slice(0, 10) || null,
    filing_date: String(c.Date ?? c.FilingDate ?? '').slice(0, 10) || null,
    report_period: String(c.ReportPeriod ?? '').slice(0, 10) || null,
  };
}

function resolveCikForOwner(owner: string | null): string | null {
  if (!owner) return null;
  const o = owner.toLowerCase();
  for (const [cik, meta] of Object.entries(CURATED_FUND_QUIVER_OWNERS)) {
    const aliases = [meta.owner, meta.name, meta.manager, ...(meta.owners ?? [])].map((x) =>
      x.toLowerCase()
    );
    if (aliases.some((a) => o.includes(a) || a.includes(o))) return cik;
  }
  return null;
}

async function upsertChangesAsHoldings(
  supabase: ReturnType<typeof createClient>,
  changes: NormalizedChange[]
) {
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

  const byFundPeriod = new Map<string, Map<string, HoldingRow>>();
  const synced_at = new Date().toISOString();

  for (const c of changes) {
    const cik = resolveCikForOwner(c.owner);
    const filing_date = (c.report_period || c.report_date || c.filing_date || '').slice(0, 10);
    if (!cik || !filing_date || !c.ticker) continue;
    const shares = c.held ?? c.shares ?? 0;
    const value_usd = c.value ?? 0;
    if (!(shares > 0) && !(value_usd > 0)) continue;

    const fundKey = `${cik}|${filing_date}`;
    let byTicker = byFundPeriod.get(fundKey);
    if (!byTicker) {
      byTicker = new Map();
      byFundPeriod.set(fundKey, byTicker);
    }
    const row: HoldingRow = {
      fund_cik: cik,
      filing_date,
      ticker: c.ticker,
      issuer_name: c.company,
      cusip: null,
      shares,
      value_usd,
      allocation_pct: 0,
      synced_at,
    };
    const prev = byTicker.get(c.ticker);
    if (!prev || (row.value_usd ?? 0) > (prev.value_usd ?? 0)) {
      byTicker.set(c.ticker, row);
    }
  }

  for (const byTicker of byFundPeriod.values()) {
    const rows = Array.from(byTicker.values());
    const total = rows.reduce((s, r) => s + (r.value_usd || 0), 0) || 1;
    for (const r of rows) {
      r.allocation_pct = Math.round((r.value_usd / total) * 1000) / 10;
    }
    if (!rows.length) continue;
    const { error } = await supabase
      .from('dark_pool_fund_holdings')
      .upsert(rows, { onConflict: 'fund_cik,filing_date,ticker' });
    if (error) console.warn('upsert changes holdings', error.message);
  }
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
