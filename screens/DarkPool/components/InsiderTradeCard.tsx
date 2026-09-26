/**
 * כרטיס פיד בכיר — לוגו מניה + פעולה ברורה.
 */

import React, { memo } from 'react';
import { useCachedFeedQuote } from '../../../hooks/useFeedQuotesCache';
import { formatInsiderRole } from '../utils/insiderTradeDisplay';
import { calcSinceTradePct, type InsiderTradeFeedItem } from '../utils/insiderFeedCalc';
import { DarkPoolTradeFeedCard } from './DarkPoolTradeFeedCard';

interface InsiderTradeCardProps {
  item: InsiderTradeFeedItem;
  onPersonPress?: (personId: string, name: string) => void;
  /** פרטי העסקה — יעד ההקשה הראשי של הכרטיס, כמו בשורת קונגרס. */
  onDetailPress?: () => void;
}

export const InsiderTradeCard = memo(function InsiderTradeCard({
  item,
  onPersonPress,
  onDetailPress,
}: InsiderTradeCardProps) {
  const { trade, quote, sinceTradePct } = item;
  const cachedQuote = useCachedFeedQuote(trade.ticker);
  const liveQuote = quote ?? cachedQuote;
  const sinceRatio =
    sinceTradePct ?? calcSinceTradePct(trade.price, liveQuote?.price ?? null);
  const displayName = trade.insider_name?.trim() || 'בכיר';
  const personId = `${trade.ticker}:${displayName}`;
  const shares = trade.shares > 0 ? trade.shares : null;

  return (
    <DarkPoolTradeFeedCard
      ticker={trade.ticker}
      personName={displayName}
      transactionType={trade.transaction_type}
      shares={shares}
      price={trade.price}
      personHint={formatInsiderRole(trade.insider_role)}
      transactionDate={trade.transaction_date}
      portraitUrl={trade.insider_logo_url}
      changeSinceTradePct={sinceRatio != null ? sinceRatio * 100 : null}
      currentPrice={liveQuote?.price ?? null}
      personKind="insider"
      onPersonPress={
        onPersonPress ? () => onPersonPress(personId, displayName) : undefined
      }
      onCardPress={onDetailPress}
    />
  );
});
