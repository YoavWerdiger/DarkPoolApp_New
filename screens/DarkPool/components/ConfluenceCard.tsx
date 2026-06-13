/**
 * קונפלוונס בכיר + דארק פול — UICard עם מסגרת accent.
 */

import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { DarkPoolSignalRow } from '../../../types/darkpool.types';
import {
  formatRelativeTime,
  formatUsdCompact,
  scoreColor,
} from '../utils/darkPoolFormat';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import {
  DarkPoolMetricCell,
  DarkPoolMetricsGrid,
  darkPoolHeaderStyles,
} from './darkPoolCardMetrics';

interface ConfluenceCardProps {
  signal: DarkPoolSignalRow;
  onPress?: (ticker: string) => void;
  showDivider?: boolean;
}

export function ConfluenceCard({ signal, onPress }: ConfluenceCardProps) {
  const tokens = useDesignTokens();
  const h = useMemo(() => darkPoolHeaderStyles(tokens), [tokens]);
  const sc = scoreColor(signal.score, tokens);
  const insider = signal.metrics?.insider_name || 'בכיר';
  const days = signal.metrics?.insider_days_ago ?? 0;
  const relVol =
    signal.metrics?.relative_volume != null
      ? `×${Number(signal.metrics.relative_volume).toFixed(1)}`
      : '—';

  return (
    <DarkPoolFeedCard
      accent
      onPress={onPress ? () => onPress(signal.ticker) : undefined}
      accessibilityLabel={`קונפלוונס ${signal.ticker}`}
    >
      <View style={h.header}>
        <TickerLogo symbol={signal.ticker} size={40} borderRadius={12} />
        <View style={h.headerMain}>
          <View style={h.titleRow}>
            <Text style={h.ticker}>{signal.ticker}</Text>
            <View style={h.badge}>
              <Text style={h.badgeText}>קונפלוונס</Text>
            </View>
          </View>
          <Text style={h.subtitle} numberOfLines={1}>
            {insider} · {formatRelativeTime(signal.detected_at)}
          </Text>
        </View>
        <View style={h.scoreBox}>
          <Text style={[h.scoreNum, { color: sc }]}>{Math.round(signal.score)}</Text>
          <Text style={h.scoreLbl}>ציון</Text>
        </View>
      </View>

      <DarkPoolMetricsGrid tokens={tokens}>
        <DarkPoolMetricCell
          tokens={tokens}
          label="רכישת בכיר"
          value={formatUsdCompact(signal.metrics?.insider_value)}
        />
        <DarkPoolMetricCell
          tokens={tokens}
          label="דארק פול"
          value={formatUsdCompact(signal.metrics?.premium_total)}
        />
        <DarkPoolMetricCell tokens={tokens} label="לפני" value={`${days} ימ׳`} />
        <DarkPoolMetricCell
          tokens={tokens}
          label="מול ממוצע"
          value={relVol}
          valueColor={
            signal.metrics?.relative_volume != null
              ? tokens.colors.primary.main
              : undefined
          }
        />
      </DarkPoolMetricsGrid>

      {signal.ai_summary || signal.reason ? (
        <Text style={h.reason} numberOfLines={3}>
          {signal.ai_summary || signal.reason}
        </Text>
      ) : null}
    </DarkPoolFeedCard>
  );
}
