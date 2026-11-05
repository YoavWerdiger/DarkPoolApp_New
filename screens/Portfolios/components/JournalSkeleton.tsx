import { UI_DIR } from '../../../lib/i18n/direction';
/**
 * יומן מסחר בטעינה — אותו מבנה וטקסטים כמו המסך האמיתי (PortfolioDetailScreen + OverviewTab):
 * צ׳יפי הטאבים, שווי תיק וגרף, חלוקת נכסים, פוזיציות פתוחות, עסקאות אחרונות וסטטיסטיקה.
 * בלי טקסט קבוע — כל כותרת, תווית ומספר הם צורת טעינה באותו מקום ובאותו גודל.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { LineChartSkeleton, SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { JOURNAL_LAYOUT } from '../../Journal/journalLayout';

export function JournalSkeleton() {
  const tokens = useDesignTokens();
  const divider = { height: 1, backgroundColor: tokens.colors.border.divider, marginHorizontal: JOURNAL_LAYOUT.cardPadding };
  // כותרת סקשן — בלי טקסט קבוע, רק צורה בגובה הכותרת
  const heading = (w: number) => <SkeletonBox width={w} height={18} borderRadius={7} style={styles.heading} />;

  /** פאנל רשימה: לוגו 36 · טיקר (+ שורה משנית) · ערך משמאל — כמו HoldingsListRow / Row בלוח הבקרה */
  const listPanel = (count: number, withSub: boolean, delay: number) => (
    <View style={styles.section}>
      {heading(withSub ? 118 : 104)}
      <UICard variant="soft" glassIntensity="light" padding="none" style={styles.panel}>
        {Array.from({ length: count }, (_, i) => (
          <React.Fragment key={i}>
            <View style={styles.listRow}>
              <SkeletonBox width={36} height={36} borderRadius={18} delay={delay + i * 60} />
              <View style={styles.listText}>
                <View style={styles.tickerLine}>
                  <SkeletonBox width={52} height={14} borderRadius={6} delay={delay + i * 60} />
                  {withSub ? null : <SkeletonBox width={34} height={16} borderRadius={8} delay={delay + i * 60} />}
                </View>
                {withSub ? <SkeletonBox width={40} height={10} borderRadius={5} delay={delay + i * 60} /> : null}
              </View>
              <View style={styles.listValue}>
                <SkeletonBox width={68} height={14} borderRadius={6} delay={delay + i * 60} />
                {withSub ? <SkeletonBox width={44} height={10} borderRadius={5} delay={delay + i * 60} /> : null}
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
      {/* צ׳יפי הטאבים — צורות בלבד */}
      <View style={styles.tabsRow}>
        {[64, 84, 70, 66].map((w, i) => (
          <SkeletonBox key={i} width={w} height={32} borderRadius={16} />
        ))}
      </View>

      <View style={styles.content}>
        {/* שווי תיק + גרף — על רקע המסך */}
        <View style={styles.section}>
          {heading(76)}
          <SkeletonBox width={190} height={30} borderRadius={8} style={styles.heroValue} />
          <View style={styles.deltaRow}>
            <SkeletonBox width={120} height={12} borderRadius={6} />
          </View>
          <LineChartSkeleton height={220} periods={6} />
        </View>

        {/* חלוקת נכסים — צ׳יפים בחוץ, דונאט + מקרא + סה״כ בכרטיס */}
        <View style={styles.section}>
          {heading(96)}
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
                    <SkeletonBox width="55%" height={12} borderRadius={6} />
                    <SkeletonBox width={30} height={12} borderRadius={6} />
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.totalRow}>
              <SkeletonBox width={70} height={12} borderRadius={6} />
              <SkeletonBox width={84} height={14} borderRadius={6} />
            </View>
          </UICard>
        </View>

        {/* פוזיציות פתוחות (טיקר + חלק מהתיק · שווי + תשואה) */}
        {listPanel(3, true, 0)}
        {/* עסקאות אחרונות (טיקר + תגית לונג/שורט · רווח/הפסד) */}
        {listPanel(3, false, 120)}

        {/* סטטיסטיקה — ערך משמאל · כותרת · אייקון מימין (כמו שורת הגדרות) */}
        <View style={styles.section}>
          {heading(84)}
          <UICard variant="soft" glassIntensity="light" padding="none" style={styles.panel}>
            {[92, 104, 84, 88, 100, 90].map((w, i, arr) => (
              <React.Fragment key={i}>
                <View style={styles.statRow}>
                  <SkeletonBox width={56} height={14} borderRadius={6} delay={i * 50} />
                  <View style={styles.statTitle}>
                    <SkeletonBox width={w} height={14} borderRadius={6} delay={i * 50} />
                  </View>
                  <SkeletonBox width={20} height={20} borderRadius={6} delay={i * 50} style={styles.statIcon} />
                </View>
                {i < arr.length - 1 ? <View style={divider} /> : null}
              </React.Fragment>
            ))}
          </UICard>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // כמו צ׳יפי הטאבים ב-PortfolioDetailScreen
  tabsRow: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 6,
    marginBottom: 2,
  },
  heading: { alignSelf: 'flex-start', marginBottom: JOURNAL_LAYOUT.sectionHeaderToContent },
  content: { paddingHorizontal: 16, paddingTop: 14, direction: UI_DIR },
  // כמו sectionBlock / heroBlock / Section ב-OverviewTab ו-JournalDashboard
  section: { marginBottom: JOURNAL_LAYOUT.sectionGap, direction: UI_DIR },
  heroValue: { marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap * 2 - JOURNAL_LAYOUT.sectionHeaderToContent },
  deltaRow: {
    marginTop: JOURNAL_LAYOUT.titleSubtitleGap + 6,
    marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
  },
  chips: { direction: UI_DIR, flexDirection: 'row', gap: 6, marginBottom: 14 },
  donutRow: { direction: UI_DIR, flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 12 },
  legendRow: { direction: UI_DIR, flexDirection: 'row', alignItems: 'center', gap: 8 },
  panel: { borderRadius: UI_CARD_RADIUS, overflow: 'hidden' },
  // כמו Row בלוח הבקרה
  listRow: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: JOURNAL_LAYOUT.cardTitleToBodyGap,
    paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
    minHeight: 56,
    gap: 12,
  },
  listText: { flex: 1, gap: 6, alignItems: 'flex-start' },
  tickerLine: { direction: UI_DIR, flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalRow: {
    direction: UI_DIR,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  listValue: { gap: 6, alignItems: 'flex-end' },
  // כמו statRow ב-JournalStatsList (שורת תפריט בהגדרות)
  statRow: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
  },
  statTitle: { flex: 1, minWidth: 0, marginLeft: 12, alignItems: 'flex-end' },
  statIcon: { marginLeft: 12 },
});
