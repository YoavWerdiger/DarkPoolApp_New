import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { LIGHT_CANVAS } from '../../../components/ui/designTokensStatic';
import {
  CARD_GLASS_ANDROID_BLUR_METHOD,
  CARD_GLASS_ANDROID_BLUR_REDUCTION,
  cardGlassBlurTint,
} from '../../../components/ui/cardGlass';
import { SheetGlassBackground } from '../../../components/ui/BottomSheet/SheetGlassBackground';
import {
  SHEET_GLASS_INTENSITY,
} from '../../../components/ui/BottomSheet/sheetGlass';
import { PortfolioValueChart } from './PortfolioValueChart';
import type { Portfolio, PortfolioSummary, PerformancePeriod } from '../portfolioTypes';
import {
  formatCurrency,
  formatPercent,
  formatRelative,
  gainColor,
  winRateColor,
} from '../utils/format';
import {
  buildHistoricalPortfolioSeries,
  buildHistoricalPortfolioSeriesFromSnapshots,
  getValueHistory,
} from '../../../services/portfolios';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalCaption2Style,
  journalCardMetricValueStyle,
  journalSectionSubtitleStyle,
} from '../../Journal/journalLayout';

export interface JournalPreviewItem {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
}

interface Props {
  items: JournalPreviewItem[];
  selectedId: string | null;
  onSelect: (portfolioId: string) => void;
  onOpenMore: (portfolioId: string) => void;
  onLongPressPortfolio?: (portfolio: Portfolio) => void;
  /** מרווח תחתון מעל טאבים */
  bottomInset?: number;
}

const SHEET_RADIUS = 28;
const WELL_RADIUS = 16;

/**
 * פריביו תיק ביומן — טופולוגיית זכוכית:
 * Aurora (ScreenChrome) → שיט BlurView שקוף → wells rgba → CTA ירוק.
 * זהות · hero · KPI · גרף · פתח תיק. Swipe בין תיקים. בלי נקודות pager.
 */
