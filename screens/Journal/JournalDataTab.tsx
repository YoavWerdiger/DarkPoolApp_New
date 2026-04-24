import React, { useCallback, useMemo, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import Svg, { Line, Rect, Polyline, Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import UICard from '../../components/ui/UICard';
import type { Trade } from './tradeTypes';
import {
  parseJournalDetails,
  TIMEFRAME_OPTIONS,
  MISTAKE_OPTIONS,
  moodLabel,
  type MoodId,
  type TradeTimeframe,
} from './tradeJournalConstants';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { MarketsSegmentedControl } from '../Markets/components/MarketsSegmentedControl';

type PnlBar = { key: string; label: string; pnl: number };

function sortTradesByExitAsc(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => new Date(a.exit_date).getTime() - new Date(b.exit_date).getTime()
  );
}

/** צבירת P&L לפי סדר יציאה — לגרף קווי */
function cumulativeSeries(trades: Trade[]): { exitISO: string; cum: number }[] {
  const sorted = sortTradesByExitAsc(trades);
  let cum = 0;
  return sorted.map((t) => {
    cum += t.pnl;
    return { exitISO: t.exit_date, cum };
  });
}

/** סיכום P&L לפי חודש (יציאה) */
function monthlyPnl(trades: Trade[]): PnlBar[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    const d = new Date(t.exit_date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + t.pnl);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, pnl]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('he-IL', {
        month: 'short',
        year: '2-digit',
      });
      return { key, label, pnl };
    });
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ימים עם עסקאות — עד maxBars ימים אחרונים (תאריך מקומי לפי יציאה) */
function dailyPnlSeries(trades: Trade[], maxBars: number): PnlBar[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    const d = new Date(t.exit_date);
    if (Number.isNaN(d.getTime())) continue;
    const key = localYmd(d);
    map.set(key, (map.get(key) ?? 0) + t.pnl);
  }
  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  return sorted.slice(-maxBars).map(([key, pnl]) => {
    const [y, mo, da] = key.split('-').map(Number);
    const label = new Date(y, mo - 1, da).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
    });
    return { key, label, pnl };
  });
}

/** סיכום P&L לפי שעת יציאה מקומית (0–23) — עמודות */
function hourlyPnlByClock(trades: Trade[]): PnlBar[] {
  const sums = new Array(24).fill(0) as number[];
  for (const t of trades) {
    const d = new Date(t.exit_date);
    if (Number.isNaN(d.getTime())) continue;
    sums[d.getHours()] += t.pnl;
  }
  return sums.map((pnl, h) => ({
    key: `hour-${h}`,
    label: String(h),
    pnl,
  }));
}

type ChartGranularity = 'days' | 'months' | 'hours';

type ChartColors = {
  zero: string;
  pos: string;
  neg: string;
  label: string;
};

type LineChartColors = {
  line: string;
  grid: string;
  zero: string;
  label: string;
};

function formatMoneyAxis(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const CumulativePnlLineChart = memo(function CumulativePnlLineChart({
  series,
  chartW,
  colors,
}: {
  series: { exitISO: string; cum: number }[];
  chartW: number;
  colors: LineChartColors;
}) {
  const H = 190;
  const padL = 40;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const innerW = Math.max(1, chartW - padL - padR);
  const innerH = H - padT - padB;

  if (series.length === 0) return null;

  const values = series.map((s) => s.cum);
  let minV = Math.min(0, ...values);
  let maxV = Math.max(0, ...values);
  let range = maxV - minV;
  if (range < 1e-9) {
    minV -= 1;
    maxV += 1;
    range = maxV - minV;
  }

  const n = values.length;
  const coords = values.map((v, i) => {
    const x = n <= 1 ? padL + innerW / 2 : padL + (i / Math.max(1, n - 1)) * innerW;
    const y = padT + innerH - ((v - minV) / range) * innerH;
    return { x, y, v };
  });

  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const zeroY = padT + innerH - ((0 - minV) / range) * innerH;
  const showZero = zeroY >= padT && zeroY <= padT + innerH;

  return (
    <View style={{ width: chartW }}>
      <Svg width={chartW} height={H}>
        <Line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + innerH}
          stroke={colors.grid}
          strokeWidth={1}
        />
        <Line
          x1={padL}
          y1={padT + innerH}
          x2={padL + innerW}
          y2={padT + innerH}
          stroke={colors.grid}
          strokeWidth={1}
        />
        {showZero ? (
          <Line
            x1={padL}
            y1={zeroY}
            x2={padL + innerW}
            y2={zeroY}
            stroke={colors.zero}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ) : null}
        {n > 1 ? (
          <Polyline points={pointsStr} fill="none" stroke={colors.line} strokeWidth={2.5} />
        ) : (
          <Circle cx={coords[0].x} cy={coords[0].y} r={5} fill={colors.line} />
        )}
      </Svg>
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: 'center',
          gap: 24,
          marginTop: 4,
          paddingHorizontal: 4,
          width: chartW,
        }}
      >
        <Text style={{ fontSize: 11, color: colors.label }}>${formatMoneyAxis(minV)}</Text>
        <Text style={{ fontSize: 11, color: colors.label }}>${formatMoneyAxis(maxV)}</Text>
      </View>
    </View>
  );
});

