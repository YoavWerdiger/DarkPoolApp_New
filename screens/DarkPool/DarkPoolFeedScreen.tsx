/**
 * פיד ראשי — קונגרס + בכירי חברות (Insider Wave style).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { TradeCardSkeleton } from '../../components/ui/SkeletonLoader';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { CongressTradeCard } from './components/CongressTradeCard';
import { InsiderTradeCard } from './components/InsiderTradeCard';
import { DarkPoolTabToggle } from './components/DarkPoolTabToggle';
import { useCongressFeed, loadCongress } from '../../hooks/useCongressFeed';
import { useDarkPoolInsiderFeed, loadInsider } from '../../hooks/useDarkPoolInsiderFeed';
import type { DarkPoolFeedTab } from '../../hooks/useDarkPoolInsiderFeed';
import {
  DARK_POOL_SEC_PRODUCTION,
  DARK_POOL_FEED_LIMIT,
  DARK_POOL_FEED_STALE_MS,
} from '../../types/darkpool.types';
import { prefetchTickerLogos } from '../../utils/prefetchTickerLogos';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DarkPoolTabParamList } from '../../navigation/DarkPoolTabs';
import type { CongressTradeFeedItem } from './utils/congressFeedCalc';
import type { InsiderTradeFeedItem } from './utils/insiderFeedCalc';
import { hebrewText, toDataIsland } from './utils/bidi';

type FeedRow =
  | { kind: 'congress'; key: string; item: CongressTradeFeedItem }
  | { kind: 'insider'; key: string; item: InsiderTradeFeedItem };

export default function DarkPoolFeedScreen() {
  const tokens = useDesignTokens();
  const navigation = useDarkPoolStackNav();
  const tabNav = useNavigation<BottomTabNavigationProp<DarkPoolTabParamList>>();
  const bottomPad = useDarkPoolTabBarHeight();
  const [segment, setSegment] = useState<DarkPoolFeedTab>(
    DARK_POOL_SEC_PRODUCTION ? 'all' : 'congress'
  );

  const congress = useCongressFeed(DARK_POOL_FEED_LIMIT, segment === 'congress');
  const insiders = useDarkPoolInsiderFeed({
    tab: 'all',
    limit: DARK_POOL_FEED_LIMIT,
    enabled: segment === 'all',
  });

  // Prefetch the other tab when switching
  const handleSegmentChange = useCallback((newSegment: DarkPoolFeedTab) => {
    setSegment(newSegment);
    // Prefetch the opposite tab's data
    if (newSegment === 'congress') {
      void queryClient.prefetchQuery({
        queryKey: appQueryKeys.insiderFeed('all', true, DARK_POOL_FEED_LIMIT),
        queryFn: () => loadInsider('all', DARK_POOL_FEED_LIMIT, true, false, {}),
        staleTime: DARK_POOL_FEED_STALE_MS,
      });
    } else {
      void queryClient.prefetchQuery({
        queryKey: appQueryKeys.congressFeed(DARK_POOL_FEED_LIMIT),
        queryFn: () => loadCongress(DARK_POOL_FEED_LIMIT, false, {}),
        staleTime: DARK_POOL_FEED_STALE_MS,
      });
    }
  }, []);

  const active = segment === 'congress' ? congress : insiders;
  const loading =
    active.loading &&
    (segment === 'congress' ? congress.trades.length === 0 : insiders.trades.length === 0);

  useEffect(() => {
    const tickers =
      segment === 'congress'
        ? congress.trades.map((t) => t.trade.ticker)
        : insiders.trades.map((t) => t.trade.ticker);
    prefetchTickerLogos(tickers);
  }, [segment, congress.trades, insiders.trades]);

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const openPolitician = useCallback(
    (politicianId: string, name?: string, image?: string | null) => {
      navigation.navigate('DarkPoolInvestor', {
        id: politicianId,
        kind: 'politician',
        nameHint: name,
        imageHint: image,
      });
    },
    [navigation]
  );

  const openInsider = useCallback(
    (personId: string, name: string, ticker: string) => {
      navigation.navigate('DarkPoolInvestor', {
        id: personId,
        kind: 'insider',
        ticker,
        nameHint: name,
      });
    },
    [navigation]
  );

  const openTradeDetail = useCallback(
    (trade: CongressTradeFeedItem['trade']) => {
      navigation.navigate('DarkPoolTradeDetail', { trade });
    },
    [navigation]
  );

  const goToExplore = useCallback(() => {
    tabNav.navigate('DarkPoolExplore');
  }, [tabNav]);

  const handleRefresh = useCallback(() => {
    if (segment === 'congress') {
      void congress.refetch();
    } else {
      void insiders.refetch();
    }
  }, [segment, congress, insiders]);

  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);

  const subtitle =
    segment === 'congress'
      ? `עסקאות קונגרס · ${toDataIsland('Quiver')} · כל ${toDataIsland('~20m')}`
      : `בכירים · ${toDataIsland('Quiver + Form 4')} · ${toDataIsland('3x')} ביום מסחר`;

  const rows = useMemo((): FeedRow[] => {
    if (segment === 'congress') {
      return congress.trades.map((item, index) => ({
        kind: 'congress' as const,
        key: `${item.trade.id}:${item.trade.filed_at}:${index}`,
        item,
      }));
    }
    return insiders.trades.map((item) => ({
      kind: 'insider' as const,
      key: `${item.trade.source}-${item.trade.id}`,
      item,
    }));
  }, [segment, congress.trades, insiders.trades]);

  const renderItem: ListRenderItem<FeedRow> = useCallback(
    ({ item: row }) =>
      row.kind === 'congress' ? (
        <CongressTradeCard
          item={row.item}
          onPersonPress={(pid) => {
            const t = row.item.trade;
            openPolitician(pid, t.politician_name, t.politician_image_url);
          }}
          onDetailPress={() => openTradeDetail(row.item.trade)}
        />
      ) : (
        <InsiderTradeCard
          item={row.item}
          onPersonPress={(personId, name) =>
            openInsider(personId, name, row.item.trade.ticker)
          }
        />
      ),
    [openPolitician, openInsider, openTradeDetail]
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <DarkPoolTabToggle
          value={segment}
          onChange={handleSegmentChange}
          hideWatchlist
          hideFollowing
        />
        {active.error ? (
          <UICard variant="glass" glassIntensity="light" padding="md" style={styles.errorCard}>
            <Text style={styles.errorText}>{active.error}</Text>
            <Text style={styles.errorHint}>משוך למטה לרענון.</Text>
          </UICard>
        ) : null}
      </View>
    ),
    [segment, active.error, styles]
  );

  const listEmpty = useMemo(() => {
    if (loading) return null;
    if (segment === 'congress') {
      return (
        <UICard variant="glass" glassIntensity="light" padding="lg" style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>אין עסקאות קונגרס</Text>
          <Text style={styles.emptyBody}>
            עדיין לא הגיעו דיווחי STOCK Act. משוך למטה לרענון — הנתונים מ־Quiver, מסונכרנים לשרת כל ~20 ד׳ (לא webhook חי).
          </Text>
          <Text style={styles.emptyLink} onPress={goToExplore}>
            חפש לוויתנים
          </Text>
        </UICard>
      );
    }
    return (
      <UICard variant="glass" glassIntensity="light" padding="lg" style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>אין רכישות בכירים</Text>
        <Text style={styles.emptyBody}>
          אין עדיין רכישות בכירים. משוך למטה לרענון — הנתונים מ־Quiver (+ Form 4 / SEC), מסונכרנים כמה פעמים ביום מסחר.
        </Text>
      </UICard>
    );
  }, [loading, segment, styles, goToExplore]);

  const loadingSkeleton = useMemo(() => {
    if (!loading || rows.length > 0) return null;
    return (
      <View style={styles.scrollContent}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TradeCardSkeleton key={i} delay={i * 70} />
        ))}
      </View>
    );
  }, [loading, rows.length, styles]);

  if (loading && rows.length === 0) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <MainDrawerScreenHeader
            inRtlTree
            title="Dark Pool"
            subtitle={subtitle}
            onMenuPress={openDrawer}
          />
          {loadingSkeleton}
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="Dark Pool"
          subtitle={subtitle}
          onMenuPress={openDrawer}
        />
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={active.refreshing}
              onRefresh={handleRefresh}
              tintColor={tokens.colors.primary.main}
            />
          }
        />
      </SafeAreaView>
    </ScreenChrome>
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
      paddingTop: 4,
      direction: 'rtl',
    },
    listHeader: {
      direction: 'rtl',
    },
    errorCard: {
      marginBottom: tokens.spacing.md,
      borderColor: tokens.colors.border.danger,
    },
    errorText: {
      ...hebrewText,
      color: tokens.colors.text.danger,
      fontSize: tokens.typography.subhead.size,
      lineHeight: tokens.typography.subhead.lineHeight,
      fontWeight: tokens.typography.fontWeight.bold,
      letterSpacing: tokens.typography.letterSpacing.normal,
    },
    errorHint: {
      ...hebrewText,
      marginTop: 8,
      fontSize: tokens.typography.footnote.size,
      lineHeight: tokens.typography.footnote.lineHeight,
      fontWeight: tokens.typography.footnote.weight,
      letterSpacing: tokens.typography.footnote.letterSpacing,
      color: tokens.colors.text.tertiary,
    },
    emptyCard: {
      marginTop: tokens.spacing.sm,
      alignItems: 'flex-end',
    },
    emptyTitle: {
      ...hebrewText,
      fontSize: tokens.typography.titleXs.size,
      lineHeight: tokens.typography.titleXs.lineHeight,
      fontWeight: tokens.typography.fontWeight.bold,
      letterSpacing: tokens.typography.letterSpacing.normal,
      color: tokens.colors.text.primary,
    },
    emptyBody: {
      ...hebrewText,
      marginTop: 8,
      fontSize: tokens.typography.subhead.size,
      lineHeight: tokens.typography.subhead.lineHeight,
      fontWeight: tokens.typography.subhead.weight,
      letterSpacing: tokens.typography.letterSpacing.normal,
      color: tokens.colors.text.secondary,
    },
    emptyLink: {
      ...hebrewText,
      marginTop: 14,
      fontSize: tokens.typography.subhead.size,
      lineHeight: tokens.typography.subhead.lineHeight,
      fontWeight: tokens.typography.fontWeight.bold,
      letterSpacing: tokens.typography.letterSpacing.normal,
      color: tokens.colors.primary.main,
    },
  });
}
