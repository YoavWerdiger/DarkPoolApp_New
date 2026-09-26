/**
 * טאב פיד — עסקאות ממוזגות (קונגרס + Form 4).
 * גילוי לוויתנים בטאב גילוי; מעקב בטאב מעקב.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import { DayDividerPill } from '../../components/ui/DayDividerPill';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { TradeCardSkeleton } from '../../components/ui/SkeletonLoader';
import { curatedCeoPortraitUrl } from './utils/executivePortraitUrls';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import type { DarkPoolTabParamList } from '../../navigation/DarkPoolTabs';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { CongressTradeCard } from './components/CongressTradeCard';
import { InsiderTradeCard } from './components/InsiderTradeCard';
import {
  FEED_LIST_CHIPS_TO_CARDS,
  FEED_LIST_GUTTER,
  FEED_LIST_TITLE_TO_CHIPS,
} from './components/darkPoolFeedCardStyles';
import { useCongressFeed } from '../../hooks/useCongressFeed';
import { useDarkPoolInsiderFeed } from '../../hooks/useDarkPoolInsiderFeed';
import { useFeedQuotesCache } from '../../hooks/useFeedQuotesCache';
import type { CongressTradeFeedItem } from './utils/congressFeedCalc';
import type { InsiderTradeFeedItem } from './utils/insiderFeedCalc';
import { DARK_POOL_FEED_LIMIT } from '../../types/darkpool.types';
import { prefetchTickerLogos } from '../../utils/prefetchTickerLogos';
import { prefetchPersonPortfolio } from '../../services/darkpool/prefetchPersonPortfolio';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
  darkPoolRtlContent,
  darkPoolSectionTitleStyle,
  darkPoolTransparentFill,
} from './darkPoolLayout';
import {
  congressTradeDetailParams,
  insiderTradeDetailParams,
} from './utils/tradeDetailParams';
import {
  FEED_RECENT_KIND_CHIPS,
  FEED_RECENT_KIND_DEFAULT,
  matchesFeedRecentKind,
  type FeedRecentKind,
} from './utils/feedRecentKind';

const FEED_INITIAL_RENDER = 8;
const FEED_MAX_BATCH = 6;
const FEED_WINDOW_SIZE = 7;

type FeedRow =
  | { kind: 'congress'; key: string; sortAt: number; item: CongressTradeFeedItem }
  | { kind: 'insider'; key: string; sortAt: number; item: InsiderTradeFeedItem };

export default function DarkPoolHomeScreen() {
  const tokens = useDesignTokens();
  const navigation = useDarkPoolStackNav();
  const tabNav = useNavigation<BottomTabNavigationProp<DarkPoolTabParamList>>();
  const bottomPad = useDarkPoolTabBarHeight();

  const [recentKind, setRecentKind] = useState<FeedRecentKind>(FEED_RECENT_KIND_DEFAULT);
  const congress = useCongressFeed(DARK_POOL_FEED_LIMIT, true);
  const insiders = useDarkPoolInsiderFeed({
    tab: 'all',
    limit: DARK_POOL_FEED_LIMIT,
    enabled: true,
  });
  // Observer + extraData: ציטוט שנכתב לקאש מחליף «—» בלי קפיצת גובה
  const feedQuotes = useFeedQuotesCache();

  useEffect(() => {
    const tickers = Array.from(
      new Set([
        ...congress.trades.map((t) => t.trade.ticker),
        ...insiders.trades.map((t) => t.trade.ticker),
      ])
    )
      .filter((ticker): ticker is string => typeof ticker === 'string' && ticker.trim().length > 0)
      .slice(0, 60);
    const task = InteractionManager.runAfterInteractions(() => {
      prefetchTickerLogos(tickers);
    });
    return () => task.cancel();
  }, [congress.trades, insiders.trades]);

  const loading =
    (congress.loading && congress.trades.length === 0) ||
    (insiders.loading && insiders.trades.length === 0);

  const refreshing = congress.refreshing || insiders.refreshing;

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
      prefetchPersonPortfolio({
        id: politicianId,
        kind: 'politician',
        nameHint: name,
      });
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
    (personId: string, name: string, ticker: string, image?: string | null) => {
      prefetchPersonPortfolio({
        id: personId,
        kind: 'insider',
        ticker,
        nameHint: name,
      });
      navigation.navigate('DarkPoolInvestor', {
        id: personId,
        kind: 'insider',
        ticker,
        nameHint: name,
        imageHint: image,
      });
    },
    [navigation]
  );

  const openCongressTradeDetail = useCallback(
    (trade: CongressTradeFeedItem['trade']) => {
      navigation.navigate('DarkPoolTradeDetail', congressTradeDetailParams(trade));
    },
    [navigation]
  );

  const openInsiderTradeDetail = useCallback(
    (trade: InsiderTradeFeedItem['trade']) => {
      navigation.navigate('DarkPoolTradeDetail', insiderTradeDetailParams(trade));
    },
    [navigation]
  );

  const goExplore = useCallback(() => {
    void HapticFeedback.selection();
    tabNav.navigate('DarkPoolExplore');
  }, [tabNav]);

  const handleRefresh = useCallback(() => {
    void congress.refetch();
    void insiders.refetch();
  }, [congress, insiders]);

  const feedRows = useMemo((): FeedRow[] => {
    const rows: FeedRow[] = [];
    congress.trades.forEach((item, index) => {
      const t = item.trade;
      rows.push({
        kind: 'congress',
        key: `c:${t.id}:${t.filed_at}:${index}`,
        sortAt: Date.parse(t.filed_at || t.transaction_date || '') || 0,
        item,
      });
    });
    insiders.trades.forEach((item) => {
      const t = item.trade;
      rows.push({
        kind: 'insider',
        key: `i:${t.source}-${t.id}`,
        sortAt: Date.parse(t.filed_at || t.transaction_date || '') || 0,
        item,
      });
    });
    rows.sort((a, b) => b.sortAt - a.sortAt);
    return rows;
  }, [congress.trades, insiders.trades]);

  const visibleRows = useMemo(
    () => feedRows.filter((row) => matchesFeedRecentKind(row.kind, recentKind)),
    [feedRows, recentKind]
  );

  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);
  const error = congress.error || insiders.error;

  const renderItem: ListRenderItem<FeedRow> = useCallback(
    ({ item: row }) =>
      row.kind === 'congress' ? (
        <CongressTradeCard
          item={row.item}
          onPersonPress={(pid) => {
            const t = row.item.trade;
            openPolitician(pid, t.politician_name, t.politician_image_url);
          }}
          onDetailPress={() => openCongressTradeDetail(row.item.trade)}
        />
      ) : (
        <InsiderTradeCard
          item={row.item}
          onPersonPress={(personId, name) =>
            openInsider(
              personId,
              name,
              row.item.trade.ticker,
              curatedCeoPortraitUrl(personId)
            )
          }
          onDetailPress={() => openInsiderTradeDetail(row.item.trade)}
        />
      ),
    [openPolitician, openInsider, openCongressTradeDetail, openInsiderTradeDetail]
  );

  const keyExtractor = useCallback((row: FeedRow) => row.key, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.tradesHead}>
          <Text style={styles.sectionTitle}>עסקאות אחרונות</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kindChipRow}
            accessibilityRole="tablist"
          >
            {FEED_RECENT_KIND_CHIPS.map((chip) => {
              const active = recentKind === chip.id;
              return (
                <DayDividerPill
                  key={chip.id}
                  selected={active}
                  haptic={!active}
                  onPress={() => setRecentKind(chip.id)}
                  accessibilityLabel={chip.label}
                >
                  {chip.label}
                </DayDividerPill>
              );
            })}
          </ScrollView>
        </View>

        {error ? (
          <UICard variant="soft" padding="md" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </UICard>
        ) : null}
      </View>
    ),
    [styles, error, recentKind]
  );

  const listEmpty = useMemo(() => {
    if (loading) return null;
    return (
      <UICard variant="soft" padding="lg" style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>אין עסקאות להצגה</Text>
        <Text style={styles.emptyBody}>משוך למטה לרענון או נסה שוב בעוד רגע.</Text>
      </UICard>
    );
  }, [loading, styles]);

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={[styles.safe, darkPoolTransparentFill]} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="אינסיידרים"
          onMenuPress={openDrawer}
          rightAccessory={
            <DayNavBlurButton
              onPress={goExplore}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="גילוי לוויתנים"
            >
              <Ionicons name="search" size={22} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          }
        />

        {loading && feedRows.length === 0 ? (
          <View style={styles.scroll}>
            {Array.from({ length: 3 }).map((_, i) => (
              <TradeCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={visibleRows}
            extraData={feedQuotes}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            style={darkPoolTransparentFill}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            initialNumToRender={FEED_INITIAL_RENDER}
            maxToRenderPerBatch={FEED_MAX_BATCH}
            windowSize={FEED_WINDOW_SIZE}
            updateCellsBatchingPeriod={40}
            removeClippedSubviews={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={tokens.colors.primary.main}
              />
            }
          />
        )}
      </SafeAreaView>
    </ScreenChrome>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>, bottomPad: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent', ...darkPoolRtlContent },
    scroll: {
      direction: 'rtl',
      paddingBottom: bottomPad + 24,
      paddingTop: 6,
      paddingHorizontal: tokens.layout?.screenPadding ?? FEED_LIST_GUTTER,
    },
    listHeader: {
      direction: 'rtl',
      alignSelf: 'stretch',
      width: '100%',
    },
    sectionTitle: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    tradesHead: {
      direction: 'rtl',
      marginTop: 4,
      marginBottom: FEED_LIST_CHIPS_TO_CARDS,
      alignSelf: 'stretch',
      width: '100%',
    },
    kindChipRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      gap: 6,
      marginTop: FEED_LIST_TITLE_TO_CHIPS,
    },
    errorCard: {
      marginBottom: 12,
    },
    errorText: {
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.danger,
      fontSize: DARK_POOL_TYPE.footnote.fontSize,
      lineHeight: DARK_POOL_TYPE.footnote.lineHeight,
      fontWeight: DARK_POOL_TYPE.footnote.fontWeight,
    },
    emptyCard: {
      marginTop: 4,
    },
    emptyTitle: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    emptyBody: {
      ...darkPoolPhysicalRightText,
      marginTop: 8,
      fontSize: DARK_POOL_TYPE.body.fontSize,
      lineHeight: DARK_POOL_TYPE.body.lineHeight,
      fontWeight: DARK_POOL_TYPE.body.fontWeight,
      color: tokens.colors.text.secondary,
    },
  });
}
