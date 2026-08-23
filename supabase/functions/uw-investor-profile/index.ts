// פרופיל «תיק» של פוליטיקאי / בכיר — holdings + עסקאות אחרונות מ-UW

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  fetchUwInsiderTransactions,
  fetchUwInsidersForTicker,
  fetchUwPoliticians,
  resolveUwLogoUrl,
  type UwCongressTrade,
} from '../_shared/unusualWhales.ts';
import {
  congressDbRowToUwTrade,
  createServiceSupabase,
  loadCongressTradesForPoliticianFromDb,
  loadInsiderBuysFromDb,
  type InsiderBuyDbRow,
} from '../_shared/uwDbCache.ts';
import { CURATED_EXECUTIVE_UW_IDS } from '../_shared/quiverQuant.ts';
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
import {
  CURATED_ID_SET,
  ensureYahooPriceMaps,
  isSnapshotFresh,
  loadPortfolioSnapshot,
  metricsToSnapshotFields,
  upsertPortfolioSnapshot,
} from '../_shared/darkpoolPortfolioSnapshots.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';
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
  /** מחיר כניסה מוצר: Form4=cost/qty; קונגרס=Yahoo ב־first_added */
  entry_price?: number | null;
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
  portfolio_source?:
    | 'reconstructed'
    | 'trades_only'
    | 'none'
    | 'form4_reconstructed'
    | 'snapshot';
  snapshot_computed_at?: string | null;
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
  // עסקאות רק מ-DB — Quiver/UW/Form4 לא בנתיב פתיחת פרופיל (cron בלבד)
  const dbRows = await loadCongressTradesForPoliticianFromDb(
    supabase,
    politicianId,
    500
  ).catch(() => []);
  const mine: UwCongressTrade[] = dbRows.map(
    (r) => congressDbRowToUwTrade(r) as UwCongressTrade
  );

  const snap = await loadPortfolioSnapshot(supabase, politicianId, 'politician').catch(
    () => null
  );
  const snapFresh = snap && isSnapshotFresh(snap.computed_at);

  const politicians = apiKey
    ? await fetchUwPoliticians(apiKey, 24).catch(() => [])
    : [];
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

  const recent = mine
    .slice(0, RECENT_TRADES_LIMIT)
    .map((t) => congressToRecent(t, politicianId))
    .filter(Boolean) as RecentTradeRow[];
  const subtitle = formatPolSubtitle(meta);

  let metrics: CongressPortfolioMetrics | null = null;
  let portfolio_source: ProfilePayload['portfolio_source'] = 'none';
  let snapshot_computed_at: string | null = snap?.computed_at ?? null;

  if (snapFresh && snap?.metrics) {
    metrics = snap.metrics as CongressPortfolioMetrics;
    portfolio_source = 'snapshot';
  } else if (
    mine.length &&
    (CURATED_ID_SET.has(politicianId) ||
      CURATED_EXECUTIVE_UW_IDS.includes(politicianId) ||
      !snap)
  ) {
    // Bootstrap: curated / אין snapshot — מחשבים פעם אחת וכותבים
    // לא-curated עם snapshot ישן: trades_only עד שה-cron ירענן
    const shouldBootstrap =
      CURATED_ID_SET.has(politicianId) ||
      CURATED_EXECUTIVE_UW_IDS.includes(politicianId) ||
      !snap;
    if (shouldBootstrap) {
      try {
        const tickers = Array.from(
          new Set(
            mine
              .map((t) => String(t.ticker ?? '').toUpperCase())
              .filter((t) => t && t.length <= 5)
          )
        ).slice(0, 40);
        const prices = await ensureYahooPriceMaps(supabase, tickers);
        metrics = await metricsFromCongressTrades(mine, {
          maxTickers: 40,
          pricesByTicker: prices,
        });
        if (metrics) {
          const fields = metricsToSnapshotFields(metrics);
          await upsertPortfolioSnapshot(supabase, {
            person_id: politicianId,
            kind: 'politician',
            ...fields,
            profile_meta: { name, bootstrap: true },
            source_meta: { accuracy: 'congress_yahoo_first_added', path: 'profile_bootstrap' },
          });
          snapshot_computed_at = new Date().toISOString();
          portfolio_source = 'reconstructed';
        }
      } catch (e) {
        console.error('politician bootstrap failed', politicianId, e);
        metrics = null;
      }
    } else if (snap?.metrics) {
      metrics = snap.metrics as CongressPortfolioMetrics;
      portfolio_source = 'snapshot';
    }
  } else if (snap?.metrics) {
    metrics = snap.metrics as CongressPortfolioMetrics;
    portfolio_source = 'snapshot';
  }

  const holdingsAgg = aggregateCongressHoldings(mine);
  const sparkline_values =
    metrics?.series && metrics.series.length >= 2
      ? metrics.series.map((p) => p.value)
      : Array.isArray(snap?.series) && (snap!.series as { value: number }[]).length >= 2
        ? (snap!.series as { value: number }[]).map((p) => p.value)
        : buildActivitySparkline(mine);

  if (!metrics?.holdings?.length && mine.length && portfolio_source === 'none') {
    portfolio_source = 'trades_only';
  }

  return {
    id: politicianId,
    kind: 'politician',
    name,
    subtitle,
    image_url,
    stats: {
      total_trades: mine.length,
      unique_tickers: metrics?.holdings?.length ?? holdingsAgg.length,
      last_active_days: minDaysSince(mine),
    },
    holdings: metrics?.holdings?.length
      ? metricsHoldingsToRows(metrics)
      : holdingsAgg.slice(0, 24),
    holdings_source: metrics?.holdings?.length ? 'snapshot' : 'trades',
    portfolio_snapshot: null,
    recent_trades: recent,
    sparkline_values,
    metrics,
    portfolio_source:
      metrics?.holdings?.length
        ? portfolio_source === 'snapshot'
          ? 'snapshot'
          : 'reconstructed'
        : mine.length
          ? 'trades_only'
          : 'none',
    snapshot_computed_at,
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

  const supabase = createServiceSupabase();
  // Form4 רק ב-cron (sync-insider-buys) — פרופיל = DB בלבד
  const dbRows = await loadInsiderBuysFromDb(supabase, {
    ticker,
    insiderName: nameKey,
    limit: 200,
  }).catch(() => []);

  const dbTxs = dbRows.map(insiderDbToUwTx);
  let txs = dbTxs.length > 0 ? dbTxs : [];

  // UW fallback רק אם אין בכלל שורות ב-DB (נדיר) — לא Form4
  if (!txs.length && apiKey) {
    txs = await fetchUwInsiderTransactions(apiKey, {
      limit: 200,
      transactionCodes: ['P', 'S'],
      ticker_symbol: ticker || undefined,
      owner_name: nameKey || undefined,
    }).catch(() => []);
  }

  const roster =
    apiKey && ticker ? await fetchUwInsidersForTicker(apiKey, ticker).catch(() => []) : [];

  const match = roster.find((r) =>
    namesLooseMatch(nameKey, r.display_name || r.name || '')
  );
  const dbName = dbRows[0]?.insider_name?.trim();
  const name =
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
    dbRows.map((r) =>
      mapInsiderTradeToCongressInput({
        ticker: r.ticker,
        transaction_type: r.transaction_type,
        shares: r.shares,
        price: r.price,
        value: r.value,
        transaction_date: r.transaction_date,
        filed_at: r.filed_at,
      })
    )
  );

  const snap = await loadPortfolioSnapshot(supabase, personKey, 'insider').catch(
    () => null
  );
  const snapFresh = snap && isSnapshotFresh(snap.computed_at);

  let metrics: CongressPortfolioMetrics | null = null;
  let portfolio_source: ProfilePayload['portfolio_source'] = 'none';
  let snapshot_computed_at: string | null = snap?.computed_at ?? null;

  if (snapFresh && snap?.metrics) {
    metrics = snap.metrics as CongressPortfolioMetrics;
    portfolio_source = 'snapshot';
  } else if (dedupedInputs.length && (CURATED_ID_SET.has(personKey) || !snap)) {
    try {
      const tickers = Array.from(
        new Set(
          dedupedInputs
            .map((t) => String(t.ticker ?? '').toUpperCase())
            .filter((t) => t && t.length <= 5)
        )
      ).slice(0, 20);
      const prices = await ensureYahooPriceMaps(supabase, tickers);
      metrics = await metricsFromCongressTrades(dedupedInputs, {
        maxTickers: 20,
        pricesByTicker: prices,
      });
      if (metrics) {
        const fields = metricsToSnapshotFields(metrics);
        await upsertPortfolioSnapshot(supabase, {
          person_id: personKey,
          kind: 'insider',
          ...fields,
          profile_meta: { name, bootstrap: true },
          source_meta: {
            accuracy: 'form4_db_disclosed_when_basis_reliable',
            path: 'profile_bootstrap',
            trade_source: 'dark_pool_insider_buys',
          },
        });
        snapshot_computed_at = new Date().toISOString();
        portfolio_source = 'reconstructed';
      }
    } catch (e) {
      console.error('insider bootstrap failed', personKey, e);
      metrics = null;
    }
  } else if (snap?.metrics) {
    metrics = snap.metrics as CongressPortfolioMetrics;
    portfolio_source = 'snapshot';
  }

  let sparkline_values =
    metrics?.series && metrics.series.length >= 2
      ? metrics.series.map((p) => p.value)
      : Array.isArray(snap?.series) && (snap!.series as { value: number }[]).length >= 2
        ? (snap!.series as { value: number }[]).map((p) => p.value)
        : buildInsiderSparkline(mine);

  return {
    id: personKey,
    kind: 'insider',
    name,
    subtitle: [dbRows[0]?.insider_role || match?.officer_title, ticker]
      .filter(Boolean)
      .join(' · '),
    image_url,
    ticker: ticker || undefined,
    stats: {
      total_trades: dedupedInputs.length || mine.length,
      unique_tickers: metrics?.holdings?.length ?? holdings.length,
      last_active_days: minDaysSinceInsider(mine),
    },
    holdings: metrics?.holdings?.length
      ? metricsHoldingsToRows(metrics)
      : holdings.slice(0, 24),
    holdings_source: metrics?.holdings?.length ? 'snapshot' : 'trades',
    recent_trades: recent,
    sparkline_values,
    metrics,
    portfolio_source: metrics?.holdings?.length
      ? portfolio_source === 'snapshot'
        ? 'snapshot'
        : 'reconstructed'
      : mine.length
        ? 'trades_only'
        : 'none',
    snapshot_computed_at,
    fetched_at: new Date().toISOString(),
  };
}

