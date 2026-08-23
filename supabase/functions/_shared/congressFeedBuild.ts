/**
 * בניית שורות פיד קונגרס — Quiver (ברירת מחדל) או UW.
 */

import {
  fetchYahooDaily,
  parseCongressAmount,
  parseTxnSide,
  priceOnOrBefore,
} from './congressPortfolio.ts';
import {
  dedupeCongressTrades,
  fetchUwCongressRecent,
  fetchUwCongressUnusualTrades,
  fetchUwPoliticians,
  fetchUwPoliticianTrades,
  fetchUwTradesForBioguides,
  mapUnusualTradeToCongress,
  uwCongressPersonName,
  type UwCongressTrade,
} from './unusualWhales.ts';
import {
  fetchQuiverLiveCongressTrades,
  fetchQuiverTradesForBioguides,
  getCongressTradesProvider,
  isQuiverEquityTrade,
  parseQuiverTxnSide,
  resolveCongressApiKey,
  CURATED_CONGRESS_BIOGUIDES,
  CURATED_EXECUTIVE_UW_IDS,
  type CongressTradesProvider,
  type QuiverCongressTrade,
} from './quiverQuant.ts';
import type { CongressTradeRow } from './uwDbCache.ts';

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';
const BIOGUIDE_RE = /^[A-Z]\d{6}$/;

export async function buildCongressTradeRows(
  apiKey?: string,
  limit = 60,
  providerOverride?: CongressTradesProvider
): Promise<CongressTradeRow[]> {
  const provider = providerOverride ?? getCongressTradesProvider();
  const key = apiKey?.trim() || resolveCongressApiKey(provider);
  if (!key) {
    throw new Error(
      provider === 'quiverquant'
        ? 'QUIVER_API_KEY missing (set CONGRESS_TRADES_PROVIDER=quiverquant)'
        : 'UNUSUAL_WHALES_API_KEY missing'
    );
  }

  if (provider === 'quiverquant') {
    return buildFromQuiver(key, limit);
  }
  return buildFromUw(key, limit);
}

/**
 * היסטוריה עמוקה לפוליטיקאים מאוצרים (BioGuide).
 * מנסה Quiver; אם אין מפתח / ריק — UW עם מיפוי BioGuide↔UUID.
 */
