import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { UI_DIR } from '../../../lib/i18n/direction';
import i18n from '../../../lib/i18n';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { DARK_POOL_TYPE, darkPoolPhysicalRightText, darkPoolSectionTitleStyle } from '../darkPoolLayout';
import { toDataIsland } from '../utils/bidi';
import type { TrumpActivitySummary, TrumpTickerActivity } from '../../../services/darkpool/portfolioMetricsTypes';

/**
 * טראמפ: פעילות מסחר מדווחת (OGE 278-T) — לא «שווי תיק».
 * הדיווח הוא עסקאות בטווחי סכום בלי יתרת פתיחה, ולכן שחזור תיק מהן שגוי; מציגים רק את מה שמדווח.
 */
function fmtUsd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}
const fmtRange = (r: { low: number; high: number }) => `${fmtUsd(r.low)}–${fmtUsd(r.high)}`;
const HE_MONTHS = [i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s1'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s2'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s3'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s4'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s5'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s6'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s7'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s8'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s9'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s10'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s11'), i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s12')];
const fmtDate = (d: string) => d.split('-').reverse().join('.');

type Tab = 'bought' | 'sold' | 'active';

export function TrumpActivitySection({
  activity,
  onTickerPress,
}: {
  activity: TrumpActivitySummary;
  onTickerPress?: (ticker: string) => void;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [tab, setTab] = useState<Tab>('bought');
  const maxMonth = Math.max(1, ...activity.monthly.map((m) => Math.max(m.buys, m.sells)));
  const list: TrumpTickerActivity[] =
    tab === 'bought' ? activity.top_bought : tab === 'sold' ? activity.top_sold : activity.most_active;
  const buyColor = tokens.colors.text.success;
  const sellColor = tokens.colors.text.danger;

  return (
    <View>
      {/* סיכום */}
      <Text style={styles.label}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s13')}</Text>
      <Text style={styles.period}>{toDataIsland(`${fmtDate(activity.from)} – ${fmtDate(activity.to)}`)}</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{toDataIsland(activity.trade_count.toLocaleString('en-US'))}</Text>
          <Text style={styles.statLabel}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s14')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: buyColor }]}>{toDataIsland(activity.buys.toLocaleString('en-US'))}</Text>
          <Text style={styles.statLabel}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s15')}</Text>
          <Text style={styles.statSub}>{toDataIsland(fmtRange(activity.buy))}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: sellColor }]}>{toDataIsland(activity.sells.toLocaleString('en-US'))}</Text>
          <Text style={styles.statLabel}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s16')}</Text>
          <Text style={styles.statSub}>{toDataIsland(fmtRange(activity.sell))}</Text>
        </View>
      </View>
      <Text style={styles.note}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s17')}</Text>

      {/* לפי חודש */}
      <Text style={styles.sectionTitle}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s18')}</Text>
      <UICard variant="soft" padding="md" style={styles.card}>
        {activity.monthly.map((m) => (
          <View key={m.month} style={styles.monthRow}>
            <Text style={styles.monthLabel}>{HE_MONTHS[Number(m.month.slice(5, 7)) - 1] ?? m.month}</Text>
            <View style={styles.bars}>
              <View style={styles.barLine}>
                <View style={[styles.bar, { width: `${(m.buys / maxMonth) * 100}%`, backgroundColor: buyColor }]} />
                <Text style={styles.barCount}>{m.buys}</Text>
              </View>
              <View style={styles.barLine}>
                <View style={[styles.bar, { width: `${(m.sells / maxMonth) * 100}%`, backgroundColor: sellColor }]} />
                <Text style={styles.barCount}>{m.sells}</Text>
              </View>
            </View>
          </View>
        ))}
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: buyColor }]} />
          <Text style={styles.legendText}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s15')}</Text>
          <View style={[styles.legendDot, { backgroundColor: sellColor, marginRight: 12 }]} />
          <Text style={styles.legendText}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s16')}</Text>
        </View>
      </UICard>

      {/* מניות */}
      <Text style={styles.sectionTitle}>{i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s19')}</Text>
      <SegmentedTabs
        options={[
          { id: 'bought' as Tab, label: i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s20') },
          { id: 'sold' as Tab, label: i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s21') },
          { id: 'active' as Tab, label: i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s22') },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.segmentedTabs}
      />
      <UICard variant="soft" padding="none" style={styles.card}>
        {list.slice(0, 10).map((t, i) => {
          const range = tab === 'sold' ? t.sell : tab === 'bought' ? t.buy : null;
          return (
            <Pressable
              key={`${t.ticker}:${i}`}
              onPress={onTickerPress ? () => onTickerPress(t.ticker) : undefined}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: tokens.colors.border.divider }]}
            >
              <TickerLogo symbol={t.ticker} size={32} />
              <View style={styles.rowText}>
                <Text style={styles.rowTicker}>{t.ticker}</Text>
                <Text style={styles.rowSub}>
                  {tab === 'active'
                    ? i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s23', { v0: t.buys, v1: t.sells })
                    : tab === 'bought'
                      ? i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s24', { v0: t.buys })
                      : i18n.t('auto.screens__DarkPool__components__TrumpActivitySection.s25', { v0: t.sells })}
                </Text>
              </View>
              <Text style={[styles.rowAmount, range ? { color: tab === 'sold' ? sellColor : buyColor } : null]}>
                {range ? toDataIsland(fmtRange(range)) : toDataIsland(fmtDate(t.last_date))}
              </Text>
            </Pressable>
          );
        })}
      </UICard>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    segmentedTabs: { marginBottom: 12 },
    label: {
      ...APP_TYPE.cardSubtitle,
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.secondary,
    },
    period: {
      ...APP_TYPE.cardTitle,
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.primary,
      marginTop: 2,
    },
    statsRow: {
      direction: UI_DIR,
      flexDirection: 'row',
      gap: APP_LAYOUT.stackGapSmall,
      marginTop: APP_LAYOUT.componentGap,
    },
    stat: {
      flex: 1,
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: tokens.colors.background.cardSolid,
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
    },
    statSub: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      color: tokens.colors.text.tertiary,
      fontVariant: ['tabular-nums'],
    },
    note: {
      ...APP_TYPE.cardSubtitle,
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.tertiary,
      marginTop: APP_LAYOUT.stackGapSmall,
    },
    sectionTitle: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
      marginTop: APP_LAYOUT.sectionGap,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
    card: {
      borderRadius: UI_CARD_RADIUS,
    },
    monthRow: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 5,
    },
    monthLabel: {
      width: 40,
      ...APP_TYPE.cardSubtitle,
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.secondary,
    },
    bars: {
      flex: 1,
      gap: 3,
    },
    barLine: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    bar: {
      height: 7,
      borderRadius: 4,
      minWidth: 2,
    },
    barCount: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      color: tokens.colors.text.tertiary,
      fontVariant: ['tabular-nums'],
    },
    legend: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      color: tokens.colors.text.secondary,
    },
    tabs: {
      direction: UI_DIR,
      flexDirection: 'row',
      borderRadius: 999,
      padding: 4,
      marginBottom: APP_LAYOUT.stackGapSmall,
      backgroundColor: tokens.colors.background.tertiary,
    },
    tab: {
      flex: 1,
      minHeight: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabText: {
      fontSize: APP_TYPE.cardSubtitle.fontSize,
      fontVariant: ['tabular-nums'],
      fontWeight: '600',
    },
    row: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: APP_LAYOUT.cardPadding,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    rowTicker: {
      ...APP_TYPE.cardTitle,
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.primary,
    },
    rowSub: {
      ...APP_TYPE.cardSubtitle,
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.secondary,
    },
    rowAmount: {
      ...APP_TYPE.cardSubtitle,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
      fontVariant: ['tabular-nums'],
    },
  });
}
