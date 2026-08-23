/**
 * כרטיס פיד קונגרס — אווטאר + לוגו מניה + פעולה ברורה.
 */

import React, { memo } from 'react';
import { getFeedTradeDetailParts } from '../utils/feedTradeDisplay';
import { type CongressTradeFeedItem } from '../utils/congressFeedCalc';
import { DarkPoolTradeFeedCard } from './DarkPoolTradeFeedCard';

interface Props {
  item: CongressTradeFeedItem;
  onPersonPress?: (politicianId: string) => void;
}

export const CongressTradeCard = memo(function CongressTradeCard({
  item,
  onPersonPress,
}: Props) {
  const { trade, sinceTradePct } = item;
  const { sharesLabel, amountLabel } = getFeedTradeDetailParts({
    shares: trade.shares,
    amountLabel: trade.amount_label,
  });

  return (
    <DarkPoolTradeFeedCard
      ticker={trade.ticker}
      personName={trade.politician_name}
      transactionType={trade.transaction_type}
      sharesLabel={sharesLabel}
      amountLabel={amountLabel}
      filedAt={trade.filed_at}
      sinceTradePct={sinceTradePct}
      personImageUrl={trade.politician_image_url}
      personId={trade.politician_id}
      personKind="politician"
      onPress={
        onPersonPress && trade.politician_id
          ? () => onPersonPress(trade.politician_id)
          : undefined
      }
    />
  );
});