export async function buildCuratedCongressHistoryRows(
  apiKey?: string,
  bioguides: string[] = CURATED_CONGRESS_BIOGUIDES
): Promise<CongressTradeRow[]> {
  const quiverKey = apiKey?.trim() || resolveCongressApiKey('quiverquant');
  if (quiverKey) {
    try {
      const raw = await fetchQuiverTradesForBioguides(quiverKey, bioguides);
      if (raw.length) {
        return quiverTradesToRows(raw, { priceTickersCap: 40, limit: 2000 });
      }
    } catch (e) {
      console.warn('curated quiver history', e);
    }
  }

  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
  if (!uwKey) {
    throw new Error('No Quiver/UW key available for curated congress history');
  }
  const { trades, bioMap } = await fetchUwTradesForBioguides(uwKey, bioguides, 400);
  if (!trades.length) return [];

  const tickers = Array.from(
    new Set(trades.map((t) => String(t.ticker ?? t.symbol ?? '').toUpperCase()).filter(Boolean))
  ).slice(0, 40);
  const pricesByTicker = new Map<string, Map<string, number>>();
  for (const sym of tickers) {
    pricesByTicker.set(sym, await fetchYahooDaily(sym, '5y'));
    await delay(40);
  }

  const out: CongressTradeRow[] = [];
  const seen = new Set<string>();
  for (const t of trades) {
    const row = uwToCongressRow(t, bioMap, pricesByTicker);
    if (!row || seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    out.push(row);
  }
  return out;
}

/**
 * היסטוריה לפרופילים מאוצרים לפי UUID של UW (executive — Trump וכו׳).
 * לא BioGuide; Quiver לא מכסה אותם.
 */
export async function buildCuratedExecutiveTradeRows(
  apiKey?: string,
  uwIds: string[] = CURATED_EXECUTIVE_UW_IDS
): Promise<CongressTradeRow[]> {
  const uwKey =
    apiKey?.trim() || Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
  if (!uwKey || !uwIds.length) return [];

  const trades: UwCongressTrade[] = [];
  for (const id of uwIds) {
    const pid = String(id ?? '').trim();
    if (!pid || BIOGUIDE_RE.test(pid)) continue;
    try {
      const rows = await fetchUwPoliticianTrades(uwKey, pid, 500);
      for (const t of rows) {
        trades.push({
          ...t,
          politician_id: String(t.politician_id ?? pid).trim() || pid,
        });
      }
    } catch (e) {
      console.warn(`curated executive trades ${pid}:`, (e as Error).message);
    }
  }
  if (!trades.length) return [];

  const tickers = Array.from(
    new Set(
      trades
        .map((t) => String(t.ticker ?? t.symbol ?? '').toUpperCase().trim())
        .filter((t) => t && t.length <= 5)
    )
  ).slice(0, 40);
  const pricesByTicker = new Map<string, Map<string, number>>();
  for (const sym of tickers) {
    pricesByTicker.set(sym, await fetchYahooDaily(sym, '5y'));
    await delay(40);
  }

  const emptyBio = new Map<string, string>();
  const out: CongressTradeRow[] = [];
  const seen = new Set<string>();
  for (const t of trades) {
    const row = uwToCongressRow(t, emptyBio, pricesByTicker);
    if (!row || seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    out.push(row);
  }
  return out;
}

async function buildFromQuiver(apiKey: string, limit: number): Promise<CongressTradeRow[]> {
  const raw = await fetchQuiverLiveCongressTrades(apiKey);
  const sorted = raw
    .filter(isQuiverEquityTrade)
    .sort((a, b) => {
      const da = String(a.ReportDate ?? a.TransactionDate ?? '');
      const db = String(b.ReportDate ?? b.TransactionDate ?? '');
      return db.localeCompare(da);
    })
    .slice(0, Math.min(400, Math.max(limit * 3, limit)));

  return quiverTradesToRows(sorted, { priceTickersCap: 16, limit });
}

async function quiverTradesToRows(
  raw: QuiverCongressTrade[],
  opts: { priceTickersCap: number; limit: number }
): Promise<CongressTradeRow[]> {
  const sorted = raw
    .filter(isQuiverEquityTrade)
    .sort((a, b) => {
      const da = String(a.ReportDate ?? a.TransactionDate ?? '');
      const db = String(b.ReportDate ?? b.TransactionDate ?? '');
      return db.localeCompare(da);
    });

  const tickers = Array.from(
    new Set(sorted.map((t) => String(t.Ticker ?? '').toUpperCase()).filter(Boolean))
  ).slice(0, opts.priceTickersCap);

  const pricesByTicker = new Map<string, Map<string, number>>();
  for (const sym of tickers) {
    pricesByTicker.set(sym, await fetchYahooDaily(sym, '5y'));
    await delay(40);
  }

  const out: CongressTradeRow[] = [];
  const seenExt = new Set<string>();
  for (const t of sorted) {
    const row = quiverToCongressRow(t, pricesByTicker);
    if (!row || seenExt.has(row.external_id)) continue;
    seenExt.add(row.external_id);
    out.push(row);
    if (out.length >= opts.limit) break;
  }
  return out;
}

function quiverToCongressRow(
  t: QuiverCongressTrade,
  pricesByTicker: Map<string, Map<string, number>>
): CongressTradeRow | null {
  const politician_id = String(t.BioGuideID ?? '').trim();
  const politician_name = String(t.Representative ?? '').trim() || 'פוליטיקאי';
  const ticker = String(t.Ticker ?? '').toUpperCase().trim();
  const side = parseQuiverTxnSide(t.Transaction);
  if (!ticker || !side) return null;

  const txDate = String(t.TransactionDate ?? '').slice(0, 10);
  const filed = String(t.ReportDate ?? t.last_modified ?? txDate).slice(0, 10);
  const amount_label = t.Range?.trim() || null;
  const amountUsd = parseCongressAmount(amount_label ?? t.Amount);
  const priceMap = pricesByTicker.get(ticker);
  const price = priceMap ? priceOnOrBefore(priceMap, txDate || filed) : null;
  const shares =
    price && price > 0 && amountUsd > 0 ? Math.round(amountUsd / price) : null;

  const politician_image_url = politician_id
    ? `${CONGRESS_PHOTO}/${politician_id}.jpg`
    : null;
  const txn_label = side === 'sell' ? 'מכירה' : 'רכישה';
  const txnSlug = String(t.Transaction ?? side).replace(/\s+/g, '_').slice(0, 40);
  const external_id = `quiver:${politician_id}:${ticker}:${txDate}:${side}:${txnSlug}`;

  return {
    external_id,
    politician_id: politician_id || external_id,
    politician_name,
    politician_image_url,
    ticker,
    company_name: t.Description?.trim() || null,
    transaction_type: side,
    shares,
    price: price != null ? Math.round(price * 100) / 100 : null,
    amount_label,
    filed_at: filed ? `${filed}T12:00:00Z` : new Date().toISOString(),
    transaction_date: txDate || filed,
    txn_label,
    source: 'quiverquant',
  };
}

async function buildFromUw(apiKey: string, limit: number): Promise<CongressTradeRow[]> {
  const fetchCap = Math.min(300, Math.max(limit * 2, limit));
  const [politicians, recent, unusual] = await Promise.all([
    fetchUwPoliticians(apiKey, 36).catch(() => []),
    fetchUwCongressRecent(apiKey, fetchCap).catch(() => [] as UwCongressTrade[]),
    fetchUwCongressUnusualTrades(apiKey, { limit: Math.min(120, fetchCap) }).catch(() => []),
  ]);

  const bioMap = new Map<string, string>();
  for (const p of politicians) {
    const id = String(p.politician_id ?? p.id ?? '').trim();
    const bg = p.bioguide_id?.trim();
    if (id && bg) bioMap.set(id, bg);
  }

  const merged = dedupeCongressTrades([
    ...recent,
    ...unusual.map(mapUnusualTradeToCongress),
  ]);

  const sorted = merged
    .filter((t) => {
      const ticker = String(t.ticker ?? t.symbol ?? '').toUpperCase().trim();
      const side = parseTxnSide(t.txn_type);
      return ticker.length >= 1 && ticker.length <= 5 && side != null;
    })
    .sort((a, b) => {
      const da = String(a.filed_at_date ?? a.transaction_date ?? '');
      const db = String(b.filed_at_date ?? b.transaction_date ?? '');
      return db.localeCompare(da);
    })
    .slice(0, Math.min(400, Math.max(limit * 2, limit)));

  const tickers = Array.from(
    new Set(sorted.map((t) => String(t.ticker ?? t.symbol ?? '').toUpperCase()))
  ).slice(0, 20);

  const pricesByTicker = new Map<string, Map<string, number>>();
  for (const sym of tickers) {
    pricesByTicker.set(sym, await fetchYahooDaily(sym, '1y'));
    await delay(40);
  }

  const out: CongressTradeRow[] = [];
  const seenExt = new Set<string>();
  for (const t of sorted) {
    const row = uwToCongressRow(t, bioMap, pricesByTicker);
    if (!row || seenExt.has(row.external_id)) continue;
    seenExt.add(row.external_id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function uwToCongressRow(
  t: UwCongressTrade,
  bioMap: Map<string, string>,
  pricesByTicker: Map<string, Map<string, number>>
): CongressTradeRow | null {
  const politician_id = String(t.politician_id ?? '').trim();
  const politician_name = uwCongressPersonName(t) || 'פוליטיקאי';
  const ticker = String(t.ticker ?? t.symbol ?? '').toUpperCase().trim();
  const side = parseTxnSide(t.txn_type);
  if (!ticker || !side) return null;

  const txDate = String(t.transaction_date ?? t.filed_at_date ?? '').slice(0, 10);
  const filed = String(t.filed_at_date ?? t.transaction_date ?? txDate).slice(0, 10);
  const amountUsd = parseCongressAmount(t.amounts);
  const priceMap = pricesByTicker.get(ticker);
  const price = priceMap ? priceOnOrBefore(priceMap, txDate || filed) : null;
  const shares =
    price && price > 0 && amountUsd > 0 ? Math.round(amountUsd / price) : null;

  const mappedBg = bioMap.get(politician_id);
  const stableId =
    mappedBg ||
    (BIOGUIDE_RE.test(politician_id) ? politician_id : politician_id) ||
    politician_id;
  const photoId = mappedBg || (BIOGUIDE_RE.test(stableId) ? stableId : null);
  const politician_image_url = photoId ? `${CONGRESS_PHOTO}/${photoId}.jpg` : null;
  const txn_label = side === 'sell' ? 'מכירה' : 'רכישה';
  const amountKey = (t.amounts?.trim() || 'na').replace(/\s+/g, '_').slice(0, 48);
  const external_id = `uw-congress:${stableId}:${ticker}:${txDate}:${side}:${amountKey}`;

  return {
    external_id,
    politician_id: stableId || external_id,
    politician_name,
    politician_image_url,
    ticker,
    company_name: t.issuer?.trim() || null,
    transaction_type: side,
    shares,
    price: price != null ? Math.round(price * 100) / 100 : null,
    amount_label: t.amounts?.trim() || null,
    filed_at: filed ? `${filed}T12:00:00Z` : new Date().toISOString(),
    transaction_date: txDate || filed,
    txn_label,
    source: 'unusualwhales',
  };
}

export { getCongressTradesProvider, resolveCongressApiKey, type CongressTradesProvider };

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
