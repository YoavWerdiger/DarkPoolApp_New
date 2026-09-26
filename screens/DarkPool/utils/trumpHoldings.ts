/**
 * מנוע שלישי לפרופיל טראמפ — Quiver trumpstocktrades.
 *
 * טראמפ אינו חבר קונגרס (אין bioguide / STOCK Act). הסכום ב-Amount הוא
 * דולר מדווח, לא טווח. אין CurrentHolding ואין מניות Form 4.
 *
 * ספר רץ: buy מוסיף נומינל, sell גורע FIFO. שווי = נומינל × (close חי / close ביום העסקה).
 * בלי midpoint של $1,001–$15,000.
 */

import {
  closeOnOrBefore,
  formatForm4Value,
  holdingReturnFromEntry,
  latestTickerClose,
  unionTradingDates,
  type CongressBasketPricePoint,
  type CongressBasketValuePoint,
} from './investorHoldings';
import { parseQuiverUsd } from './congressHonesty';
import { parseDisclosedAmountRange } from './congressTradeDisplay';

/** מזהה פנימי ב-DB / Explore — לא BioGuide. */
export const TRUMP_PERSON_ID = '888dc73f-f1eb-485a-a241-80657aaaaff9';

export const TRUMP_HOLDINGS_HELP_TITLE = 'על המספרים';
export const TRUMP_HOLDINGS_HELP_BODY =
  'עסקאות Quiver trumpstocktrades. כשיש סכום מדויק בדולר — שווי לפי הנומינל × Yahoo. ' +
  'כש-Quiver מחזיר רק טווח STOCK Act ($1,001–$15,000 וכו׳) — אין בסיס לדולר אמיתי: ' +
  'הגרף והמשקלים הם סל עם משקל שווה לכל עסקה (לא midpoint של הטווח). ' +
  'לא כל השווי הנטו של טראמפ.';
/** נומינל פנימי לסל «משקל שווה» — לא מוצג כ-$ אמיתי. */
export const TRUMP_EQUAL_WEIGHT_NOTIONAL_USD = 1;

export interface TrumpTradeInput {
  ticker: string;
  transaction_date: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  /** מחיר מדווח אם יש; אחרת MTM לפי יחס close. */
  price?: number | null;
  /** true כשאין $ מדויק — משקל שווה לעסקה (טווח STOCK Act בלבד). */
  unitWeighted?: boolean;
}

export interface TrumpModelHolding {
  type: 'TRUMP_NOTIONAL';
  ticker: string;
  remainingNotionalUsd: number;
  marketValueUsd: number;
  weightPct: number;
  returnPct: number | null;
  firstAddedDate: string | null;
  entryPrice: number | null;
  livePrice: number | null;
}

interface TrumpLot {
  date: string;
  notional: number;
  entryPrice: number | null;
}

const RANGE_RE = /[\d.]+\s*[-–—]|to\s*[\d.$]/i;

export function isTrumpPerson(
  id?: string | null,
  name?: string | null
): boolean {
  const pid = String(id ?? '').trim();
  if (pid.toLowerCase() === TRUMP_PERSON_ID) return true;
  // BioGuide אמיתי — לעולם לא טראמפ, גם אם השם הגיע שגוי
  if (/^[A-Z]\d{6}$/i.test(pid)) return false;
  const n = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
  return n === 'donald trump' || n === 'donald j trump';
}

/**
 * סכום דולרי מדויק בלבד. טווח STOCK Act / רצפת מדרגה → null.
 */
export function parseExactUsdAmount(
  raw: string | number | null | undefined
): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  const text = raw.trim();
  if (!text) return null;
  if (RANGE_RE.test(text.replace(/,/g, ''))) return null;
  if (/over|above|מעל|\+/i.test(text)) return null;
  const range = parseDisclosedAmountRange(text);
  if (range?.source === 'bracket') return null;
  if (range && range.high != null && range.high !== range.low) return null;
  return parseQuiverUsd(text);
}

/** טווח STOCK Act בלבד — לא סכום מדויק (מקור נפוץ ב-trumpstocktrades היום). */
export function isTrumpStockActRangeLabel(
  raw: string | number | null | undefined
): boolean {
  if (raw == null) return false;
  if (typeof raw === 'number') return false;
  const text = raw.trim();
  if (!text) return false;
  if (parseExactUsdAmount(text) != null) return false;
  if (RANGE_RE.test(text.replace(/,/g, ''))) return true;
  const range = parseDisclosedAmountRange(text);
  return (
    range != null &&
    range.high != null &&
    range.low != null &&
    range.high !== range.low
  );
}

export function trumpPortfolioUsesUnitWeight(trades: TrumpTradeInput[]): boolean {
  return trades.length > 0 && trades.every((t) => t.unitWeighted === true);
}

