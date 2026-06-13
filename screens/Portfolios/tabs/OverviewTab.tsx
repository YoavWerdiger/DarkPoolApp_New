import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type {
  Portfolio,
  PortfolioSummary,
  PortfolioHolding,
  DistributionGroupBy,
  PerformancePeriod,
} from '../portfolioTypes';
import {
  buildDistribution,
  getDailyGainersLosers,
} from '../../../services/portfolios/portfolioAggregator';
import { DistributionDonut } from '../components/DistributionDonut';
import { PortfolioValueChart } from '../components/PortfolioValueChart';
import { formatCurrency, formatPercent, gainColor } from '../utils/format';
import { PERIOD_TO_DAYS } from '../portfolioConstants';
import {
  getValueHistory,
  getTransactionChartSeries,
} from '../../../services/portfolios';
import UICard from '../../../components/ui/UICard';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
  holdings: PortfolioHolding[];
}

const GROUP_BY_OPTIONS: { id: DistributionGroupBy; label: string }[] = [
  { id: 'symbol', label: 'נכסים' },
  { id: 'asset_type', label: 'סוג נכס' },
  { id: 'sector', label: 'סקטור' },
  { id: 'currency', label: 'מטבע' },
];

export default function OverviewTab({ portfolio, summary, holdings }: Props) {
  const tokens = useDesignTokens();
  const [groupBy, setGroupBy] = useState<DistributionGroupBy>('symbol');
  const [period, setPeriod] = useState<PerformancePeriod>('3M');
  const [chartSeries, setChartSeries] = useState<{ date: string; value: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setChartLoading(true);
    const load = async () => {
      try {
        // עדיפות: portfolio_value_history → אחרת מחושב מטרנזקציות
        const hist = await getValueHistory(portfolio.id, 365);
        if (!cancel) {
          if (hist.length >= 2) {
            setChartSeries(hist.map((p) => ({ date: p.date, value: p.total_value })));
          } else {
            const txSeries = await getTransactionChartSeries(portfolio.id);
            if (!cancel) setChartSeries(txSeries);
          }
        }
      } catch {
        if (!cancel) {
          try {
            const txSeries = await getTransactionChartSeries(portfolio.id);
            if (!cancel) setChartSeries(txSeries);
          } catch {
            if (!cancel) setChartSeries([]);
          }
        }
      } finally {
        if (!cancel) setChartLoading(false);
      }
    };
    void load();
    return () => { cancel = true; };
  }, [portfolio.id]);

  const distribution = useMemo(
    () => buildDistribution(holdings, groupBy),
    [holdings, groupBy]
  );

  const { gainers, losers } = useMemo(
    () => getDailyGainersLosers(holdings),
    [holdings]
  );

  const filteredSeries = useMemo(() => {
    if (chartSeries.length < 2) return [];
    const days = PERIOD_TO_DAYS[period];
    if (days == null) return chartSeries;
    if (days === -1) {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      return chartSeries.filter((p) => p.date >= yearStart);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const filtered = chartSeries.filter((p) => p.date >= cutoffIso);
    // אם הסינון השאיר פחות מ-2 נקודות → תחזיר הכל (תיק צעיר)
    return filtered.length >= 2 ? filtered : chartSeries;
  }, [chartSeries, period]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginBottom: 16,
          overflow: 'hidden',
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          marginBottom: 12,
        },
        tipsBanner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          backgroundColor: 'rgba(255, 184, 0, 0.10)',
          borderColor: 'rgba(255, 184, 0, 0.30)',
          borderWidth: 1,
          borderRadius: 14,
          marginBottom: 16,
        },
        tipsText: {
          flex: 1,
          fontSize: 13,
          color: tokens.colors.text.warning,
          lineHeight: 18,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        groupChips: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 14,
        },
        groupChip: {
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.04)',
        },
        groupChipActive: {
          borderColor: `${tokens.colors.primary.main}66`,
          backgroundColor: `${tokens.colors.primary.main}1F`,
        },
        groupChipText: {
          fontSize: 12,
          color: tokens.colors.text.secondary,
          fontWeight: '600',
        },
        groupChipTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        donutWrap: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 16,
        },
        legend: {
          flex: 1,
          gap: 8,
        },
        legendRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
        },
        legendDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
        },
        legendLabel: {
          flex: 1,
          fontSize: 12,
          color: tokens.colors.text.primary,
          textAlign: 'right',
          fontWeight: '600',
        },
        legendPct: {
          fontSize: 12,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
        },
        moversWrap: {
          gap: 14,
        },
        moverGroup: {
          gap: 4,
        },
        moverGroupHeaderText: {
          fontSize: 12,
          fontWeight: '700',
          textAlign: 'right',
          marginBottom: 8,
        },
        moverRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 9,
          paddingHorizontal: 10,
          gap: 8,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          marginBottom: 6,
        },
        moverSymbol: {
          flex: 1,
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        moverPct: {
          fontSize: 13,
          fontWeight: '700',
          writingDirection: 'ltr',
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingVertical: 24,
        },
        emptyTextSmall: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingVertical: 10,
        },
        cashGrid: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 10,
        },
        cashCell: {
          width: '48%',
          flexGrow: 1,
          padding: 12,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          gap: 6,
        },
        cashCellLabel: {
          fontSize: 11,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
        },
        cashCellValue: {
          fontSize: 15,
          fontWeight: '700',
          textAlign: 'right',
          writingDirection: 'ltr',
        },
      }),
    [tokens]
  );

  const showTip = (summary?.holdings_count ?? 0) === 0;

  return (
    <View>
      {showTip ? (
        <View style={styles.tipsBanner}>
          <Ionicons name="bulb" size={20} color={tokens.colors.text.warning} />
          <Text style={styles.tipsText}>
            התיק עוד ריק – הוסף הפקדה ראשונה ועסקאות buy כדי לראות חישובים מדויקים.
          </Text>
        </View>
      ) : null}

      {/* Performance chart */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>שווי תיק לאורך זמן</Text>
        {chartLoading ? (
          <Text style={styles.emptyText}>טוען נתונים…</Text>
        ) : filteredSeries.length < 2 ? (
          <Text style={styles.emptyText}>הוסף טרנזקציות כדי לראות את הגרף</Text>
        ) : (
          <PortfolioValueChart
            series={filteredSeries}
            currency={portfolio.currency}
            selectedPeriod={period}
            onPeriodChange={setPeriod}
          />
        )}
      </UICard>

      {/* Distribution */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>חלוקת נכסים</Text>
        <View style={styles.groupChips}>
          {GROUP_BY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => {
                if (groupBy !== opt.id) void HapticFeedback.selection();
                setGroupBy(opt.id);
              }}
              style={[
                styles.groupChip,
                groupBy === opt.id && styles.groupChipActive,
              ]}
            >
              <Text
                style={[
                  styles.groupChipText,
                  groupBy === opt.id && styles.groupChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {distribution.length === 0 ? (
          <Text style={styles.emptyText}>הוסף נכסים כדי לראות פילוח</Text>
        ) : (
          <View style={styles.donutWrap}>
            <DistributionDonut
              slices={distribution}
              size={140}
              strokeWidth={20}
              centerLabel="סה״כ"
              centerValue={`${distribution.length}`}
            />
            <View style={styles.legend}>
              {distribution.slice(0, 6).map((s) => (
                <View key={s.key} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={styles.legendPct}>{formatPercent(s.percentage, 1, false)}</Text>
                </View>
              ))}
              {distribution.length > 6 ? (
                <Text
                  style={[styles.legendLabel, { color: tokens.colors.text.tertiary }]}
                >
                  ועוד {distribution.length - 6} נכסים נוספים
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </UICard>

      {/* Daily gainers/losers */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>הזזת המחיר היום</Text>
        {holdings.length === 0 ? (
          <Text style={styles.emptyText}>אין נכסים בתיק</Text>
        ) : (
          <View style={styles.moversWrap}>
            <View style={styles.moverGroup}>
              <Text
                style={[
                  styles.moverGroupHeaderText,
                  { color: tokens.colors.primary.main },
                ]}
              >
                עליות הכי גדולות
              </Text>
              {gainers.length === 0 ? (
                <Text style={styles.emptyTextSmall}>
                  אין עליות היום בנכסים הפתוחים
                </Text>
              ) : (
                gainers.map((h) => (
                  <View key={h.symbol} style={styles.moverRow}>
                    <Text style={styles.moverSymbol}>{h.symbol}</Text>
                    <Text
                      style={[
                        styles.moverPct,
                        {
                          color: gainColor(
                            h.daily_gain_pct,
                            tokens.colors.primary.main,
                            tokens.colors.text.danger,
                            tokens.colors.text.secondary
                          ),
                        },
                      ]}
                    >
                      {formatPercent(h.daily_gain_pct)}
                    </Text>
                  </View>
                ))
              )}
            </View>
            <View style={styles.moverGroup}>
              <Text
                style={[
                  styles.moverGroupHeaderText,
                  { color: tokens.colors.text.danger },
                ]}
              >
                ירידות הכי גדולות
              </Text>
              {losers.length === 0 ? (
                <Text style={styles.emptyTextSmall}>
                  אין ירידות היום בנכסים הפתוחים
                </Text>
              ) : (
                losers.map((h) => (
                  <View key={h.symbol} style={styles.moverRow}>
                    <Text style={styles.moverSymbol}>{h.symbol}</Text>
                    <Text
                      style={[
                        styles.moverPct,
                        {
                          color: gainColor(
                            h.daily_gain_pct,
                            tokens.colors.primary.main,
                            tokens.colors.text.danger,
                            tokens.colors.text.secondary
                          ),
                        },
                      ]}
                    >
                      {formatPercent(h.daily_gain_pct)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </UICard>

      {/* Cash flow summary */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>תזרים מזומנים</Text>
        <View style={styles.cashGrid}>
          <CashFlowCard
            label="הפקדות"
            value={summary ? formatCurrency(summary.total_deposits, portfolio.currency) : '—'}
            tokens={tokens}
            styles={styles}
          />
          <CashFlowCard
            label="משיכות"
            value={summary ? formatCurrency(summary.total_withdrawals, portfolio.currency) : '—'}
            tokens={tokens}
            styles={styles}
          />
          <CashFlowCard
            label="עמלות / מסים"
            value={summary ? formatCurrency(summary.total_fees, portfolio.currency) : '—'}
            tokens={tokens}
            styles={styles}
          />
          <CashFlowCard
            label="דיבידנדים"
            value={
              summary ? formatCurrency(summary.total_dividends, portfolio.currency) : '—'
            }
            tokens={tokens}
            styles={styles}
          />
        </View>
      </UICard>
    </View>
  );
}

interface CashFlowCardProps {
  label: string;
  value: string;
  tokens: ReturnType<typeof useDesignTokens>;
  styles: {
    cashCell: any;
    cashCellLabel: any;
    cashCellValue: any;
  };
}

function CashFlowCard({ label, value, tokens, styles }: CashFlowCardProps) {
  return (
    <View style={styles.cashCell}>
      <Text style={styles.cashCellLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.cashCellValue, { color: tokens.colors.text.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
    </View>
  );
}
