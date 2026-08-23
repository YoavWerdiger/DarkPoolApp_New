// פרופיל «תיק» של פוליטיקאי / בכיר — holdings + עסקאות אחרונות מ-UW

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  fetchUwInsiderTickerFlow,
  fetchUwInsiderTransactions,
  fetchUwInsidersForTicker,
  fetchUwPoliticianTrades,
  fetchUwPoliticians,
  resolveUwLogoUrl,
  uwCongressPersonName,
  type UwCongressTrade,
} from '../_shared/unusualWhales.ts';
import {
  congressDbRowToUwTrade,
  createServiceSupabase,
  loadCongressTradesForPoliticianFromDb,
  loadInsiderBuysFromDb,
  upsertCongressTradesToDb,
  type InsiderBuyDbRow,
} from '../_shared/uwDbCache.ts';
import { buildCuratedCongressHistoryRows, buildCuratedExecutiveTradeRows } from '../_shared/congressFeedBuild.ts';
import { resolveQuiverApiKey, CURATED_EXECUTIVE_UW_IDS } from '../_shared/quiverQuant.ts';
import {
  formatForm4InsiderName,
  loadForm4InsiderHistory,
  mapForm4Transaction,
  resolveForm4ApiKey,
} from '../_shared/form4api.ts';
import {
  mapInsiderTradeToCongressInput,
  metricsFromCongressTrades,
  type CongressPortfolioMetrics,
  type CongressTradeInput,
} from '../_shared/congressPortfolio.ts';
import { isSecProductionMode } from '../_shared/darkPoolMode.ts';
import {
  congressPhotoUrl,
  knownPortraitUrl,
  loadPortraitFromDb,
} from '../_shared/personPortraits.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';
const BIOGUIDE_RE = /^[A-Z]\d{6}$/;
/** מתחת לסף — מושכים היסטוריה עמוקה מ-Quiver לפרופיל */
const THIN_HISTORY_THRESHOLD = 12;
/** כמה עסקאות אחרונות להחזיר בפרופיל (UI / API) */
const RECENT_TRADES_LIMIT = Math.min(
  100,
  Math.max(20, Number(Deno.env.get('PROFILE_RECENT_TRADES_LIMIT') || '50'))
);

interface HoldingRow {
  ticker: string;
  issuer: string | null;
  owner_label: string | null;
  trade_count: number;
  last_trade_date: string | null;
  first_added_date?: string | null;
  txn_mix: string;
  allocation_pct: number;
  amount_label: string | null;
  /** אמצע טווח disclosure ב-$1000 (מ-UW snapshot) */
  mid_usd_k?: number;
  return_pct?: number | null;
}

interface PortfolioSnapshot {
  disclosure_year: number | null;
  estimated_value_usd: number;
  estimated_value_label: string;
  filing_date: string | null;
  disclosure_url: string | null;
  source: 'annual_disclosure';
}

interface ProfilePayload {
  id: string;
  kind: 'politician' | 'insider';
  name: string;
  subtitle: string;
  image_url: string | null;
  ticker?: string;
  stats: {
    total_trades: number;
    unique_tickers: number;
    last_active_days: number | null;
  };
  holdings: HoldingRow[];
  holdings_source?: 'snapshot' | 'trades';
  portfolio_snapshot?: PortfolioSnapshot | null;
  recent_trades: RecentTradeRow[];
  sparkline_values: number[];
  /** שחזור תיק מעסקאות + Yahoo — ללא UW Enterprise */
  metrics?: CongressPortfolioMetrics | null;
  portfolio_source?: 'reconstructed' | 'trades_only' | 'none';
  fetched_at: string;
}

interface RecentTradeRow {
  id: string;
  ticker: string;
  txn_label: string;
  amount_label: string | null;
  date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const secMode = isSecProductionMode();
  const key = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  if (!secMode && !key) return json({ error: 'UNUSUAL_WHALES_API_KEY missing' }, 400);

