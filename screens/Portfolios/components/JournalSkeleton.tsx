import { UI_DIR } from '../../../lib/i18n/direction';
/**
 * יומן מסחר בטעינה — אותו מבנה כמו המסך האמיתי (PortfolioDetailScreen + OverviewTab + JournalDashboard),
 * כך שכשהתוכן מגיע רק הנתונים מתחלפים ושום דבר לא קופץ:
 *  - סרגלי הטאבים הם הרכיב האמיתי (SegmentedTabs) עם אותן אפשרויות ושוליים;
 *  - כל שורת טקסט היא «שורה» בגובה ה-lineHeight האמיתי, עם צורת טעינה בתוכה — כך הגבהים והמרווחים זהים;
 *  - טקסט קבוע (טאבים, כותרות סקשנים) מוצג כמו שהוא; רק הנתונים (מספרים, טיקרים, תוויות מהשרת) הם צורות טעינה.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '../../../lib/i18n';
import UICard from '../../../components/ui/UICard';
import { LineChartSkeleton, SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCardTitleStyle,
  journalPhysicalRightText,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';
import { ArrowLeftRight, PieChart, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react-native';
import { DISTRIBUTION_GROUP_BY_OPTIONS, PORTFOLIO_DETAIL_TABS } from '../portfolioConstants';

const noop = () => {};

/** שורות הסטטיסטיקה — אותו סדר, אייקון ותווית כמו JournalStatsCard */
const STAT_ROWS = [
  { icon: PieChart, key: 's5' },
  { icon: ArrowLeftRight, key: 's6' },
  { icon: TrendingUp, key: 's7' },
  { icon: TrendingDown, key: 's8' },
  { icon: Scale, key: 's9' },
  { icon: Wallet, key: 's10' },
] as const;

/** גובה גרף הסקירה (HERO_CHART_HEIGHT ב-OverviewTab) ומספר כפתורי התקופה */
const HERO_CHART_HEIGHT = 220;
const CHART_PERIODS = 7;

/** שורת טקסט: תופסת בדיוק lineHeight, והצורה ממורכזת בה אנכית */
function SkLine({
  lineHeight,
  width,
  box,
  delay,
  end,
}: {
  lineHeight: number;
  width: number | `${number}%`;
  /** גובה הצורה (ברירת מחדל ~70% מהשורה) */
  box?: number;
  delay?: number;
  /** הצמדה לקצה הנגדי (ערכים בצד השני של השורה) */
  end?: boolean;
}) {
  const h = box ?? Math.round(lineHeight * 0.7);
  return (
    <View style={{ height: lineHeight, justifyContent: 'center', alignItems: end ? 'flex-end' : 'flex-start' }}>
      <SkeletonBox width={width} height={h} borderRadius={Math.min(8, h / 2)} delay={delay} />
    </View>
  );
}

/**
 * בלוק השווי בזמן טעינה — שלושה חלקים נפרדים באותן מידות של OverviewTab
 * (heroNumberWrap + heroValue, deltaRow, chartWrap + PortfolioValueChart).
 * נפרדים כי השווי החי מגיע לפני הגרף: כל חלק אמיתי מחליף רק את הצורה שלו, במקומה.
 */
export function JournalHeroValueSkeleton() {
  return (
    // heroNumberWrap.marginTop + heroValue.marginTop
    <View style={{ marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap * 2 }} pointerEvents="none">
      <SkLine lineHeight={JOURNAL_TYPE.cardMetricValue.lineHeight} width={170} box={26} />
    </View>
  );
}

export function JournalHeroDeltaSkeleton() {
  return (
    <View style={styles.deltaRow} pointerEvents="none">
      <SkLine lineHeight={JOURNAL_TYPE.cardBody.lineHeight} width={124} box={13} />
    </View>
  );
}

export function JournalHeroChartSkeleton() {
  return (
    <View style={styles.chartWrap} pointerEvents="none">
      <LineChartSkeleton height={HERO_CHART_HEIGHT} periods={CHART_PERIODS} />
    </View>
  );
}

