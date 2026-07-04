import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { Portfolio, PortfolioSummary } from '../portfolioTypes';
import {
  formatCurrency,
  formatPercent,
  gainColor,
  winRateColor,
} from '../utils/format';

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
  const dailyColor = gainColor(dailyValue, positive, negative, neutral);
  const dailyPositive = (dailyValue ?? 0) >= 0;
  const dailyPillBg =
    dailyValue == null
      ? 'rgba(255,255,255,0.06)'
      : dailyPositive
        ? `${positive}1F`
        : `${negative}1F`;
  const dailyPillBorder =
    dailyValue == null
      ? tokens.colors.border.subtle
      : dailyPositive
        ? `${positive}55`
        : `${negative}55`;

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
        variant="glass"
        glassIntensity="light"
        padding="none"
        style={{
          width: '100%',
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
        }}
      >
        {/* Hero block */}
        <View style={styles.hero}>
          <Text style={[styles.label, { color: tokens.colors.text.tertiary }]}>
            שווי תיק
          </Text>
          <Text
            style={[styles.totalValue, { color: tokens.colors.text.primary }]}
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
            <Ionicons
              name={dailyPositive ? 'arrow-up' : 'arrow-down'}
              size={13}
              color={dailyColor}
            />
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
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  totalValue: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  dailyPill: {
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  dailyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dailyMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  kpiRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  kpiCell: {
    flex: 1,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  kpiSeparator: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '700',
    writingDirection: 'ltr',
    textAlign: 'center',
  },
  kpiSub: {
    fontSize: 11,
    fontWeight: '600',
    writingDirection: 'ltr',
    textAlign: 'center',
  },
});
