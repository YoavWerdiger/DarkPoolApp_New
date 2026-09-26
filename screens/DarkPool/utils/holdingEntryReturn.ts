/**
 * תשואת שורת אחזקה — רק מול מחיר כניסה אמיתי.
 *
 * Form 4: ממוצע משוקלל ממחירי קנייה (replay ב-`investorHoldings`).
 * 13F: mark = value_usd / shares בדיווח (אחרון או מצטבר לפי דלתת מניות).
 * קונגרס: רק שדה vendor (AvgCost / Shares / PriceChange). בלי midpoint של STOCK Act.
 */

import {
  impliedFilingPriceFrom13f,
  returnPctFromEntry,
} from './darkPoolFormat';
import {
  normalizeFiling13FRows,
  type Filing13FRow,
} from './filingChartSeries';
import {
  latestTickerClose,
  type CongressBasketPricePoint,
} from './investorHoldings';

export const implied13FMarkPrice = impliedFilingPriceFrom13f;
export const holdingReturnFromAvgCost = returnPctFromEntry;

const QUIVER_HOLDING_META = new Set([
  'allocation',
  'bioguideid',
  'currentholding',
  'name',
  'ticker',
]);

const VENDOR_COST_KEYS = [
  'PurchasePrice',
  'AvgCost',
  'AverageCost',
  'CostBasis',
  'avg_cost',
  'purchase_price',
  'Basis',
  'AvgPrice',
  'AveragePrice',
];

const VENDOR_SHARE_KEYS = [
  'Shares',
  'ShareQuantity',
  'Quantity',
  'shares',
  'Qty',
  'ShareQty',
];

const VENDOR_PRICE_CHANGE_KEYS = [
  'PriceChange',
  'price_change',
  'price_change_pct',
  'PriceChangePct',
];

