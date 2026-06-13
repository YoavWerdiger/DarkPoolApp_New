/**
 * כרטיס פיד קונגרס — לוגו מניה + פעולה ברורה.
 */

import React from 'react';
import { formatFeedTradeDetail } from '../utils/feedTradeDisplay';
import { type CongressTradeFeedItem } from '../utils/congressFeedCalc';
import { DarkPoolTradeFeedCard } from './DarkPoolTradeFeedCard';

interface Props {
  item: CongressTradeFeedItem;
  onPersonPress?: (politicianId: string) => void;
}

export function CongressTradeCard({ item, onPersonPress }: Props) {
  const { trade, sinceTradePct } = item;
  const detail = formatFeedTradeDetail({
    shares: trade.shares,
    amountLabel: trade.amount_label,
  });

  return (
    <DarkPoolTradeFeedCard
      ticker={trade.ticker}
      personName={trade.politician_name}
      transactionType={trade.transaction_type}
      detail={detail}
      filedAt={trade.filed_at}
      sinceTradePct={sinceTradePct}
      onPress={
        onPersonPress && trade.politician_id
          ? () => onPersonPress(trade.politician_id)
          : undefined
      }
    />
  );
}
