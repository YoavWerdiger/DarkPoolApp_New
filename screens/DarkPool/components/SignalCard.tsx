/**
 * כרטיס סיגנל — UICard glass + גריד מטריקות (כמו TradeListCard).
 */

import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { DarkPoolFeedItem } from '../../../types/darkpool.types';
import {
  formatRelativeTime,
  formatUsdCompact,
  scoreColor,
  signalTypeLabel,
  signalTypeShortLabel,
} from '../utils/darkPoolFormat';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import {
  DarkPoolMetricCell,
  DarkPoolMetricsGrid,
  darkPoolHeaderStyles,
} from './darkPoolCardMetrics';

interface SignalCardProps {
  item: DarkPoolFeedItem;
  onPress?: (ticker: string) => void;
  showDivider?: boolean;
}

export function SignalCard({ item, onPress }: SignalCardProps) {
  const tokens = useDesignTokens();
  const h = useMemo(() => darkPoolHeaderStyles(tokens), [tokens]);
  const { signal } = item;
  const sc = scoreColor(signal.score, tokens);
  const premium = formatUsdCompact(signal.metrics?.premium_total);
  const relVol =
    signal.metrics?.relative_volume != null
      ? `×${Number(signal.metrics.relative_volume).toFixed(1)}`
      : '—';
  const company = signal.metrics?.company_name?.trim();

  return (
    <DarkPoolFeedCard
      onPress={onPress ? () => onPress(signal.ticker) : undefined}
      accessibilityLabel={`סיגנל ${signalTypeLabel(signal.signal_type)} ${signal.ticker}`}
    >
      <View style={h.header}>
        <TickerLogo symbol={signal.ticker} size={40} borderRadius={12} />
        <View style={h.headerMain}>
          <View style={h.titleRow}>
            <Text style={h.ticker}>{signal.ticker}</Text>
            <View style={h.badge}>
              <Text style={h.badgeText}>
                {signalTypeShortLabel(signal.signal_type)}
              </Text>
            </View>
          </View>
          <Text style={h.subtitle} numberOfLines={1}>
            {company || signalTypeLabel(signal.signal_type)}
          </Text>
        </View>
        <View style={h.scoreBox}>
          <Text style={[h.scoreNum, { color: sc }]}>{Math.round(signal.score)}</Text>
          <Text style={h.scoreLbl}>ציון</Text>
        </View>
      </View>

      <DarkPoolMetricsGrid tokens={tokens}>
        <DarkPoolMetricCell tokens={tokens} label="פרימיום" value={premium} />
        <DarkPoolMetricCell
          tokens={tokens}
          label="זמן"
          value={formatRelativeTime(signal.detected_at) || '—'}
        />
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
        <Text style={h.reason} numberOfLines={2}>
          {signal.ai_summary || signal.reason}
        </Text>
      ) : null}
    </DarkPoolFeedCard>
  );
}
