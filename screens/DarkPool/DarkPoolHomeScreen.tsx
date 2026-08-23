/**
 * בית Dark Pool — מסך אחד בלבד.
 * פס אנשים → לחיצה = תיק (גרף).
 * מתחת: עסקאות אחרונות (FlatList + כרטיסים קלים).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Pressable,
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
import { useQuery } from '@tanstack/react-query';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { appQueryKeys } from '../../lib/appQueryKeys';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { CongressTradeCard } from './components/CongressTradeCard';
import { InsiderTradeCard } from './components/InsiderTradeCard';
import { PeopleAvatarCard } from './components/PeopleAvatarCard';
import { useCongressFeed } from '../../hooks/useCongressFeed';
import { useDarkPoolInsiderFeed } from '../../hooks/useDarkPoolInsiderFeed';
import { fetchExplorePeopleMerged } from '../../services/darkpool/featuredProfilesService';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';
import {
  buildExploreProfileGrid,
  explorePersonHasPhoto,
  withResolvedPhoto,
} from './utils/exploreGrid';
import { formatInsiderDisplayName } from './utils/investorPlaceholder';
import type { CongressTradeFeedItem } from './utils/congressFeedCalc';
import type { InsiderTradeFeedItem } from './utils/insiderFeedCalc';

/** תואם appPrefetch — FlatList מרנדר רק את מה שבמסך */
const FEED_LIMIT = 80;
const PEOPLE_STRIP_LIMIT = 20;

type Filter = 'all' | 'congress' | 'insiders';

type FeedRow =
  | { kind: 'congress'; key: string; sortAt: number; item: CongressTradeFeedItem }
  | { kind: 'insider'; key: string; sortAt: number; item: InsiderTradeFeedItem };

export default function DarkPoolHomeScreen() {
  const tokens = useDesignTokens();
  const navigation = useDarkPoolStackNav();
  const [filter, setFilter] = useState<Filter>('all');
  /** דוחה רינדור רשימה כבדה עד אחרי אנימציית המגירה */
  const [listReady, setListReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setListReady(true);
    });
    return () => task.cancel();
  }, []);

  const peopleQuery = useQuery({
    queryKey: appQueryKeys.uwExploreHomeStrip,
    queryFn: () => fetchExplorePeopleMerged({ requirePhoto: false }),
    staleTime: 5 * 60 * 1000,
  });

  const congress = useCongressFeed(FEED_LIMIT, filter !== 'insiders');
  const insiders = useDarkPoolInsiderFeed({
    tab: 'all',
    limit: FEED_LIMIT,
    enabled: filter !== 'congress',
  });

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

  const peopleFromFeeds = useMemo((): ExplorePerson[] => {
    const out: ExplorePerson[] = [];
    const seen = new Set<string>();
    for (const item of congress.trades) {
      const t = item.trade;
      const id = t.politician_id?.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: t.politician_name,
        subtitle: 'קונגרס',
        image_url: t.politician_image_url,
        kind: 'politician',
        activity_score: 50,
      });
    }
    for (const item of insiders.trades) {
      const t = item.trade;
      const name = t.insider_name?.trim();
      if (!name || !t.ticker) continue;
      const id = `${t.ticker}:${name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: formatInsiderDisplayName(name),
        subtitle: t.ticker,
        image_url: null,
        kind: 'insider',
        ticker: t.ticker,
        activity_score: 40,
      });
    }
    return out;
  }, [congress.trades, insiders.trades]);

  const people = useMemo(
    () =>
      buildExploreProfileGrid([...(peopleQuery.data ?? []), ...peopleFromFeeds], {
        requirePhoto: true,
      })
        .filter(explorePersonHasPhoto)
        .slice(0, PEOPLE_STRIP_LIMIT)
        .map(withResolvedPhoto),
    [peopleQuery.data, peopleFromFeeds]
  );
  const styles = useMemo(() => createStyles(tokens), [tokens]);
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
        />
      ) : (
        <InsiderTradeCard
          item={row.item}
          onPersonPress={(personId, name) =>
            openInsider(personId, name, row.item.trade.ticker)
          }
        />
      ),
    [openPolitician, openInsider]
  );

  const keyExtractor = useCallback((row: FeedRow) => row.key, []);

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>אנשים</Text>
          <Pressable onPress={goSearch} hitSlop={8}>
            <Text style={styles.sectionLink}>חיפוש</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.peopleStrip}
        >
          {people.map((person) => (
            <PeopleAvatarCard
              key={person.id}
              person={person}
              onPress={() => openPerson(person)}
            />
          ))}
        </ScrollView>

        <Text style={[styles.sectionTitle, styles.tradesTitle]}>עסקאות אחרונות</Text>
        <View style={styles.filters}>
          {(
            [
              { id: 'all', label: 'הכל' },
              { id: 'congress', label: 'קונגרס' },
              { id: 'insiders', label: 'בכירים' },
            ] as const
          ).map((f) => {
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
          <UICard variant="outlined" padding="md" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </UICard>
        ) : null}

        {!listReady ? (
          <View style={styles.listPlaceholder}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        ) : null}
      </View>
    ),
    [
      styles,
      people,
      goSearch,
      openPerson,
      filter,
      error,
      listReady,
      tokens.colors.primary.main,
    ]
  );

  const listEmpty = useMemo(() => {
    if (!listReady || loading) return null;
    return (
      <UICard variant="outlined" padding="lg" style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>אין עסקאות להצגה</Text>
        <Text style={styles.emptyBody}>משוך למטה לרענון, או חפש אדם למעלה.</Text>
      </UICard>
    );
  }, [listReady, loading, styles]);

  return (
    <ScreenChrome rtl withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="אינסיידרים"
          subtitle="לחץ על אדם לראות את שווי התיק"
          onMenuPress={openDrawer}
          rightAccessory={
            <DayNavBlurButton
              onPress={goSearch}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="חיפוש אנשים"
            >
              <Ionicons name="search" size={22} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          }
        />

        {loading && feedRows.length === 0 && people.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
            <Text style={styles.loadingHint}>טוען…</Text>
          </View>
        ) : (
          <FlatList
            data={listReady ? feedRows : []}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={7}
            updateCellsBatchingPeriod={50}
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

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    safe: { flex: 1 },
    scroll: {
      direction: 'rtl',
      paddingBottom: 40,
      paddingTop: 4,
      paddingHorizontal: tokens.layout.screenPadding,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingHint: {
      fontSize: 13,
      color: tokens.colors.text.tertiary,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    sectionLink: {
      fontSize: 13,
      fontWeight: '700',
      color: tokens.colors.primary.main,
    },
    peopleStrip: {
      gap: 12,
      paddingBottom: 4,
      paddingTop: 2,
      alignItems: 'flex-start',
    },
    tradesTitle: {
      marginTop: 18,
      marginBottom: 10,
    },
    filters: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
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
      fontSize: 13,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
    },
    chipTextActive: {
      color: tokens.colors.primary.main,
      fontWeight: '800',
    },
    listPlaceholder: {
      paddingVertical: 28,
      alignItems: 'center',
    },
    errorCard: {
      marginBottom: 12,
      borderColor: tokens.colors.border.danger,
    },
    errorText: {
      color: tokens.colors.text.danger,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'left',
    },
    emptyCard: {
      marginTop: 4,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    emptyBody: {
      marginTop: 8,
      fontSize: 14,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
      lineHeight: 20,
    },
  });
}
