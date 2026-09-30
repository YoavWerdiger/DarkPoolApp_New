/**
 * טאב סקירה — מצב כללי של פיד הבכירים.
 */

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { UI_CARD_RADIUS } from '../../components/ui/appLayout';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useNavigation } from '@react-navigation/native';
import { useDarkPoolInsiderFeed } from '../../hooks/useDarkPoolInsiderFeed';
import { DARK_POOL_FORM4_ONLY } from '../../types/darkpool.types';
import { DARK_POOL_TYPE, darkPoolPhysicalRightText } from './darkPoolLayout';

export default function DarkPoolOverviewScreen() {
  const tokens = useDesignTokens();
  const drawerNav = useNavigation();
  const bottomPad = useDarkPoolTabBarHeight();
  const { trades, loading, refreshing, refetch } = useDarkPoolInsiderFeed({
    tab: 'all',
    limit: 100,
  });

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(drawerNav as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [drawerNav]);

  const stats = useMemo(() => {
    const tickers = new Set(trades.map((t) => t.trade.ticker));
    const withPhoto = trades.filter((t) => t.trade.insider_logo_url).length;
    const form4 = trades.filter((t) => t.trade.source === 'form4api').length;
    const uw = trades.filter((t) => t.trade.source === 'unusualwhales').length;
    return { total: trades.length, tickers: tickers.size, withPhoto, form4, uw };
  }, [trades]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { paddingHorizontal: tokens.layout.screenPadding, paddingBottom: bottomPad },
        grid: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: tokens.spacing.sm,
          marginTop: tokens.spacing.md,
        },
        hint: {
          ...darkPoolPhysicalRightText,
          marginTop: tokens.spacing.lg,
          fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
          lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
          fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
          color: tokens.colors.text.secondary,
          flex: 1,
        },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      }),
    [tokens, bottomPad]
  );

  if (loading && !trades.length) {
    return (
      <ScreenChrome>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
          <MainDrawerScreenHeader title="סקירה" onMenuPress={openDrawer} />
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <MainDrawerScreenHeader
          title="סקירה"
          subtitle="מצב פיד רכישות בכירים"
          onMenuPress={openDrawer}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refetch()}
              tintColor={tokens.colors.primary.main}
            />
          }
        >
          <View style={styles.grid}>
            <StatCard label="עסקאות בפיד" value={String(stats.total)} />
            <StatCard label="טיקרים" value={String(stats.tickers)} />
            <StatCard label="מ-Form4" value={String(stats.form4)} />
            <StatCard label="מ-UW" value={String(stats.uw)} />
            <StatCard label="עם תמונת בכיר" value={String(stats.withPhoto)} />
          </View>
          <UICard variant="soft" padding="md">
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sync-outline" size={18} color={tokens.colors.primary.main} />
              <Text style={styles.hint}>
                הנתונים מתעדכנים מהשרת כל שעה (Form4 + Unusual Whales). משוך למטה לרענון.
                {!DARK_POOL_FORM4_ONLY
                  ? ' במצב מלא יוצגו גם הדפסות Dark Pool וסיגנלים.'
                  : ''}
              </Text>
            </View>
          </UICard>
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="soft"
      glassIntensity="light"
      padding="md"
      style={{
        width: '48%',
        flexGrow: 1,
        borderRadius: UI_CARD_RADIUS,
        backgroundColor: 'transparent',
      }}
    >
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: DARK_POOL_TYPE.cardMetricValue.fontSize,
            lineHeight: DARK_POOL_TYPE.cardMetricValue.lineHeight,
            fontWeight: DARK_POOL_TYPE.cardMetricValue.fontWeight,
            color: tokens.colors.text.primary,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontSize: DARK_POOL_TYPE.cardMetricLabel.fontSize,
            lineHeight: DARK_POOL_TYPE.cardMetricLabel.lineHeight,
            fontWeight: DARK_POOL_TYPE.cardMetricLabel.fontWeight,
            color: tokens.colors.text.tertiary,
            textAlign: 'right',
          }}
        >
          {label}
        </Text>
      </View>
    </UICard>
  );
}