export function JournalSkeleton() {
  const tokens = useDesignTokens();
  const divider = { height: 1, backgroundColor: tokens.colors.border.divider, marginHorizontal: JOURNAL_LAYOUT.cardPadding };
  // כותרות הסקשנים קבועות — טקסט אמיתי באותו סגנון; רק הנתונים הם צורות טעינה
  const heading = (title: string) => (
    <Text style={[journalSectionTitleStyle, { color: tokens.colors.text.primary }]} numberOfLines={1}>
      {title}
    </Text>
  );

  /**
   * פאנל רשימה כמו JournalDashboard:
   *  withSub — פוזיציות פתוחות (HoldingsListRow: טיקר + חלק מהתיק · שווי + תשואה)
   *  בלי — עסקאות אחרונות (Row: טיקר + תגית · רווח/הפסד)
   */
  const listPanel = (count: number, withSub: boolean, delay: number) => (
    <View style={styles.section}>
      <View style={styles.headingWrap}>{heading(i18n.t(withSub ? 'auto.screens__Portfolios__components__JournalDashboard.s1' : 'auto.screens__Portfolios__components__JournalDashboard.s2'))}</View>
      <UICard variant="soft" glassIntensity="light" padding="none" style={styles.panel}>
        {Array.from({ length: count }, (_, i) => {
          const d = delay + i * 60;
          return (
            <React.Fragment key={i}>
              <View style={styles.listRow}>
                <SkeletonBox width={36} height={36} borderRadius={18} delay={d} />
                <View style={styles.listText}>
                  <View style={styles.tickerLine}>
                    <SkLine lineHeight={JOURNAL_TYPE.cardBody.lineHeight} width={52} box={14} delay={d} />
                    {withSub ? null : <SkeletonBox width={34} height={16} borderRadius={8} delay={d} />}
                  </View>
                  {withSub ? (
                    <View style={styles.subLine}>
                      <SkLine lineHeight={JOURNAL_TYPE.caption.lineHeight} width={40} box={10} delay={d} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.listValue}>
                  <SkLine lineHeight={JOURNAL_TYPE.cardBody.lineHeight} width={68} box={14} delay={d} end />
                  {withSub ? (
                    <View style={styles.subLine}>
                      <SkLine lineHeight={JOURNAL_TYPE.caption.lineHeight} width={44} box={10} delay={d} end />
                    </View>
                  ) : null}
                </View>
              </View>
              {i < count - 1 ? <View style={divider} /> : null}
            </React.Fragment>
          );
        })}
      </UICard>
    </View>
  );

  return (
    <View pointerEvents="none">
      {/* סרגל הטאבים האמיתי — אותו רכיב ושוליים כמו ב-PortfolioDetailScreen (styles.segmentedTabs) */}
      <SegmentedTabs options={PORTFOLIO_DETAIL_TABS} value="overview" onChange={noop} haptic={false} style={styles.tabs} />

      {/* כמו עטיפת התוכן ב-PortfolioDetailScreen */}
      <View style={styles.content}>
        {/* שווי תיק + גרף — heroBlock */}
        <View style={styles.section}>
          {heading(i18n.t('auto.screens__Portfolios__tabs__OverviewTab.s14'))}
          <JournalHeroValueSkeleton />
          <JournalHeroDeltaSkeleton />
          <JournalHeroChartSkeleton />
        </View>

        {/* חלוקת נכסים — sectionBlock: כותרת, סרגל הקיבוץ האמיתי, כרטיס דונאט */}
        <View style={styles.section}>
          <View style={styles.headingWrap}>{heading(i18n.t('auto.screens__Portfolios__tabs__OverviewTab.s19'))}</View>
          <SegmentedTabs
            options={DISTRIBUTION_GROUP_BY_OPTIONS}
            value="symbol"
            onChange={noop}
            haptic={false}
            style={styles.groupTabs}
          />
          <UICard variant="soft" padding="md" style={styles.panelMd}>
            <View style={styles.donutRow}>
              <SkeletonBox width={128} height={128} borderRadius={64} />
              <View style={styles.legend}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.legendRow}>
                    <SkeletonBox width={10} height={10} borderRadius={5} />
                    <View style={{ flex: 1 }}>
                      <SkLine lineHeight={15} width="60%" box={11} />
                    </View>
                    <SkLine lineHeight={15} width={30} box={11} />
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.totalRow}>
              <SkLine lineHeight={18} width={70} box={12} />
              <SkLine lineHeight={18} width={84} box={14} />
            </View>
          </UICard>
        </View>

        {listPanel(3, true, 0)}
        {listPanel(3, false, 120)}

        {/* סטטיסטיקה — JournalStatsList: ערך משמאל · כותרת · אייקון מימין, 6 שורות */}
        <View style={styles.section}>
          <View style={styles.headingWrap}>{heading(i18n.t('auto.screens__Portfolios__components__JournalDashboard.s11'))}</View>
          <UICard variant="soft" glassIntensity="light" padding="none" style={styles.panel}>
            {STAT_ROWS.map(({ icon: Icon, key }, i, arr) => (
              <React.Fragment key={key}>
                {/* כותרת ואייקון קבועים — רק הערך נטען */}
                <View style={styles.statRow}>
                  <SkLine lineHeight={JOURNAL_TYPE.cardTitle.lineHeight} width={56} box={14} delay={i * 50} />
                  <Text style={[styles.statTitle, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                    {i18n.t(`auto.screens__Portfolios__components__JournalDashboard.${key}`)}
                  </Text>
                  <View style={styles.statIcon}>
                    <Icon size={20} color={tokens.colors.text.primary} strokeWidth={2} />
                  </View>
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
  // = segmentedTabs ב-PortfolioDetailScreen
  tabs: { marginHorizontal: 16, marginTop: 6, marginBottom: 2 },
  // = עטיפת התוכן ב-PortfolioDetailScreen
  content: { paddingHorizontal: 16, paddingTop: 14, direction: UI_DIR },
  // = heroBlock / sectionBlock / Section (marginBottom: sectionGap)
  section: { marginBottom: JOURNAL_LAYOUT.sectionGap, direction: UI_DIR },
  headingWrap: { marginBottom: JOURNAL_LAYOUT.sectionHeaderToContent },
  // = deltaRow ב-OverviewTab
  deltaRow: { marginTop: JOURNAL_LAYOUT.titleSubtitleGap, marginBottom: JOURNAL_LAYOUT.sectionHeaderToContent },
  // = chartWrap ב-OverviewTab
  chartWrap: { marginTop: JOURNAL_LAYOUT.stackGapSmall, alignSelf: 'stretch' },
  // = groupTabs ב-OverviewTab
  groupTabs: { marginBottom: 14 },
  panelMd: { overflow: 'hidden', direction: UI_DIR },
  donutRow: { direction: UI_DIR, flexDirection: 'row', alignItems: 'center', gap: JOURNAL_LAYOUT.componentGap },
  legend: { flex: 1, gap: JOURNAL_LAYOUT.stackGapSmall },
  legendRow: { direction: UI_DIR, flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalRow: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  panel: { borderRadius: UI_CARD_RADIUS, overflow: 'hidden' },
  // = row ב-JournalDashboard / holdingRow ב-HoldingsListRow
  listRow: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: JOURNAL_LAYOUT.cardTitleToBodyGap,
    paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
    minHeight: 56,
    gap: 12,
  },
  listText: { flex: 1, minWidth: 0 },
  tickerLine: { direction: UI_DIR, flexDirection: 'row', alignItems: 'center', gap: 6 },
  subLine: { marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap },
  listValue: { flexShrink: 0 },
  // = statRow ב-JournalStatsList (שורת תפריט בהגדרות)
  statRow: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
  },
  // = statTitle ב-JournalStatsList
  statTitle: { ...journalCardTitleStyle, ...journalPhysicalRightText, flex: 1, minWidth: 0, marginLeft: 12 },
  statIcon: { marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
});
