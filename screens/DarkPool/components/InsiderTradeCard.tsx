/**
 * כרטיס פיד בכיר — לוגו מניה + פעולה ברורה (בלי תמונת בכיר).
 */

import React from 'react';
import { formatFeedTradeDetail } from '../utils/feedTradeDisplay';
import { type InsiderTradeFeedItem } from '../utils/insiderFeedCalc';
import { DarkPoolTradeFeedCard } from './DarkPoolTradeFeedCard';

interface InsiderTradeCardProps {
  item: InsiderTradeFeedItem;
  onPersonPress?: (personId: string, name: string) => void;
}

export function InsiderTradeCard({ item, onPersonPress }: InsiderTradeCardProps) {
  const { trade, sinceTradePct } = item;
  const displayName = trade.insider_name?.trim() || 'בכיר';
  const personId = `${trade.ticker}:${displayName}`;
  const value =
    trade.value ?? (trade.shares > 0 && trade.price > 0 ? trade.shares * trade.price : null);
  const detail = formatFeedTradeDetail({
    shares: trade.shares,
    valueUsd: value,
  });

  return (
    <DarkPoolTradeFeedCard
      ticker={trade.ticker}
      personName={displayName}
      transactionType={trade.transaction_type}
      detail={detail}
      filedAt={trade.filed_at}
      sinceTradePct={sinceTradePct}
      onPress={onPersonPress ? () => onPersonPress(personId, displayName) : undefined}
    />
  );
}
