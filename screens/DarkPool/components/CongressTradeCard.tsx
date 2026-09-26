/**
 * כרטיס פיד קונגרס.
 *
 * דיווח STOCK Act מכיל טווח סכום בלבד — לא מניות, לא מחיר, לא שווי מדויק.
 * «מאז העסקה» — שינוי מחיר הטיקר מפתיחת יום הביצוע מול חי (לא טווח STOCK Act).
 */

import React, { memo } from 'react';
import { formatDisclosedAmountRange } from '../utils/congressTradeDisplay';
import { type CongressTradeFeedItem } from '../utils/congressFeedCalc';
import { DarkPoolTradeFeedCard } from './DarkPoolTradeFeedCard';

interface Props {
  item: CongressTradeFeedItem;
  onPersonPress?: (politicianId: string) => void;
  onDetailPress?: () => void;
}

export const CongressTradeCard = memo(function CongressTradeCard({
  item,
  onPersonPress,
  onDetailPress,
}: Props) {
  const { trade, quote, sinceTradePct } = item;
  const amountLabel = formatDisclosedAmountRange(trade.amount_label);

  return (
    <DarkPoolTradeFeedCard
      ticker={trade.ticker}
      personName={trade.politician_name}
      portraitUrl={trade.politician_image_url}
      transactionType={trade.transaction_type}
      amountLabel={amountLabel}
      transactionDate={trade.transaction_date}
      changeSinceTradePct={sinceTradePct}
      currentPrice={quote?.price ?? null}
      personKind="politician"
      onPersonPress={
        onPersonPress && trade.politician_id
          ? () => onPersonPress(trade.politician_id)
          : undefined
      }
      onCardPress={onDetailPress}
    />
  );
});
