/**
 * DarkPoolFlowChart.tsx
 * -----------------------------------------------------------------------------
 * גרף Buy-vs-Sell pressure (stacked bars) — react-native-svg.
 * צבעים: ירוק/אדום בלבד (לפי הנחיית העיצוב).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { DarkPoolDailyAggregateRow } from '../../../types/darkpool.types';
import { formatUsdCompact } from '../utils/darkPoolFormat';

interface FlowChartProps {
  data: DarkPoolDailyAggregateRow[];
  height?: number;
}

const PADDING = { top: 16, right: 16, bottom: 24, left: 40 };

export function DarkPoolFlowChart({ data, height = 200 }: FlowChartProps) {
  const tokens = useDesignTokens();
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const muted = tokens.colors.text.tertiary;

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

  const points = data.slice(-14); // last 14d for clarity
  const maxAbs = Math.max(
    ...points.map((d) => Math.max(d.buy_premium ?? 0, d.sell_premium ?? 0))
  );
  const safeMax = maxAbs > 0 ? maxAbs : 1;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 360 ${height}`}>
        <G>
          {/* baseline */}
          <Line
            x1={PADDING.left}
            x2={360 - PADDING.right}
            y1={height / 2}
            y2={height / 2}
            stroke={muted}
            strokeWidth={0.5}
            opacity={0.4}
          />
          {/* ticks (left scale) */}
          <SvgText
            x={PADDING.left - 4}
            y={PADDING.top}
            fill={muted}
            fontSize={9}
            textAnchor="end"
          >
            {formatUsdCompact(safeMax)}
          </SvgText>
          <SvgText
            x={PADDING.left - 4}
            y={height - PADDING.bottom + 8}
            fill={muted}
            fontSize={9}
            textAnchor="end"
          >
            -{formatUsdCompact(safeMax)}
          </SvgText>
          {points.map((d, i) => {
            const barWidth = Math.max(
              2,
              (360 - PADDING.left - PADDING.right) / points.length - 4
            );
            const x =
              PADDING.left +
              (i * (360 - PADDING.left - PADDING.right)) / points.length;
            const center = height / 2;
            const buyH = ((d.buy_premium ?? 0) / safeMax) * (center - PADDING.top);
            const sellH = ((d.sell_premium ?? 0) / safeMax) * (center - PADDING.top);
            return (
              <G key={d.date}>
                <Rect
                  x={x}
                  y={center - buyH}
                  width={barWidth}
                  height={buyH}
                  fill={positive}
                  opacity={0.85}
                  rx={1.5}
                />
                <Rect
                  x={x}
                  y={center}
                  width={barWidth}
                  height={sellH}
                  fill={negative}
                  opacity={0.7}
                  rx={1.5}
                />
                {i === 0 || i === points.length - 1 ? (
                  <SvgText
                    x={x + barWidth / 2}
                    y={height - PADDING.bottom + 14}
                    fill={muted}
                    fontSize={9}
                    textAnchor="middle"
                  >
                    {d.date.slice(5)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
