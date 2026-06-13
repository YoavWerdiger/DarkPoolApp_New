/**
 * AccumulationChart.tsx
 * -----------------------------------------------------------------------------
 * גרף מצטבר (cumulative net flow) — מציג צבירה לאורך זמן.
 * Path SVG עם fill ירוק/אדום (לפי כיוון).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { DarkPoolDailyAggregateRow } from '../../../types/darkpool.types';

interface AccumulationChartProps {
  data: DarkPoolDailyAggregateRow[];
  height?: number;
}

const PADDING = { top: 8, right: 12, bottom: 8, left: 12 };

export function AccumulationChart({ data, height = 140 }: AccumulationChartProps) {
  const tokens = useDesignTokens();
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: '100%' },
        emptyText: {
          textAlign: 'center',
          color: tokens.colors.text.tertiary,
          fontSize: 12,
          paddingVertical: 24,
        },
      }),
    [tokens]
  );

  if (!data?.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.emptyText}>אין נתונים זמינים</Text>
      </View>
    );
  }

  const cumulative: number[] = [];
  let acc = 0;
  for (const d of data) {
    acc += (d.buy_premium ?? 0) - (d.sell_premium ?? 0);
    cumulative.push(acc);
  }
  const minY = Math.min(0, ...cumulative);
  const maxY = Math.max(0, ...cumulative);
  const range = maxY - minY || 1;
  const finalPositive = (cumulative[cumulative.length - 1] ?? 0) >= 0;
  const lineColor = finalPositive ? positive : negative;
  const gradId = finalPositive ? 'gradPos' : 'gradNeg';

  const w = 360;
  const innerW = w - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const stepX = innerW / Math.max(1, cumulative.length - 1);
  const yFor = (val: number) =>
    PADDING.top + innerH - ((val - minY) / range) * innerH;

  const linePath = cumulative
    .map((y, i) => {
      const x = PADDING.left + stepX * i;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yFor(y).toFixed(1)}`;
    })
    .join(' ');
  const fillPath =
    linePath +
    ` L ${(PADDING.left + innerW).toFixed(1)} ${(PADDING.top + innerH).toFixed(1)}` +
    ` L ${PADDING.left.toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} Z`;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity={0.32} />
            <Stop offset="1" stopColor={lineColor} stopOpacity={0.04} />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill={`url(#${gradId})`} />
        <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}
