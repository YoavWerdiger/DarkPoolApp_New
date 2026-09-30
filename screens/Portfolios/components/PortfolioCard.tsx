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
import {
  JOURNAL_LAYOUT,
  journalCaption2Style,
  journalCardMetricLabelStyle,
  journalCardMetricValueSecondaryStyle,
  journalCardMetricValueStyle,
  journalCardSubtitleStyle,
  journalCardTitleStyle,
  journalRow,
  journalRtlContent,
} from '../../Journal/journalLayout';

const HEBREW_LETTER = /[\u0590-\u05FF]/;

/** שם לועזי נשאר LTR ומיושר לימין — writingDirection rtl מדביק אותו לשורת «עודכן». */
function portfolioNameIsLatin(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && !HEBREW_LETTER.test(trimmed);
}

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
 *
 * RTL: עץ direction:rtl + row (לא row-reverse).
 * כותרת עברית: journalCardTitleStyle (ימין פיזי). שם לועזי: writingDirection ltr, אותו יישור.
 * משנה: marginTop 2 מתוך journalCardSubtitleStyle — בלי gap נוסף על העמודה.
 * שווי: 28. שורת מדדים: תווית 12 וערך 20 על אותו קו, בלי שבירת «אחוז הצלחה».
 */
export function PortfolioCard({ portfolio, summary, onPress, onLongPress }: Props) {
  const tokens = useDesignTokens();
  const latinName = portfolioNameIsLatin(portfolio.name);

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
          variant="soft"
          padding="md"
          style={{ backgroundColor: tokens.colors.background.cardSolid }}
        >
          <View style={styles.cardInner}>
            <View style={styles.header}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: tokens.colors.background.tertiary },
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
                  <Ionicons name="briefcase" size={20} color={tokens.colors.text.primary} />
                )}
              </View>
              <View style={styles.headerText}>
                <View style={styles.titleRow}>
                  <View style={styles.titleBlock}>
                    <Text
                      style={[
                        styles.title,
                        { color: tokens.colors.text.primary },
                        latinName && styles.titleLatin,
                      ]}
                      numberOfLines={1}
                    >
                      {portfolio.name}
                    </Text>
                    <Text
                      style={[styles.meta, { color: tokens.colors.text.secondary }]}
                      numberOfLines={1}
                    >
                      עודכן {formatRelative(portfolio.updated_at)}
                    </Text>
                  </View>
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
              </View>
              <Ionicons
                name="chevron-back"
                size={20}
                color={tokens.colors.text.tertiary}
              />
            </View>

            <View style={styles.valueRow}>
              <Text style={[styles.valueLabel, { color: tokens.colors.text.secondary }]}>
                שווי תיק
              </Text>
              <Text style={[styles.valueAmount, { color: tokens.colors.text.primary }]}>
                {summary ? formatCurrency(summary.total_value, portfolio.currency) : '—'}
              </Text>
            </View>

            <View style={[styles.kpiRow, { borderTopColor: tokens.colors.border.divider }]}>
              <View style={styles.kpi}>
                <Text
                  style={[styles.kpiLabel, { color: tokens.colors.text.secondary }]}
                  numberOfLines={1}
                >
                  יומי
                </Text>
                <Text style={[styles.kpiValue, { color: dailyColor }]} numberOfLines={1}>
                  {summary ? formatPercent(summary.daily_gain_pct) : '—'}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
              <View style={styles.kpi}>
                <Text
                  style={[styles.kpiLabel, { color: tokens.colors.text.secondary }]}
                  numberOfLines={1}
                >
                  רווח כולל
                </Text>
                <Text style={[styles.kpiValue, { color: totalColor }]} numberOfLines={1}>
                  {summary ? formatPercent(summary.total_gain_pct) : '—'}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
              <View style={[styles.kpi, styles.kpiFit]}>
                <Text
                  style={[styles.kpiLabel, { color: tokens.colors.text.secondary }]}
                  numberOfLines={1}
                >
                  אחוז הצלחה
                </Text>
                <Text style={[styles.kpiValue, { color: winRateC }]} numberOfLines={1}>
                  {summary?.win_rate_pct != null && isFinite(summary.win_rate_pct)
                    ? formatPercent(summary.win_rate_pct, 1, false)
                    : '—'}
                </Text>
              </View>
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
    marginBottom: JOURNAL_LAYOUT.cardStackGap,
  },
  pressInner: {},
  pressInnerPressed: {
    opacity: 0.9,
  },
  cardInner: {
    ...journalRtlContent,
  },
  header: {
    ...journalRow,
    alignItems: 'center',
    marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 12,
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
    minWidth: 0,
    alignItems: 'stretch',
  },
  titleRow: {
    ...journalRow,
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    direction: 'ltr',
    alignItems: 'stretch',
  },
  title: {
    ...journalCardTitleStyle,
    flexShrink: 1,
    minWidth: 0,
    includeFontPadding: false,
  },
  /** שם לועזי: אותו textAlign right, בלי writingDirection rtl שמדביק את השורה הבאה. */
  titleLatin: {
    writingDirection: 'ltr',
  },
  brokerBadge: {
    ...journalRow,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
  },
  brokerBadgeText: {
    ...journalCaption2Style,
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  meta: {
    ...journalCardSubtitleStyle,
    includeFontPadding: false,
  },
  /**
   * כמו analyticsCell / PortfolioValueChart — LTR מקומי + flex-end
   * דוחף תווית+שווי לימין הפיזי (לא textAlign בלבד בתוך RTL).
   */
  valueRow: {
    width: '100%',
    alignSelf: 'stretch',
    direction: 'ltr',
    alignItems: 'flex-end',
    marginBottom: 0,
  },
  valueLabel: {
    maxWidth: '100%',
    ...journalCardMetricLabelStyle,
    marginBottom: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
    textAlign: 'right',
    includeFontPadding: false,
  },
  valueAmount: {
    maxWidth: '100%',
    ...journalCardMetricValueStyle,
    writingDirection: 'ltr',
    textAlign: 'right',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  kpiRow: {
    ...journalRow,
    alignItems: 'stretch',
    paddingTop: JOURNAL_LAYOUT.cardTitleToBodyGap,
    marginTop: JOURNAL_LAYOUT.cardTitleToBodyGap,
    borderTopWidth: 1,
  },
  kpi: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  /** «אחוז הצלחה» לא נדחס לשתי שורות — שאר הערכים נשארים על אותו קו. */
  kpiFit: {
    flexShrink: 0,
    flexBasis: 'auto',
  },
  kpiLabel: {
    ...journalCardMetricLabelStyle,
    textAlign: 'center',
    includeFontPadding: false,
  },
  kpiValue: {
    ...journalCardMetricValueSecondaryStyle,
    marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
    writingDirection: 'ltr',
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
});
