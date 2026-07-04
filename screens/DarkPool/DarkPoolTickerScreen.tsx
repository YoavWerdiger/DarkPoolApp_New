/**
 * מסך פירוט טיקר — Insider + Dark Pool (רק כשיש נתונים).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { MarketsSegmentedControl } from '../Markets/components/MarketsSegmentedControl';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { useDarkPoolTicker } from '../../hooks/useDarkPoolTicker';
import { useUwTickerInsights } from '../../hooks/useUwTickerInsights';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import { SignalCard } from './components/SignalCard';
import { WhaleCard } from './components/WhaleCard';
import { DarkPoolFlowChart } from './components/DarkPoolFlowChart';
import { AccumulationChart } from './components/AccumulationChart';
import { PremiumLockCard } from './components/PremiumLockCard';
import { DarkPoolSectionHeader } from './components/DarkPoolSectionHeader';
import { TickerScreenHero, type TickerHeroStat } from './components/TickerScreenHero';
import { TickerInsiderBuyRow } from './components/TickerInsiderBuyRow';
import { UwTickerInsightsSection } from './components/UwTickerInsightsSection';
import { formatUsdCompact } from './utils/darkPoolFormat';
import { DARK_POOL_FORM4_ONLY, DARK_POOL_VENDOR_LIVE_APIS } from '../../types/darkpool.types';

type Nav = NativeStackNavigationProp<DarkPoolStackParamList, 'DarkPoolTicker'>;
type RP = RouteProp<DarkPoolStackParamList, 'DarkPoolTicker'>;
type TabId = 'insider' | 'darkpool';

export default function DarkPoolTickerScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RP>();
  const mainTabsHeight = useMainTabsHeight();
  const ticker = (route.params?.ticker || '').toUpperCase();
  const [tab, setTab] = useState<TabId>('insider');

  const {
    aggregates,
    trades,
    signals,
    insiderBuys,
    loading,
    isPremium,
    isWatching,
    alertsOn,
    toggleWatch,
    setAlerts,
  } = useDarkPoolTicker(ticker);

  const { data: insights } = useUwTickerInsights(ticker);

  const hasDarkPoolData = useMemo(
    () =>
      trades.length > 0 ||
      signals.length > 0 ||
      aggregates.some((a) => (a.total_premium ?? 0) > 0),
    [trades.length, signals.length, aggregates]
  );

  const tabOptions = useMemo(() => {
    const opts: { id: TabId; label: string }[] = [{ id: 'insider', label: 'בכירים' }];
    if (!DARK_POOL_FORM4_ONLY && hasDarkPoolData) {
      opts.push({ id: 'darkpool', label: 'Dark Pool' });
    }
    return opts;
  }, [hasDarkPoolData]);

  useEffect(() => {
    const requested = route.params?.tab;
    if (requested === 'darkpool' && tabOptions.some((t) => t.id === 'darkpool')) {
      setTab('darkpool');
    } else {
      setTab('insider');
    }
  }, [route.params?.tab, tabOptions]);

  useEffect(() => {
    if (tab === 'darkpool' && !tabOptions.some((t) => t.id === 'darkpool')) {
      setTab('insider');
    }
  }, [tab, tabOptions]);

  const styles = useMemo(() => createStyles(tokens, mainTabsHeight), [tokens, mainTabsHeight]);

  const latestAgg = aggregates[aggregates.length - 1];
  const premiumToday =
    latestAgg && (latestAgg.total_premium ?? 0) > 0 ? latestAgg.total_premium : null;

  const companyName =
    insights?.form4_company?.name?.trim() ||
    insiderBuys.find((b) => b.company_name?.trim())?.company_name?.trim() ||
    null;

  const heroStats = useMemo((): TickerHeroStat[] => {
    const stats: TickerHeroStat[] = [];
    if (insights?.insider_sentiment) {
      const s = insights.insider_sentiment;
      stats.push({
        label: 'סנטימנט',
        value: s.score.toFixed(2),
        tone: s.score >= 0.2 ? 'positive' : s.score <= -0.2 ? 'negative' : 'default',
      });
    }
    if (insiderBuys.length > 0) {
      stats.push({
        label: 'עסקאות 90 יום',
        value: String(insiderBuys.length),
      });
    }
    if (insights?.form4_company?.active_insiders) {
      stats.push({
        label: 'בכירים פעילים',
        value: String(insights.form4_company.active_insiders),
        tone: 'muted',
      });
    }
    return stats.slice(0, 3);
  }, [insights, insiderBuys.length]);

  const goToSubscription = useCallback(() => {
    const root = navigation.getParent();
    try {
      (root as unknown as { navigate: (n: string, p?: unknown) => void } | null)?.navigate?.(
        'Profile',
        { screen: 'SubscriptionPlans' }
      );
    } catch {
      /* noop */
    }
  }, [navigation]);

  if (loading) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  const hasChartData = aggregates.some((a) => (a.total_premium ?? 0) > 0);

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.goBack();
            }}
            style={styles.iconBtn}
            hitSlop={12}
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </Pressable>
          <Pressable
            onPress={() => {
              void HapticFeedback.selection();
              void toggleWatch();
            }}
            style={styles.iconBtn}
            hitSlop={12}
            accessibilityLabel={isWatching ? 'הסר ממעקב' : 'הוסף למעקב'}
          >
            <Ionicons
              name={isWatching ? 'star' : 'star-outline'}
              size={22}
              color={
                isWatching ? tokens.colors.primary.main : tokens.colors.text.primary
              }
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TickerScreenHero
            ticker={ticker}
            companyName={companyName}
            sector={insights?.form4_company?.sector}
            stats={heroStats}
            premiumToday={premiumToday}
          />

          {tabOptions.length > 1 ? (
            <View style={styles.tabBar}>
              <UICard variant="glass" glassIntensity="light" padding="none" style={styles.tabCard}>
                <MarketsSegmentedControl
                  options={tabOptions}
                  value={tab}
                  onChange={(v) => setTab(v as TabId)}
                  accessibilityGroupLabel="לשוניות מניה"
                  containerDirection="row"
                  segmentAccessibilityRole="tab"
                />
              </UICard>
            </View>
          ) : null}

          {tab === 'insider' ? (
            <InsiderTab ticker={ticker} insiderBuys={insiderBuys} />
          ) : (
            <DarkPoolTab
              aggregates={aggregates}
              trades={trades}
              signals={signals}
              hasChartData={hasChartData}
              isPremium={isPremium}
              isWatching={isWatching}
              alertsOn={alertsOn}
              onSubscribe={goToSubscription}
              onToggleAlerts={() => void setAlerts(!alertsOn)}
              styles={styles}
              tokens={tokens}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function InsiderTab({
  ticker,
  insiderBuys,
}: {
  ticker: string;
  insiderBuys: ReturnType<typeof useDarkPoolTicker>['insiderBuys'];
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => insiderTabStyles(tokens), [tokens]);

  return (
    <View style={styles.wrap}>
      {DARK_POOL_VENDOR_LIVE_APIS ? <UwTickerInsightsSection ticker={ticker} /> : null}

      {insiderBuys.length > 0 ? (
        <View style={styles.section}>
          <DarkPoolSectionHeader
            title="היסטוריית Form 4"
            subtitle={`${insiderBuys.length} עסקאות ב-90 יום האחרונים`}
            icon="document-text-outline"
          />
          {insiderBuys.map((item) => (
            <TickerInsiderBuyRow key={item.id} item={item} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DarkPoolTab({
  aggregates,
  trades,
  signals,
  hasChartData,
  isPremium,
  isWatching,
  alertsOn,
  onSubscribe,
  onToggleAlerts,
  styles,
  tokens,
}: {
  aggregates: ReturnType<typeof useDarkPoolTicker>['aggregates'];
  trades: ReturnType<typeof useDarkPoolTicker>['trades'];
  signals: ReturnType<typeof useDarkPoolTicker>['signals'];
  hasChartData: boolean;
  isPremium: boolean;
  isWatching: boolean;
  alertsOn: boolean;
  onSubscribe: () => void;
  onToggleAlerts: () => void;
  styles: ReturnType<typeof createStyles>;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  return (
    <View>
      {hasChartData ? (
        <>
          <UICard variant="glass" glassIntensity="light" padding="md" style={styles.chartCard}>
            <DarkPoolSectionHeader title="צבירה מצטברת" icon="trending-up-outline" />
            <AccumulationChart data={aggregates} />
          </UICard>

          <UICard variant="glass" glassIntensity="light" padding="md" style={styles.chartCard}>
            <DarkPoolSectionHeader title="קניות מול מכירות" icon="swap-horizontal-outline" />
            <DarkPoolFlowChart data={aggregates} />
          </UICard>

          <UICard variant="glass" glassIntensity="light" padding="md" style={styles.chartCard}>
            <DarkPoolSectionHeader title="Premium יומי" icon="calendar-outline" />
            <PremiumHistoryList data={aggregates} />
          </UICard>
        </>
      ) : null}

      {signals.length > 0 ? (
        <View style={styles.section}>
          <DarkPoolSectionHeader title="סיגנלים" icon="radio-outline" />
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              item={{ signal: s, latestTrade: null, insiderHint: null }}
            />
          ))}
        </View>
      ) : null}

      {trades.length > 0 ? (
        <View style={styles.section}>
          <DarkPoolSectionHeader title="הדפסות אחרונות" icon="water-outline" />
          {trades.slice(0, 10).map((t) => (
            <WhaleCard key={t.id} trade={t} />
          ))}
        </View>
      ) : null}

      {!isPremium ? (
        <View style={{ marginTop: 4 }}>
          <PremiumLockCard variant="inline" onPress={onSubscribe} />
        </View>
      ) : null}

      {isWatching ? (
        <TouchableOpacity
          style={[styles.alertsRow, { borderColor: tokens.colors.border.subtle }]}
          onPress={() => {
            void HapticFeedback.selection();
            onToggleAlerts();
          }}
          activeOpacity={0.9}
        >
          <Ionicons
            name={alertsOn ? 'notifications' : 'notifications-off-outline'}
            size={20}
            color={
              alertsOn ? tokens.colors.primary.main : tokens.colors.text.tertiary
            }
          />
          <Text style={[styles.alertsRowText, { color: tokens.colors.text.primary }]}>
            {alertsOn ? 'התראות פעילות' : 'הפעל התראות'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PremiumHistoryList({
  data,
}: {
  data: ReturnType<typeof useDarkPoolTicker>['aggregates'];
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => premiumListStyles(tokens), [tokens]);
  const recent = data
    .filter((d) => (d.total_premium ?? 0) > 0)
    .slice(-7)
    .reverse();
  if (!recent.length) return null;

  return (
    <View>
      {recent.map((d, i) => (
        <View
          key={d.date}
          style={[styles.row, i === recent.length - 1 && styles.rowLast]}
        >
          <Text style={styles.date}>{formatDisplayDate(d.date)}</Text>
          <Text style={styles.value}>{formatUsdCompact(d.total_premium)}</Text>
        </View>
      ))}
    </View>
  );
}

function formatDisplayDate(iso: string): string {
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function insiderTabStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: { gap: 4 },
    section: { marginTop: tokens.spacing.md },
  });
}

function premiumListStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.subtle,
    },
    rowLast: { borderBottomWidth: 0 },
    date: {
      fontSize: 13,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
      writingDirection: 'ltr',
    },
    value: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
  });
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  bottomPadding: number
) {
  return StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 4,
      paddingBottom: 0,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBar: {
      marginBottom: tokens.spacing.md,
    },
    tabCard: {
      borderRadius: tokens.borderRadius['3xl'],
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      overflow: 'hidden',
    },
    scrollContent: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: tokens.spacing.sm,
      paddingBottom: bottomPadding + 32,
    },
    chartCard: {
      marginBottom: tokens.spacing.md,
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    section: {
      marginTop: tokens.spacing.md,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertsRow: {
      marginTop: tokens.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
    },
    alertsRowText: {
      fontSize: 14,
      fontWeight: '700',
      writingDirection: 'rtl',
    },
  });
}
