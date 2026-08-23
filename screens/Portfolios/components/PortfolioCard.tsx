import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { Portfolio, PortfolioSummary } from '../portfolioTypes';
import {
  formatCurrency,
  formatPercent,
  formatRelative,
  gainColor,
  winRateColor,
} from '../utils/format';

interface Props {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * כרטיס תיק – מציג את הנתונים העיקריים בצורה מודרנית.
 *  - שם + תאריך עדכון
 *  - שווי תיק (כמו במסך הפירוט) — תווית צמודה למספר
 *  - 3 KPIs קטנים: Daily / Total / אחוז הצלחה
 */
export function PortfolioCard({ portfolio, summary, onPress, onLongPress }: Props) {
  const tokens = useDesignTokens();

  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.secondary;

  const dailyColor = gainColor(summary?.daily_gain ?? null, positive, negative, neutral);
  const totalColor = gainColor(summary?.total_gain ?? null, positive, negative, neutral);
  const winRateC = winRateColor(
    summary?.win_rate_pct ?? null,
    positive,
    negative,
    neutral
  );

  return (
    <View style={styles.rowOuter}>
      <Pressable
        onPress={() => {
          void HapticFeedback.impactLight();
          onPress();
        }}
        onLongPress={
          onLongPress
            ? () => {
                void HapticFeedback.medium();
                onLongPress();
              }
            : undefined
        }
        delayLongPress={450}
        style={({ pressed }) => [styles.pressInner, pressed && styles.pressInnerPressed]}
      >
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="md"
          style={styles.card}
        >
        <View style={styles.header}>
          <View
            style={[
              styles.iconWrap,
              portfolio.source === 'colmex_pro' && styles.iconWrapLogo,
            ]}
          >
            {portfolio.source === 'colmex_pro' ? (
              <Image
                source={require('../../../assets/colmex-logo.png')}
                style={styles.brokerLogo}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="briefcase" size={20} color={tokens.colors.primary.main} />
            )}
          </View>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: tokens.colors.text.primary }]}
                numberOfLines={1}
              >
                {portfolio.name}
              </Text>
              {portfolio.source === 'colmex_pro' ? (
                <View
                  style={[
                    styles.brokerBadge,
                    { backgroundColor: 'rgba(0, 200, 5, 0.15)' },
                  ]}
                >
                  <Ionicons name="sync" size={10} color={tokens.colors.primary.main} />
                  <Text
                    style={[styles.brokerBadgeText, { color: tokens.colors.primary.main }]}
                  >
                    Colmex
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.meta, { color: tokens.colors.text.tertiary }]}>
              עודכן {formatRelative(portfolio.updated_at)}
            </Text>
          </View>
          <Ionicons
            name="chevron-back"
            size={20}
            color={tokens.colors.text.tertiary}
          />
        </View>

        <View style={styles.valueRow}>
          <Text style={[styles.valueLabel, { color: tokens.colors.text.tertiary }]}>
            שווי תיק
          </Text>
          <Text style={[styles.valueAmount, { color: tokens.colors.text.primary }]}>
            {summary ? formatCurrency(summary.total_value, portfolio.currency) : '—'}
          </Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={[styles.kpiLabel, { color: tokens.colors.text.tertiary }]}>
              יומי
            </Text>
            <Text style={[styles.kpiValue, { color: dailyColor }]}>
              {summary
                ? formatPercent(summary.daily_gain_pct)
                : '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.kpi}>
            <Text style={[styles.kpiLabel, { color: tokens.colors.text.tertiary }]}>
              רווח כולל
            </Text>
            <Text style={[styles.kpiValue, { color: totalColor }]}>
              {summary ? formatPercent(summary.total_gain_pct) : '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.kpi}>
            <Text style={[styles.kpiLabel, { color: tokens.colors.text.tertiary }]}>
              אחוז הצלחה
            </Text>
            <Text style={[styles.kpiValue, { color: winRateC }]}>
              {summary?.win_rate_pct != null && isFinite(summary.win_rate_pct)
                ? formatPercent(summary.win_rate_pct, 1, false)
                : '—'}
            </Text>
          </View>
        </View>
        </UICard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /** מרווח אנכי בין כרטיסים (FlatList לא תמיד מכבד `gap` בכל הפלטפורמות) */
  rowOuter: {
    marginBottom: 18,
  },
  pressInner: {},
  pressInnerPressed: {
    opacity: 0.9,
  },
  card: {
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLogo: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  brokerLogo: { width: 38, height: 38 },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  brokerBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  brokerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'ltr',
  },
  meta: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  valueRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 0,
  },
  valueLabel: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  valueAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  kpiRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  kpi: {
    flex: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
