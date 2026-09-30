import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import type { Portfolio, PortfolioHolding } from '../portfolioTypes';
import {
  fetchPortfolioMetrics,
  type PortfolioMetricsResponse,
} from '../../../services/portfolios/portfolioAnalysis';
import { formatPercent, formatNumber, gainColor } from '../utils/format';
import { PERFORMANCE_PERIODS } from '../portfolioConstants';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCaptionStyle,
  journalCardMetricValueSecondaryStyle,
  journalCardSubtitleStyle,
  journalCardTitleStyle,
  journalPhysicalRightText,
} from '../../Journal/journalLayout';

interface Props {
  portfolio: Portfolio;
  holdings: PortfolioHolding[];
}

export default function AnalysisTab({ portfolio, holdings }: Props) {
  const tokens = useDesignTokens();
  const [metrics, setMetrics] = useState<PortfolioMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchPortfolioMetrics(portfolio.id)
      .then((m) => {
        if (!cancel) setMetrics(m);
      })
      .catch(() => {
        if (!cancel) setMetrics(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [portfolio.id]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          direction: 'rtl',
        },
        section: {
          marginBottom: 16,
          direction: 'rtl',
        },
        sectionTitle: {
          ...journalCardTitleStyle,
          color: tokens.colors.text.primary,
          marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
        },
        riskGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        riskCell: {
          width: '48%',
          padding: 12,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          borderWidth: 0,
          borderColor: tokens.colors.border.subtle,
          // LTR מקומי — flex-end דוחף תווית/ערך/רמז לימין הפיזי
          direction: 'ltr',
          alignItems: 'flex-end',
        },
        riskLabel: {
          maxWidth: '100%',
          fontSize: JOURNAL_TYPE.caption2.fontSize,
          fontWeight: JOURNAL_TYPE.caption2.fontWeight,
          lineHeight: JOURNAL_TYPE.caption2.lineHeight,
          color: tokens.colors.text.tertiary,
          marginBottom: 4,
          direction: 'ltr',
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        riskValue: {
          alignSelf: 'stretch',
          maxWidth: '100%',
          ...journalCardMetricValueSecondaryStyle,
          color: tokens.colors.text.primary,
          textAlign: 'right',
          direction: 'ltr',
        },
        riskHint: {
          maxWidth: '100%',
          fontSize: JOURNAL_TYPE.caption2.fontSize,
          fontWeight: JOURNAL_TYPE.caption2.fontWeight,
          lineHeight: JOURNAL_TYPE.caption2.lineHeight,
          color: tokens.colors.text.tertiary,
          marginTop: 4,
          direction: 'ltr',
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        perfRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 15,
          paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border.divider,
          width: '100%',
        },
        perfLabel: {
          flex: 1,
          ...journalCardSubtitleStyle,
          width: undefined,
          color: tokens.colors.text.primary,
        },
        perfValue: {
          width: 90,
          fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
          fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
          lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
          direction: 'ltr',
          textAlign: 'right',
          writingDirection: 'ltr',
        },
        perfBenchmark: {
          width: 90,
          fontSize: 12,
          direction: 'ltr',
          textAlign: 'right',
          writingDirection: 'ltr',
          color: tokens.colors.text.tertiary,
        },
        perfHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 4,
          gap: 8,
          width: '100%',
        },
        perfHeaderText: {
          fontSize: 11,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
          ...journalPhysicalRightText,
        },
        emptyText: {
          width: '100%',
          alignSelf: 'stretch',
          ...journalCardSubtitleStyle,
          color: tokens.colors.text.tertiary,
          paddingVertical: 30,
        },
        holdingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border.divider,
          width: '100%',
        },
        holdingSymbol: {
          width: 70,
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
          textAlign: 'right',
        },
        holdingValue: {
          flex: 1,
          fontSize: 12,
          color: tokens.colors.text.secondary,
          ...journalPhysicalRightText,
        },
        holdingPct: {
          width: 80,
          fontSize: 13,
          fontWeight: '700',
          textAlign: 'right',
          writingDirection: 'ltr',
        },
      }),
    [tokens]
  );

  if (loading) {
    return (
      <View style={{ paddingVertical: 60, alignItems: 'center' }}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  if (!metrics) {
    return (
      <UICard variant="soft" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.emptyText}>
          לא הצלחנו לטעון מטריקות אנליזה. נסה למשוך מטה לרענון.
        </Text>
      </UICard>
    );
  }

  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.primary;

  const sortedHoldings = [...holdings]
    .filter((h) => !h.is_closed)
    .sort((a, b) => b.total_gain_pct - a.total_gain_pct);

  return (
    <View style={styles.root}>
      {/* Risk metrics */}
      <UICard variant="soft" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>מטריקות סיכון</Text>
        <View style={styles.riskGrid}>
          <RiskCell
            label="Beta (1Y)"
            value={metrics.beta_1y != null ? formatNumber(metrics.beta_1y, 2) : '—'}
            hint="רגישות לתנועות השוק (1.0 = זהה לbenchmark)"
            styles={styles}
          />
          <RiskCell
            label="Sharpe Ratio"
            value={
              metrics.sharpe_ratio != null
                ? formatNumber(metrics.sharpe_ratio, 2)
                : '—'
            }
            hint="תשואה מותאמת לסיכון. מעל 1 = טוב"
            styles={styles}
            color={
              metrics.sharpe_ratio != null
                ? gainColor(
                    metrics.sharpe_ratio - 1,
                    positive,
                    negative,
                    neutral
                  )
                : undefined
            }
          />
          <RiskCell
            label="Sortino Ratio"
            value={
              metrics.sortino_ratio != null
                ? formatNumber(metrics.sortino_ratio, 2)
                : '—'
            }
            hint="תשואה מותאמת לסיכון שלילי בלבד"
            styles={styles}
            color={
              metrics.sortino_ratio != null
                ? gainColor(
                    metrics.sortino_ratio - 1,
                    positive,
                    negative,
                    neutral
                  )
                : undefined
            }
          />
          <RiskCell
            label="Volatility (1M)"
            value={
              metrics.volatility_1m != null
                ? formatPercent(metrics.volatility_1m * 100, 1, false)
                : '—'
            }
            hint="סטיית תקן שנתית של תשואות יומיות"
            styles={styles}
          />
        </View>
      </UICard>

      {/* Performance per period */}
      <UICard variant="soft" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>ביצועים על פני זמן</Text>
        <View style={styles.perfHeader}>
          <Text style={[styles.perfLabel, { fontSize: 11, color: tokens.colors.text.tertiary }]}>
            תקופה
          </Text>
          <Text style={[styles.perfHeaderText, { width: 90, textAlign: 'right' }]}>תיק</Text>
          <Text style={[styles.perfHeaderText, { width: 90, textAlign: 'right', writingDirection: 'ltr' }]}>
            {portfolio.benchmark_symbol}
          </Text>
        </View>
        {PERFORMANCE_PERIODS.map((p) => {
          const portfolioReturn = metrics.performance_periods[p.id];
          const cmp = metrics.benchmark_comparison.find((c) => c.period === (p.id as any));
          const benchReturn = cmp?.benchmark_return ?? null;
          return (
            <View key={p.id} style={styles.perfRow}>
              <Text style={styles.perfLabel}>{p.label}</Text>
              <Text
                style={[
                  styles.perfValue,
                  {
                    color: gainColor(portfolioReturn, positive, negative, neutral),
                  },
                ]}
              >
                {portfolioReturn != null ? formatPercent(portfolioReturn) : '—'}
              </Text>
              <Text
                style={[
                  styles.perfBenchmark,
                  {
                    color: gainColor(benchReturn, positive, negative, neutral),
                  },
                ]}
              >
                {benchReturn != null ? formatPercent(benchReturn) : '—'}
              </Text>
            </View>
          );
        })}
      </UICard>

      {/* Holdings performance */}
      <UICard variant="soft" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>ביצועי נכסים בתיק</Text>
        {sortedHoldings.length === 0 ? (
          <Text style={styles.emptyText}>אין נכסים להציג</Text>
        ) : (
          sortedHoldings.map((h) => (
            <View key={h.symbol} style={styles.holdingRow}>
              <Text style={styles.holdingSymbol}>{h.symbol}</Text>
              <Text style={styles.holdingValue} numberOfLines={1}>
                {formatPercent(h.allocation, 1, false)} מהתיק
              </Text>
              <Text
                style={[
                  styles.holdingPct,
                  { color: gainColor(h.total_gain, positive, negative, neutral) },
                ]}
              >
                {formatPercent(h.total_gain_pct)}
              </Text>
            </View>
          ))
        )}
      </UICard>

      {/* Disclaimer */}
      <UICard
        variant="soft"
        glassIntensity="subtle"
        padding="md"
        style={[styles.section, { borderColor: 'rgba(59, 130, 246, 0.25)' }]}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Ionicons name="information-circle" size={18} color={tokens.colors.text.info} />
          <Text style={{ flex: 1, ...journalCaptionStyle, color: tokens.colors.text.secondary }}>
            המטריקות מחושבות מבוססות תזרים השווי היומי של התיק שלך, מתוך מחירי close
            יומיים מ-Yahoo Finance. ביצועים בעבר אינם ערובה לביצועים עתידיים.
          </Text>
        </View>
      </UICard>
    </View>
  );
}

interface RiskCellProps {
  label: string;
  value: string;
  hint: string;
  color?: string;
  styles: ReturnType<typeof StyleSheet.create>;
}

function RiskCell({ label, value, hint, color, styles }: RiskCellProps) {
  return (
    <View style={styles.riskCell}>
      <Text style={styles.riskLabel}>{label}</Text>
      <Text style={[styles.riskValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.riskHint}>{hint}</Text>
    </View>
  );
}
