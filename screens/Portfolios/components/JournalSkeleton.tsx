/**
 * יומן מסחר בטעינה — אותו מבנה כמו המסך האמיתי (PortfolioDetailScreen + OverviewTab):
 * צ׳יפי הטאבים האמיתיים, כרטיס שווי עם גרף, כרטיס פילוח עם דונאט ושורת כרטיסי מדדים.
 * רק התוכן בתוך הכרטיסים «נטען» — כשהנתונים מגיעים הם פשוט מחליפים אותו במקום.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { SlidingPillGroup } from '../../../components/ui/DayDividerPill';
import { LineChartSkeleton, SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { PORTFOLIO_DETAIL_TABS } from '../portfolioConstants';

export function JournalSkeleton() {
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
        {/* שווי + גרף */}
        <UICard variant="soft" padding="md">
          <SkeletonBox width={90} height={12} borderRadius={6} />
          <SkeletonBox width={190} height={30} borderRadius={8} style={styles.mt10} />
          <SkeletonBox width={120} height={12} borderRadius={6} style={styles.mt10} />
          <View style={styles.mt16}>
            <LineChartSkeleton height={200} periods={6} />
          </View>
        </UICard>

        {/* פילוח */}
        <UICard variant="soft" padding="md" style={styles.mt16}>
          <SkeletonBox width={110} height={16} borderRadius={6} />
          <View style={[styles.row, styles.mt12]}>
            {[64, 72, 58].map((w, i) => (
              <SkeletonBox key={i} width={w} height={30} borderRadius={15} />
            ))}
          </View>
          <View style={[styles.donutRow, styles.mt16]}>
            <SkeletonBox width={140} height={140} borderRadius={70} />
            <View style={styles.legend}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBox key={i} width="85%" height={12} borderRadius={6} />
              ))}
            </View>
          </View>
        </UICard>

        {/* כרטיסי מדדים */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, styles.mt16]}>
          {[0, 1, 2].map((i) => (
            <UICard key={i} variant="soft" padding="md" style={styles.metricCard}>
              <View style={styles.metricInner}>
                <SkeletonBox width={44} height={44} borderRadius={22} />
                <View style={styles.metricText}>
                  <SkeletonBox width="70%" height={11} borderRadius={6} />
                  <SkeletonBox width="50%" height={18} borderRadius={6} />
                </View>
              </View>
            </UICard>
          ))}
        </ScrollView>
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
  metricCard: { width: 220 },
  metricInner: { direction: 'rtl', flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricText: { flex: 1, gap: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
});
