import i18n from '../../../lib/i18n';
import type { HistoricalPricePoint, PriceQuote } from '../../Portfolios/portfolioTypes';
import type { CongressFeedTrade } from '../../../services/darkpool/uwCongressFeedService';
import {
  pickDailyOpenOnDate,
  resolveCongressSinceTradePct,
} from './congressSinceTrade';

export { resolveCongressSinceTradePct } from './congressSinceTrade';

export interface CongressTradeFeedItem {
  trade: CongressFeedTrade;
  quote: PriceQuote | null;
  /** % טיקר מאז יום העסקה — פתיחת יום הביצוע מול חי (PriceChange רק fallback). */
  sinceTradePct: number | null;
}

export function buildCongressFeedItem(
  trade: CongressFeedTrade,
  quotes: Map<string, PriceQuote>,
  dailyBars?: Map<string, HistoricalPricePoint[]>
): CongressTradeFeedItem {
  const quote = quotes.get(trade.ticker.toUpperCase()) ?? null;
  const bars = dailyBars?.get(trade.ticker.toUpperCase());
  return {
    trade,
    quote,
    sinceTradePct: resolveCongressSinceTradePct({
      vendorPriceChangePct: trade.price_change_pct,
      openOnTransactionDate: pickDailyOpenOnDate(bars, trade.transaction_date),
      currentPrice: quote?.price ?? null,
    }),
  };
}

/** שורה קצרה לכרטיס פיד. */
export function formatCongressTradeShort(trade: CongressFeedTrade): string {
  const verb = trade.transaction_type === 'sell' ? i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s1') : i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s2');
  const range = formatDisclosureRange(trade.amount_label);
  if (range) return `${verb} · ${trade.ticker} · ${range.replace('בטווח ', '')}`;
  if (trade.shares != null && trade.shares > 0) {
    return i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s3', { v0: verb, v1: trade.ticker, v2: formatShareCount(trade.shares) });
  }
  return `${verb} · ${trade.ticker}`;
}

/** שורת פעולה קריאה — כמות מניות או טווח שווי (STIR), בלי UUID. */
export function formatCongressTradeSummary(trade: CongressFeedTrade): string {
  const verb = trade.transaction_type === 'sell' ? i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s1') : i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s2');
  const ticker = trade.ticker;

  if (trade.shares != null && trade.shares > 0) {
    const qty = formatShareCount(trade.shares);
    if (trade.price != null && Number.isFinite(trade.price)) {
      return i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s4', { v0: verb, v1: qty, v2: ticker, v3: formatTradeUsd(trade.price) });
    }
    return i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s5', { v0: verb, v1: qty, v2: ticker });
  }

  const range = formatDisclosureRange(trade.amount_label);
  if (range) {
    return i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s6', { v0: verb, v1: range, v2: ticker });
  }

  return i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s7', { v0: verb, v1: ticker });
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
  return cleaned.startsWith('$') ? i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s8', { v0: cleaned }) : i18n.t('auto.screens__DarkPool__utils__congressFeedCalc.s9', { v0: cleaned });
}
