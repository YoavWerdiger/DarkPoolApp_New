import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { PerformancePeriod } from '../portfolioTypes';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  computeChartPeriodReturn,
  downsampleChartSeries,
  filterChartSeriesByPeriod,
  isChartPeriodAvailable,
} from '../../DarkPool/utils/profileChartSeries';

interface ChartPoint {
  date: string;
  value: number;
  external_flow?: number;
}

interface Props {
  /** סדרה מלאה — הסינון לפי selectedPeriod נעשה בפנים */
  series: ChartPoint[];
  benchmarkSeries?: ChartPoint[];
  height?: number;
  currency: string;
  selectedPeriod: PerformancePeriod;
  onPeriodChange?: (p: PerformancePeriod) => void;
  showBenchmark?: boolean;
  onToggleBenchmark?: (show: boolean) => void;
  /** כותרת + תשואת תקופה מעל הגרף */
  showHeader?: boolean;
  formatValue?: (value: number, currency: string) => string;
}

const PERIODS: PerformancePeriod[] = ['1W', '1M', '3M', 'YTD', '1Y', '5Y', 'All'];
/** נקודות קבועות למורפינג חלק בין אינטרוולים */
const MORPH_N = 56;
const MORPH_MS = 420;
const MORPH_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

type PlottedPoint = {
  x: number;
  y: number;
  date: string;
  value: number;
};

function emptyCoords(): number[] {
  return new Array(MORPH_N * 2).fill(0);
}