const PnlBarChart = memo(function PnlBarChart({
  bars,
  chartW,
  colors,
  maxBars,
}: {
  bars: PnlBar[];
  chartW: number;
  colors: ChartColors;
  maxBars: number;
}) {
  const H = 200;
  const padL = 36;
  const padB = 36;
  const padT = 10;
  const innerW = Math.max(1, chartW - padL - 8);
  /** אזור העמודות — גובה מלא, עמודות עומדות על קו בסיס תחתון (לא ציר אמצע) */
  const innerH = H - padB - padT;

  const slice = bars.slice(-maxBars);
  if (slice.length === 0) return null;

  const maxAbs = Math.max(...slice.map((m) => Math.abs(m.pnl)), 1e-6);
  const n = slice.length;
  const gap = n > 18 ? 3 : n > 14 ? 4 : 6;
  const barW = (innerW - gap * Math.max(0, n - 1)) / n;
  const baselineY = padT + innerH;

  return (
    <View style={{ width: chartW, direction: 'ltr' }}>
      <Svg width={chartW} height={H}>
        <Line
          x1={padL}
          y1={baselineY}
          x2={chartW - 8}
          y2={baselineY}
          stroke={colors.zero}
          strokeWidth={1}
        />
        {slice.map((m, i) => {
          const x = padL + i * (barW + gap);
          const h = Math.max((Math.abs(m.pnl) / maxAbs) * innerH * 0.94, m.pnl !== 0 ? 3 : 0);
          const fill = m.pnl >= 0 ? colors.pos : colors.neg;
          return (
            <Rect key={m.key} x={x} y={baselineY - h} width={barW} height={h} rx={3} fill={fill} />
          );
        })}
      </Svg>
      <View
        style={{
          flexDirection: 'row',
          width: chartW,
          paddingLeft: padL,
          paddingRight: 8,
          marginTop: 4,
          gap,
        }}
      >
        {slice.map((m) => (
          <Text
            key={m.key}
            style={{
              width: barW,
              fontSize: n > 18 ? 8 : n > 12 ? 9 : 10,
              color: colors.label,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
});

type MoodStat = { id: MoodId; label: string; count: number; avgPnl: number };

type JournalInsights = {
  total: number;
  withDetails: number;
  coveragePct: number;
  moodBefore: MoodStat[];
  moodAfter: MoodStat[];
  plan: { yes: number; no: number; unknown: number };
  timeframes: { id: TradeTimeframe; label: string; count: number }[];
  mistakes: { id: string; label: string; count: number }[];
};

function buildJournalInsights(trades: Trade[]): JournalInsights {
  const moodB = new Map<MoodId, { sum: number; n: number }>();
  const moodA = new Map<MoodId, { sum: number; n: number }>();
  let planYes = 0;
  let planNo = 0;
  let planUnk = 0;
  const tfCount = new Map<TradeTimeframe, number>();
  const mistakeCount = new Map<string, number>();
  let withDetails = 0;

  for (const t of trades) {
    const jd = parseJournalDetails(t.journal_details);
    const hasAny = !!(
      jd.timeframe ||
      jd.mood_before ||
      jd.mood_after ||
      typeof jd.followed_plan === 'boolean' ||
      (jd.strategy_type && jd.strategy_type.trim()) ||
      (jd.entry_reason && jd.entry_reason.trim()) ||
      (jd.exit_reason && jd.exit_reason.trim()) ||
      (jd.mistakes && jd.mistakes.length > 0)
    );
    if (hasAny) withDetails++;

    if (jd.mood_before) {
      const cur = moodB.get(jd.mood_before) ?? { sum: 0, n: 0 };
      cur.sum += t.pnl;
      cur.n += 1;
      moodB.set(jd.mood_before, cur);
    }
    if (jd.mood_after) {
      const cur = moodA.get(jd.mood_after) ?? { sum: 0, n: 0 };
      cur.sum += t.pnl;
      cur.n += 1;
      moodA.set(jd.mood_after, cur);
    }

    if (typeof jd.followed_plan === 'boolean') {
      if (jd.followed_plan) planYes++;
      else planNo++;
    } else {
      planUnk++;
    }

    if (jd.timeframe) {
      tfCount.set(jd.timeframe, (tfCount.get(jd.timeframe) ?? 0) + 1);
    }

    for (const mid of jd.mistakes ?? []) {
      mistakeCount.set(mid, (mistakeCount.get(mid) ?? 0) + 1);
    }
  }

  const sortMood = (m: Map<MoodId, { sum: number; n: number }>): MoodStat[] =>
    [...m.entries()]
      .map(([id, { sum, n }]) => ({
        id,
        label: moodLabel(id),
        count: n,
        avgPnl: n ? sum / n : 0,
      }))
      .sort((a, b) => b.count - a.count);

  const timeframes = TIMEFRAME_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
    count: tfCount.get(opt.id) ?? 0,
  })).sort((a, b) => b.count - a.count);

  const mistakes = [...mistakeCount.entries()]
    .map(([id, count]) => ({
      id,
      label: MISTAKE_OPTIONS.find((m) => m.id === id)?.label ?? id,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const total = trades.length;
  return {
    total,
    withDetails,
    coveragePct: total ? Math.round((withDetails / total) * 100) : 0,
    moodBefore: sortMood(moodB),
    moodAfter: sortMood(moodA),
    plan: { yes: planYes, no: planNo, unknown: planUnk },
    timeframes,
    mistakes,
  };
}

const journalTabStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    width: '100%',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    minHeight: 200,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  empty: {
    paddingVertical: 32,
    gap: 8,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 12,
    width: '100%',
  },
  chartCenter: {
    width: '100%',
    alignItems: 'center',
  },
  segmentShell: {
    width: '100%',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'column',
    width: '100%',
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  kpiBlock: {
    minWidth: 140,
    maxWidth: '48%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  kpiTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    writingDirection: 'ltr',
  },
  journalHint: {
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 21,
  },
  journalInsightSection: {
    width: '100%',
  },
  journalInsightStack: {
    width: '100%',
    gap: 16,
  },
  journalInsightSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  journalInsightSurface: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  journalCoverageWrap: {
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  journalCoveragePct: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    writingDirection: 'ltr',
  },
  journalCoverageSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  journalPillRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    width: '100%',
    gap: 8,
    justifyContent: 'space-between',
  },
  journalMiniPill: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: '28%',
    maxWidth: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  journalMiniPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  journalMiniPillValue: {
    fontSize: 22,
    fontWeight: '800',
    writingDirection: 'ltr',
  },
  journalMoodGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    width: '100%',
    gap: 10,
    justifyContent: 'space-between',
  },
  journalMoodCell: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  journalMoodCellTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  journalMoodCellMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  journalMoodCountBadge: {
    minWidth: 36,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalMoodCountText: {
    fontSize: 14,
    fontWeight: '800',
    writingDirection: 'ltr',
  },
  journalMoodAvg: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  journalMistakeCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  journalMistakeList: {
    width: '100%',
    gap: 8,
  },
  journalMistakeLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  journalMistakeCount: {
    fontSize: 20,
    fontWeight: '800',
    writingDirection: 'ltr',
    minWidth: 36,
    textAlign: 'center',
  },
});

function KpiBlock({
  title,
  value,
  valueColor,
  titleColor,
}: {
  title: string;
  value: string;
  valueColor: string;
  titleColor: string;
}) {
  return (
    <View style={journalTabStyles.kpiBlock}>
      <Text style={[journalTabStyles.kpiTitle, { color: titleColor }]}>{title}</Text>
      <Text
        style={[journalTabStyles.kpiValue, { color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
    </View>
  );
}

function JournalInsightSection({
  title,
  titleColor,
  surfaceBg,
  surfaceBorder,
  children,
}: {
  title: string;
  titleColor: string;
  surfaceBg: string;
  surfaceBorder: string;
  children: React.ReactNode;
}) {
  return (
    <View style={journalTabStyles.journalInsightSection}>
      <Text style={[journalTabStyles.journalInsightSectionTitle, { color: titleColor }]}>{title}</Text>
      <View
        style={[
          journalTabStyles.journalInsightSurface,
          { backgroundColor: surfaceBg, borderColor: surfaceBorder },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function JournalMiniPill({
  label,
  value,
  labelColor,
  valueColor,
  borderColor,
  backgroundColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  borderColor: string;
  backgroundColor: string;
}) {
  return (
    <View style={[journalTabStyles.journalMiniPill, { borderColor, backgroundColor }]}>
      <Text style={[journalTabStyles.journalMiniPillLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[journalTabStyles.journalMiniPillValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function JournalMoodInsightCard({
  item,
  formatUsd,
  cardBg,
  cardBorder,
  titleColor,
  badgeBg,
  badgeTextColor,
  avgPosColor,
  avgNegColor,
}: {
  item: MoodStat;
  formatUsd: (n: number) => string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  badgeBg: string;
  badgeTextColor: string;
  avgPosColor: string;
  avgNegColor: string;
}) {
  const avgColor = item.avgPnl >= 0 ? avgPosColor : avgNegColor;
  return (
    <View style={[journalTabStyles.journalMoodCell, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <Text style={[journalTabStyles.journalMoodCellTitle, { color: titleColor }]} numberOfLines={2}>
        {item.label}
      </Text>
      <View style={journalTabStyles.journalMoodCellMeta}>
        <View style={[journalTabStyles.journalMoodCountBadge, { backgroundColor: badgeBg }]}>
          <Text style={[journalTabStyles.journalMoodCountText, { color: badgeTextColor }]}>
            {item.count}
          </Text>
        </View>
        <Text style={[journalTabStyles.journalMoodAvg, { color: avgColor }]} numberOfLines={1}>
          {`ממוצע $${formatUsd(item.avgPnl)}`}
        </Text>
      </View>
    </View>
  );
}

const CHART_SEGMENTS: { id: ChartGranularity; label: string }[] = [
  { id: 'months', label: 'חודשים' },
  { id: 'days', label: 'ימים' },
  { id: 'hours', label: 'שעות' },
];

export default function JournalDataTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const { width: windowW } = useWindowDimensions();
  const mainTabsHeight = useMainTabsHeight();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<ChartGranularity>('months');

  const chartW = Math.min(windowW - 48, 400);
  const kpiGap = 12;

  const sectionCardStyle = useMemo(
    () => ({
      width: '100%' as const,
      maxWidth: 440,
      alignSelf: 'center' as const,
      marginBottom: DesignTokens.spacing.md,
      borderWidth: 1 as const,
      borderColor: `${DesignTokens.colors.primary.main}24`,
      borderRadius: DesignTokens.borderRadius['2xl'],
      overflow: 'hidden' as const,
    }),
    [DesignTokens]
  );

  const loadTrades = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('exit_date', { ascending: false });
      if (error) throw error;
      setTrades(data || []);
    } catch {
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadTrades();
    }, [loadTrades])
  );

  const formatUsd = (value: number) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const monthBars = useMemo(() => monthlyPnl(trades), [trades]);
  const dayBars = useMemo(() => dailyPnlSeries(trades, 24), [trades]);
  const hourBars = useMemo(() => hourlyPnlByClock(trades), [trades]);
  const cumSeries = useMemo(() => cumulativeSeries(trades), [trades]);

  const chartBars =
    chartMode === 'months' ? monthBars : chartMode === 'days' ? dayBars : hourBars;
  const maxBars = chartMode === 'months' ? 10 : chartMode === 'days' ? 24 : 24;

  const kpis = useMemo(() => {
    if (trades.length === 0) return null;
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const wins = trades.filter((t) => t.pnl > 0).length;
    const winRate = Math.round((wins / trades.length) * 100);
    const avg = totalPnl / trades.length;
    const pnlColor =
      totalPnl >= 0 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger;
    const avgColor = avg >= 0 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger;
    return {
      totalPnlStr: `$${formatUsd(totalPnl)}`,
      totalPnlColor: pnlColor,
      countStr: String(trades.length),
      winRateStr: `${winRate}%`,
      avgStr: `$${formatUsd(avg)}`,
      avgColor,
    };
  }, [trades, DesignTokens.colors.primary.main, DesignTokens.colors.text.danger]);

  const journalInsights = useMemo(() => buildJournalInsights(trades), [trades]);

  const chartColors: ChartColors = useMemo(
    () => ({
      zero: 'rgba(255,255,255,0.25)',
      pos: DesignTokens.colors.primary.main,
      neg: DesignTokens.colors.text.danger,
      label: DesignTokens.colors.text.tertiary,
    }),
    [DesignTokens]
  );

  const lineChartColors: LineChartColors = useMemo(
    () => ({
      line: DesignTokens.colors.primary.main,
      grid: DesignTokens.colors.border.primary,
      zero: 'rgba(255,255,255,0.25)',
      label: DesignTokens.colors.text.tertiary,
    }),
    [DesignTokens]
  );

  if (loading) {
    return (
      <View style={journalTabStyles.loadingWrap}>
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="lg"
          style={sectionCardStyle}
          contentContainerStyle={{ alignItems: 'center', gap: 12 }}
        >
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={[journalTabStyles.loadingText, { color: DesignTokens.colors.text.secondary }]}>
            טוען נתונים...
          </Text>
        </UICard>
      </View>
    );
  }

  return (
    <ScrollView
      style={journalTabStyles.scroll}
      contentContainerStyle={[journalTabStyles.scrollContent, { paddingBottom: mainTabsHeight + 24 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces
    >
      {trades.length === 0 ? (
        <UICard variant="glass" glassIntensity="light" padding="md" style={sectionCardStyle}>
          <View style={journalTabStyles.empty}>
            <Text style={[journalTabStyles.emptyTitle, { color: DesignTokens.colors.text.primary }]}>
              אין עדיין טריידים
            </Text>
            <Text style={[journalTabStyles.emptyHint, { color: DesignTokens.colors.text.tertiary }]}>
              הוסף טריידים ביומן — הגרף והמדדים יתעדכנו אוטומטית.
            </Text>
          </View>
        </UICard>
      ) : (
        <>
          <UICard variant="glass" glassIntensity="light" padding="md" style={sectionCardStyle}>
            <Text style={[journalTabStyles.sectionTitle, { color: DesignTokens.colors.text.primary }]}>
              גרף P&L
            </Text>
            <View style={journalTabStyles.chartCenter}>
              {cumSeries.length > 0 ? (
                <CumulativePnlLineChart
                  series={cumSeries}
                  chartW={chartW}
                  colors={lineChartColors}
                />
              ) : (
                <Text style={{ color: DesignTokens.colors.text.tertiary, textAlign: 'center' }}>
                  אין נתונים
                </Text>
              )}
            </View>
          </UICard>

          <UICard variant="glass" glassIntensity="light" padding="md" style={sectionCardStyle}>
            <Text style={[journalTabStyles.sectionTitle, { color: DesignTokens.colors.text.primary }]}>
              חלוקת P&L לפי טווחי זמן
            </Text>
            <View
              style={[
                journalTabStyles.segmentShell,
                {
                  borderColor: DesignTokens.colors.glass.card.border,
                  backgroundColor: DesignTokens.colors.glass.card.bg,
                },
              ]}
            >
              <MarketsSegmentedControl
                options={CHART_SEGMENTS}
                value={chartMode}
                onChange={setChartMode}
                accessibilityGroupLabel="יחידת זמן לחלוקה"
                containerDirection="row-reverse"
                segmentAccessibilityRole="button"
              />
            </View>
            <View style={journalTabStyles.chartCenter}>
              {chartBars.length > 0 ? (
                <PnlBarChart bars={chartBars} chartW={chartW} colors={chartColors} maxBars={maxBars} />
              ) : (
                <Text style={{ color: DesignTokens.colors.text.tertiary, textAlign: 'center' }}>
                  אין עדיין נתונים לגרף
                </Text>
              )}
            </View>
          </UICard>

          {kpis ? (
            <UICard variant="glass" glassIntensity="light" padding="md" style={sectionCardStyle}>
              <Text style={[journalTabStyles.sectionTitle, { color: DesignTokens.colors.text.primary }]}>
                ביצועים
              </Text>
              <View style={[journalTabStyles.kpiGrid, { gap: kpiGap }]}>
                <View style={[journalTabStyles.kpiRow, { gap: kpiGap }]}>
                  <KpiBlock
                    title="סה״כ רווח / הפסד"
                    value={kpis.totalPnlStr}
                    valueColor={kpis.totalPnlColor}
                    titleColor={DesignTokens.colors.text.secondary}
                  />
                  <KpiBlock
                    title="סה״כ טריידים"
                    value={kpis.countStr}
                    valueColor={DesignTokens.colors.text.primary}
                    titleColor={DesignTokens.colors.text.secondary}
                  />
                </View>
                <View style={[journalTabStyles.kpiRow, { gap: kpiGap }]}>
                  <KpiBlock
                    title="אחוזי הצלחה"
                    value={kpis.winRateStr}
                    valueColor={DesignTokens.colors.text.primary}
                    titleColor={DesignTokens.colors.text.secondary}
                  />
                  <KpiBlock
                    title="רווח ממוצע"
                    value={kpis.avgStr}
                    valueColor={kpis.avgColor}
                    titleColor={DesignTokens.colors.text.secondary}
                  />
                </View>
              </View>
            </UICard>
          ) : null}

          {journalInsights ? (
            <UICard variant="glass" glassIntensity="light" padding="md" style={sectionCardStyle}>
              <Text style={[journalTabStyles.sectionTitle, { color: DesignTokens.colors.text.primary }]}>
                יומן המסחר — תובנות
              </Text>
              {journalInsights.withDetails === 0 ? (
                <Text style={[journalTabStyles.journalHint, { color: DesignTokens.colors.text.tertiary }]}>
                  עדיין אין שדות יומן משוריינים. בעת שמירת טרייד, ניתן למלא מצב רוח, מסגרת זמן, עמידה בתוכנית
                  וטעויות — הנתונים יתאגדו כאן.
                </Text>
              ) : (
                <View style={journalTabStyles.journalInsightStack}>
                  <JournalInsightSection
                    title="כיסוי יומן"
                    titleColor={DesignTokens.colors.text.secondary}
                    surfaceBg={DesignTokens.colors.glass.card.bg}
                    surfaceBorder={DesignTokens.colors.glass.card.border}
                  >
                    <View style={journalTabStyles.journalCoverageWrap}>
                      <Text
                        style={[
                          journalTabStyles.journalCoveragePct,
                          { color: DesignTokens.colors.primary.main },
                        ]}
                      >
                        {journalInsights.coveragePct}%
                      </Text>
                      <Text
                        style={[
                          journalTabStyles.journalCoverageSub,
                          { color: DesignTokens.colors.text.tertiary },
                        ]}
                      >
                        {`${journalInsights.withDetails} מתוך ${journalInsights.total} טריידים עם פרטי יומן`}
                      </Text>
                    </View>
                  </JournalInsightSection>

                  {journalInsights.moodBefore.length > 0 ? (
                    <JournalInsightSection
                      title="מצב רוח לפני הטרייד"
                      titleColor={DesignTokens.colors.text.secondary}
                      surfaceBg={DesignTokens.colors.glass.card.bg}
                      surfaceBorder={DesignTokens.colors.glass.card.border}
                    >
                      <View style={journalTabStyles.journalMoodGrid}>
                        {journalInsights.moodBefore.map((m) => (
                          <JournalMoodInsightCard
                            key={`mb-${m.id}`}
                            item={m}
                            formatUsd={formatUsd}
                            cardBg="rgba(255,255,255,0.04)"
                            cardBorder="rgba(255,255,255,0.08)"
                            titleColor={DesignTokens.colors.text.primary}
                            badgeBg="rgba(255,255,255,0.12)"
                            badgeTextColor={DesignTokens.colors.text.primary}
                            avgPosColor={DesignTokens.colors.primary.main}
                            avgNegColor={DesignTokens.colors.text.danger}
                          />
                        ))}
                      </View>
                    </JournalInsightSection>
                  ) : null}

                  {journalInsights.moodAfter.length > 0 ? (
                    <JournalInsightSection
                      title="מצב רוח אחרי הטרייד"
                      titleColor={DesignTokens.colors.text.secondary}
                      surfaceBg={DesignTokens.colors.glass.card.bg}
                      surfaceBorder={DesignTokens.colors.glass.card.border}
                    >
                      <View style={journalTabStyles.journalMoodGrid}>
                        {journalInsights.moodAfter.map((m) => (
                          <JournalMoodInsightCard
                            key={`ma-${m.id}`}
                            item={m}
                            formatUsd={formatUsd}
                            cardBg="rgba(255,255,255,0.04)"
                            cardBorder="rgba(255,255,255,0.08)"
                            titleColor={DesignTokens.colors.text.primary}
                            badgeBg="rgba(255,255,255,0.12)"
                            badgeTextColor={DesignTokens.colors.text.primary}
                            avgPosColor={DesignTokens.colors.primary.main}
                            avgNegColor={DesignTokens.colors.text.danger}
                          />
                        ))}
                      </View>
                    </JournalInsightSection>
                  ) : null}

                  <JournalInsightSection
                    title="עמידה בתוכנית (כל הטריידים)"
                    titleColor={DesignTokens.colors.text.secondary}
                    surfaceBg={DesignTokens.colors.glass.card.bg}
                    surfaceBorder={DesignTokens.colors.glass.card.border}
                  >
                    <View style={journalTabStyles.journalPillRow}>
                      <JournalMiniPill
                        label="כן"
                        value={String(journalInsights.plan.yes)}
                        labelColor={DesignTokens.colors.text.tertiary}
                        valueColor={DesignTokens.colors.primary.main}
                        borderColor="rgba(255,255,255,0.1)"
                        backgroundColor="rgba(255,255,255,0.05)"
                      />
                      <JournalMiniPill
                        label="לא"
                        value={String(journalInsights.plan.no)}
                        labelColor={DesignTokens.colors.text.tertiary}
                        valueColor={DesignTokens.colors.text.danger}
                        borderColor="rgba(255,255,255,0.1)"
                        backgroundColor="rgba(255,255,255,0.05)"
                      />
                      <JournalMiniPill
                        label="לא צוין"
                        value={String(journalInsights.plan.unknown)}
                        labelColor={DesignTokens.colors.text.tertiary}
                        valueColor={DesignTokens.colors.text.secondary}
                        borderColor="rgba(255,255,255,0.1)"
                        backgroundColor="rgba(255,255,255,0.05)"
                      />
                    </View>
                  </JournalInsightSection>

                  {journalInsights.timeframes.some((t) => t.count > 0) ? (
                    <JournalInsightSection
                      title="מסגרת זמן"
                      titleColor={DesignTokens.colors.text.secondary}
                      surfaceBg={DesignTokens.colors.glass.card.bg}
                      surfaceBorder={DesignTokens.colors.glass.card.border}
                    >
                      <View style={journalTabStyles.journalPillRow}>
                        {journalInsights.timeframes.map((tf) => (
                          <JournalMiniPill
                            key={tf.id}
                            label={tf.label}
                            value={String(tf.count)}
                            labelColor={DesignTokens.colors.text.tertiary}
                            valueColor={
                              tf.count > 0
                                ? DesignTokens.colors.text.primary
                                : DesignTokens.colors.text.tertiary
                            }
                            borderColor="rgba(255,255,255,0.1)"
                            backgroundColor="rgba(255,255,255,0.05)"
                          />
                        ))}
                      </View>
                    </JournalInsightSection>
                  ) : null}

                  {journalInsights.mistakes.length > 0 ? (
                    <JournalInsightSection
                      title="טעויות נפוצות"
                      titleColor={DesignTokens.colors.text.secondary}
                      surfaceBg={DesignTokens.colors.glass.card.bg}
                      surfaceBorder={DesignTokens.colors.glass.card.border}
                    >
                      <View style={journalTabStyles.journalMistakeList}>
                        {journalInsights.mistakes.map((mis) => (
                          <View
                            key={mis.id}
                            style={[
                              journalTabStyles.journalMistakeCard,
                              {
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                borderColor: 'rgba(255,255,255,0.08)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                journalTabStyles.journalMistakeLabel,
                                { color: DesignTokens.colors.text.secondary },
                              ]}
                              numberOfLines={2}
                            >
                              {mis.label}
                            </Text>
                            <Text
                              style={[
                                journalTabStyles.journalMistakeCount,
                                { color: DesignTokens.colors.text.primary },
                              ]}
                            >
                              {mis.count}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </JournalInsightSection>
                  ) : null}
                </View>
              )}
            </UICard>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