  let body: { id?: string; kind?: string; ticker?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const id = String(body.id ?? '').trim();
  const kind = body.kind === 'insider' ? 'insider' : 'politician';
  if (!id) return json({ error: 'id required' }, 400);

  try {
    const apiKey = secMode ? '' : key;
    const profile =
      kind === 'insider'
        ? await buildInsiderProfile(apiKey, id, body.ticker)
        : await buildPoliticianProfile(apiKey, id);
    return json(profile, 200);
  } catch (e) {
    console.error('uw-investor-profile', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function buildPoliticianProfile(
  apiKey: string,
  politicianId: string
): Promise<ProfilePayload> {
  const supabase = createServiceSupabase();
  const politicians = apiKey
    ? await fetchUwPoliticians(apiKey, 24).catch(() => [])
    : [];
  let dbRows = await loadCongressTradesForPoliticianFromDb(supabase, politicianId, 500).catch(
    () => []
  );

  let mine: UwCongressTrade[] = dbRows.map(
    (r) => congressDbRowToUwTrade(r) as UwCongressTrade
  );

  const isExecutiveUwId =
    !BIOGUIDE_RE.test(politicianId) &&
    (/^[0-9a-f-]{36}$/i.test(politicianId) ||
      CURATED_EXECUTIVE_UW_IDS.includes(politicianId));

  // היסטוריה דלילה ל־BioGuide (למשל פלוסי) — משיכה עמוקה מ-Quiver ושמירה ל-DB
  if (BIOGUIDE_RE.test(politicianId) && mine.length < THIN_HISTORY_THRESHOLD) {
    const quiverKey = resolveQuiverApiKey();
    if (quiverKey) {
      try {
        const curated = await buildCuratedCongressHistoryRows(quiverKey, [politicianId]);
        if (curated.length) {
          await upsertCongressTradesToDb(supabase, curated).catch((e) =>
            console.warn('persist curated congress', politicianId, e)
          );
          dbRows = await loadCongressTradesForPoliticianFromDb(
            supabase,
            politicianId,
            500
          ).catch(() => curated);
          mine = dbRows.map((r) => congressDbRowToUwTrade(r) as UwCongressTrade);
        }
      } catch (e) {
        console.warn('quiver deep history', politicianId, e);
      }
    }
  }

  // Executive (Trump וכו׳) — משיכה לפי UUID מ-UW + שמירה ל-DB
  if (isExecutiveUwId && mine.length < THIN_HISTORY_THRESHOLD && apiKey) {
    try {
      const curated = await buildCuratedExecutiveTradeRows(apiKey, [politicianId]);
      if (curated.length) {
        await upsertCongressTradesToDb(supabase, curated).catch((e) =>
          console.warn('persist executive congress', politicianId, e)
        );
        dbRows = await loadCongressTradesForPoliticianFromDb(
          supabase,
          politicianId,
          500
        ).catch(() => curated);
        mine = dbRows.map((r) => congressDbRowToUwTrade(r) as UwCongressTrade);
      }
    } catch (e) {
      console.warn('executive deep history', politicianId, e);
    }
  }

  if (mine.length < 3 && apiKey) {
    const uwTrades = await fetchUwPoliticianTrades(apiKey, politicianId, 500).catch(
      (e) => {
        console.warn('uw politician trades fallback', politicianId, e);
        return [];
      }
    );
    const byId = uwTrades.filter((t) => String(t.politician_id ?? '') === politicianId);
    // BioGuide לרוב לא תואם UUID של UW — נסה גם לפי שם מ-DB/מטא
    // לא דורסים היסטוריה שכבר נמשכה/נשמרה ל-DB (executive curated)
    if (byId.length && mine.length === 0) {
      mine = byId;
      try {
        const curated = await buildCuratedExecutiveTradeRows(apiKey, [politicianId]);
        if (curated.length) {
          await upsertCongressTradesToDb(supabase, curated).catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
    } else if (BIOGUIDE_RE.test(politicianId) && uwTrades.length && mine.length === 0) {
      const nameHint = String(dbRows[0]?.politician_name ?? '').toLowerCase();
      const last = nameHint.split(/\s+/).filter(Boolean).pop() ?? '';
      if (last.length >= 4) {
        const byName = uwTrades.filter((t) =>
          uwCongressPersonName(t).toLowerCase().includes(last)
        );
        if (byName.length) mine = byName;
      }
    } else if (byId.length > mine.length) {
      // יותר עסקאות ב-UW מאשר ב-DB — ממזגים ושומרים
      mine = byId;
      try {
        const curated = await buildCuratedExecutiveTradeRows(apiKey, [politicianId]);
        if (curated.length) {
          await upsertCongressTradesToDb(supabase, curated).catch(() => undefined);
          dbRows = await loadCongressTradesForPoliticianFromDb(
            supabase,
            politicianId,
            500
          ).catch(() => curated);
          if (dbRows.length) {
            mine = dbRows.map((r) => congressDbRowToUwTrade(r) as UwCongressTrade);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  let metrics: CongressPortfolioMetrics | null = null;
  if (mine.length) {
    try {
      metrics = await metricsFromCongressTrades(mine, { maxTickers: 40 });
    } catch (e) {
      console.error('politician metrics failed', politicianId, e);
      metrics = null;
    }
  }

  const meta = politicians.find(
    (p) => String(p.politician_id ?? p.id) === politicianId
  );
  const dbMeta = dbRows[0];
  const name =
    String(meta?.name ?? dbMeta?.politician_name ?? '').trim() || 'פוליטיקאי';
  const bg = meta?.bioguide_id?.trim();
  const portraitCache = await loadPortraitFromDb(supabase, politicianId).catch(() => null);
  const image_url =
    portraitCache ??
    dbMeta?.politician_image_url ??
    congressPhotoUrl(politicianId) ??
    knownPortraitUrl(politicianId, name) ??
    (bg ? `${CONGRESS_PHOTO}/${bg}.jpg` : null);

  const holdings = aggregateCongressHoldings(mine);

  const recent = mine
    .slice(0, RECENT_TRADES_LIMIT)
    .map((t) => congressToRecent(t, politicianId))
    .filter(Boolean) as RecentTradeRow[];

  const sparkline_values =
    metrics?.series && metrics.series.length >= 2
      ? metrics.series.map((p) => p.value)
      : buildActivitySparkline(mine);
  const subtitle = formatPolSubtitle(meta);

  return {
    id: politicianId,
    kind: 'politician',
    name,
    subtitle,
    image_url,
    stats: {
      total_trades: mine.length,
      unique_tickers: metrics?.holdings.length ?? holdings.length,
      last_active_days: minDaysSince(mine),
    },
    holdings: metrics?.holdings.length
      ? metricsHoldingsToRows(metrics)
      : holdings.slice(0, 24),
    holdings_source: metrics?.holdings.length ? 'snapshot' : 'trades',
    portfolio_snapshot: null,
    recent_trades: recent,
    sparkline_values,
    metrics,
    portfolio_source: metrics?.holdings.length
      ? 'reconstructed'
      : mine.length
        ? 'trades_only'
        : 'none',
    fetched_at: new Date().toISOString(),
  };
}

async function buildInsiderProfile(
  apiKey: string,
  personKey: string,
  tickerHint?: string
): Promise<ProfilePayload> {
  const parts = personKey.split(':');
  const ticker = (tickerHint || parts[0] || '').toUpperCase();
  const nameKey = parts.slice(1).join(':').trim();
  const form4Key = resolveForm4ApiKey();

  const supabase = createServiceSupabase();
  const dbRows = await loadInsiderBuysFromDb(supabase, {
    ticker,
    insiderName: nameKey,
    limit: 200,
  }).catch(() => []);

  const form4History =
    form4Key && nameKey
      ? await loadForm4InsiderHistory(form4Key, {
          cik: dbRows[0]?.insider_cik,
          nameHint: nameKey,
          ticker: ticker || undefined,
          years: 5,
        }).catch(() => null)
      : null;

  const form4Txs = (form4History?.trades ?? [])
    .map((t) => mapForm4Transaction(t))
    .filter(Boolean)
    .filter((t) => {
      if (!nameKey) return true;
      return namesLooseMatch(nameKey, t!.insider_name || '');
    }) as NonNullable<ReturnType<typeof mapForm4Transaction>>[];

  const dbTxs = dbRows.map(insiderDbToUwTx);
  const f4Mapped = form4Txs.map(form4TradeToUwTx);

  let txs = f4Mapped.length >= dbTxs.length && f4Mapped.length > 0
    ? f4Mapped
    : dbTxs.length > 0
      ? dbTxs
      : [];

  if (!txs.length && apiKey) {
    txs = await fetchUwInsiderTransactions(apiKey, {
      limit: 200,
      transactionCodes: ['P', 'S'],
      ticker_symbol: ticker || undefined,
      owner_name: nameKey || undefined,
    });
  }

  const roster =
    apiKey && ticker ? await fetchUwInsidersForTicker(apiKey, ticker) : [];

  const match = roster.find((r) =>
    namesLooseMatch(nameKey, r.display_name || r.name || '')
  );
  const dbName = dbRows[0]?.insider_name?.trim();
  const f4Profile = form4History?.profile;
  const name =
    (f4Profile?.name ? formatForm4InsiderName(f4Profile.name) : null) ||
    dbName ||
    match?.display_name ||
    match?.name ||
    formatInsiderName(nameKey) ||
    'בכיר';
  const portraitCache = await loadPortraitFromDb(supabase, personKey).catch(() => null);
  const image_url =
    portraitCache ??
    (dbRows[0]?.insider_logo_url?.trim() ||
      knownPortraitUrl(personKey, name) ||
      (match ? resolveUwLogoUrl(match) : null) ||
      null);

  const mine = txs.filter((t) => {
    if (!nameKey) return true;
    return namesLooseMatch(nameKey, t.owner_name || '');
  });

  const holdings = aggregateInsiderHoldings(mine);
  const recent = mine.slice(0, RECENT_TRADES_LIMIT).map(insiderToRecent);

  const dedupedInputs = dedupeTradeInputs(
    [
      ...dbRows.map((r) =>
        mapInsiderTradeToCongressInput({
          ticker: r.ticker,
          transaction_type: r.transaction_type,
          shares: r.shares,
          price: r.price,
          value: r.value,
          transaction_date: r.transaction_date,
          filed_at: r.filed_at,
        })
      ),
      ...(form4Txs.length >= dbRows.length ? form4Txs : []).map((t) =>
        mapInsiderTradeToCongressInput({
          ticker: t.ticker,
          transaction_code: t.transaction_type,
          shares: t.shares,
          price: t.price,
          value: t.value,
          transaction_date: t.transaction_date,
          filed_at: t.filed_at,
        })
      ),
      ...(form4Txs.length >= dbRows.length ? [] : mine).map((t) =>
        mapInsiderTradeToCongressInput({
          ticker: t.ticker,
          transaction_code: t.transaction_code,
          shares: t.amount,
          transaction_date: t.transaction_date,
          filed_at: t.filed_at,
        })
      ),
    ]
  );

  let metrics: CongressPortfolioMetrics | null = null;
  if (dedupedInputs.length) {
    try {
      metrics = await metricsFromCongressTrades(dedupedInputs, { maxTickers: 20 });
    } catch (e) {
      console.error('insider metrics failed', personKey, e);
      metrics = null;
    }
  }

  let sparkline_values =
    metrics?.series && metrics.series.length >= 2
      ? metrics.series.map((p) => p.value)
      : buildInsiderSparkline(mine);

  const roleFromForm4 =
    f4Profile?.officerTitle?.trim() ||
    [
      f4Profile?.isOfficer ? 'Officer' : '',
      f4Profile?.isDirector ? 'Director' : '',
      f4Profile?.isTenPercentOwner ? '10% Owner' : '',
    ]
      .filter(Boolean)
      .join(' · ');

  return {
    id: personKey,
    kind: 'insider',
    name,
    subtitle: [dbRows[0]?.insider_role || roleFromForm4 || match?.officer_title, ticker]
      .filter(Boolean)
      .join(' · '),
    image_url,
    ticker: ticker || undefined,
    stats: {
      total_trades: dedupedInputs.length || mine.length,
      unique_tickers: metrics?.holdings.length ?? holdings.length,
      last_active_days: minDaysSinceInsider(mine),
    },
    holdings: metrics?.holdings.length
      ? metricsHoldingsToRows(metrics)
      : holdings.slice(0, 24),
    holdings_source: metrics?.holdings.length ? 'snapshot' : 'trades',
    recent_trades: recent,
    sparkline_values,
    metrics,
    portfolio_source: metrics?.holdings.length
      ? form4Txs.length >= 3
        ? 'form4_reconstructed'
        : 'reconstructed'
      : mine.length
        ? 'trades_only'
        : 'none',
    fetched_at: new Date().toISOString(),
  };
}

function metricsHoldingsToRows(m: CongressPortfolioMetrics): HoldingRow[] {
  return m.holdings.map((h) => ({
    ticker: h.ticker,
    issuer: null,
    owner_label: null,
    trade_count: 0,
    last_trade_date: null,
    first_added_date: h.first_added_date ?? null,
    txn_mix: 'פתוח',
    allocation_pct: h.allocation_pct,
    amount_label: `${Math.round(h.qty).toLocaleString('en-US')} מניות · $${Math.round(h.market_value).toLocaleString('en-US')}`,
    mid_usd_k: h.market_value / 1000,
    return_pct: h.return_pct,
  }));
}

function form4TradeToUwTx(t: {
  ticker: string;
  insider_name: string | null;
  shares: number;
  transaction_type: string;
  filed_at: string;
  transaction_date: string;
}) {
  return {
    ticker: t.ticker,
    owner_name: t.insider_name,
    amount: t.shares,
    transaction_code: t.transaction_type,
    filed_at: t.filed_at,
    transaction_date: t.transaction_date,
  };
}

function dedupeTradeInputs(inputs: CongressTradeInput[]): CongressTradeInput[] {
  const seen = new Set<string>();
  const out: CongressTradeInput[] = [];
  for (const row of inputs) {
    const key = `${row.ticker}:${row.transaction_date}:${row.txn_type}:${row.amounts ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function insiderDbToUwTx(row: InsiderBuyDbRow) {
  return {
    id: row.external_id,
    ticker: row.ticker,
    owner_name: row.insider_name,
    amount: row.shares,
    transaction_code: row.transaction_type,
    transaction_date: row.transaction_date,
    filing_date: row.filed_at,
    filed_at: row.filed_at,
  };
}

function aggregateCongressHoldings(trades: UwCongressTrade[]): HoldingRow[] {
  const map = new Map<string, HoldingRow & { owners: Set<string> }>();
  for (const t of trades) {
    const ticker = String(t.ticker ?? t.symbol ?? '').toUpperCase();
    if (!ticker || ticker === '—') continue;
    const cur = map.get(ticker);
    const date = String(t.transaction_date ?? t.filed_at_date ?? '').slice(0, 10);
    const amt = t.amounts?.trim() || null;
    const ownerRaw = String(t.reporter ?? t.issuer ?? '').trim();
    const ownerLabel = congressOwnerLabel(ownerRaw);
    const company = congressCompanyName(t);
    const txnLower = String(t.txn_type ?? '').toLowerCase();
    const isBuy =
      txnLower.includes('purchase') ||
      txnLower === 'buy' ||
      txnLower.includes('buy');
    if (cur) {
      cur.trade_count += 1;
      if (date && (!cur.last_trade_date || date > cur.last_trade_date)) {
        cur.last_trade_date = date;
        if (amt) cur.amount_label = amt;
      }
      if (date && isBuy && (!cur.first_added_date || date < cur.first_added_date)) {
        cur.first_added_date = date;
      }
      if (t.txn_type) cur.txn_mix = mergeTxn(cur.txn_mix, t.txn_type);
      if (ownerLabel) cur.owners.add(ownerLabel);
      if (company && !cur.issuer) cur.issuer = company;
    } else {
      map.set(ticker, {
        ticker,
        issuer: company,
        owner_label: ownerLabel,
        trade_count: 1,
        last_trade_date: date || null,
        // כניסה רק מקנייה — מכירה בודדת לא ממציאה תאריך כניסה
        first_added_date: isBuy && date ? date : null,
        txn_mix: formatTxn(t.txn_type),
        allocation_pct: 0,
        amount_label: amt,
        owners: ownerLabel ? new Set([ownerLabel]) : new Set(),
      });
    }
  }
  const rows: HoldingRow[] = Array.from(map.values())
    .map(({ owners, ...row }) => ({
      ...row,
      owner_label:
        row.owner_label ??
        (owners.size === 1
          ? Array.from(owners)[0]
          : owners.size > 1
            ? `${owners.size} דיווחים`
            : null),
    }))
    .sort((a, b) => b.trade_count - a.trade_count);
  const total = rows.reduce((s, r) => s + r.trade_count, 0) || 1;
  for (const r of rows) {
    r.allocation_pct = Math.round((r.trade_count / total) * 1000) / 10;
  }
  return rows;
}

const OWNER_TYPE_KEYS = new Set(['self', 'spouse', 'child', 'joint', 'dependent']);

function isCongressOwnerType(raw: string): boolean {
  const l = raw.trim().toLowerCase();
  if (!l) return false;
  if (OWNER_TYPE_KEYS.has(l)) return true;
  return l.includes('spouse') || l.includes('child') || l.includes('joint');
}

function congressOwnerLabel(raw: string): string | null {
  if (!raw || !isCongressOwnerType(raw)) return null;
  const l = raw.trim().toLowerCase();
  if (l === 'self') return 'אישי';
  if (l === 'spouse') return 'בן/בת זוג';
  if (l === 'child') return 'ילד/ה';
  if (l === 'joint') return 'משותף';
  return raw.trim();
}

function congressCompanyName(t: UwCongressTrade): string | null {
  const issuer = String(t.issuer ?? '').trim();
  if (issuer && !isCongressOwnerType(issuer)) return issuer;
  return null;
}

function formatPortfolioUsd(usd: number): string {
  const a = Math.abs(usd);
  if (a >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(usd / 1000)}K`;
  return `$${Math.round(usd)}`;
}

function aggregateInsiderHoldings(
  txs: Array<{
    ticker?: string;
    amount?: number | string;
    transaction_code?: string;
    transaction_date?: string;
    filed_at?: string;
  }>
): HoldingRow[] {
  const map = new Map<string, HoldingRow>();
  for (const t of txs) {
    const ticker = (t.ticker || '').toUpperCase();
    if (!ticker) continue;
    let row = map.get(ticker);
    const shares = Math.abs(Number(t.amount) || 0);
    const date = String(t.transaction_date ?? t.filed_at ?? '').slice(0, 10);
    const code = String(t.transaction_code || 'P').toUpperCase();
    const isBuy = code === 'P' || code.startsWith('P');
    if (row) {
      row.trade_count += 1;
      row.txn_mix = mergeTxn(row.txn_mix, t.transaction_code || 'P');
      if (date && (!row.last_trade_date || date > row.last_trade_date)) {
        row.last_trade_date = date;
      }
      if (date && isBuy && (!row.first_added_date || date < row.first_added_date)) {
        row.first_added_date = date;
      }
    } else {
      row = {
        ticker,
        issuer: null,
        owner_label: null,
        trade_count: 1,
        last_trade_date: date || null,
        first_added_date: date || null,
        txn_mix: t.transaction_code === 'S' ? 'מכירות' : 'רכישות',
        allocation_pct: 0,
        amount_label: shares > 0 ? `${shares} מניות` : null,
      };
      map.set(ticker, row);
    }
    if (shares > 0 && row.trade_count > 1) {
      const prev = row.amount_label?.replace(/[^\d]/g, '') || '0';
      const sum = Number(prev) + shares;
      row.amount_label = `${sum} מניות (מצטבר)`;
    }
  }
  const rows = Array.from(map.values()).sort((a, b) => b.trade_count - a.trade_count);
  const total = rows.reduce((s, r) => s + r.trade_count, 0) || 1;
  for (const r of rows) {
    r.allocation_pct = Math.round((r.trade_count / total) * 1000) / 10;
  }
  return rows;
}

function buildActivitySparkline(trades: UwCongressTrade[]): number[] {
  const buckets = new Map<string, number>();
  for (const t of trades) {
    const d = String(t.filed_at_date ?? t.transaction_date ?? '').slice(0, 10);
    if (!d) continue;
    const week = d.slice(0, 7);
    buckets.set(week, (buckets.get(week) ?? 0) + 1);
  }
  const weeks = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, c]) => c);
  if (weeks.length < 2) return weeks.length ? [weeks[0], weeks[0]] : [0, 0];
  let sum = 0;
  return weeks.map((c) => {
    sum += c;
    return sum;
  });
}

function buildInsiderSparkline(
  txs: Array<{ transaction_date?: string; filing_date?: string }>
): number[] {
  const buckets = new Map<string, number>();
  for (const t of txs) {
    const d = String(t.transaction_date ?? t.filing_date ?? '').slice(0, 10);
    if (!d) continue;
    const week = d.slice(0, 7);
    buckets.set(week, (buckets.get(week) ?? 0) + 1);
  }
  const weeks = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, c]) => c);
  if (weeks.length < 2) return weeks.length ? [weeks[0], weeks[0]] : [0, 0];
  let sum = 0;
  return weeks.map((c) => {
    sum += c;
    return c;
  });
}

function congressToRecent(t: UwCongressTrade, pid: string): RecentTradeRow | null {
  const ticker = String(t.ticker ?? '').toUpperCase();
  if (!ticker) return null;
  const date = String(t.transaction_date ?? t.filed_at_date ?? '').slice(0, 10);
  return {
    id: `${pid}:${ticker}:${date}:${t.txn_type}`,
    ticker,
    txn_label: formatTxn(t.txn_type),
    amount_label: t.amounts?.trim() || null,
    date: date || null,
  };
}

function insiderToRecent(t: {
  id?: string;
  ticker?: string;
  transaction_code?: string;
  amount?: number | string;
  transaction_date?: string;
}): RecentTradeRow {
  const ticker = (t.ticker || '').toUpperCase();
  const date = t.transaction_date?.slice(0, 10) ?? '';
  const code = (t.transaction_code || 'P').toUpperCase();
  const amt = t.amount != null ? String(t.amount) : '0';
  return {
    id: String(t.id ?? `${ticker}:${date}:${code}:${amt}`),
    ticker,
    txn_label: code === 'S' ? 'מכירה' : 'רכישה',
    amount_label: t.amount != null ? `${t.amount} מניות` : null,
    date: date || null,
  };
}

function formatPolSubtitle(meta?: { party?: string; chamber?: string; trade_count?: number }): string {
  const parts: string[] = [];
  if (meta?.party) parts.push(String(meta.party));
  if (meta?.chamber) parts.push(String(meta.chamber));
  if (meta?.trade_count) parts.push(`${meta.trade_count} דיווחים`);
  return parts.join(' · ') || 'פוליטיקאי · UW';
}

function formatTxn(raw?: string): string {
  const t = (raw || '').toLowerCase();
  if (t.includes('purchase') || t === 'buy') return 'רכישה';
  if (t.includes('sale') || t === 'sell') return 'מכירה';
  return raw?.trim() || 'עסקה';
}

function mergeTxn(cur: string, raw?: string): string {
  const n = formatTxn(raw);
  if (cur.includes(n)) return cur;
  return `${cur}, ${n}`;
}

function minDaysSince(trades: UwCongressTrade[]): number | null {
  let best: number | null = null;
  for (const t of trades) {
    const d = parseDaysSince(t.filed_at_date ?? t.transaction_date);
    if (d != null && (best == null || d < best)) best = d;
  }
  return best;
}

function minDaysSinceInsider(
  txs: Array<{ transaction_date?: string; filing_date?: string }>
): number | null {
  let best: number | null = null;
  for (const t of txs) {
    const d = parseDaysSince(t.transaction_date ?? t.filing_date);
    if (d != null && (best == null || d < best)) best = d;
  }
  return best;
}

function parseDaysSince(iso: unknown): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = Date.parse(iso.slice(0, 10));
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d) / 86400000));
}

function formatInsiderName(raw: string): string {
  const p = raw.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return raw;
  const last = p[0];
  const rest = p.slice(1).join(' ');
  return `${rest} ${last}`.trim();
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