export function formatExactUsdLabel(
  raw: string | number | null | undefined
): string | null {
  const n = parseExactUsdAmount(raw);
  if (n == null) return null;
  return formatForm4Value(n);
}

function tradeSide(raw: {
  transaction_type?: string | null;
  txn_label?: string | null;
}): 'buy' | 'sell' | null {
  const t = `${raw.transaction_type ?? ''} ${raw.txn_label ?? ''}`.toLowerCase();
  if (/sell|sale|מכר|מכיר|dispose/.test(t)) return 'sell';
  if (/buy|purchase|קנ[הי]|רכיש/.test(t)) return 'buy';
  return null;
}

function tradeDay(raw: {
  transaction_date?: string | null;
  traded_date?: string | null;
  date?: string | null;
  filed_at?: string | null;
}): string | null {
  const day = String(
    raw.transaction_date ?? raw.traded_date ?? raw.date ?? raw.filed_at ?? ''
  ).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function trumpTradesFromRows(
  rows: Array<{
    ticker?: string | null;
    transaction_type?: string | null;
    txn_label?: string | null;
    amount_label?: string | null;
    shares?: number | null;
    price?: number | null;
    transaction_date?: string | null;
    traded_date?: string | null;
    date?: string | null;
    filed_at?: string | null;
  }>
): TrumpTradeInput[] {
  const out: TrumpTradeInput[] = [];
  for (const row of rows) {
    const ticker = String(row.ticker ?? '')
      .toUpperCase()
      .trim();
    const side = tradeSide(row);
    const day = tradeDay(row);
    if (!ticker || !side || !day) continue;
    const fromLabel = parseExactUsdAmount(row.amount_label);
    const shares = row.shares;
    const price = row.price;
    const fromPx =
      shares != null &&
      price != null &&
      Number.isFinite(shares) &&
      Number.isFinite(price) &&
      shares > 0 &&
      price > 0
        ? shares * price
        : null;
    let amountUsd = fromLabel ?? fromPx;
    let unitWeighted = false;
    if (amountUsd == null && isTrumpStockActRangeLabel(row.amount_label)) {
      amountUsd = TRUMP_EQUAL_WEIGHT_NOTIONAL_USD;
      unitWeighted = true;
    }
    if (amountUsd == null || !(amountUsd > 0)) continue;
    const entryPrice =
      price != null && Number.isFinite(price) && price > 0 ? price : null;
    out.push({
      ticker,
      transaction_date: day,
      side,
      amountUsd,
      price: entryPrice,
      ...(unitWeighted ? { unitWeighted: true } : {}),
    });
  }
  return out.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
}

function emptyLots(): TrumpLot[] {
  return [];
}

function applyTrumpTrade(lots: TrumpLot[], t: TrumpTradeInput): TrumpLot[] {
  if (t.side === 'buy') {
    return [
      ...lots,
      {
        date: t.transaction_date,
        notional: t.amountUsd,
        entryPrice: t.price != null && t.price > 0 ? t.price : null,
      },
    ];
  }
  let remain = t.amountUsd;
  const next: TrumpLot[] = [];
  for (const lot of lots) {
    if (remain <= 0) {
      next.push(lot);
      continue;
    }
    if (lot.notional <= remain) {
      remain -= lot.notional;
    } else {
      next.push({ ...lot, notional: lot.notional - remain });
      remain = 0;
    }
  }
  return next;
}

export function replayTrumpLots(
  trades: TrumpTradeInput[]
): Map<string, TrumpLot[]> {
  const pos = new Map<string, TrumpLot[]>();
  const sorted = [...trades].sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date)
  );
  for (const t of sorted) {
    const cur = pos.get(t.ticker) ?? emptyLots();
    pos.set(t.ticker, applyTrumpTrade(cur, t));
  }
  return pos;
}

function lotMarketValue(
  lot: TrumpLot,
  live: number | null,
  series: CongressBasketPricePoint[] | null | undefined
): number {
  if (live != null && live > 0 && lot.entryPrice != null && lot.entryPrice > 0) {
    return lot.notional * (live / lot.entryPrice);
  }
  const entryClose = closeOnOrBefore(series, lot.date);
  if (live != null && live > 0 && entryClose != null && entryClose > 0) {
    return lot.notional * (live / entryClose);
  }
  return lot.notional;
}

function lotEntryPx(
  lot: TrumpLot,
  series: CongressBasketPricePoint[] | null | undefined
): number | null {
  if (lot.entryPrice != null && lot.entryPrice > 0) return lot.entryPrice;
  return closeOnOrBefore(series, lot.date);
}

/**
 * אחזקות בין הטיקרים הידועים של טראמפ.
 * בלי מחירי Yahoo — שווי = נומינל שנותר (יום העסקה), תשואה = null.
 */
