/**
 * כרטיס פיד בכיר — אווטאר + לוגו מניה + פעולה ברורה.
 */

import React, { memo } from 'react';
import { getFeedTradeDetailParts } from '../utils/feedTradeDisplay';
import { type InsiderTradeFeedItem } from '../utils/insiderFeedCalc';
import { DarkPoolTradeFeedCard } from './DarkPoolTradeFeedCard';

interface InsiderTradeCardProps {
  item: InsiderTradeFeedItem;
  onPersonPress?: (personId: string, name: string) => void;
}

export const InsiderTradeCard = memo(function InsiderTradeCard({
  item,
  onPersonPress,
}: InsiderTradeCardProps) {
  const { trade, sinceTradePct } = item;
  const displayName = trade.insider_name?.trim() || 'בכיר';
  const personId = `${trade.ticker}:${displayName}`;
  const value =
    trade.value ?? (trade.shares > 0 && trade.price > 0 ? trade.shares * trade.price : null);
  const { sharesLabel, amountLabel } = getFeedTradeDetailParts({
    shares: trade.shares,
    valueUsd: value,
  });

  return (
    <DarkPoolTradeFeedCard
      ticker={trade.ticker}
      personName={displayName}
      transactionType={trade.transaction_type}
      sharesLabel={sharesLabel}
      amountLabel={amountLabel}
      filedAt={trade.filed_at}
      sinceTradePct={sinceTradePct}
      personImageUrl={trade.insider_logo_url}
      personId={personId}
      personKind="insider"
      onPress={onPersonPress ? () => onPersonPress(personId, displayName) : undefined}
    />
  );
});
