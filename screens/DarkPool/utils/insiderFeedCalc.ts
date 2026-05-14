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