export function buildTrumpHoldings(
  trades: TrumpTradeInput[],
  pricesByTicker?: Record<string, CongressBasketPricePoint[]>
): TrumpModelHolding[] {
  const pos = replayTrumpLots(trades);
  const rows: Array<Omit<TrumpModelHolding, 'weightPct'>> = [];

  for (const [ticker, lots] of pos) {
    const remaining = lots.reduce((s, l) => s + l.notional, 0);
    if (!(remaining > 0)) continue;
    const series = pricesByTicker?.[ticker];
    const live = latestTickerClose(series);
    let market = 0;
    let firstDate: string | null = null;
    let weightedEntry = 0;
    for (const lot of lots) {
      market += lotMarketValue(lot, live, series);
      if (!firstDate || lot.date < firstDate) firstDate = lot.date;
      const entryPx = lotEntryPx(lot, series);
      if (entryPx != null && entryPx > 0) weightedEntry += lot.notional * entryPx;
    }
    const avgEntry = remaining > 0 && weightedEntry > 0 ? weightedEntry / remaining : null;
    rows.push({
      type: 'TRUMP_NOTIONAL',
      ticker,
      remainingNotionalUsd: remaining,
      marketValueUsd: market,
      returnPct: holdingReturnFromEntry(live, avgEntry),
      firstAddedDate: firstDate,
      entryPrice: avgEntry,
      livePrice: live,
    });
  }

  const total = rows.reduce((s, h) => s + h.marketValueUsd, 0);
  return rows
    .map((h) => ({
      ...h,
      weightPct: total > 0 ? (h.marketValueUsd / total) * 100 : 0,
    }))
    .sort((a, b) => b.marketValueUsd - a.marketValueUsd);
}

export function sumTrumpPortfolioValue(
  holdings: TrumpModelHolding[]
): number | null {
  const sum = holdings.reduce((s, h) => s + h.marketValueUsd, 0);
  return sum > 0 ? sum : null;
}

function priceOf(
  ticker: string,
  date: string,
  closeMaps: Map<string, Map<string, number>>,
  lastClose: Map<string, number>
): number | null {
  const dayPx = closeMaps.get(ticker)?.get(date);
  if (dayPx != null && dayPx > 0) return dayPx;
  const inherited = lastClose.get(ticker);
  return inherited != null && inherited > 0 ? inherited : null;
}

/**
 * Mark-to-market יומי: נומינל נותר × יחס close מול יום הכניסה.
 * רק ימי מסחר. בלי midpoint של STOCK Act.
 */
export function buildTrumpMarkToMarketSeries(
  trades: TrumpTradeInput[],
  pricesByTicker: Record<string, CongressBasketPricePoint[]>
): CongressBasketValuePoint[] {
  if (!trades.length) return [];
  const sorted = [...trades].sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date)
  );

  const closeMaps = new Map<string, Map<string, number>>();
  let lastPriceDate: string | null = null;
  for (const [ticker, series] of Object.entries(pricesByTicker)) {
    const map = new Map<string, number>();
    for (const p of series) {
      if (!(p.close > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) continue;
      map.set(p.date, p.close);
      if (lastPriceDate == null || p.date > lastPriceDate) lastPriceDate = p.date;
    }
    if (map.size) closeMaps.set(ticker.toUpperCase(), map);
  }
  if (!closeMaps.size) return [];

  const start = sorted[0].transaction_date;
  const endTrade = sorted[sorted.length - 1].transaction_date;
  const end = lastPriceDate != null && lastPriceDate > endTrade ? lastPriceDate : endTrade;
  const days = unionTradingDates(pricesByTicker, start, end);
  if (days.length < 2) return [];

  const pos = new Map<string, TrumpLot[]>();
  const lastClose = new Map<string, number>();
  const out: CongressBasketValuePoint[] = [];
  let tradeIdx = 0;

  for (const date of days) {
    while (tradeIdx < sorted.length && sorted[tradeIdx].transaction_date <= date) {
      const t = sorted[tradeIdx];
      tradeIdx += 1;
      pos.set(t.ticker, applyTrumpTrade(pos.get(t.ticker) ?? emptyLots(), t));
    }
    for (const ticker of closeMaps.keys()) {
      const px = closeMaps.get(ticker)?.get(date);
      if (px != null && px > 0) lastClose.set(ticker, px);
    }

    let value = 0;
    for (const [ticker, lots] of pos) {
      const live = priceOf(ticker, date, closeMaps, lastClose);
      const series = pricesByTicker[ticker];
      for (const lot of lots) {
        value += lotMarketValue(lot, live, series);
      }
    }
    if (value <= 0) continue;
    out.push({ date, value });
  }

  return out;
}
