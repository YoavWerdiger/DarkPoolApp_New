/**
 * הדפסת לווייתן — UICard glass.
 */

import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { DarkPoolTradeRow } from '../../../types/darkpool.types';
import { formatRelativeTime, formatUsdCompact } from '../utils/darkPoolFormat';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import {
  DarkPoolMetricCell,
  DarkPoolMetricsGrid,
  darkPoolHeaderStyles,
} from './darkPoolCardMetrics';

interface WhaleCardProps {
  trade: DarkPoolTradeRow;
  onPress?: (ticker: string) => void;
  showDivider?: boolean;
}

const SIDE_HE: Record<string, string> = {
  buy: 'קנייה',
  sell: 'מכירה',
  unknown: 'דארק פול',
};

export function WhaleCard({ trade, onPress }: WhaleCardProps) {
  const tokens = useDesignTokens();
  const h = useMemo(() => darkPoolHeaderStyles(tokens), [tokens]);
  const sideLabel = SIDE_HE[trade.side || 'unknown'] || 'דארק פול';
  const sideColor =
    trade.side === 'buy'
      ? tokens.colors.primary.main
      : trade.side === 'sell'
        ? tokens.colors.text.danger
        : tokens.colors.text.tertiary;

  return (
    <DarkPoolFeedCard
      onPress={onPress ? () => onPress(trade.ticker) : undefined}
      accessibilityLabel={`הדפסה ${trade.ticker}`}
    >
      <View style={h.header}>
        <TickerLogo symbol={trade.ticker} size={40} borderRadius={12} />
        <View style={h.headerMain}>
          <View style={h.titleRow}>
            <Text style={h.ticker}>{trade.ticker}</Text>
            <View style={[h.badge, { backgroundColor: `${sideColor}22` }]}>
              <Text style={[h.badgeText, { color: sideColor }]}>{sideLabel}</Text>
            </View>
          </View>
          <Text style={h.subtitle} numberOfLines={1}>
            {trade.company_name?.trim() || 'הדפסת לווייתן'}
          </Text>
        </View>
        <Ionicons name="water" size={22} color={tokens.colors.primary.main} />
      </View>

      <DarkPoolMetricsGrid tokens={tokens}>
        <DarkPoolMetricCell
          tokens={tokens}
          label="פרימיום"
          value={formatUsdCompact(trade.premium)}
        />
        <DarkPoolMetricCell
          tokens={tokens}
          label="כמות"
          value={Number(trade.size).toLocaleString('en-US')}
        />
        <DarkPoolMetricCell
          tokens={tokens}
          label="מחיר"
          value={`$${Number(trade.price).toFixed(2)}`}
        />
        <DarkPoolMetricCell
          tokens={tokens}
          label="זמן"
          value={formatRelativeTime(trade.ts) || '—'}
        />
      </DarkPoolMetricsGrid>
    </DarkPoolFeedCard>
  );
}
