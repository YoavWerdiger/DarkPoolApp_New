/**
 * DarkPoolScreen.tsx
 * -----------------------------------------------------------------------------
 * מסך ה-Dark Pool הראשי — בנוי בסגנון InsiderWave (מבנה בלבד), בשפת העיצוב
 * הקיימת של האפליקציה (כהה, ירוק accent, RTL בעברית).
 *
 * סדר ה-sections (מלמעלה למטה):
 *   1. Tab Toggle (הכל / מעקב)
 *   2. Premium Lock (משתמש חינמי — כרטיס בולט עם CTA)
 *   3. LATEST TRADES (רכישות בכירים Form4Api עם since-trade %)
 *   4. Live Signals (Dark Pool signals — premium-gated)
 *   5. Top Accumulation (3D net flow — horizontal cards)
 *   6. Whale Orders (>$1M ב-24 שעות)
 *   7. Insider × Dark Pool Confluence (קונפלוונס מיוחד)
 *
 * רכיבים: ScreenChrome + MainDrawerScreenHeader + UICard, באותה DNA של שאר האפליקציה.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useDarkPoolFeed } from '../../hooks/useDarkPoolFeed';
import {
  useDarkPoolInsiderFeed,
  type DarkPoolFeedTab,
} from '../../hooks/useDarkPoolInsiderFeed';
import { DARK_POOL_PREMIUM_GATING_ENABLED } from '../../types/darkpool.types';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import { SignalCard } from './components/SignalCard';
import { WhaleCard } from './components/WhaleCard';
import { ConfluenceCard } from './components/ConfluenceCard';
import { AccumulationCard } from './components/AccumulationCard';
import { PremiumLockCard } from './components/PremiumLockCard';
import { DarkPoolSectionHeader } from './components/DarkPoolSectionHeader';
import { DarkPoolTabToggle } from './components/DarkPoolTabToggle';
import { InsiderTradeCard } from './components/InsiderTradeCard';

type Nav = NativeStackNavigationProp<DarkPoolStackParamList, 'DarkPoolHome'>;

export default function DarkPoolScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  const [tab, setTab] = useState<DarkPoolFeedTab>('all');

  const {
    liveSignals,
    topAccumulation,
    whaleOrders,
    confluence,
    loading,
    refreshing,
    error,
    isPremium,
    refetch,
  } = useDarkPoolFeed();

  const {
    trades: insiderTrades,
    loading: insiderLoading,
    refreshing: insiderRefreshing,
    error: insiderError,
    refetch: refetchInsider,
  } = useDarkPoolInsiderFeed({ tab });

  const handleTabChange = useCallback(
    (next: DarkPoolFeedTab) => {
      if (next === 'watchlist' && !isPremium) {
        goToSubscription();
        return;
      }
      setTab(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPremium]
  );

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const goToTicker = useCallback(
    (ticker: string) => {
      navigation.navigate('DarkPoolTicker', { ticker });
    },
    [navigation]
  );

  const goToSubscription = useCallback(() => {
    const root = navigation.getParent();
    try {
      (root as unknown as { navigate: (n: string, p?: unknown) => void } | null)?.navigate?.(
        'Profile',
        { screen: 'SubscriptionPlans' }
      );
    } catch {
      // noop
    }
  }, [navigation]);

  const styles = useMemo(() => createStyles(tokens, mainTabsHeight), [tokens, mainTabsHeight]);

  const isInitialLoading = loading && insiderLoading;
  const isRefreshing = refreshing || insiderRefreshing;
  const handleRefresh = useCallback(() => {
    void refetch();
    void refetchInsider();
  }, [refetch, refetchInsider]);

  if (isInitialLoading) {
    return (
      <ScreenChrome>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <MainDrawerScreenHeader title="Dark Pool" onMenuPress={openDrawer} />
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MainDrawerScreenHeader
          title="Dark Pool"
          subtitle={
            DARK_POOL_PREMIUM_GATING_ENABLED
              ? isPremium
                ? 'בזמן אמת · גישת פרימיום'
                : 'חינמי · השהייה של 15 דקות'
              : 'בזמן אמת · גישה מלאה'
          }
          onMenuPress={openDrawer}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={tokens.colors.primary.main}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ---------- Tab Toggle ---------- */}
          <DarkPoolTabToggle
            value={tab}
            onChange={handleTabChange}
            watchlistLocked={!isPremium}
          />

          {/* ---------- Error banner ---------- */}
          {error || insiderError ? (
            <UICard variant="outlined" padding="md" style={styles.errorCard}>
              <Text style={styles.errorText}>
                נתקלנו בבעיה בטעינת הנתונים. נסה שוב.
              </Text>
            </UICard>
          ) : null}

          {/* ---------- Premium Lock (לא פרימיום) ---------- */}
          {!isPremium ? (
            <View style={{ marginBottom: tokens.spacing.lg }}>
              <PremiumLockCard onPress={goToSubscription} />
            </View>
          ) : null}

          {/* ---------- Quick stats ---------- */}
          <View style={styles.statsRow}>
            <UICard variant="glass" glassIntensity="light" padding="md" style={styles.statCard}>
              <Text style={styles.statValue}>{insiderTrades.length}</Text>
              <Text style={styles.statLabel}>רכישות בכירים</Text>
            </UICard>
            <UICard variant="glass" glassIntensity="light" padding="md" style={styles.statCard}>
              <Text style={styles.statValue}>{whaleOrders.length}</Text>
              <Text style={styles.statLabel}>Whale orders</Text>
            </UICard>
            <UICard variant="glass" glassIntensity="light" padding="md" style={styles.statCard}>
              <Text style={[styles.statValue, { color: tokens.colors.primary.main }]}>
                {confluence.length}
              </Text>
              <Text style={styles.statLabel}>Confluence</Text>
            </UICard>
          </View>

          {/* ---------- LATEST TRADES (Form4Api) ---------- */}
          <View style={styles.section}>
            <DarkPoolSectionHeader
              title="LATEST TRADES"
              subtitle={
                tab === 'watchlist'
                  ? 'רכישות מטיקרים שאתה עוקב אחריהם'
                  : 'רכישות בכירים אחרונות (Form 4)'
              }
              icon="newspaper"
            />
            {insiderLoading ? (
              <View style={styles.sectionLoader}>
                <ActivityIndicator color={tokens.colors.primary.main} />
              </View>
            ) : insiderTrades.length === 0 ? (
              <EmptySection
                text={
                  tab === 'watchlist'
                    ? 'אין עדיין רכישות בטיקרים שאתה עוקב.'
                    : 'אין רכישות בכירים בזמן האחרון. נסה שוב מאוחר יותר.'
                }
              />
            ) : (
              insiderTrades.map((item) => (
                <InsiderTradeCard
                  key={item.trade.id}
                  item={item}
                  onPress={goToTicker}
                />
              ))
            )}
          </View>

          {/* ---------- Live Signals ---------- */}
          <View style={styles.section}>
            <DarkPoolSectionHeader
              title="Live Signals"
              subtitle={isPremium ? 'מתעדכן בזמן אמת' : 'מוצגים 3 הסיגנלים המובילים'}
              icon="pulse"
            />
            {liveSignals.length === 0 ? (
              <EmptySection text="לא זוהו סיגנלים פעילים כרגע. חזור עוד מעט." />
            ) : (
              liveSignals.map((it) => (
                <SignalCard key={it.signal.id} item={it} onPress={goToTicker} />
              ))
            )}
          </View>

          {/* ---------- Top Accumulation ---------- */}
          <View style={styles.section}>
            <DarkPoolSectionHeader
              title="Top Accumulation"
              subtitle="נטו 3 ימים אחרונים"
              icon="trending-up"
            />
            {topAccumulation.length === 0 ? (
              <EmptySection text="אין מספיק נתונים לחישוב צבירה ב-3 ימים." />
            ) : (
              <FlatList
                data={topAccumulation}
                keyExtractor={(r) => r.ticker}
                horizontal
                inverted
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
                renderItem={({ item }) => (
                  <AccumulationCard row={item} onPress={goToTicker} />
                )}
              />
            )}
          </View>

          {/* ---------- Whale Orders ---------- */}
          <View style={styles.section}>
            <DarkPoolSectionHeader
              title="Whale Orders"
              subtitle="הדפסות > $1M ב-24 שעות"
              icon="water"
            />
            {whaleOrders.length === 0 ? (
              <EmptySection text="לא נמצאו whale orders ב-24 שעות האחרונות." />
            ) : (
              whaleOrders.map((t) => (
                <WhaleCard key={t.id} trade={t} onPress={goToTicker} />
              ))
            )}
          </View>

          {/* ---------- Insider Confluence ---------- */}
          {confluence.length > 0 ? (
            <View style={styles.section}>
              <DarkPoolSectionHeader
                title="Insider Confluence"
                subtitle="קונפלוונס של רכישת בכיר + Dark Pool"
                icon="shield-checkmark"
              />
              {confluence.map((s) => (
                <ConfluenceCard key={s.id} signal={s} onPress={goToTicker} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function EmptySection({ text }: { text: string }) {
  const tokens = useDesignTokens();
  return (
    <UICard variant="glass" glassIntensity="subtle" padding="md">
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <Ionicons name="water-outline" size={22} color={tokens.colors.text.tertiary} />
        <Text
          style={{
            color: tokens.colors.text.tertiary,
            fontSize: 13,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}
        >
          {text}
        </Text>
      </View>
    </UICard>
  );
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  bottomPadding: number
) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: tokens.layout.screenPadding,
      paddingBottom: bottomPadding + 32,
      paddingTop: 6,
    },
    statsRow: {
      flexDirection: 'row-reverse',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.lg,
    },
    statCard: {
      flex: 1,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      letterSpacing: -0.5,
    },
    statLabel: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    section: {
      marginBottom: tokens.spacing.xl,
    },
    sectionLoader: {
      paddingVertical: tokens.spacing.lg,
      alignItems: 'center',
    },
    horizontalList: {
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    errorCard: {
      marginBottom: tokens.spacing.md,
      borderColor: tokens.colors.border.danger,
    },
    errorText: {
      color: tokens.colors.text.danger,
      fontSize: 13,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