/** שווי קומפקטי ל־amount_label — תואם formatUsdCompact בצד לקוח */
function formatUsdCompactLabel(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

/** מניות קומפקטיות — 2.6M / 12.5K */
function formatSharesCompactLabel(v: number): string {
  const n = Math.abs(Math.round(v));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** שווי קודם + מניות בסוגריים — לא נחתך מול עמודת תשואה */
function formatHoldingsAmountLabel(
  marketValue: number,
  qty: number | null,
  showShares: boolean
): string {
  // LTR isolate — מונע מ־K/M/B של שווי/מניות להידבק לעברית בבידי RTL
  const usd = `\u2066${formatUsdCompactLabel(marketValue)}\u2069`;
  const valuePart = `שווי אחזקה: ${usd}`;
  if (showShares && qty != null && Number.isFinite(qty) && qty > 0) {
    const sh = `\u2066${formatSharesCompactLabel(qty)}\u2069`;
    return `${valuePart} (${sh} מניות)`;
  }
  return valuePart;
}

function metricsHoldingsToRows(m: CongressPortfolioMetrics): HoldingRow[] {
  return m.holdings.map((h) => {
    const entry =
      h.entry_price != null && h.entry_price > 0 ? h.entry_price : null;
    const hasReturn =
      entry != null && Number.isFinite(h.return_pct)
        ? true
        : h.basis_reliable === true && Number.isFinite(h.return_pct);
    const showShares = h.basis_reliable === true || h.qty_disclosed === true;
    return {
      ticker: h.ticker,
      issuer: null,
      owner_label: null,
      trade_count: 0,
      last_trade_date: null,
      first_added_date: h.first_added_date ?? null,
      txn_mix: 'פתוח',
      allocation_pct: h.allocation_pct,
      // qty רק כשמניות מדווחות — לא ממציאים מניות מטווח STOCK Act
      amount_label: formatHoldingsAmountLabel(
        h.market_value,
        h.qty,
        showShares
      ),
      mid_usd_k: h.market_value / 1000,
      entry_price: entry,
      // תשואה מוצר: Form4 מ־cost; אחרת מ־מחיר שוק ב־first_added
      return_pct: hasReturn ? h.return_pct : null,
    };
  });
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
