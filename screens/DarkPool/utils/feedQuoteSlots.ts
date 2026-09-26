/**
 * מציגי מחיר חי / מאז העסקה — תמיד שמור-גובה.
 * לא ממציאים $0; חוסר נתון = «—».
 */

import { formatReturnPct } from './congressTradeDisplay';

/** מציין חוסר ציטוט — לא 0% ולא הסתרת שורה. */
export const FEED_QUOTE_PLACEHOLDER = '—';

export function formatFeedLivePriceText(
  price: number | null | undefined
): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return `$${price.toFixed(2)}`;
}

export function resolveFeedQuoteSlots(opts: {
  currentPrice?: number | null;
  changeSinceTradePct?: number | null;
}): {
  priceText: string;
  changeText: string;
  priceKnown: boolean;
  changeKnown: boolean;
} {
  const rawPrice = formatFeedLivePriceText(opts.currentPrice);
  const rawChange = formatReturnPct(opts.changeSinceTradePct);
  return {
    priceText: rawPrice ?? FEED_QUOTE_PLACEHOLDER,
    changeText: rawChange ?? FEED_QUOTE_PLACEHOLDER,
    priceKnown: rawPrice != null,
    changeKnown: rawChange != null,
  };
}
