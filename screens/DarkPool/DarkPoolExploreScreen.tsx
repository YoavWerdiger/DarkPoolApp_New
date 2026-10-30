/**
 * גילוי — מדפי הקטגוריות.
 * בלי גריד «כל הפרופילים», בלי "$ copied" ובלי דירוג ALL משוחזר.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formFieldShellStyle } from '../../components/ui/formControl';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { LIGHT_CANVAS } from '../../components/ui/designTokensStatic';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ExplorePortraitCard } from './components/ExplorePortraitCard';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { ChatSheetTopoHeader } from '../../components/chat/ChatBottomSheet';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import {
  fetchExplorePeopleMerged,
  getExplorePeopleMergedSync,
} from '../../services/darkpool/featuredProfilesService';
import {
  EMPTY_EXPLORE_DISCOVERY,
  fetchExploreDiscoveryExtras,
  type DatedExplorePerson,
} from '../../services/darkpool/exploreDiscoveryService';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { ExploreDiscoverySections } from './components/ExploreDiscoverySections';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';
import {
  EXPLORE_FEATURED_LIMIT,
  EXPLORE_RAIL_LIMIT,
  buildExploreProfileGrid,
  explorePersonHasPhoto,
  EXPLORE_GRID_GAP,
  withResolvedPhoto,
} from './utils/exploreGrid';
import { portraitDisplayUrl } from './utils/investorPlaceholder';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
  darkPoolRtlContent,
  darkPoolTransparentFill,
} from './darkPoolLayout';
import { formatHebrewAgo } from './utils/congressTradeDisplay';
import {
  formatFollowerCountHe,
  formatMedianExcessMetric,
  partitionExploreByKind,
  sortExploreByLastFiled,
  takeUniqueExplorePeople,
} from './utils/exploreDisplay';
import {
  filterCuratedExplorePeople,
  isCuratedExploreId,
} from './utils/curatedExploreProfiles';
import { countFollowedInvestors } from '../../services/darkpool/darkPoolFollowService';
import {
  listPoliticianMedianExcessLeaders,
  listRecentlyActivePoliticians,
} from '../../services/darkpool/darkPoolDbCacheService';
import {
  prefetchCuratedPersonPortfolios,
  prefetchPersonPortfolio,
} from '../../services/darkpool/prefetchPersonPortfolio';

// v2: כולל חברי קונגרס פעילים — מפתח חדש כדי שלא יוגש מטמון ישן של המאוצרים בלבד
const EXPLORE_GRID_KEY = [...appQueryKeys.uwExplore, 'grid-profiles', 'v2'] as const;
const CURATED_SYNC = getExplorePeopleMergedSync({ requirePhoto: true });

async function loadExploreGridPeople(): Promise<ExplorePerson[]> {
  return fetchExplorePeopleMerged({ requirePhoto: true });
}

function prefetchPortraitUris(people: ExplorePerson[]) {
  const urls = people
    .slice(0, 16)
    .map((p) => portraitDisplayUrl(p.image_url, 720) ?? p.image_url)
    .filter((u): u is string => !!u?.trim());
  if (urls.length) {
    void ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
  }
}

function mergePerson(
  known: ExplorePerson | undefined,
  fallback: ExplorePerson
): ExplorePerson {
  return withResolvedPhoto({
    ...fallback,
    name: known?.name || fallback.name,
    subtitle: known?.subtitle || fallback.subtitle,
    image_url: known?.image_url || fallback.image_url,
    ticker: known?.ticker ?? fallback.ticker,
    kind: known?.kind ?? fallback.kind,
  });
}

function withPhoto(people: ExplorePerson[]): ExplorePerson[] {
  return people.filter((p) => explorePersonHasPhoto(p) || !!p.image_url?.trim());
}

export default function DarkPoolExploreScreen() {
  const tokens = useDesignTokens();
  const stackNav = useDarkPoolStackNav();
  const bottomPad = useDarkPoolTabBarHeight();
  // חיפוש לפי שם — במקום צ׳יפי הסוג; בזמן הקלדה התוצאות מחליפות את המדפים
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
  }, []);
  const [searchFocused, setSearchFocused] = useState(false);

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(stackNav as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [stackNav]);

  const gridQuery = useQuery({
    queryKey: EXPLORE_GRID_KEY,
    queryFn: loadExploreGridPeople,
    initialData: CURATED_SYNC,
    // הרשימה הסטטית היא רק placeholder — לא «טרייה»; אחרת השליפה מהשרת נדחית ב-5 דק׳
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  const followCountsQuery = useQuery({
    queryKey: appQueryKeys.exploreFollowCounts,
    queryFn: countFollowedInvestors,
    staleTime: 60 * 1000,
  });

  const excessLeadersQuery = useQuery({
    queryKey: appQueryKeys.exploreExcessLeaders,
    queryFn: () => listPoliticianMedianExcessLeaders(5, EXPLORE_RAIL_LIMIT),
    staleTime: 10 * 60 * 1000,
  });

  const recentlyActiveQuery = useQuery({
    queryKey: appQueryKeys.exploreRecentlyActive,
    queryFn: () => listRecentlyActivePoliticians(EXPLORE_RAIL_LIMIT),
    staleTime: 5 * 60 * 1000,
  });

  const extrasQuery = useQuery({
    queryKey: appQueryKeys.exploreDiscoveryExtras,
    queryFn: () => fetchExploreDiscoveryExtras(EXPLORE_RAIL_LIMIT),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    prefetchPortraitUris(gridQuery.data ?? CURATED_SYNC);
  }, [gridQuery.data]);

  useEffect(() => {
    prefetchCuratedPersonPortfolios(12);
  }, []);

  const onPersonPress = useCallback(
    (person: ExplorePerson) => {
      const resolved = withResolvedPhoto(person);
      prefetchPersonPortfolio({
        id: resolved.id,
        kind: resolved.kind,
        ticker: resolved.ticker,
        nameHint: resolved.name,
      });
      stackNav.navigate('DarkPoolInvestor', {
        id: resolved.id,
        kind: resolved.kind,
        ticker: resolved.ticker,
        nameHint: resolved.name,
        imageHint: resolved.image_url,
      });
    },
    [stackNav]
  );

  const extras = extrasQuery.data ?? EMPTY_EXPLORE_DISCOVERY;

  const curatedProfiles = useMemo(
    () => buildExploreProfileGrid(gridQuery.data ?? CURATED_SYNC),
    [gridQuery.data]
  );

  const catalog = useMemo(
    () =>
      buildExploreProfileGrid([
        // הגריד כבר מסונן בשרת (מאוצרים + חברי קונגרס פעילים) — לא מסננים אותו שוב למאוצרים בלבד
        ...curatedProfiles,
        ...filterCuratedExplorePeople([
          ...extras.most_active,
          ...extras.fund_books,
          ...extras.new_profiles,
          ...extras.executives,
          ...extras.recently_active_insiders,
        ]),
      ]),
    [curatedProfiles, extras]
  );

  const mostFollowed = useMemo<ExplorePerson[]>(() => {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const ranked = (followCountsQuery.data ?? [])
      .map((row) => {
        const known = byId.get(row.person.id);
        const metric = formatFollowerCountHe(row.follower_count);
        return mergePerson(known, {
          id: row.person.id,
          name: row.person.name,
          subtitle: known?.subtitle ?? '',
          image_url: row.person.image_url,
          kind: row.person.kind,
          ticker: row.person.ticker,
          followers_count: row.follower_count,
          metric: metric ?? undefined,
        });
      })
      .filter((p) => (p.followers_count ?? 0) > 0)
      .filter((p) => explorePersonHasPhoto(p) || !!p.image_url?.trim());

    if (ranked.length) return ranked.slice(0, EXPLORE_FEATURED_LIMIT);

    return catalog.slice(0, EXPLORE_FEATURED_LIMIT).map((p) => ({
      ...p,
      metric: undefined,
      metric_label: undefined,
      followers_count: undefined,
    }));
  }, [catalog, followCountsQuery.data]);

  const excessLeaders = useMemo<ExplorePerson[]>(() => {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    return (excessLeadersQuery.data ?? [])
      .filter((row) => isCuratedExploreId(row.politician_id))
      .map((row) => {
        const known = byId.get(row.politician_id);
        const pct = formatMedianExcessMetric(row.median_excess_return_pct);
        if (!pct) return null;
        return mergePerson(known, {
          id: row.politician_id,
          name: known?.name ?? row.politician_name,
          subtitle: known?.subtitle ?? 'קונגרס',
          image_url: known?.image_url ?? row.politician_image_url,
          kind: 'politician',
          metric: pct,
        });
      })
      .filter((p): p is ExplorePerson => p != null)
      .filter((p) => explorePersonHasPhoto(p) || !!p.image_url?.trim())
      .slice(0, EXPLORE_RAIL_LIMIT);
  }, [catalog, excessLeadersQuery.data]);

  const recentlyActive = useMemo<ExplorePerson[]>(() => {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const politicians: DatedExplorePerson[] = (recentlyActiveQuery.data ?? [])
      .filter((row) => isCuratedExploreId(row.politician_id))
      .map((row) => {
        const known = byId.get(row.politician_id);
        const ago = formatHebrewAgo(row.last_filed_at);
        return {
          ...mergePerson(known, {
            id: row.politician_id,
            name: known?.name ?? row.politician_name,
            subtitle: ago ? `דיווח ${ago}` : 'פעילות אחרונה',
            image_url: known?.image_url ?? row.politician_image_url,
            kind: 'politician',
          }),
          last_filed_at: row.last_filed_at,
        };
      }
    );
    const insiders: DatedExplorePerson[] = extras.recently_active_insiders.map((row) => {
      const known = byId.get(row.id);
      const ago = formatHebrewAgo(row.last_filed_at);
      return {
        ...mergePerson(known, {
          ...row,
          subtitle: ago ? `דיווח ${ago}` : row.subtitle,
        }),
        last_filed_at: row.last_filed_at,
      };
    });
    return takeUniqueExplorePeople(
      withPhoto([...politicians, ...insiders].sort(sortExploreByLastFiled)),
      EXPLORE_RAIL_LIMIT
    );
  }, [catalog, recentlyActiveQuery.data, extras.recently_active_insiders]);

  const mostActive = useMemo(
    () =>
      takeUniqueExplorePeople(
        withPhoto(
          extras.most_active.map((p) => mergePerson(catalog.find((c) => c.id === p.id), p))
        ),
        EXPLORE_RAIL_LIMIT
      ),
    [catalog, extras.most_active]
  );

  const fundBooks = useMemo(
    () =>
      takeUniqueExplorePeople(
        withPhoto(
          extras.fund_books.map((p) => mergePerson(catalog.find((c) => c.id === p.id), p))
        ),
        EXPLORE_FEATURED_LIMIT
      ),
    [catalog, extras.fund_books]
  );

  const newProfiles = useMemo(
    () =>
      takeUniqueExplorePeople(
        withPhoto(
          extras.new_profiles.map((p) => mergePerson(catalog.find((c) => c.id === p.id), p))
        ),
        EXPLORE_FEATURED_LIMIT
      ),
    [catalog, extras.new_profiles]
  );

  const shelves = useMemo(() => partitionExploreByKind(catalog), [catalog]);

  // בלי סינון — מדף קצר (16); בצ׳יפ «פוליטיקאים» — כל חברי הקונגרס הפעילים
  const politicians = useMemo(
    () =>
      takeUniqueExplorePeople(
        withPhoto(shelves.politicians),
        // כל חברי הקונגרס הפעילים (מסוננים כבר לפי מספיק נתונים)
        300
      ),
    [shelves.politicians]
  );
  const executives = useMemo(
    () =>
      takeUniqueExplorePeople(
        withPhoto(
          extras.executives.length ? extras.executives : shelves.insiders
        ).map((p) => mergePerson(catalog.find((c) => c.id === p.id), p)),
        EXPLORE_FEATURED_LIMIT
      ),
    [catalog, extras.executives, shelves.insiders]
  );
  const funds = useMemo(
    () =>
      takeUniqueExplorePeople(
        withPhoto(fundBooks.length ? [...fundBooks, ...shelves.funds] : shelves.funds),
        EXPLORE_FEATURED_LIMIT
      ),
    [fundBooks, shelves.funds]
  );

  // חברות ציבוריות (13F) — בלי דרישת תמונה: האווטאר הוא לוגו הטיקר
  const companies = useMemo(
    () => takeUniqueExplorePeople(extras.company_books ?? [], EXPLORE_FEATURED_LIMIT),
    [extras.company_books]
  );

  // מתוצאת חיפוש: קודם סוגרים את השיט, ואחרי שירד — פותחים את הפרופיל (שני מודלים בבת אחת נתקעים ב-iOS)
  const openFromSearch = useCallback(
    (person: ExplorePerson) => {
      closeSearch();
      setTimeout(() => onPersonPress(person), 380);
    },
    [closeSearch, onPersonPress]
  );

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return buildExploreProfileGrid([...catalog, ...companies], { query: q });
  }, [query, catalog, companies]);

  const kindCounts = useMemo(
    () => ({
      politician: shelves.politicians.length,
      insider: shelves.insiders.length,
      fund: shelves.funds.length,
      company: companies.length,
    }),
    [shelves, companies.length]
  );

  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);
  const refreshing =
    gridQuery.isRefetching ||
    extrasQuery.isRefetching ||
    followCountsQuery.isRefetching;

  const onRefresh = useCallback(() => {
    void gridQuery.refetch();
    void followCountsQuery.refetch();
    void excessLeadersQuery.refetch();
    void recentlyActiveQuery.refetch();
    void extrasQuery.refetch();
  }, [
    extrasQuery,
    excessLeadersQuery,
    followCountsQuery,
    gridQuery,
    recentlyActiveQuery,
  ]);

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="חקור"
          onMenuPress={openDrawer}
          rightAccessory={
            <DayNavBlurButton
              onPress={() => {
                void HapticFeedback.selection();
                setSearchOpen(true);
              }}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="חיפוש לפי שם"
            >
              <Ionicons name="search" size={20} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          }
        />

        <ScrollView
          style={darkPoolTransparentFill}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.colors.primary.main}
            />
          }
        >
          {gridQuery.error ? (
            <UICard variant="outlined" padding="md" style={styles.errCard}>
              <Text style={styles.errorText}>
                {(gridQuery.error as Error).message ?? 'שגיאה'}
              </Text>
            </UICard>
          ) : null}

          <ExploreDiscoverySections
            mostFollowed={mostFollowed}
            fundBooks={fundBooks}
            recentlyActive={recentlyActive}
            newProfiles={newProfiles}
            mostActive={mostActive}
            excessLeaders={excessLeaders}
            politicians={politicians}
            executives={executives}
            funds={funds}
            companies={companies}
            kindFilter={null}
            onKindChange={() => {}}
            kindCounts={kindCounts}
            onPersonPress={onPersonPress}
          />
        </ScrollView>
      </SafeAreaView>

      {/* חיפוש לפי שם — שיט: שדה חיפוש (מקלדת נפתחת) ורשת תוצאות */}
      <BottomSheet
        isOpen={searchOpen}
        onClose={closeSearch}
        snapPoints={[0.9]}
        edgeToEdge
        showHandle
        enablePanDownToClose
        showBrandBackground={false}
        backgroundColor={tokens.colors.background.primary}
        topCornerRadius={tokens.borderRadius.xl}
        contentPaddingBottom={0}
      >
        <View style={styles.sheetRoot}>
          <ChatSheetTopoHeader title="חיפוש" onClose={closeSearch} />
          <View style={[styles.searchShell, formFieldShellStyle({ tokens, focused: searchFocused, multiline: false })]}>
            <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="שם פוליטיקאי, מנכ״ל, קרן או חברה"
              placeholderTextColor={tokens.colors.text.tertiary}
              keyboardAppearance={(tokens.colors.background.primary as string) === LIGHT_CANVAS ? 'light' : 'dark'}
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              accessibilityLabel="חיפוש לפי שם"
            />
            {query ? (
              <Pressable
                onPress={() => {
                  void HapticFeedback.selection();
                  setQuery('');
                }}
                hitSlop={10}
                accessibilityLabel="נקה חיפוש"
              >
                <Ionicons name="close-circle" size={18} color={tokens.colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {searchResults == null ? null : searchResults.length ? (
              <View style={styles.resultsGrid}>
                {searchResults.map((person) => (
                  <ExplorePortraitCard
                    key={`${person.kind}:${person.id}`}
                    person={person}
                    onPress={() => openFromSearch(person)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.noResults}>לא נמצאו פרופילים בשם הזה</Text>
            )}
          </ScrollView>
        </View>
      </BottomSheet>
    </ScreenChrome>
  );
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  bottomPad: number
) {
  return StyleSheet.create({
    scroll: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: tokens.spacing.sm,
      paddingBottom: bottomPad,
    },
    sheetRoot: {
      flex: 1,
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 4,
    },
    sheetScroll: { flex: 1 },
    sheetScrollContent: { paddingBottom: 48 },
    searchShell: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingHorizontal: 16,
      gap: APP_LAYOUT.stackGapSmall,
      borderRadius: tokens.borderRadius.search,
      marginBottom: tokens.spacing.md,
    },
    searchInput: {
      ...DARK_POOL_TYPE.body,
      ...darkPoolPhysicalRightText,
      flex: 1,
      color: tokens.colors.text.primary,
      padding: 0,
    },
    resultsGrid: {
      direction: 'rtl',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: EXPLORE_GRID_GAP,
      marginBottom: tokens.spacing.xl,
    },
    noResults: {
      ...darkPoolPhysicalRightText,
      ...DARK_POOL_TYPE.body,
      color: tokens.colors.text.secondary,
      paddingVertical: tokens.spacing.lg,
    },
    errorText: {
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.danger,
      fontSize: DARK_POOL_TYPE.footnote.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.footnote.lineHeight,
      fontWeight: DARK_POOL_TYPE.footnote.fontWeight,
    },
    errCard: { marginBottom: 12 },
  });
}