/** דגימה אחידה של נקודות מסך — מאפשרת אינטרפולציה בין אינטרוולים */
function resamplePlotted(pts: PlottedPoint[], n = MORPH_N): number[] {
  const out = emptyCoords();
  if (pts.length === 0) return out;
  if (pts.length === 1) {
    for (let i = 0; i < n; i++) {
      out[i * 2] = pts[0].x;
      out[i * 2 + 1] = pts[0].y;
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const f = t * (pts.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(pts.length - 1, i0 + 1);
    const u = f - i0;
    out[i * 2] = pts[i0].x + (pts[i1].x - pts[i0].x) * u;
    out[i * 2 + 1] = pts[i0].y + (pts[i1].y - pts[i0].y) * u;
  }
  return out;
}

function lerpCoords(from: number[], to: number[], p: number): number[] {
  const out = emptyCoords();
  const n = Math.min(from.length, to.length, out.length);
  for (let i = 0; i < n; i++) {
    out[i] = from[i] + (to[i] - from[i]) * p;
  }
  return out;
}

function defaultFormatValue(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'ILS' ? 'ILS' : 'USD',
      maximumFractionDigits: value >= 100_000 ? 0 : 2,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString('en-US')}`;
  }
}

function formatAxisDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function formatScrubDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function pickAxisTicks(points: PlottedPoint[]): PlottedPoint[] {
  if (points.length <= 2) return points;
  if (points.length <= 4) return points;
  const last = points.length - 1;
  const mid = Math.round(last / 2);
  const q1 = Math.round(last / 3);
  const q2 = Math.round((2 * last) / 3);
  const idxs = Array.from(new Set([0, q1, mid, q2, last])).sort((a, b) => a - b);
  return idxs.map((i) => points[i]);
}

/**
 * Line chart אינטראקטיבי — ציר תאריכים, cursor בגרירה, שווי לפי נקודה.
 */
export function PortfolioValueChart({
  series,
  benchmarkSeries,
  height = 180,
  currency,
  selectedPeriod,
  onPeriodChange,
  showBenchmark = false,
  showHeader = true,
  formatValue = defaultFormatValue,
}: Props) {
  const tokens = useDesignTokens();
  const [containerW, setContainerW] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = containerW > 0 ? containerW : 300;
  const padding = { left: 12, right: 12, top: 16, bottom: 34 };

  const filteredSeries = useMemo(
    () => filterChartSeriesByPeriod(series, selectedPeriod),
    [series, selectedPeriod]
  );

  const displaySeries = useMemo(
    () => downsampleChartSeries(filteredSeries),
    [filteredSeries]
  );

  const periodReturn = useMemo(
    () => computeChartPeriodReturn(filteredSeries),
    [filteredSeries]
  );

  useEffect(() => {
    setActiveIndex(null);
  }, [selectedPeriod, series]);

  const { ranges, benchmarkPath, plotted, xTicks } = useMemo(() => {
    if (displaySeries.length < 2) {
      return {
        ranges: { minY: 0, maxY: 1, firstValue: 0, lastValue: 0 },
        benchmarkPath: '',
        plotted: [] as PlottedPoint[],
        xTicks: [] as PlottedPoint[],
      };
    }

    const xs = displaySeries.map((p) => new Date(p.date).getTime());
    const ys = displaySeries.map((p) => p.value);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    if (showBenchmark && benchmarkSeries && benchmarkSeries.length > 1) {
      const benchFiltered = filterChartSeriesByPeriod(benchmarkSeries, selectedPeriod);
      const portfolioStart = displaySeries[0].value;
      const benchStart = benchFiltered[0]?.value;
      if (benchStart && benchStart > 0) {
        const scaled = downsampleChartSeries(benchFiltered).map(
          (p) => (p.value / benchStart) * portfolioStart
        );
        minY = Math.min(minY, ...scaled);
        maxY = Math.max(maxY, ...scaled);
      }
    }

    const padY =
      maxY - minY < Math.max(Math.abs(maxY), 1) * 0.002
        ? Math.max(Math.abs(maxY), 1) * 0.05
        : (maxY - minY) * 0.1 || 1;
    minY -= padY;
    maxY += padY;
    const minX = xs[0];
    const maxX = Math.max(xs[xs.length - 1], Date.now());

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const xScale = (x: number) =>
      padding.left + ((x - minX) / (maxX - minX || 1)) * innerWidth;
    const yScale = (y: number) =>
      padding.top + (1 - (y - minY) / (maxY - minY || 1)) * innerHeight;

    const plottedPts: PlottedPoint[] = displaySeries.map((p) => ({
      x: xScale(new Date(p.date).getTime()),
      y: yScale(p.value),
      date: p.date,
      value: p.value,
    }));

    let benchmarkPathStr = '';
    if (showBenchmark && benchmarkSeries && benchmarkSeries.length > 1) {
      const benchFiltered = filterChartSeriesByPeriod(benchmarkSeries, selectedPeriod);
      const portfolioStart = displaySeries[0].value;
      const benchStart = benchFiltered[0]?.value;
      if (benchStart && benchStart > 0) {
        downsampleChartSeries(benchFiltered).forEach((p, i) => {
          const x = xScale(new Date(p.date).getTime());
          const scaled = (p.value / benchStart) * portfolioStart;
          const y = yScale(scaled);
          benchmarkPathStr += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
        });
      }
    }

    return {
      ranges: { minY, maxY, firstValue: ys[0], lastValue: ys[ys.length - 1] },
      benchmarkPath: benchmarkPathStr,
      plotted: plottedPts,
      xTicks: pickAxisTicks(plottedPts),
    };
  }, [
    displaySeries,
    benchmarkSeries,
    showBenchmark,
    selectedPeriod,
    width,
    height,
    padding.left,
    padding.right,
    padding.top,
    padding.bottom,
  ]);

  const progress = useSharedValue(1);
  const fromCoords = useSharedValue(emptyCoords());
  const toCoords = useSharedValue(emptyCoords());
  const baseYSV = useSharedValue(0);
  const hasPathSV = useSharedValue(0);
  const axisOpacity = useSharedValue(1);
  const didInitMorph = useRef(false);
  const prevWidthRef = useRef(0);

  const targetCoords = useMemo(() => resamplePlotted(plotted), [plotted]);
  const plotBaseY = padding.top + (height - padding.top - padding.bottom);

  useEffect(() => {
    baseYSV.value = plotBaseY;
    const next = targetCoords;
    const ready = plotted.length >= 2;
    const widthJustReady = prevWidthRef.current < 40 && width >= 40;
    prevWidthRef.current = width;

    if (!ready) {
      hasPathSV.value = 0;
      fromCoords.value = next;
      toCoords.value = next;
      progress.value = 1;
      axisOpacity.value = 1;
      return;
    }

    hasPathSV.value = 1;

    if (!didInitMorph.current || widthJustReady) {
      didInitMorph.current = true;
      fromCoords.value = next;
      toCoords.value = next;
      progress.value = 1;
      axisOpacity.value = 1;
      return;
    }

    const current = lerpCoords(fromCoords.value, toCoords.value, progress.value);
    fromCoords.value = current;
    toCoords.value = next;
    progress.value = 0;
    progress.value = withTiming(1, { duration: MORPH_MS, easing: MORPH_EASE });
    axisOpacity.value = 0.2;
    axisOpacity.value = withTiming(1, { duration: MORPH_MS, easing: MORPH_EASE });
  }, [targetCoords, plotted.length, plotBaseY, width, selectedPeriod]);

  const animatedLineProps = useAnimatedProps(() => {
    if (!hasPathSV.value) return { d: '' };
    const p = progress.value;
    const from = fromCoords.value;
    const to = toCoords.value;
    let d = '';
    for (let i = 0; i < MORPH_N; i++) {
      const x = from[i * 2] + (to[i * 2] - from[i * 2]) * p;
      const y = from[i * 2 + 1] + (to[i * 2 + 1] - from[i * 2 + 1]) * p;
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return { d };
  });

  const animatedAreaProps = useAnimatedProps(() => {
    if (!hasPathSV.value) return { d: '' };
    const p = progress.value;
    const from = fromCoords.value;
    const to = toCoords.value;
    const baseY = baseYSV.value;
    let d = '';
    let firstX = 0;
    let lastX = 0;
    for (let i = 0; i < MORPH_N; i++) {
      const x = from[i * 2] + (to[i * 2] - from[i * 2]) * p;
      const y = from[i * 2 + 1] + (to[i * 2 + 1] - from[i * 2 + 1]) * p;
      if (i === 0) firstX = x;
      lastX = x;
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    d += ` L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
    return { d };
  });

  const axisAnimStyle = useAnimatedStyle(() => ({
    opacity: axisOpacity.value,
  }));

  const indexFromX = useCallback(
    (touchX: number) => {
      if (!plotted.length) return null;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < plotted.length; i++) {
        const d = Math.abs(plotted[i].x - touchX);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    [plotted]
  );

  const scrubToX = useCallback(
    (touchX: number) => {
      const next = indexFromX(touchX);
      if (next == null) return;
      setActiveIndex((prev) => {
        if (prev !== next) void HapticFeedback.selection();
        return next;
      });
    },
    [indexFromX]
  );

  const clearActive = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const chartGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .failOffsetY([-18, 18])
        .onBegin((e) => {
          'worklet';
          runOnJS(scrubToX)(e.x);
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(scrubToX)(e.x);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(clearActive)();
        }),
    [scrubToX, clearActive]
  );

  const activePoint =
    activeIndex != null && plotted[activeIndex] ? plotted[activeIndex] : null;
  const headerValue = activePoint?.value ?? ranges.lastValue ?? filteredSeries[filteredSeries.length - 1]?.value ?? 0;
  const scrubDateLabel = activePoint ? formatScrubDate(activePoint.date) : null;

  const change = ranges.lastValue - ranges.firstValue;
  const isUp = change >= 0;
  const lineColor = isUp ? tokens.colors.primary.main : tokens.colors.text.danger;
  const benchmarkColor = tokens.colors.text.tertiary;
  const returnColor =
    periodReturn != null && periodReturn >= 0
      ? tokens.colors.primary.main
      : tokens.colors.text.danger;
  const plotBottom = height - padding.bottom;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 0) setContainerW(w);
      }}
    >
      {showHeader && filteredSeries.length >= 1 ? (
        <View style={styles.header}>
          <Text
            style={[
              styles.headerTitle,
              {
                color: tokens.colors.text.primary,
                fontSize: tokens.typography.subhead.size,
                fontWeight: '700',
                letterSpacing: tokens.typography.subhead.letterSpacing,
                lineHeight: tokens.typography.subhead.lineHeight,
              },
            ]}
          >
            שווי תיק
          </Text>
          <Text style={[styles.headerValue, { color: tokens.colors.text.primary }]}>
            {formatValue(headerValue, currency)}
          </Text>
          {scrubDateLabel ? (
            <Text style={[styles.headerRange, { color: tokens.colors.text.secondary }]}>
              {scrubDateLabel}
            </Text>
          ) : periodReturn != null ? (
            <Text style={[styles.headerReturn, { color: returnColor }]}>
              {periodReturn >= 0 ? '▲' : '▼'} {Math.abs(periodReturn).toFixed(2)}%
              {' · '}
              {selectedPeriod === 'All' ? 'ALL' : selectedPeriod}
            </Text>
          ) : null}
        </View>
      ) : null}

      <GestureDetector gesture={chartGesture}>
        <View style={{ width, height }} collapsable={false}>
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
            {plotted.length >= 2 ? (
              <AnimatedPath
                d=""
                animatedProps={animatedAreaProps}
                fill="url(#areaGrad)"
              />
            ) : null}
            {plotted.length >= 2 ? (
              <AnimatedPath
                d=""
                animatedProps={animatedLineProps}
                stroke={lineColor}
                strokeWidth={2.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
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

            {/* ציר X — קו בסיס */}
            <Line
              x1={padding.left}
              x2={width - padding.right}
              y1={plotBottom}
              y2={plotBottom}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={StyleSheet.hairlineWidth * 2}
            />

            {activePoint ? (
              <>
                <Line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={padding.top}
                  y2={plotBottom}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <Circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r={5}
                  fill={lineColor}
                  stroke="#0A0E0A"
                  strokeWidth={2}
                />
              </>
            ) : null}
          </Svg>

          {/* תוויות תאריך על ציר X */}
          <Animated.View
            style={[styles.xAxis, { top: plotBottom + 4, height: 22 }, axisAnimStyle]}
            pointerEvents="none"
          >
            {xTicks.map((t) => (
              <Text
                key={`${t.date}-${t.x}`}
                style={[
                  styles.xTick,
                  {
                    color: tokens.colors.text.tertiary,
                    left: Math.max(0, Math.min(width - 56, t.x - 28)),
                  },
                ]}
                numberOfLines={1}
              >
                {formatAxisDate(t.date)}
              </Text>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      {onPeriodChange ? (
        <View style={styles.periodsRow}>
          {PERIODS.map((p) => {
            const isActive = selectedPeriod === p;
            const available = isChartPeriodAvailable(series, p);
            return (
              <TouchableOpacity
                key={p}
                disabled={!available}
                onPress={() => {
                  if (!isActive && available) void HapticFeedback.selection();
                  if (available) onPeriodChange(p);
                }}
                activeOpacity={0.7}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive, disabled: !available }}
                style={[
                  styles.periodBtn,
                  isActive && {
                    backgroundColor: `${tokens.colors.primary.main}22`,
                    borderColor: `${tokens.colors.primary.main}66`,
                  },
                  !available && styles.periodBtnDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    {
                      color: !available
                        ? tokens.colors.text.tertiary
                        : isActive
                          ? tokens.colors.primary.main
                          : tokens.colors.text.secondary,
                      fontWeight: isActive ? '700' : '600',
                      opacity: available ? 1 : 0.45,
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
  header: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  headerTitle: {
    marginBottom: 4,
    textAlign: 'left',
  },
  headerValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  headerReturn: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '700',
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  headerRange: {
    marginTop: 4,
    fontSize: 12,
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  xAxis: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  xTick: {
    position: 'absolute',
    width: 56,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  periodsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    gap: 4,
  },
  periodBtn: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 30,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnDisabled: {
    opacity: 0.5,
  },
  periodChipText: {
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.15,
  },
});