function positiveNum(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const n = Number(raw.replace(/[$,]/g, '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  return null;
}

function finiteNum(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const n = Number(raw.replace(/%/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

function firstKeyed(
  raw: Record<string, unknown>,
  keys: string[],
  parse: (v: unknown) => number | null
): number | null {
  for (const key of keys) {
    if (!(key in raw)) continue;
    if (QUIVER_HOLDING_META.has(key.toLowerCase())) continue;
    const n = parse(raw[key]);
    if (n != null) return n;
  }
  return null;
}

export interface QuiverHoldingVendorEntry {
  vendorAvgCost: number | null;
  vendorShares: number | null;
  vendorPriceChangePct: number | null;
}

/**
 * Quiver `congress_stock_holdings` החי הוא 5 שדות בלבד
 * (Ticker / CurrentHolding / Allocation / BioGuideID / Name).
 * אם יופיע PurchasePrice / Shares / PriceChange — נשתמש. אחרת null.
 */
export function extractQuiverHoldingVendorEntry(
  raw: Record<string, unknown> | null | undefined
): QuiverHoldingVendorEntry {
  if (!raw || typeof raw !== 'object') {
    return { vendorAvgCost: null, vendorShares: null, vendorPriceChangePct: null };
  }
  return {
    vendorAvgCost: firstKeyed(raw, VENDOR_COST_KEYS, positiveNum),
    vendorShares: firstKeyed(raw, VENDOR_SHARE_KEYS, positiveNum),
    vendorPriceChangePct: firstKeyed(raw, VENDOR_PRICE_CHANGE_KEYS, finiteNum),
  };
}

export interface CongressHonestReturnInput {
  vendorAvgCost?: number | null;
  vendorShares?: number | null;
  currentHoldingUsd?: number | null;
  livePrice?: number | null;
  /** Quiver/DB PriceChange לטיקר — לא «כניסה» שחזרנו. */
  vendorPriceChangePct?: number | null;
}

/**
 * תשואת אחזקת קונגרס רק מנתוני vendor.
 * אין Shares + CurrentHolding → לא גוזרים כמות מ-amount_label.
 */
export function congressHonestHoldingReturnPct(
  input: CongressHonestReturnInput
): number | null {
  const live = input.livePrice != null && input.livePrice > 0 ? input.livePrice : null;
  const vendorCost =
    input.vendorAvgCost != null && input.vendorAvgCost > 0 ? input.vendorAvgCost : null;
  if (vendorCost != null && live != null) {
    return returnPctFromEntry(live, vendorCost);
  }
  const shares = input.vendorShares != null && input.vendorShares > 0 ? input.vendorShares : null;
  const usd =
    input.currentHoldingUsd != null && input.currentHoldingUsd > 0
      ? input.currentHoldingUsd
      : null;
  if (shares != null && usd != null && live != null) {
    return returnPctFromEntry(live, usd / shares);
  }
  const pc = input.vendorPriceChangePct;
  if (pc != null && Number.isFinite(pc)) return pc;
  return null;
}

export interface Filing13FPosition {
  shares: number;
  /** ממוצע מצטבר אם יש דלתות; אחרת mark של הדיווח האחרון. */
  avgCost: number | null;
  lastMark: number | null;
}

/**
 * 13F: כל דיווח עם value+shares הוא mark רבעוני.
 * עליית מניות = קנייה במחיר ה-mark; ירידה = גריעת עלות יחסית.
 * בלי value/shares לא ממציאים כניסה.
 */
export function replay13FAvgCost(rows: Filing13FRow[]): Map<string, Filing13FPosition> {
  const clean = normalizeFiling13FRows(rows);
  const byTicker = new Map<string, Filing13FRow[]>();
  for (const row of clean) {
    const list = byTicker.get(row.ticker) ?? [];
    list.push(row);
    byTicker.set(row.ticker, list);
  }

  const out = new Map<string, Filing13FPosition>();
  for (const [ticker, list] of byTicker) {
    const sorted = [...list].sort((a, b) => a.filing_date.localeCompare(b.filing_date));
    let shares = 0;
    let costUsd = 0;
    let lastMark: number | null = null;
    let seeded = false;
    let tracked = false;

    for (const row of sorted) {
      const mark = implied13FMarkPrice(row.value_usd, row.shares);
      if (mark != null) lastMark = mark;
      if (row.shares == null || !(row.shares > 0)) continue;

      if (!seeded) {
        shares = row.shares;
        if (mark != null) {
          costUsd = row.shares * mark;
          tracked = true;
        }
        seeded = true;
        continue;
      }

      const delta = row.shares - shares;
      if (delta > 0) {
        if (mark != null && tracked) {
          costUsd += delta * mark;
        } else if (mark != null && !tracked) {
          costUsd = row.shares * mark;
          tracked = true;
        } else {
          tracked = false;
        }
        shares = row.shares;
      } else if (delta < 0) {
        if (tracked && shares > 0 && costUsd > 0) {
          costUsd *= row.shares / shares;
        }
        shares = row.shares;
      } else {
        shares = row.shares;
      }
    }

    if (!seeded || !(shares > 0)) continue;
    const accumulated = tracked && costUsd > 0 ? costUsd / shares : null;
    out.set(ticker, {
      shares,
      avgCost: accumulated ?? lastMark,
      lastMark,
    });
  }
  return out;
}

export function quotesMapFromDailyCloses(
  prices: Record<string, CongressBasketPricePoint[]> | null | undefined
): Map<string, number> {
  const map = new Map<string, number>();
  if (!prices) return map;
  for (const [ticker, series] of Object.entries(prices)) {
    const live = latestTickerClose(series);
    if (live != null && live > 0) map.set(ticker.toUpperCase().trim(), live);
  }
  return map;
}

export function filingHoldingReturnPct(
  livePrice: number | null | undefined,
  avgCost: number | null | undefined
): number | null {
  return returnPctFromEntry(livePrice, avgCost);
}
