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
        section: {
          marginBottom: 16,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          marginBottom: 12,
          textAlign: 'right',
        },
        riskGrid: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 8,
        },
        riskCell: {
          width: '48%',
          padding: 12,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        riskLabel: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginBottom: 4,
          textAlign: 'right',
        },
        riskValue: {
          fontSize: 18,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        riskHint: {
          fontSize: 10,
          color: tokens.colors.text.tertiary,
          marginTop: 4,
          textAlign: 'right',
          lineHeight: 14,
        },
        perfRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 4,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border.subtle,
        },
        perfLabel: {
          flex: 1,
          fontSize: 13,
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        perfValue: {
          width: 90,
          fontSize: 13,
          fontWeight: '700',
          textAlign: 'left',
        },
        perfBenchmark: {
          width: 90,
          fontSize: 12,
          textAlign: 'left',
          color: tokens.colors.text.tertiary,
        },
        perfHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 4,
          gap: 8,
        },
        perfHeaderText: {
          fontSize: 11,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingVertical: 30,
        },
        holdingRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 8,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border.subtle,
        },
        holdingSymbol: {
          width: 70,
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        holdingValue: {
          flex: 1,
          fontSize: 12,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
        },
        holdingPct: {
          width: 80,
          fontSize: 13,
          fontWeight: '700',
          textAlign: 'left',
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
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
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
    <View>
      {/* Risk metrics */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
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
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>ביצועים על פני זמן</Text>
        <View style={styles.perfHeader}>
          <Text style={[styles.perfLabel, { fontSize: 11, color: tokens.colors.text.tertiary }]}>
            תקופה
          </Text>
          <Text style={[styles.perfHeaderText, { width: 90, textAlign: 'left' }]}>תיק</Text>
          <Text style={[styles.perfHeaderText, { width: 90, textAlign: 'left' }]}>
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
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
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
        variant="glass"
        glassIntensity="subtle"
        padding="md"
        style={[styles.section, { borderColor: 'rgba(59, 130, 246, 0.25)' }]}
      >
        <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'flex-start' }}>
          <Ionicons name="information-circle" size={18} color={tokens.colors.text.info} />
          <Text style={{ flex: 1, fontSize: 12, color: tokens.colors.text.secondary, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' }}>
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
