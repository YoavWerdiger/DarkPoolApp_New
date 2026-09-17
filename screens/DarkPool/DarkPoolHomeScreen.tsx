/**
 * בית Dark Pool — מסך אחד בלבד.
 * פס לוויתנים = רשימה מאוצרת בלבד (CURATED_EXPLORE_PROFILES).
 * מתחת: פיד עסקאות גלובלי (קונגרס + Form4) — לא מסונן ל-curated.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { TradeCardSkeleton } from '../../components/ui/SkeletonLoader';
import { appQueryKeys } from '../../lib/appQueryKeys';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { CongressTradeCard } from './components/CongressTradeCard';
import { InsiderTradeCard } from './components/InsiderTradeCard';
import { InvestorPortrait } from './components/InvestorPortrait';
import { useCongressFeed } from '../../hooks/useCongressFeed';
import { useDarkPoolInsiderFeed } from '../../hooks/useDarkPoolInsiderFeed';
import {
  fetchExplorePeopleMerged,
  getExplorePeopleMergedSync,
} from '../../services/darkpool/featuredProfilesService';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';
import {
  buildExploreProfileGrid,
  withResolvedPhoto,
} from './utils/exploreGrid';
import { formatInsiderDisplayName, portraitDisplayUrl } from './utils/investorPlaceholder';
import type { CongressTradeFeedItem } from './utils/congressFeedCalc';
import type { InsiderTradeFeedItem } from './utils/insiderFeedCalc';
import { DARK_POOL_FEED_LIMIT } from '../../types/darkpool.types';
import { prefetchTickerLogos } from '../../utils/prefetchTickerLogos';
import { hebrewText, rowMixed } from './utils/bidi';
import { formatUsdCompact, ltrEmbed } from './utils/darkPoolFormat';
import { valuesToSparklinePoints } from './utils/sparkline';

const PEOPLE_STRIP_LIMIT = 8;
const HOME_PEOPLE_SYNC = getExplorePeopleMergedSync({ requirePhoto: false });
const FEED_INITIAL_RENDER = 8;
const FEED_MAX_BATCH = 6;
const FEED_WINDOW_SIZE = 7;

type Filter = 'all' | 'congress' | 'insiders';
const FILTER_OPTIONS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'הכל' },
  { id: 'congress', label: 'קונגרס' },
  { id: 'insiders', label: 'בכירים' },
];

type FeedRow =
  | { kind: 'congress'; key: string; sortAt: number; item: CongressTradeFeedItem }
  | { kind: 'insider'; key: string; sortAt: number; item: InsiderTradeFeedItem };

function whaleKindLabel(person: ExplorePerson): string {
  return 'לוויתן';
}

function whaleDisplayName(person: ExplorePerson): string {
  return person.kind === 'insider' ? formatInsiderDisplayName(person.name) : person.name;
}

function whaleValueMetric(person: ExplorePerson): { value: string; hint: string } {
  if (person.portfolio_value != null && Number.isFinite(person.portfolio_value)) {
    return {
      value: ltrEmbed(formatUsdCompact(person.portfolio_value)),
      hint: 'שווי תיק',
    };
  }

  if (person.metric?.trim()) {
    return {
      value: person.metric.trim(),
      hint: person.metric_label?.trim() || 'מדד פעילות',
    };
  }

  if (person.activity_score != null && Number.isFinite(person.activity_score)) {
    return {
      value: String(person.activity_score),
      hint: 'ציון פעילות',
    };
  }

  return {
    value: '—',
    hint: 'אין נתון שווי',
  };
}

function whaleSnapshotRef(person: ExplorePerson): string {
  const sub = person.subtitle?.trim();
  if (sub) return sub;
  const source = whaleKindLabel(person);
  return `סנאפשוט ${source}`;
}

function whaleSparkValues(person: ExplorePerson): number[] {
  if (person.sparkline_values && person.sparkline_values.length >= 2) {
    return person.sparkline_values.slice(0, 18);
  }
  const metricNumber = Number(person.metric ?? Number.NaN);
  const seedBase =
    person.activity_score ??
    person.portfolio_value ??
    (Number.isFinite(metricNumber) ? metricNumber : 50);
  const a = Math.max(8, Math.min(92, seedBase % 100));
  const b = Math.max(7, Math.min(94, a + ((seedBase % 9) - 4) * 3));
  const c = Math.max(6, Math.min(96, b + ((seedBase % 7) - 3) * 2));
  const d = Math.max(8, Math.min(95, c + ((seedBase % 11) - 5) * 2));
  const e = Math.max(10, Math.min(98, d + ((seedBase % 13) - 6)));
  return [a, b, c, d, e, d - 2, e + 1].map((v) => Math.max(5, Math.min(99, v)));
}

export default function DarkPoolHomeScreen() {
  const tokens = useDesignTokens();
  const { height: viewportHeight } = useWindowDimensions();
  const navigation = useDarkPoolStackNav();
  const [filter, setFilter] = useState<Filter>('all');

  const peopleQuery = useQuery({
    queryKey: appQueryKeys.uwExploreHomeStrip,
    queryFn: () => fetchExplorePeopleMerged({ requirePhoto: false }),
    initialData: HOME_PEOPLE_SYNC,
    placeholderData: HOME_PEOPLE_SYNC,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    const urls = (peopleQuery.data ?? HOME_PEOPLE_SYNC)
      .slice(0, PEOPLE_STRIP_LIMIT)
      .map((p) => portraitDisplayUrl(p.image_url, 256) ?? p.image_url)
      .filter((u): u is string => !!u?.trim());
    if (urls.length) {
      const task = InteractionManager.runAfterInteractions(() => {
        void ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
      });
      return () => task.cancel();
    }
  }, [peopleQuery.data]);

  const congress = useCongressFeed(DARK_POOL_FEED_LIMIT, filter !== 'insiders');
  const insiders = useDarkPoolInsiderFeed({
    tab: 'all',
    limit: DARK_POOL_FEED_LIMIT,
    enabled: filter !== 'congress',
  });

  useEffect(() => {
    const tickers = Array.from(new Set([
      ...congress.trades.map((t) => t.trade.ticker),
      ...insiders.trades.map((t) => t.trade.ticker),
    ]))
      .filter((ticker): ticker is string => typeof ticker === 'string' && ticker.trim().length > 0)
      .slice(0, 60);
    const task = InteractionManager.runAfterInteractions(() => {
      prefetchTickerLogos(tickers);
    });
    return () => task.cancel();
  }, [congress.trades, insiders.trades]);

  const loading =
    (filter !== 'insiders' && congress.loading && congress.trades.length === 0) ||
    (filter !== 'congress' && insiders.loading && insiders.trades.length === 0);

  const refreshing = congress.refreshing || insiders.refreshing || peopleQuery.isRefetching;

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const openPerson = useCallback(
    (person: ExplorePerson) => {
      void HapticFeedback.selection();
      const resolved = withResolvedPhoto(person);
      navigation.navigate('DarkPoolInvestor', {
        id: resolved.id,
        kind: resolved.kind,
        ticker: resolved.ticker,
        nameHint: resolved.name,
        imageHint: resolved.image_url,
      });
    },
    [navigation]
  );

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

  const goSearch = useCallback(() => {
    void HapticFeedback.selection();
    navigation.navigate('DarkPoolPeople');
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    void peopleQuery.refetch();
    if (filter !== 'insiders') void congress.refetch();
    if (filter !== 'congress') void insiders.refetch();
  }, [filter, peopleQuery, congress, insiders]);

  const feedRows = useMemo((): FeedRow[] => {
    const rows: FeedRow[] = [];
    if (filter !== 'insiders') {
      congress.trades.forEach((item, index) => {
        const t = item.trade;
        rows.push({
          kind: 'congress',
          key: `c:${t.id}:${t.filed_at}:${index}`,
          sortAt: Date.parse(t.filed_at || t.transaction_date || '') || 0,
          item,
        });
      });
    }
    if (filter !== 'congress') {
      insiders.trades.forEach((item) => {
        const t = item.trade;
        rows.push({
          kind: 'insider',
          key: `i:${t.source}-${t.id}`,
          sortAt: Date.parse(t.filed_at || t.transaction_date || '') || 0,
          item,
        });
      });
    }
    rows.sort((a, b) => b.sortAt - a.sortAt);
    return rows;
  }, [filter, congress.trades, insiders.trades]);

  // פס לוויתנים = curated בלבד (לא מערבבים פרופילים אקראיים מהפיד)
  const people = useMemo(
    () =>
      buildExploreProfileGrid(peopleQuery.data ?? HOME_PEOPLE_SYNC, {
        requirePhoto: false,
      })
        .slice(0, PEOPLE_STRIP_LIMIT)
        .map(withResolvedPhoto),
    [peopleQuery.data]
  );
  const whaleCardHeight = useMemo(
    () => Math.max(240, Math.min(330, Math.round(viewportHeight * 0.42))),
    [viewportHeight]
  );
  const styles = useMemo(() => createStyles(tokens, whaleCardHeight), [tokens, whaleCardHeight]);
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

  const keyExtractor = useCallback((row: FeedRow) => row.key, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.peopleSection}>
          <ScrollView
            horizontal
            style={styles.peopleRail}
            contentContainerStyle={styles.peopleRailContent}
            showsHorizontalScrollIndicator={false}
          >
            {people.length > 0 ? (
              people.map((person) => {
                const metric = whaleValueMetric(person);
                const displayName = whaleDisplayName(person);
                return (
                  <Pressable
                    key={person.id}
                    onPress={() => openPerson(person)}
                    style={({ pressed }) => [styles.whaleCard, pressed && styles.whaleCardPressed]}
                  >
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(36,81,157,0.28)', 'rgba(19,33,56,0.12)', 'rgba(10,12,16,0.08)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.whaleCardGradient}
                    />
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(122,183,255,0.22)', 'rgba(122,183,255,0)']}
                      start={{ x: 0.05, y: 0 }}
                      end={{ x: 0.9, y: 0.8 }}
                      style={styles.whaleCardGlow}
                    />
                    <View style={styles.whaleIdentityRow}>
                      <Text style={styles.whaleName} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <InvestorPortrait
                        name={displayName}
                        imageUrl={person.image_url}
                        ticker={person.ticker}
                        kind={person.kind}
                        personId={person.id}
                        layout="circle"
                        size={36}
                        priority="high"
                      />
                    </View>
                    <Text style={styles.whaleRole} numberOfLines={1}>
                      לוויתן
                    </Text>
                    <View style={styles.whaleSnapshotHead}>
                      <Text style={styles.whaleSnapshotLabel}>סנאפשוט</Text>
                      <Text style={styles.whaleSnapshot} numberOfLines={1}>
                        {whaleSnapshotRef(person)}
                      </Text>
                    </View>
                    <View style={styles.whaleMiniChart}>
                      <Svg width="100%" height="100%" viewBox="0 0 220 52" preserveAspectRatio="none">
                        <Polyline
                          points={valuesToSparklinePoints(whaleSparkValues(person), 220, 52)}
                          fill="none"
                          stroke={tokens.colors.primary.main}
                          strokeOpacity={0.5}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </Svg>
                    </View>
                    <View style={styles.whaleMetaRow}>
                      <Text style={styles.whaleMetaLabel}>תיק</Text>
                      <Text style={styles.whaleSummary} numberOfLines={1}>
                        {`${metric.hint} · ${whaleKindLabel(person)}`}
                      </Text>
                    </View>
                    <View style={styles.whaleMetaRow}>
                      <Text style={styles.whaleMetaLabel}>שווי</Text>
                      <Text style={styles.whaleValue} numberOfLines={1}>
                        {metric.value}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Pressable
                onPress={goSearch}
                style={({ pressed }) => [styles.whaleCard, styles.whaleFallbackCard, pressed && styles.whaleCardPressed]}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(36,81,157,0.28)', 'rgba(19,33,56,0.12)', 'rgba(10,12,16,0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.whaleCardGradient}
                />
                <Text style={styles.whaleName} numberOfLines={1}>
                  אין פרופילים זמינים כרגע
                </Text>
                <View style={styles.whaleMetaRow}>
                  <Text style={styles.whaleMetaLabel}>סנאפשוט</Text>
                  <Text style={styles.whaleSnapshot} numberOfLines={1}>
                    אין נתוני סנאפשוט
                  </Text>
                </View>
                <View style={styles.whaleMiniChart}>
                  <Svg width="100%" height="100%" viewBox="0 0 220 52" preserveAspectRatio="none">
                    <Polyline
                      points={valuesToSparklinePoints([24, 38, 31, 43, 40, 48], 220, 52)}
                      fill="none"
                      stroke={tokens.colors.primary.main}
                      strokeOpacity={0.45}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
                <View style={styles.whaleMetaRow}>
                  <Text style={styles.whaleMetaLabel}>תיק</Text>
                  <Text style={styles.whaleSummary} numberOfLines={1}>
                    הקש לחיפוש פרופילים
                  </Text>
                </View>
                <View style={styles.whaleMetaRow}>
                  <Text style={styles.whaleMetaLabel}>שווי</Text>
                  <Text style={styles.whaleSnapshot} numberOfLines={1}>
                    —
                  </Text>
                </View>
              </Pressable>
            )}
          </ScrollView>
        </View>

        <View style={styles.tradesHead}>
          <Text style={[styles.sectionTitle, styles.tradesTitle]}>עסקאות אחרונות</Text>
          <Text style={styles.tradesHint}>מתעדכן בזמן אמת</Text>
        </View>
        <View style={styles.filters}>
          {FILTER_OPTIONS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  if (!active) void HapticFeedback.selection();
                  setFilter(f.id);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <UICard variant="glass" glassIntensity="light" padding="md" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </UICard>
        ) : null}
      </View>
    ),
    [styles, people, openPerson, goSearch, filter, error]
  );

  const listEmpty = useMemo(() => {
    if (loading) return null;
    return (
      <UICard variant="glass" glassIntensity="light" padding="lg" style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>אין עסקאות להצגה</Text>
        <Text style={styles.emptyBody}>משוך למטה לרענון או נסה שוב בעוד רגע.</Text>
      </UICard>
    );
  }, [loading, styles]);

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="אינסיידרים"
          centerAccessory={<Text style={styles.mainCenteredTitle}>אינסיידרים</Text>}
          onMenuPress={openDrawer}
          rightAccessory={
            <DayNavBlurButton
              onPress={goSearch}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="חיפוש לוויתנים"
            >
              <Ionicons name="search" size={22} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          }
        />

        {loading && feedRows.length === 0 && people.length === 0 ? (
          <View style={styles.scroll}>
            {Array.from({ length: 5 }).map((_, i) => (
              <TradeCardSkeleton key={i} delay={i * 70} />
            ))}
          </View>
        ) : (
          <FlatList
            data={feedRows}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            initialNumToRender={FEED_INITIAL_RENDER}
            maxToRenderPerBatch={FEED_MAX_BATCH}
            windowSize={FEED_WINDOW_SIZE}
            updateCellsBatchingPeriod={40}
            removeClippedSubviews
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

function createStyles(tokens: ReturnType<typeof useDesignTokens>, whaleCardHeight: number) {
  return StyleSheet.create({
    safe: { flex: 1 },
    scroll: {
      paddingBottom: 40,
      paddingTop: 4,
      paddingHorizontal: tokens.layout.screenPadding,
    },
    listHeader: {
      direction: 'rtl',
    },
    mainCenteredTitle: {
      ...hebrewText,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: -0.35,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    peopleSection: {
      marginBottom: 10,
      paddingTop: 0,
      width: '100%',
      minHeight: whaleCardHeight + 20,
    },
    sectionTitle: {
      ...hebrewText,
      fontSize: tokens.typography.titleXs.size,
      lineHeight: tokens.typography.titleXs.lineHeight,
      fontWeight: tokens.typography.fontWeight.bold,
      letterSpacing: tokens.typography.letterSpacing.normal,
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    peopleRail: {
      direction: 'rtl',
      minHeight: whaleCardHeight + 8,
    },
    peopleRailContent: {
      paddingBottom: 6,
      paddingTop: 0,
      gap: 12,
      paddingHorizontal: 4,
      flexDirection: 'row-reverse',
      alignItems: 'stretch',
    },
    whaleCard: {
      width: 210,
      minHeight: whaleCardHeight,
      borderRadius: 22,
      borderWidth: 1.2,
      borderColor: 'rgba(120,178,255,0.34)',
      backgroundColor: 'rgba(18,22,31,0.95)',
      paddingHorizontal: 13,
      paddingVertical: 12,
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
      overflow: 'hidden',
    },
    whaleCardPressed: {
      opacity: 0.88,
    },
    whaleFallbackCard: {
      justifyContent: 'space-between',
    },
    whaleCardGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 22,
    },
    whaleCardGlow: {
      position: 'absolute',
      top: -40,
      left: -30,
      width: 170,
      height: 120,
      borderRadius: 999,
    },
    whaleIdentityRow: {
      ...rowMixed,
      justifyContent: 'space-between',
      gap: 8,
      width: '100%',
    },
    whaleName: {
      ...hebrewText,
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    whaleMetaRow: {
      ...rowMixed,
      justifyContent: 'space-between',
      gap: 8,
      width: '100%',
    },
    whaleMetaLabel: {
      ...hebrewText,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: tokens.typography.footnote.weight,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
    },
    whaleValue: {
      ...hebrewText,
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.primary.main,
      textAlign: 'right',
    },
    whaleSnapshot: {
      ...hebrewText,
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: tokens.typography.subhead.weight,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
    },
    whaleSnapshotHead: {
      gap: 2,
      width: '100%',
      alignItems: 'center',
    },
    whaleSnapshotLabel: {
      ...hebrewText,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: tokens.typography.footnote.weight,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
    },
    whaleRole: {
      ...hebrewText,
      width: '100%',
      fontSize: 11,
      lineHeight: 14,
      fontWeight: tokens.typography.subhead.weight,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    whaleMiniChart: {
      width: '100%',
      height: 52,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(120,178,255,0.24)',
      backgroundColor: 'rgba(5,12,24,0.42)',
      paddingHorizontal: 6,
      paddingVertical: 5,
      overflow: 'hidden',
    },
    whaleSummary: {
      ...hebrewText,
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: tokens.typography.subhead.weight,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
    },
    tradesHead: {
      marginTop: 14,
      marginBottom: 10,
      ...rowMixed,
      justifyContent: 'space-between',
      width: '100%',
    },
    tradesTitle: {
      marginTop: 0,
      marginBottom: 0,
    },
    tradesHint: {
      ...hebrewText,
      fontSize: tokens.typography.footnote.size,
      lineHeight: tokens.typography.footnote.lineHeight,
      fontWeight: tokens.typography.footnote.weight,
      letterSpacing: tokens.typography.footnote.letterSpacing,
      color: tokens.colors.text.secondary,
    },
    filters: {
      ...rowMixed,
      gap: 8,
      marginBottom: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    chipActive: {
      borderColor: `${tokens.colors.primary.main}66`,
      backgroundColor: `${tokens.colors.primary.main}18`,
    },
    chipText: {
      ...hebrewText,
      fontSize: tokens.typography.subhead.size,
      lineHeight: tokens.typography.subhead.lineHeight,
      fontWeight: tokens.typography.subhead.weight,
      letterSpacing: tokens.typography.letterSpacing.normal,
      color: tokens.colors.text.secondary,
    },
    chipTextActive: {
      color: tokens.colors.primary.main,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    errorCard: {
      marginBottom: 12,
      borderColor: tokens.colors.border.danger,
    },
    errorText: {
      ...hebrewText,
      color: tokens.colors.text.danger,
      fontSize: tokens.typography.subhead.size,
      lineHeight: tokens.typography.subhead.lineHeight,
      fontWeight: tokens.typography.subhead.weight,
      letterSpacing: tokens.typography.letterSpacing.normal,
    },
    emptyCard: {
      marginTop: 4,
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
      lineHeight: 22,
      fontWeight: tokens.typography.bodySmall.weight,
      letterSpacing: tokens.typography.letterSpacing.normal,
      color: tokens.colors.text.secondary,
    },
  });
}
