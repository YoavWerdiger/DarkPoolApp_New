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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
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

const SHEET_RADIUS = 36;
const CARD_RADIUS = 18;
const SHEET_BG = '#262626';
const INNER_BG = '#333333';
const PILL_BG = '#3A3A3A';

/**
 * פריביו יומן — Soft UI כהה:
 * hero סכום, KPIs קומפקטיים, גרף גדול, blur CTA בתחתית. בלי handle/gesture לסגירה.
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
  const previewPeriod: PerformancePeriod = '3M';
  const [chartSeries, setChartSeries] = useState<
    { date: string; value: number; external_flow: number }[]
  >([]);
  const [chartLoading, setChartLoading] = useState(false);
  /** גובה plot דינמי לפי שטח פנוי בכרטיס (בלי חיתוך header/periods) */
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

  /** שווי להצגה — total_value עם fallbacks (cash+value / נקודת גרף אחרונה) */
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

    // אם total_value חסר/NaN אבל יש חלקים או גרף — לא מציגים "—"
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

  /** החלקה אופקית בין תיקים — על hero/KPI (הגרף נשאר ל-scrub) */
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

  /** footer: CTA צמוד ל-safe area — מעט נמוך יותר (~8px) */
  const ctaPadBottom = Math.max(4, bottomInset - 18);
  const ctaBlock = 50;
  const chartCtaGap = 8;
  const footerReserve = chartCtaGap + ctaBlock + ctaPadBottom;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flex: 1,
          justifyContent: 'flex-end',
          minHeight: 0,
        },
        sheet: {
          flex: 1,
          width: '100%',
          marginTop: 28,
          backgroundColor: SHEET_BG,
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          overflow: 'hidden',
        },
        body: {
          flex: 1,
          minHeight: 0,
          paddingHorizontal: 22,
          paddingTop: 22,
          paddingBottom: footerReserve,
        },
        swipeArea: {
          flex: 1,
          minHeight: 0,
          direction: 'ltr',
        },
        portfolioHint: {
          flexShrink: 0,
          width: '100%',
          fontSize: 13,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          marginBottom: 4,
        },
        /** Cash App hero — דומיננטי, צמוד לימין, לא נמעך ע״י flex של הגרף */
        valueAmount: {
          flexShrink: 0,
          width: '100%',
          alignSelf: 'stretch',
          minHeight: 50,
          fontSize: 44,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          letterSpacing: -1.4,
          lineHeight: 50,
          marginBottom: 6,
          writingDirection: 'ltr',
        },
        metaLine: {
          flexShrink: 0,
          width: '100%',
          fontSize: 13,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          marginBottom: 14,
          lineHeight: 18,
        },
        metaGain: {
          fontWeight: '600',
        },
        pillsRow: {
          flexShrink: 0,
          flexDirection: 'row',
          gap: 10,
          marginBottom: 14,
        },
        pill: {
          flex: 1,
          height: 44,
          borderRadius: 9999,
          backgroundColor: PILL_BG,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
        },
        pillText: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        /** שורת KPI קומפקטית */
        kpiRow: {
          flexShrink: 0,
          flexDirection: 'row',
          backgroundColor: INNER_BG,
          borderRadius: CARD_RADIUS,
          paddingVertical: 12,
          paddingHorizontal: 8,
          marginBottom: 14,
        },
        kpiCell: {
          flex: 1,
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 6,
        },
        kpiDivider: {
          width: 2,
          backgroundColor: 'rgba(255,255,255,0.28)',
          alignSelf: 'stretch',
          marginVertical: 4,
          borderRadius: 1,
        },
        kpiLabel: {
          width: '100%',
          fontSize: 11,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        kpiValue: {
          width: '100%',
          fontSize: 15,
          fontWeight: '700',
          textAlign: 'center',
          writingDirection: 'ltr',
        },
        chartCard: {
          flex: 1,
          minHeight: 0,
          backgroundColor: INNER_BG,
          borderRadius: CARD_RADIUS,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 4,
          marginBottom: 0,
          overflow: 'visible',
        },
        chartEmpty: {
          flex: 1,
          minHeight: 140,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 16,
        },
        chartEmptyText: {
          fontSize: 13,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          width: '100%',
        },
        blurCta: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: footerReserve,
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: ctaPadBottom,
          zIndex: 4,
        },
        blurFill: {
          ...StyleSheet.absoluteFillObject,
        },
        ctaBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minWidth: 220,
          paddingHorizontal: 28,
          paddingVertical: 15,
          borderRadius: 9999,
          backgroundColor: tokens.colors.primary.main,
          overflow: 'hidden',
          zIndex: 2,
          ...Platform.select({
            ios: {
              shadowColor: tokens.colors.primary.main,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
            },
            android: { elevation: 4 },
            default: {},
          }),
        },
        ctaText: {
          fontSize: 16,
          fontWeight: '700',
          color: '#0A0A0A',
          textAlign: 'center',
          writingDirection: 'rtl',
        },
      }),
    [tokens, ctaPadBottom, footerReserve]
  );

  if (!portfolio) {
    return <View style={styles.wrap} />;
  }

  const dailyPctLabel = summary
    ? formatPercent(summary.daily_gain_pct)
    : null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.sheet}>
        <View style={styles.body}>
          <GestureDetector gesture={swipePortfolios}>
            <View style={styles.swipeArea}>
              {hasMultiple ? (
                <TouchableOpacity
                  onPress={cyclePortfolio}
                  onLongPress={
                    onLongPressPortfolio
                      ? () => {
                          void HapticFeedback.medium();
                          onLongPressPortfolio(portfolio);
                        }
                      : undefined
                  }
                  delayLongPress={450}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`תיק: ${portfolio.name}. החלק להחלפת תיק`}
                >
                  <Text style={styles.portfolioHint} numberOfLines={1}>
                    {portfolio.name}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={handleOpenMore}
                onLongPress={
                  onLongPressPortfolio
                    ? () => {
                        void HapticFeedback.medium();
                        onLongPressPortfolio(portfolio);
                      }
                    : undefined
                }
                delayLongPress={450}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="פתח תיק"
              >
                <Text
                  style={styles.valueAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.45}
                >
                  {heroValue != null
                    ? formatCurrency(heroValue, heroCurrency)
                    : '—'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.metaLine}>
                עודכן {formatRelative(portfolio.updated_at)}
                {dailyPctLabel ? (
                  <>
                    {'  ·  '}
                    <Text style={[styles.metaGain, { color: dailyColor }]}>
                      {dailyPctLabel} היום
                    </Text>
                  </>
                ) : null}
              </Text>

              <View style={styles.pillsRow}>
                <TouchableOpacity
                  style={styles.pill}
                  onPress={handleOpenMore}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="פתח תיק"
                >
                  <Text style={styles.pillText}>פתח תיק</Text>
                </TouchableOpacity>
                {hasMultiple ? (
                  <TouchableOpacity
                    style={styles.pill}
                    onPress={cyclePortfolio}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="החלף תיק"
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={17}
                      color={tokens.colors.text.primary}
                    />
                    <Text style={styles.pillText}>החלף תיק</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.pill}
                    onPress={handleOpenMore}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="עוד נתונים"
                  >
                    <Text style={styles.pillText}>עוד נתונים</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.kpiRow}>
                <View style={styles.kpiCell}>
                  <Text style={styles.kpiLabel}>יומי</Text>
                  <Text style={[styles.kpiValue, { color: dailyColor }]}>
                    {summary ? formatPercent(summary.daily_gain_pct) : '—'}
                  </Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiCell}>
                  <Text style={styles.kpiLabel}>רווח</Text>
                  <Text style={[styles.kpiValue, { color: totalColor }]}>
                    {summary ? formatPercent(summary.total_gain_pct) : '—'}
                  </Text>
                </View>
                <View style={styles.kpiDivider} />
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
                style={styles.chartCard}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  // מצב preview נקי: רק קנבס גרף בלי כותרת/אינטרוולים
                  const next = Math.max(140, Math.floor(h - 10));
                  setPlotHeight((prev) => (Math.abs(prev - next) > 2 ? next : prev));
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

        <View style={styles.blurCta} pointerEvents="box-none">
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={styles.blurFill} />
          ) : (
            <BlurView intensity={28} tint="dark" style={styles.blurFill} />
          )}
          <LinearGradient
            colors={['rgba(38,38,38,0)', 'rgba(38,38,38,0.45)', SHEET_BG]}
            locations={[0, 0.35, 1]}
            style={styles.blurFill}
            pointerEvents="none"
          />
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleOpenMore}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="לחץ לפתיחת תיק"
          >
            <Text style={styles.ctaText}>לחץ לפתיחת תיק</Text>
            <Ionicons name="arrow-back" size={16} color="#0A0A0A" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
