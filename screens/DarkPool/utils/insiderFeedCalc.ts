/**
 * insiderFeedCalc.ts
 * -----------------------------------------------------------------------------
 * עוזרים טהורים (pure) לחישובי "LATEST TRADES" של ה-Dark Pool.
 *
 * הקובץ נשאר ללא תלויות בריאקט/supabase כדי שאפשר יהיה לטסט אותו ישירות
 * תחת jest-expo/node (preset לבדיקות לוגיקה טהורה).
 */

import type { InsiderBuyRow } from '../../../types/darkpool.types';
import type { PriceQuote } from '../../Portfolios/portfolioTypes';

export interface InsiderTradeFeedItem {
  trade: InsiderBuyRow;
  quote: PriceQuote | null;
  /** ((currentPrice - trade.price) / trade.price); null אם quote/price חסר. */
  sinceTradePct: number | null;
}

/**
 * חישוב % שינוי מאז מחיר הרכישה:
 *   ((currentPrice - tradePrice) / tradePrice)
 * מחזיר null אם אחד הקלטים לא חוקי.
 */
export function calcSinceTradePct(
  tradePrice: number | null | undefined,
  currentPrice: number | null | undefined
): number | null {
  if (tradePrice == null || currentPrice == null) return null;
  if (!Number.isFinite(tradePrice) || !Number.isFinite(currentPrice)) return null;
  if (tradePrice <= 0) return null;
  return (currentPrice - tradePrice) / tradePrice;
}

/**
 * בונה item של פיד מתוך trade + map של quotes (ticker → quote).
 * הקריאה ל-map מנורמלת ל-uppercase כדי שיתאים לסכמת ה-DB.
 */
export function buildFeedItem(
  trade: InsiderBuyRow,
  quotes: Map<string, PriceQuote>
): InsiderTradeFeedItem {
  const quote = quotes.get(trade.ticker.toUpperCase()) ?? null;
  return {
    trade,
    quote,
    sinceTradePct: calcSinceTradePct(trade.price, quote?.price ?? null),
  };
}

/** שורה קצרה לכרטיס פיד — בלי פירוט מחיר למניה. */
export function formatInsiderTradeShort(trade: InsiderBuyRow): string {
  const verb = trade.transaction_type === 'S' ? 'מכר' : 'רכש';
  const value = trade.value ?? (trade.shares > 0 && trade.price > 0 ? trade.shares * trade.price : 0);
  if (value > 0) {
    return `${verb} · ${trade.ticker} · ${formatInsiderTradeUsd(value)}`;
  }
  if (trade.shares > 0) {
    return `${verb} · ${trade.ticker} · ${formatInsiderShareCount(trade.shares)} מניות`;
  }
  return `${verb} · ${trade.ticker}`;
}

/** שורת פעולה מלאה (פרופיל / פרטים). */
export function formatInsiderTradeSummary(trade: InsiderBuyRow): string {
  const verb = trade.transaction_type === 'S' ? 'מכר' : 'רכש';
  const ticker = trade.ticker;
  const qty = formatInsiderShareCount(trade.shares);

  if (trade.shares != null && trade.shares > 0) {
    if (trade.price != null && Number.isFinite(trade.price) && trade.price > 0) {
      return `${verb} ${qty} מניות ב-${ticker} במחיר ${formatInsiderTradeUsd(trade.price)} למניה`;
    }
    return `${verb} ${qty} מניות ב-${ticker}`;
  }

  const value = trade.value ?? 0;
  if (value > 0) {
    return `${verb} עסקה ב-${ticker} בשווי ${formatInsiderTradeUsd(value)}`;
  }

  return `${verb} עסקה ב-${ticker}`;
}

function formatInsiderShareCount(shares: number): string {
  const n = Math.abs(Math.round(shares));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString('en-US');
  return String(n);
}

function formatInsiderTradeUsd(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toFixed(2)}`;
}
