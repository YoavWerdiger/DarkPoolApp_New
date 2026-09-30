/**
 * תצוגה משותפת — שווי תיק + דונאט פילוח (צ'אט / ציוצים).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';
import { DistributionDonut } from '../../screens/Portfolios/components/DistributionDonut';
import type { DistributionSlice } from '../../screens/Portfolios/portfolioTypes';
import type { SharePreviewHoldingSlice } from '../../types/shareableEntity';

type Props = {
  portfolioValueLabel?: string | null;
  holdingsChart?: SharePreviewHoldingSlice[] | null;
  avatarUrl?: string | null;
  userInitial?: string;
  compact?: boolean;
};

export function PortfolioSharePreview({
  portfolioValueLabel,
  holdingsChart,
  avatarUrl,
  userInitial,
  compact = false,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens, compact), [tokens, compact]);

  const slices: DistributionSlice[] = useMemo(() => {
    const raw = holdingsChart ?? [];
    return raw
      .filter((s) => s.pct > 0 && s.ticker)
      .map((s) => ({
        key: s.ticker.toUpperCase(),
        label: s.ticker.toUpperCase(),
        value: s.pct,
        percentage: s.pct,
        color: s.color,
      }));
  }, [holdingsChart]);

  const showValue = Boolean(portfolioValueLabel?.trim());
  const showChart = slices.length >= 2;

  if (!showValue && !showChart) return null;

  const donutSize = compact ? 96 : 112;
  const legend = slices.slice(0, compact ? 4 : 5);

  return (
    <View style={styles.wrap}>
      {showValue ? (
        <View style={styles.valueBlock}>
          <Text style={styles.valueLabel}>שווי תיק</Text>
          <Text style={styles.valueAmount}>{portfolioValueLabel}</Text>
        </View>
      ) : null}

      {showChart ? (
        <View style={styles.chartRow}>
          <DistributionDonut
            slices={slices}
            size={donutSize}
            strokeWidth={compact ? 14 : 16}
            avatarUrl={avatarUrl}
            userInitial={userInitial}
          />
          <View style={styles.legend}>
            {legend.map((s) => (
              <View key={s.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendTicker}>{s.label}</Text>
                <Text style={styles.legendPct}>{s.percentage.toFixed(0)}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  compact: boolean
) {
  return StyleSheet.create({
    wrap: {
      gap: APP_LAYOUT.cardTitleToBodyGap,
      width: '100%',
    },
    valueBlock: {
      alignItems: 'flex-end',
    },
    valueLabel: {
      ...APP_TYPE.cardMetricLabel,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    valueAmount: {
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
      ...(compact ? APP_TYPE.cardMetricValueSecondary : APP_TYPE.cardMetricValue),
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    chartRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    legend: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    legendRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    legendTicker: {
      flex: 1,
      ...APP_TYPE.cardMetricLabel,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    legendPct: {
      ...APP_TYPE.caption,
      color: tokens.colors.text.secondary,
      writingDirection: 'ltr',
    },
  });
}
