import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { changeToneFromSigned } from '../../../components/ui/ChangeDot';
import type { Portfolio, PortfolioSummary } from '../portfolioTypes';
import {
  formatCurrency,
  formatPercent,
  gainColor,
  winRateColor,
} from '../utils/format';
import {
  JOURNAL_LAYOUT,
  journalCardMetricLabelStyle,
  journalCardMetricValueSecondaryStyle,
  journalCardMetricValueStyle,
} from '../../Journal/journalLayout';
import { portfolioAmountDisplayColor } from '../utils/chartDisplay';

interface Props {
  summary: PortfolioSummary | null;
  portfolio?: Portfolio | null;
}

/**
 * Hero portfolio summary
 * – שווי תיק + Daily change pill
 * – Quick actions (פעולה חדשה / ייבוא / שיתוף לקהילה)
 * – 3 KPI inline בקווים דקים (רווח כולל / הצלחה / מזומן)
 */
export function PortfolioSummaryHeader({
  summary,
  portfolio,
}: Props) {
  const tokens = useDesignTokens();
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.secondary;

  const dailyValue = summary?.daily_gain ?? null;
  const dailyTone = changeToneFromSigned(dailyValue);
  const dailyColor = gainColor(dailyValue, positive, negative, neutral);
  const dailyPillBg =
    dailyTone === 'positive'
      ? `${positive}1F`
      : dailyTone === 'negative'
        ? `${negative}1F`
        : 'rgba(255,255,255,0.06)';
  const dailyPillBorder =
    dailyTone === 'positive'
      ? `${positive}55`
      : dailyTone === 'negative'
        ? `${negative}55`
        : tokens.colors.border.subtle;

  const totalColor = gainColor(summary?.total_gain ?? null, positive, negative, neutral);
  const winRateC = winRateColor(
    summary?.win_rate_pct ?? null,
    positive,
    negative,
    neutral
  );


  return (
    <View style={styles.wrap}>
      <UICard
        variant="soft"
        padding="none"
        style={{
          width: '100%',
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
        }}
      >
        {/* Hero block */}
        <View style={styles.hero}>
          <Text style={[styles.label, { color: tokens.colors.text.secondary }]}>
            שווי תיק
          </Text>
          <Text
            style={[
              styles.totalValue,
              {
                color: portfolioAmountDisplayColor(
                  summary?.total_value ?? 0,
                  tokens.colors.text.primary,
                  tokens.colors.text.danger,
                ),
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {summary ? formatCurrency(summary.total_value, summary.currency) : '—'}
          </Text>

          <View
            style={[
              styles.dailyPill,
              {
                backgroundColor: dailyPillBg,
                borderColor: dailyPillBorder,
              },
            ]}
          >
            <Text style={[styles.dailyText, { color: dailyColor }]} numberOfLines={1}>
              {summary
                ? `${formatCurrency(summary.daily_gain, summary.currency)} (${formatPercent(
                    summary.daily_gain_pct
                  )})`
                : '—'}
            </Text>
            <Text style={[styles.dailyMeta, { color: tokens.colors.text.tertiary }]}>
              היום
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: tokens.colors.border.subtle }]}
        />

        {/* KPI row */}
        <View style={styles.kpiRow}>
          <KpiInline
            label="רווח כולל"
            value={summary ? formatCurrency(summary.total_gain, summary.currency) : '—'}
            subValue={summary ? formatPercent(summary.total_gain_pct) : undefined}
            color={totalColor}
            tokens={tokens}
          />
          <View
            style={[
              styles.kpiSeparator,
              { backgroundColor: tokens.colors.border.subtle },
            ]}
          />
          <KpiInline
            label="הצלחה"
            value={
              summary?.win_rate_pct != null && isFinite(summary.win_rate_pct)
                ? formatPercent(summary.win_rate_pct, 1, false)
                : '—'
            }
            color={winRateC}
            tokens={tokens}
          />
          <View
            style={[
              styles.kpiSeparator,
              { backgroundColor: tokens.colors.border.subtle },
            ]}
          />
          <KpiInline
            label="מזומן"
            value={summary ? formatCurrency(summary.cash, summary.currency) : '—'}
            color={tokens.colors.text.primary}
            tokens={tokens}
          />
        </View>
      </UICard>
    </View>
  );
}


interface KpiInlineProps {
  label: string;
  value: string;
  subValue?: string;
  color: string;
  tokens: ReturnType<typeof useDesignTokens>;
}
function KpiInline({ label, value, subValue, color, tokens }: KpiInlineProps) {
  return (
    <View style={styles.kpiCell}>
      <Text style={[styles.kpiLabel, { color: tokens.colors.text.tertiary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.kpiValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
      {subValue ? (
        <Text
          style={[styles.kpiSub, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {subValue}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    direction: 'rtl',
  },
  /**
   * Hero ממורכז — LTR מקומי מבודד מה-wrap ה-RTL.
   * בלי זה adjustsFontSizeToFit + סכום אחרי טעינה נשבר / נראה «מוזר»
   * בעוד ש-"—" בטעינה נראה ממורכז נכון.
   */
  hero: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
    direction: 'ltr',
    alignItems: 'center',
    width: '100%',
  },
  label: {
    width: '100%',
    ...journalCardMetricLabelStyle,
    textAlign: 'center',
    marginBottom: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
  },
  totalValue: {
    width: '100%',
    direction: 'ltr',
    ...journalCardMetricValueStyle,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  dailyPill: {
    direction: 'ltr',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0,
  },
  dailyText: {
    direction: 'ltr',
    fontSize: 13,
    fontWeight: '700',
    writingDirection: 'ltr',
  },
  dailyMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginStart: 2,
    writingDirection: 'rtl',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  kpiCell: {
    flex: 1,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
  },
  kpiSeparator: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  kpiLabel: {
    ...journalCardMetricLabelStyle,
    textAlign: 'center',
  },
  kpiValue: {
    width: '100%',
    direction: 'ltr',
    ...journalCardMetricValueSecondaryStyle,
    writingDirection: 'ltr',
    textAlign: 'center',
  },
  kpiSub: {
    width: '100%',
    direction: 'ltr',
    fontSize: 11,
    fontWeight: '600',
    writingDirection: 'ltr',
    textAlign: 'center',
  },
});
