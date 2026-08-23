import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { Portfolio, PortfolioSummary } from '../portfolioTypes';
import { formatCurrency, formatPercent, gainColor } from '../utils/format';

/** נקודות SVG לפי סדר ערכי שווי (יומי) — ללא mock */
function valuesToPolyline(values: number[], w: number, h: number): string {
  if (values.length < 2 || w <= 4 || h <= 4) return '';
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const parts: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const t = i / (values.length - 1);
    const x = pad + t * (w - 2 * pad);
    const n = range < 1e-12 ? 0.5 : (values[i] - min) / range;
    const y = pad + (1 - n) * (h - 2 * pad);
    parts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

interface Props {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
  /** ערכי total_value לפי זמן (עולה) — מ-portfolio_value_history או מחושב מטרנזקציות */
  sparklineValues: number[] | null;
  sparklineSource: 'history' | 'transactions' | 'none';
  ownerLabel: string;
  onPress: () => void;
}

export function CommunityPortfolioLeaderCard({
  portfolio,
  summary,
  sparklineValues,
  sparklineSource,
  ownerLabel,
  onPress,
}: Props) {
  const tokens = useDesignTokens();
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.secondary;

  const roi = summary?.total_gain_pct;
  const roiColor = gainColor(
    roi != null && isFinite(roi) ? roi : null,
    positive,
    negative,
    neutral
  );
  const lineStroke =
    summary != null && roi != null && isFinite(roi) && roi < 0 ? negative : positive;

  const [chartW, setChartW] = React.useState(0);
  const chartH = 52;

  const polyPoints = useMemo(
    () =>
      chartW > 4 && sparklineValues && sparklineValues.length >= 2
        ? valuesToPolyline(sparklineValues, chartW, chartH)
        : '',
    [chartW, chartH, sparklineValues]
  );

  const onChartLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - chartW) > 1) setChartW(w);
  };

  const roiText =
    summary != null && roi != null && isFinite(roi) ? formatPercent(roi) : '—';
  const valueText =
    summary != null
      ? formatCurrency(summary.total_value, portfolio.currency, 0)
      : '—';

  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.impactLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`תיק ${portfolio.name} של ${ownerLabel}`}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
    >
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="md"
        style={{
          borderRadius: tokens.borderRadius.xl,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        }}
      >
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: tokens.colors.text.primary }]} numberOfLines={2}>
              {portfolio.name}
            </Text>
            <Text
              style={[styles.owner, { color: tokens.colors.text.tertiary }]}
              numberOfLines={1}
            >
              תיק של {ownerLabel}
            </Text>
          </View>
          <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
        </View>

        <View style={styles.chartBox} onLayout={onChartLayout}>
          {chartW > 4 && polyPoints ? (
            <Svg width={chartW} height={chartH}>
              <Polyline
                points={polyPoints}
                fill="none"
                stroke={lineStroke}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.85}
              />
            </Svg>
          ) : (
            <View style={{ height: chartH, justifyContent: 'center' }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: tokens.colors.text.tertiary,
                  textAlign: 'center',
                }}
              >
                אין עדיין היסטוריית שווי
              </Text>
            </View>
          )}
        </View>
        {sparklineSource === 'transactions' && (
          <Text style={[styles.chartLabel, { color: tokens.colors.text.tertiary }]}>
            גרף מחושב ממסחר · כולל מחירי שוק
          </Text>
        )}

        <View style={styles.bottomRow}>
          <Text style={[styles.roi, { color: roiColor }]}>{roiText}</Text>
          <Text style={[styles.value, { color: tokens.colors.text.tertiary }]}>{valueText}</Text>
        </View>
      </UICard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  owner: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chartBox: {
    width: '100%',
    height: 52,
    marginBottom: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  roi: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    writingDirection: 'ltr',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    writingDirection: 'ltr',
  },
});
