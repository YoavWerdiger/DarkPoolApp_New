/**
 * תשואת שורת אחזקה — קונגרס.
 * 1) vendor cost / shares (Quiver) אם קיים
 * 2) מחיר המניה מאז רכישה אחרונה שדווחה ב-PTR: open ביום transaction_date מול חי
 * 3) PriceChange של אותה עסקה (Quiver) אם אין פתיחה
 *
 * לא midpoint STOCK Act, לא כמות מטווח, לא P&L פוזיציה.
 */

import type { CongressFeedTrade } from '../../../services/darkpool/uwCongressFeedService';
import {
  pickDailyOpenOnDate,
  resolveCongressSinceTradePct,
  type DailyOpenPoint,
} from './congressSinceTrade';
import {
  congressHonestHoldingReturnPct,
  type CongressHonestReturnInput,
} from './holdingEntryReturn';

export interface LastCongressPurchase {
  transactionDate: string;
  priceChangePct: number | null;
}

function isoDay(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function isBuyTrade(trade: CongressFeedTrade): boolean {
  if (trade.transaction_type === 'buy') return true;
  if (trade.transaction_type === 'sell') return false;
  return !isSellTxnLabel(trade.txn_label);
}

function isSellTxnLabel(label: string | null | undefined): boolean {
  const l = String(label ?? '').toLowerCase();
  return /sell|sale|מכר|מכיר|dispose/.test(l);
}

/**
 * לכל טיקר — העסקת קנייה האחרונה לפי transaction_date (STOCK Act).
 */
export function lastCongressPurchaseByTicker(
  trades: ReadonlyArray<CongressFeedTrade>
): Map<string, LastCongressPurchase> {
  const map = new Map<string, LastCongressPurchase>();
  for (const t of trades) {
    if (!isBuyTrade(t)) continue;
    const sym = t.ticker.trim().toUpperCase().replace(/^\$/, '');
    const day = isoDay(t.transaction_date);
    if (!sym || !day) continue;
    const prev = map.get(sym);
    if (prev && prev.transactionDate >= day) continue;
    const pc =
      t.price_change_pct != null && Number.isFinite(t.price_change_pct)
        ? t.price_change_pct
        : null;
    map.set(sym, { transactionDate: day, priceChangePct: pc });
  }
  return map;
}

export function congressHoldingReturnSinceLastPtrBuy(input: {
  lastPurchase: LastCongressPurchase | null | undefined;
  dailyBars: ReadonlyArray<DailyOpenPoint> | null | undefined;
  livePrice: number | null | undefined;
}): number | null {
  const purchase = input.lastPurchase;
  if (!purchase) return null;
  return resolveCongressSinceTradePct({
    vendorPriceChangePct: purchase.priceChangePct,
    openOnTransactionDate: pickDailyOpenOnDate(input.dailyBars, purchase.transactionDate),
    currentPrice: input.livePrice,
  });
}

export function resolveCongressHoldingDisplayReturnPct(
  input: CongressHonestReturnInput & {
    lastPurchase?: LastCongressPurchase | null;
    dailyBars?: ReadonlyArray<DailyOpenPoint> | null;
  }
): number | null {
  const fromVendor = congressHonestHoldingReturnPct(input);
  if (fromVendor != null) return fromVendor;
  return congressHoldingReturnSinceLastPtrBuy({
    lastPurchase: input.lastPurchase,
    dailyBars: input.dailyBars,
    livePrice: input.livePrice,
  });
}
