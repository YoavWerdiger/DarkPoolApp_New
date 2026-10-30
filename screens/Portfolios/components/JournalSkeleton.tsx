/**
 * יומן מסחר בטעינה — אותו מבנה וטקסטים כמו המסך האמיתי (PortfolioDetailScreen + OverviewTab):
 * צ׳יפי הטאבים, «שווי תיק:» עם גרף, «חלוקת נכסים» עם דונאט, כרטיסי המדדים עם התוויות שלהם
 * ו«תזרים» עם ארבע השורות. רק המספרים והגרפיקה «נטענים» — הנתונים מחליפים אותם במקום, בלי קפיצה.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { SlidingPillGroup } from '../../../components/ui/DayDividerPill';
import { LineChartSkeleton, SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  JOURNAL_TYPE,
  journalCardTitleStyle,
  journalPhysicalRightText,
} from '../../Journal/journalLayout';
import { PORTFOLIO_DETAIL_TABS } from '../portfolioConstants';

const METRIC_LABELS = ['היום', 'תשואה', 'רווח לא ממומש', 'P&L נטו', 'אחוז הצלחה', 'פקטור רווח', 'ירידה מקסימלית'];
const CASH_LABELS = ['הפקדות', 'משיכות', 'עמלות', 'דיבידנדים'];

export function JournalSkeleton() {
  const tokens = useDesignTokens();
  const title = [journalCardTitleStyle, { color: tokens.colors.text.primary }];
  const secondary = tokens.colors.text.secondary;
  return (
    <View pointerEvents="none">
      <SlidingPillGroup
        scroll
        options={PORTFOLIO_DETAIL_TABS}
        value="overview"
        onChange={() => {}}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsScrollContent}
        pillStyle={styles.tabBtn}
      />

      <View style={styles.content}>
        {/* שווי תיק + גרף */}
        <UICard variant="soft" padding="md">
          <Text style={[title, journalPhysicalRightText]}>שווי תיק:</Text>
          <SkeletonBox width={190} height={30} borderRadius={8} style={styles.mt10} />
          <View style={[styles.row, styles.mt10]}>
            <SkeletonBox width={90} height={12} borderRadius={6} />
            <SkeletonBox width={56} height={12} borderRadius={6} />
          </View>
          <View style={styles.mt16}>
            <LineChartSkeleton height={200} periods={6} />
          </View>
        </UICard>

        {/* חלוקת נכסים */}
        <UICard variant="soft" padding="md" style={styles.mt16}>
          <Text style={[title, journalPhysicalRightText]}>חלוקת נכסים</Text>
          <View style={[styles.row, styles.mt12]}>
            {[64, 72, 58].map((w, i) => (
              <SkeletonBox key={i} width={w} height={30} borderRadius={15} />
            ))}
          </View>
          <View style={[styles.donutRow, styles.mt16]}>
            <SkeletonBox width={140} height={140} borderRadius={70} />
            <View style={styles.legend}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.legendRow}>
                  <SkeletonBox width={10} height={10} borderRadius={5} />
                  <SkeletonBox width="70%" height={12} borderRadius={6} />
                </View>
              ))}
            </View>
          </View>
        </UICard>

        {/* כרטיסי מדדים — רשת שני טורים כמו במסך */}
        <View style={[styles.metricGrid, styles.mt16]}>
          {METRIC_LABELS.map((label) => (
            <UICard key={label} variant="soft" padding="md" style={styles.metricCard}>
              <View style={styles.metricInnerLtr}>
                <Text style={[title, journalPhysicalRightText, styles.right]} numberOfLines={1}>
                  {label}
                </Text>
                <SkeletonBox width="60%" height={20} borderRadius={6} style={[styles.mt10, styles.selfEnd]} />
                <SkeletonBox width="80%" height={10} borderRadius={5} style={[styles.mt10, styles.selfEnd]} />
              </View>
            </UICard>
          ))}
        </View>

        {/* תזרים */}
        <UICard variant="soft" padding="md" style={styles.mt16}>
          <Text style={[title, journalPhysicalRightText]}>תזרים</Text>
          {CASH_LABELS.map((label, i) => (
            <View
              key={label}
              style={[
                styles.cashLine,
                i < CASH_LABELS.length - 1 && { borderBottomWidth: 1, borderBottomColor: tokens.colors.border.divider },
              ]}
            >
              <SkeletonBox width={70} height={13} borderRadius={6} />
              <Text style={[styles.cashLabel, journalPhysicalRightText, { color: secondary }]}>{label}</Text>
            </View>
          ))}
        </UICard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // כמו ב-PortfolioDetailScreen
  tabsScroll: { marginTop: 6, marginBottom: 2 },
  tabsScrollContent: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  tabBtn: { borderRadius: 999, overflow: 'hidden' },
  content: { paddingHorizontal: 16, paddingTop: 14, direction: 'rtl' },
  row: { direction: 'rtl', flexDirection: 'row', gap: 8 },
  donutRow: { direction: 'rtl', flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 12 },
  legendRow: { direction: 'rtl', flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricGrid: { direction: 'rtl', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { flexBasis: '46%', flexGrow: 1 },
  metricInnerLtr: { direction: 'ltr' },
  selfEnd: { alignSelf: 'flex-end' },
  metricInner: { direction: 'rtl', flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricText: { flex: 1, gap: 8 },
  right: { textAlign: 'right', width: '100%' },
  // כמו cashLine ב-OverviewTab
  cashLine: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  cashLabel: {
    fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
    fontWeight: JOURNAL_TYPE.cardSubtitle.fontWeight,
    lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
  },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
});
