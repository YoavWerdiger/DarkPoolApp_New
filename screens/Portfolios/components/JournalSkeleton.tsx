/**
 * יומן מסחר בטעינה — אותו מבנה וטקסטים כמו המסך האמיתי (PortfolioDetailScreen + OverviewTab):
 * צ׳יפי הטאבים, «שווי תיק» וגרף על רקע המסך, «חלוקת נכסים» (כותרת וצ׳יפים בחוץ, דונאט בכרטיס),
 * ולוח הבקרה: «פוזיציות פתוחות», «עסקאות אחרונות» ו«סטטיסטיקה» — כותרת בחוץ ופאנל עם שורות וקווים.
 * רק המספרים והגרפיקה «נטענים» — הנתונים מחליפים אותם במקום, בלי קפיצה.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { SlidingPillGroup } from '../../../components/ui/DayDividerPill';
import { LineChartSkeleton, SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import {
  JOURNAL_LAYOUT,
  journalCardMetricLabelStyle,
  journalPhysicalRightText,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';
import { PORTFOLIO_DETAIL_TABS } from '../portfolioConstants';

/** התוויות של «סטטיסטיקה» (JournalStatsCard) — שני טורים */
const STAT_LABELS = [
  ['אחוז הצלחה', 'עסקאות סגורות'],
  ['רווח ממוצע', 'הפסד ממוצע'],
  ['יחס רווח/הפסד', 'רווח ממומש'],
];

export function JournalSkeleton() {
  const tokens = useDesignTokens();
  const heading = [journalSectionTitleStyle, journalPhysicalRightText, { color: tokens.colors.text.primary }];
  const divider = { height: 1, backgroundColor: tokens.colors.border.divider, marginHorizontal: JOURNAL_LAYOUT.cardPadding };

  /** פאנל רשימה (כמו Panel בלוח הבקרה) עם שורות לוגו + כותרת/פירוט + ערך */
  const listPanel = (title: string, count: number) => (
    <View style={styles.section}>
      <Text style={[heading, styles.headingGap]}>{title}</Text>
      <UICard variant="soft" glassIntensity="light" padding="none" style={styles.panel}>
        {Array.from({ length: count }, (_, i) => (
          <React.Fragment key={i}>
            <View style={styles.listRow}>
              <SkeletonBox width={36} height={36} borderRadius={18} />
              <View style={styles.listText}>
                <SkeletonBox width={64} height={13} borderRadius={6} />
                <SkeletonBox width={96} height={10} borderRadius={5} />
              </View>
              <View style={styles.listValue}>
                <SkeletonBox width={72} height={13} borderRadius={6} />
                <SkeletonBox width={44} height={10} borderRadius={5} />
              </View>
            </View>
            {i < count - 1 ? <View style={divider} /> : null}
          </React.Fragment>
        ))}
      </UICard>
    </View>
  );

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
        {/* שווי תיק + גרף — על רקע המסך, בלי כרטיס */}
        <View style={styles.section}>
          <Text style={heading}>שווי תיק</Text>
          <SkeletonBox width={190} height={30} borderRadius={8} style={styles.heroValue} />
          <View style={styles.deltaRow}>
            <SkeletonBox width={120} height={12} borderRadius={6} />
          </View>
          <LineChartSkeleton height={220} periods={6} />
        </View>

        {/* חלוקת נכסים — כותרת וצ׳יפים בחוץ, הדונאט בכרטיס */}
        <View style={styles.section}>
          <Text style={[heading, styles.headingGap]}>חלוקת נכסים</Text>
          <View style={styles.chips}>
            {[64, 72, 58].map((w, i) => (
              <SkeletonBox key={i} width={w} height={30} borderRadius={15} />
            ))}
          </View>
          <UICard variant="soft" padding="md">
            <View style={styles.donutRow}>
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
        </View>

        {listPanel('פוזיציות פתוחות', 3)}
        {listPanel('עסקאות אחרונות', 3)}

        {/* סטטיסטיקה — רשת שני טורים: אייקון, תווית אמיתית, ערך נטען */}
        <View style={styles.section}>
          <Text style={[heading, styles.headingGap]}>סטטיסטיקה</Text>
          <UICard variant="soft" glassIntensity="light" padding="none" style={styles.panel}>
            {STAT_LABELS.map((pair, r) => (
              <React.Fragment key={r}>
                <View style={styles.statRow}>
                  {pair.map((label, i) => (
                    <React.Fragment key={label}>
                      {i > 0 ? <View style={[styles.statColDivider, { backgroundColor: tokens.colors.border.divider }]} /> : null}
                      <View style={styles.statCell}>
                        <SkeletonBox width={36} height={36} borderRadius={18} />
                        <View style={styles.statText}>
                          <Text
                            style={[journalCardMetricLabelStyle, journalPhysicalRightText, { color: tokens.colors.text.secondary }]}
                            numberOfLines={1}
                          >
                            {label}
                          </Text>
                          <SkeletonBox width={64} height={20} borderRadius={6} style={styles.statValue} />
                        </View>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                {r < STAT_LABELS.length - 1 ? <View style={divider} /> : null}
              </React.Fragment>
            ))}
          </UICard>
        </View>
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
  // כמו sectionBlock / heroBlock / Section ב-OverviewTab ו-JournalDashboard
  section: { marginBottom: JOURNAL_LAYOUT.sectionGap, direction: 'rtl' },
  headingGap: { marginBottom: JOURNAL_LAYOUT.sectionHeaderToContent },
  heroValue: { marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap * 2 },
  deltaRow: {
    marginTop: JOURNAL_LAYOUT.titleSubtitleGap + 6,
    marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
  },
  chips: { direction: 'rtl', flexDirection: 'row', gap: 6, marginBottom: 14 },
  donutRow: { direction: 'rtl', flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 12 },
  legendRow: { direction: 'rtl', flexDirection: 'row', alignItems: 'center', gap: 8 },
  panel: { borderRadius: UI_CARD_RADIUS, overflow: 'hidden' },
  // כמו Row בלוח הבקרה
  listRow: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: JOURNAL_LAYOUT.cardTitleToBodyGap,
    paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
    minHeight: 56,
    gap: 12,
  },
  listText: { flex: 1, gap: 6, alignItems: 'flex-start' },
  listValue: { gap: 6, alignItems: 'flex-end' },
  // כמו statRow / statCell ב-JournalStatsGrid
  statRow: { direction: 'rtl', flexDirection: 'row' },
  statCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: JOURNAL_LAYOUT.cardPadding,
  },
  statColDivider: { width: 1, marginVertical: JOURNAL_LAYOUT.cardPadding },
  statText: { flex: 1, minWidth: 0 },
  statValue: { marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap },
});
