import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { PerformancePeriod } from '../portfolioTypes';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface ChartPoint {
  date: string;
  value: number;
}

interface Props {
  series: ChartPoint[];
  benchmarkSeries?: ChartPoint[];
  height?: number;
  currency: string;
  selectedPeriod: PerformancePeriod;
  onPeriodChange?: (p: PerformancePeriod) => void;
  showBenchmark?: boolean;
  onToggleBenchmark?: (show: boolean) => void;
}

const PERIODS: PerformancePeriod[] = ['1W', '1M', '3M', 'YTD', '1Y', '5Y', 'All'];

/**
 * Line chart מבוסס SVG – ללא תלויות חיצוניות.
 * מציג את שווי התיק על פני זמן + benchmark optional.
 */
export function PortfolioValueChart({
  series,
  benchmarkSeries,
  height = 180,
  currency,
  selectedPeriod,
  onPeriodChange,
  showBenchmark = false,
  onToggleBenchmark,
}: Props) {
  const tokens = useDesignTokens();
  const [containerW, setContainerW] = useState(0);
  const width = containerW > 0 ? containerW : 300;
  const padding = { left: 12, right: 12, top: 16, bottom: 24 };

  const { path, areaPath, ranges, benchmarkPath } = useMemo(() => {
    if (series.length < 2) {
      return {
        path: '',
        areaPath: '',
        ranges: { minY: 0, maxY: 1, firstValue: 0, lastValue: 0 },
        benchmarkPath: '',
      };
    }

    const xs = series.map((p) => new Date(p.date).getTime());
    const ys = series.map((p) => p.value);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    if (showBenchmark && benchmarkSeries && benchmarkSeries.length > 1) {
      // נורמליזציה: מציגים benchmark כסקאלה זהה לשווי התיק
      const portfolioStart = series[0].value;
      const benchStart = benchmarkSeries[0].value;
      if (benchStart > 0) {
        const scaled = benchmarkSeries.map((p) => (p.value / benchStart) * portfolioStart);
        minY = Math.min(minY, ...scaled);
        maxY = Math.max(maxY, ...scaled);
      }
    }
    const padY = (maxY - minY) * 0.1 || 1;
    minY -= padY;
    maxY += padY;
    const minX = xs[0];
    const maxX = xs[xs.length - 1];

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const xScale = (x: number) =>
      padding.left + ((x - minX) / (maxX - minX || 1)) * innerWidth;
    const yScale = (y: number) =>
      padding.top + (1 - (y - minY) / (maxY - minY || 1)) * innerHeight;

    let path = '';
    series.forEach((p, i) => {
      const x = xScale(new Date(p.date).getTime());
      const y = yScale(p.value);
      path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    const lastX = xScale(xs[xs.length - 1]);
    const firstX = xScale(xs[0]);
    const baseY = padding.top + innerHeight;
    const areaPath = `${path} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

    let benchmarkPath = '';
    if (showBenchmark && benchmarkSeries && benchmarkSeries.length > 1) {
      const portfolioStart = series[0].value;
      const benchStart = benchmarkSeries[0].value;
      benchmarkSeries.forEach((p, i) => {
        const x = xScale(new Date(p.date).getTime());
        const scaled = (p.value / benchStart) * portfolioStart;
        const y = yScale(scaled);
        benchmarkPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      });
    }

    return {
      path,
      areaPath,
      ranges: { minY, maxY, firstValue: ys[0], lastValue: ys[ys.length - 1] },
      benchmarkPath,
    };
  }, [series, benchmarkSeries, showBenchmark, width, height, padding.left, padding.right, padding.top, padding.bottom]);

  const change = ranges.lastValue - ranges.firstValue;
  const isUp = change >= 0;
  const lineColor = isUp ? tokens.colors.primary.main : tokens.colors.text.danger;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 0) setContainerW(w);
      }}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((frac) => (
          <Line
            key={frac}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + (height - padding.top - padding.bottom) * frac}
            y2={padding.top + (height - padding.top - padding.bottom) * frac}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}
        {areaPath ? <Path d={areaPath} fill="url(#areaGrad)" /> : null}
        {path ? (
          <Path
            d={path}
            stroke={lineColor}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
          />
        ) : null}
        {benchmarkPath ? (
          <Path
            d={benchmarkPath}
            stroke={benchmarkColor}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
          />
        ) : null}
      </Svg>

      {onPeriodChange ? (
        <View style={styles.periodsRow}>
          {PERIODS.map((p) => {
            const isActive = selectedPeriod === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  if (!isActive) void HapticFeedback.selection();
                  onPeriodChange(p);
                }}
                activeOpacity={0.7}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.periodBtn,
                  isActive && {
                    backgroundColor: `${tokens.colors.primary.main}1A`,
                    borderColor: `${tokens.colors.primary.main}55`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    {
                      color: isActive
                        ? tokens.colors.primary.main
                        : tokens.colors.text.tertiary,
                      fontWeight: isActive ? '700' : '600',
                    },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
  },
  periodsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    paddingTop: 8,
    gap: 4,
  },
  periodBtn: {
    flex: 1,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodChipText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