export function JournalPreviewSheet({
  items,
  selectedId,
  onSelect,
  onOpenMore,
  onLongPressPortfolio,
  bottomInset = 0,
}: Props) {
  const tokens = useDesignTokens();
  const isDark = tokens.colors.background.primary !== LIGHT_CANVAS;
  const previewPeriod: PerformancePeriod = '3M';
  const [chartSeries, setChartSeries] = useState<
    { date: string; value: number; external_flow: number }[]
  >([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [plotHeight, setPlotHeight] = useState(200);

  const selected = useMemo(() => {
    if (!items.length) return null;
    return (
      items.find((it) => it.portfolio.id === selectedId) ?? items[0] ?? null
    );
  }, [items, selectedId]);

  const portfolio = selected?.portfolio ?? null;
  const summary = selected?.summary ?? null;
  const hasMultiple = items.length > 1;

  const heroValue = useMemo(() => {
    const asFinite = (c: unknown): number | null => {
      const n = typeof c === 'number' ? c : Number(c);
      return Number.isFinite(n) ? n : null;
    };
    const fromTotal = asFinite(summary?.total_value);
    const fromParts =
      summary != null
        ? asFinite(Number(summary.cash) + Number(summary.value))
        : null;
    const fromValue = asFinite(summary?.value);
    const fromCash = asFinite(portfolio?.available_cash);
    const fromChart =
      chartSeries.length > 0
        ? asFinite(chartSeries[chartSeries.length - 1]?.value)
        : null;

    if (fromTotal != null && (fromTotal > 0 || fromChart == null)) {
      return fromTotal;
    }
    if (fromParts != null && fromParts > 0) return fromParts;
    if (fromChart != null) return fromChart;
    if (fromTotal != null) return fromTotal;
    if (fromValue != null) return fromValue;
    if (fromCash != null) return fromCash;
    return null;
  }, [summary, portfolio?.available_cash, chartSeries]);

  const heroCurrency = summary?.currency ?? portfolio?.currency ?? 'USD';

  useEffect(() => {
    if (!portfolio) {
      setChartSeries([]);
      setChartLoading(false);
      return;
    }
    let cancel = false;
    setChartLoading(true);
    const load = async () => {
      try {
        const rangeDays = portfolio.source === 'colmex_pro' ? 2000 : 365;
        const snapshots = await buildHistoricalPortfolioSeriesFromSnapshots(
          portfolio.id,
          rangeDays
        );
        if (cancel) return;
        if (snapshots.length >= 1) {
          setChartSeries(snapshots);
          return;
        }
        if (portfolio.source === 'colmex_pro') {
          setChartSeries([]);
          return;
        }
        const series = await buildHistoricalPortfolioSeries(portfolio.id, 365);
        if (!cancel) setChartSeries(series);
      } catch {
        if (cancel) return;
        if (portfolio.source === 'colmex_pro') {
          setChartSeries([]);
          return;
        }
        try {
          const hist = await getValueHistory(portfolio.id, 365);
          const series =
            hist.length >= 2
              ? hist.map((p) => ({
                  date: p.date,
                  value: p.total_value,
                  external_flow: 0,
                }))
              : [];
          if (!cancel) setChartSeries(series);
        } catch {
          if (!cancel) setChartSeries([]);
        }
      } finally {
        if (!cancel) setChartLoading(false);
      }
    };
    void load();
    return () => {
      cancel = true;
    };
  }, [portfolio?.id, portfolio?.source]);

  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.secondary;

  const dailyColor = gainColor(
    summary?.daily_gain_pct ?? null,
    positive,
    negative,
    neutral
  );
  const totalColor = gainColor(
    summary?.total_gain_pct ?? null,
    positive,
    negative,
    neutral
  );
  const winRateC = winRateColor(
    summary?.win_rate_pct ?? null,
    positive,
    negative,
    neutral
  );
  const dailyPositive = (summary?.daily_gain_pct ?? 0) >= 0;

  const handleOpenMore = useCallback(() => {
    if (!portfolio) return;
    void HapticFeedback.medium();
    onOpenMore(portfolio.id);
  }, [onOpenMore, portfolio]);

  const selectedIndex = useMemo(() => {
    if (!portfolio || !items.length) return 0;
    const idx = items.findIndex((it) => it.portfolio.id === portfolio.id);
    return idx >= 0 ? idx : 0;
  }, [items, portfolio]);

  const selectByOffset = useCallback(
    (delta: number) => {
      if (items.length < 2) return;
      const nextIdx = (selectedIndex + delta + items.length) % items.length;
      const next = items[nextIdx];
      if (!next || next.portfolio.id === portfolio?.id) return;
      void HapticFeedback.selection();
      onSelect(next.portfolio.id);
    },
    [items, onSelect, portfolio?.id, selectedIndex]
  );

  const cyclePortfolio = useCallback(() => {
    selectByOffset(1);
  }, [selectByOffset]);

  const swipePortfolios = useMemo(() => {
    if (!hasMultiple) return Gesture.Pan().enabled(false);
    return Gesture.Pan()
      .activeOffsetX([-40, 40])
      .failOffsetY([-28, 28])
      .onEnd((e) => {
        'worklet';
        if (e.translationX <= -48) {
          runOnJS(selectByOffset)(1);
        } else if (e.translationX >= 48) {
          runOnJS(selectByOffset)(-1);
        }
      });
  }, [hasMultiple, selectByOffset]);

  const ctaPadBottom = Math.max(4, bottomInset - 18);
  const ctaBlock = 52;
  const chartCtaGap = 10;
  const footerReserve = chartCtaGap + ctaBlock + ctaPadBottom;

  const glassWellBg = tokens.colors.background.primary;
  const glassWellBorder = tokens.colors.border.divider;
  const glassChipBg = tokens.colors.background.primary;
  const glassChipBorder = tokens.colors.border.divider;

  const androidBlurProps =
    Platform.OS === 'android'
      ? {
          blurMethod: CARD_GLASS_ANDROID_BLUR_METHOD,
          blurReductionFactor: CARD_GLASS_ANDROID_BLUR_REDUCTION,
        }
      : undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        /** קנבס שקוף — האורורה מ-ScreenChrome נראית מאחור */
        canvas: {
          flex: 1,
          minHeight: 0,
          backgroundColor: 'transparent',
          paddingHorizontal: tokens.spacing.md,
          paddingBottom: 0,
        },
        /** שיט זכוכית — Blur + overlay, לא #262626 אטום */
        panel: {
          flex: 1,
          minHeight: 0,
          borderRadius: SHEET_RADIUS,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: glassWellBorder,
          borderTopColor: tokens.colors.border.divider,
          backgroundColor: 'transparent',
        },
        body: {
          flex: 1,
          minHeight: 0,
          zIndex: 1,
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: tokens.spacing.lg,
          paddingBottom: footerReserve,
        },
        swipeColumn: {
          flex: 1,
          minHeight: 0,
        },
        identity: {
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: tokens.spacing.sm,
          marginBottom: tokens.spacing.md,
          minHeight: 36,
        },
        nameChip: {
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: tokens.borderRadius.button,
          backgroundColor: glassChipBg,
          borderWidth: 1,
          borderColor: glassChipBorder,
          overflow: 'hidden',
        },
        nameText: {
          ...journalBodyTextStyle,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        switchBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: glassChipBg,
          borderWidth: 1,
          borderColor: glassChipBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        hero: {
          flexShrink: 0,
          alignItems: 'center',
          marginBottom: tokens.spacing.md,
        },
        heroLabel: {
          ...journalCaption2Style,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          writingDirection: 'rtl',
          marginBottom: 4,
          letterSpacing: 0.2,
        },
        heroValue: {
          width: '100%',
          ...journalCardMetricValueStyle,
          color: tokens.colors.text.primary,
        },
        dailyChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: tokens.spacing.sm,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: tokens.borderRadius.button,
          backgroundColor: glassChipBg,
          borderWidth: 1,
          borderColor: glassChipBorder,
        },
        dailyPct: {
          fontSize: 13,
          fontWeight: '700',
          writingDirection: 'ltr',
        },
        dailyMeta: {
          fontSize: 12,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          writingDirection: 'rtl',
        },
        updated: {
          ...journalSectionSubtitleStyle,
          marginTop: tokens.spacing.sm,
          marginBottom: 0,
          fontWeight: '500',
          color: tokens.colors.text.muted,
          textAlign: 'center',
        },
        kpiBand: {
          flexShrink: 0,
          flexDirection: 'row',
          backgroundColor: glassWellBg,
          borderRadius: WELL_RADIUS,
          borderWidth: 1,
          borderColor: glassWellBorder,
          paddingVertical: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.xs,
          marginBottom: tokens.spacing.md,
          overflow: 'hidden',
        },
        kpiCell: {
          flex: 1,
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 4,
        },
        kpiGap: {
          width: StyleSheet.hairlineWidth,
          backgroundColor: glassWellBorder,
          alignSelf: 'stretch',
          marginVertical: 4,
        },
        kpiLabel: {
          width: '100%',
          ...journalCaption2Style,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        kpiValue: {
          width: '100%',
          fontSize: JOURNAL_TYPE.body.fontSize,
          fontWeight: '700',
          lineHeight: JOURNAL_TYPE.body.lineHeight,
          textAlign: 'center',
          writingDirection: 'ltr',
        },
        chartWell: {
          flex: 1,
          minHeight: 0,
          backgroundColor: glassWellBg,
          borderRadius: WELL_RADIUS,
          borderWidth: 1,
          borderColor: glassWellBorder,
          paddingTop: 8,
          paddingHorizontal: tokens.spacing.sm,
          paddingBottom: 4,
          overflow: 'hidden',
        },
        chartEmpty: {
          flex: 1,
          minHeight: 120,
          alignItems: 'center',
          justifyContent: 'center',
          gap: tokens.spacing.sm,
          paddingHorizontal: tokens.spacing.base,
        },
        chartEmptyText: {
          ...journalSectionSubtitleStyle,
          marginTop: 0,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
          width: '100%',
          textAlign: 'center',
        },
        footer: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: footerReserve,
          justifyContent: 'flex-end',
          alignItems: 'stretch',
          paddingHorizontal: tokens.spacing.lg,
          paddingBottom: ctaPadBottom,
          zIndex: 4,
          overflow: 'hidden',
        },
        footerBlur: {
          ...StyleSheet.absoluteFillObject,
        },
        footerTint: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: tokens.colors.background.cardSolid,
        },
        ctaBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: tokens.spacing.sm,
          height: ctaBlock - 2,
          borderRadius: tokens.borderRadius.button,
          backgroundColor: tokens.colors.primary.main,
          zIndex: 1,
        },
        ctaText: {
          fontSize: JOURNAL_TYPE.body.fontSize,
          fontWeight: '700',
          lineHeight: JOURNAL_TYPE.body.lineHeight,
          color: tokens.colors.text.inverse,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
      }),
    [
      tokens,
      glassWellBg,
      glassWellBorder,
      glassChipBg,
      glassChipBorder,
      ctaPadBottom,
      footerReserve,
      ctaBlock,
    ]
  );

  if (!portfolio) {
    return <View style={styles.canvas} />;
  }

  const dailyPctLabel = summary ? formatPercent(summary.daily_gain_pct) : null;

  const onLongPress =
    onLongPressPortfolio != null
      ? () => {
          void HapticFeedback.medium();
          onLongPressPortfolio(portfolio);
        }
      : undefined;

  return (
    <View style={styles.canvas} pointerEvents="box-none">
      <View style={styles.panel}>
        <SheetGlassBackground
          active
          intensity={SHEET_GLASS_INTENSITY}
          overlayColor={tokens.colors.background.cardSolid}
        />

        <View style={styles.body}>
          <GestureDetector gesture={swipePortfolios}>
            <View style={styles.swipeColumn}>
              <View style={styles.identity}>
                <TouchableOpacity
                  style={styles.nameChip}
                  onPress={hasMultiple ? cyclePortfolio : handleOpenMore}
                  onLongPress={onLongPress}
                  delayLongPress={450}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasMultiple
                      ? `תיק: ${portfolio.name}. החלק או לחץ להחלפה`
                      : `תיק: ${portfolio.name}`
                  }
                >
                  <Text style={styles.nameText} numberOfLines={1}>
                    {portfolio.name}
                  </Text>
                </TouchableOpacity>
                {hasMultiple ? (
                  <TouchableOpacity
                    style={styles.switchBtn}
                    onPress={cyclePortfolio}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="החלף תיק"
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={18}
                      color={tokens.colors.text.primary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.hero}
                onPress={handleOpenMore}
                onLongPress={onLongPress}
                delayLongPress={450}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="פתח תיק"
              >
                <Text style={styles.heroLabel}>שווי תיק</Text>
                <Text
                  style={styles.heroValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.45}
                >
                  {heroValue != null
                    ? formatCurrency(heroValue, heroCurrency)
                    : '—'}
                </Text>
                {dailyPctLabel ? (
                  <View style={styles.dailyChip}>
                    <Ionicons
                      name={dailyPositive ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={dailyColor}
                    />
                    <Text style={[styles.dailyPct, { color: dailyColor }]}>
                      {dailyPctLabel}
                    </Text>
                    <Text style={styles.dailyMeta}>היום</Text>
                  </View>
                ) : null}
                <Text style={styles.updated}>
                  עודכן {formatRelative(portfolio.updated_at)}
                </Text>
              </TouchableOpacity>

              <View style={styles.kpiBand}>
                <View style={styles.kpiCell}>
                  <Text style={styles.kpiLabel}>יומי</Text>
                  <Text style={[styles.kpiValue, { color: dailyColor }]}>
                    {summary ? formatPercent(summary.daily_gain_pct) : '—'}
                  </Text>
                </View>
                <View style={styles.kpiGap} />
                <View style={styles.kpiCell}>
                  <Text style={styles.kpiLabel}>רווח</Text>
                  <Text style={[styles.kpiValue, { color: totalColor }]}>
                    {summary ? formatPercent(summary.total_gain_pct) : '—'}
                  </Text>
                </View>
                <View style={styles.kpiGap} />
                <View style={styles.kpiCell}>
                  <Text style={styles.kpiLabel}>הצלחה</Text>
                  <Text style={[styles.kpiValue, { color: winRateC }]}>
                    {summary?.win_rate_pct != null
                      ? formatPercent(summary.win_rate_pct, 1, false)
                      : '—'}
                  </Text>
                </View>
              </View>

              <View
                style={styles.chartWell}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  const next = Math.max(140, Math.floor(h - 8));
                  setPlotHeight((prev) =>
                    Math.abs(prev - next) > 2 ? next : prev
                  );
                }}
              >
                {chartLoading ? (
                  <View style={styles.chartEmpty}>
                    <ActivityIndicator color={tokens.colors.primary.main} />
                  </View>
                ) : chartSeries.length >= 2 ? (
                  <PortfolioValueChart
                    series={chartSeries}
                    currency={portfolio.currency}
                    selectedPeriod={previewPeriod}
                    height={plotHeight}
                    showHeader={false}
                    showXAxisLabels={false}
                    showIntervalSelector={false}
                  />
                ) : (
                  <View style={styles.chartEmpty}>
                    <Ionicons
                      name="analytics-outline"
                      size={24}
                      color={tokens.colors.text.tertiary}
                    />
                    <Text style={styles.chartEmptyText}>
                      אין עדיין מספיק נתונים לגרף
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </GestureDetector>
        </View>

        <View style={styles.footer} pointerEvents="box-none">
          <BlurView
            intensity={SHEET_GLASS_INTENSITY}
            tint={cardGlassBlurTint(isDark)}
            {...androidBlurProps}
            style={styles.footerBlur}
          />
          <View style={styles.footerTint} pointerEvents="none" />
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleOpenMore}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="פתח תיק"
          >
            <Text style={styles.ctaText}>פתח תיק</Text>
            <Ionicons
              name="arrow-back"
              size={16}
              color={tokens.colors.text.inverse}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
