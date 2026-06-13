import type { PriceQuote } from '../../Portfolios/portfolioTypes';
import type { CongressFeedTrade } from '../../../services/darkpool/uwCongressFeedService';
import { calcSinceTradePct } from './insiderFeedCalc';

export interface CongressTradeFeedItem {
  trade: CongressFeedTrade;
  quote: PriceQuote | null;
  sinceTradePct: number | null;
}

export function buildCongressFeedItem(
  trade: CongressFeedTrade,
  quotes: Map<string, PriceQuote>
): CongressTradeFeedItem {
  const quote = quotes.get(trade.ticker.toUpperCase()) ?? null;
  return {
    trade,
    quote,
    sinceTradePct: calcSinceTradePct(trade.price, quote?.price ?? null),
  };
}

/** שורה קצרה לכרטיס פיד. */
export function formatCongressTradeShort(trade: CongressFeedTrade): string {
  const verb = trade.transaction_type === 'sell' ? 'מכר' : 'רכש';
  const range = formatDisclosureRange(trade.amount_label);
  if (range) return `${verb} · ${trade.ticker} · ${range.replace('בטווח ', '')}`;
  if (trade.shares != null && trade.shares > 0) {
    return `${verb} · ${trade.ticker} · ${formatShareCount(trade.shares)} מניות`;
  }
  return `${verb} · ${trade.ticker}`;
}

/** שורת פעולה קריאה — כמות מניות או טווח שווי (STIR), בלי UUID. */
export function formatCongressTradeSummary(trade: CongressFeedTrade): string {
  const verb = trade.transaction_type === 'sell' ? 'מכר' : 'רכש';
  const ticker = trade.ticker;

  if (trade.shares != null && trade.shares > 0) {
    const qty = formatShareCount(trade.shares);
    if (trade.price != null && Number.isFinite(trade.price)) {
      return `${verb} ${qty} מניות ב-${ticker} במחיר ${formatTradeUsd(trade.price)} למניה`;
    }
    return `${verb} כ-${qty} מניות ב-${ticker}`;
  }

  const range = formatDisclosureRange(trade.amount_label);
  if (range) {
    return `${verb} ${range} ב-${ticker}`;
  }

  return `${verb} עסקה ב-${ticker}`;
}

function formatShareCount(shares: number): string {
  const n = Math.abs(Math.round(shares));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return n.toLocaleString('en-US');
  if (n >= 1_000) return n.toLocaleString('en-US');
  return String(n);
}

function formatTradeUsd(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  return `$${price.toFixed(2)}`;
}

/** "$1,001 - $15,000" → "בטווח $1,001–$15,000" */
function formatDisclosureRange(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.trim().replace(/\s*-\s*/g, '–').replace(/\s+/g, ' ');
  if (/^[0-9a-f-]{30,}$/i.test(cleaned)) return null;
  if (!/\$/.test(cleaned) && !/\d/.test(cleaned)) return null;
  return cleaned.startsWith('$') ? `בטווח ${cleaned}` : `בטווח $${cleaned}`;
}
