/**
 * כרטיס פיד קונגרס.
 *
 * דיווח STOCK Act מכיל טווח סכום בלבד — לא מניות, לא מחיר, לא שווי מדויק.
 * לכן מוצג טווח הדיווח, ו"מאז העסקה" מגיע מ-`PriceChange` של Quiver
 * (נשמר ב-`price_change_pct`) ולא משחזור מקומי.
 */

import React, { memo } from 'react';
import { withFeedValueLabel } from '../utils/feedTradeDisplay';
import { formatDisclosedAmountRangeCompact } from '../utils/congressTradeDisplay';
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
  const { trade, quote } = item;
  const amountLabel = withFeedValueLabel(
    formatDisclosedAmountRangeCompact(trade.amount_label)
  );

  return (
    <DarkPoolTradeFeedCard
      ticker={trade.ticker}
      personName={trade.politician_name}
      portraitUrl={trade.politician_image_url}
      transactionType={trade.transaction_type}
      amountLabel={amountLabel}
      filedAt={trade.filed_at}
      transactionDate={trade.transaction_date}
      changeSinceTradePct={trade.price_change_pct}
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
