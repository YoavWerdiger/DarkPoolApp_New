import { UI_DIR, dirIcon } from '../../lib/i18n/direction';
import { supabase } from '../../lib/supabase';
import i18n from '../../lib/i18n';
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
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { LIGHT_CANVAS } from '../../components/ui/designTokensStatic';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ExplorePortraitCard } from './components/ExplorePortraitCard';
import { InvestorPortrait } from './components/InvestorPortrait';
import { formatInsiderDisplayName } from './utils/investorPlaceholder';
import { congressMemberLabel, isKnownCongressMember } from './utils/congressGender';
import { ltrNameText, toDataIsland } from './utils/bidi';
import { DarkPoolSectionHeader } from './components/DarkPoolSectionHeader';
import { CHROME_UICARD } from '../../components/ui/chromeControl';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { useChatSheetDismiss } from '../../components/chat/ChatBottomSheet';
import { DAY_NAV_BUTTON_SIZE, DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE, headerExitButtonFill } from '../../components/ui/DayNavBlurButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { hydrateQueryFromDisk, persistQueryToDisk } from '../../services/darkpool/feedDiskCache';
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
const EXPLORE_GRID_KEY = appQueryKeys.exploreGridProfiles;
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

const EXPLORE_PERSISTED_KEYS: readonly (readonly unknown[])[] = [
  appQueryKeys.exploreGridProfiles,
  appQueryKeys.exploreFollowCounts,
  appQueryKeys.exploreExcessLeaders,
  appQueryKeys.exploreRecentlyActive,
  appQueryKeys.exploreDiscoveryExtras,
];

/** שומר query לדיסק אחרי שליפה אמיתית (לא initialData / placeholder) */
function usePersistQuery(
  key: readonly unknown[],
  q: { data: unknown; dataUpdatedAt: number; isSuccess: boolean; isPlaceholderData: boolean },
) {
  useEffect(() => {
    if (q.isSuccess && !q.isPlaceholderData) persistQueryToDisk(key, q.data, q.dataUpdatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, q.dataUpdatedAt]);
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
  // פיתוח בלבד: EXPO_PUBLIC_DEV_EXPLORE_SEARCH=1 — פותח את שיט החיפוש (לצילומי סימולטור)
  useEffect(() => {
    if (__DEV__ && process.env.EXPO_PUBLIC_DEV_EXPLORE_SEARCH) {
      const t = setTimeout(() => setSearchOpen(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

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

  // כניסה אופטימיסטית: המדפים האחרונים מהדיסק (נטענים גם בהפעלה — warmAppCache), ושמירה אחרי כל שליפה
  useEffect(() => {
    for (const key of EXPLORE_PERSISTED_KEYS) void hydrateQueryFromDisk(key);
  }, []);
  usePersistQuery(EXPLORE_GRID_KEY, gridQuery);
  usePersistQuery(appQueryKeys.exploreFollowCounts, followCountsQuery);
  usePersistQuery(appQueryKeys.exploreExcessLeaders, excessLeadersQuery);
  usePersistQuery(appQueryKeys.exploreRecentlyActive, recentlyActiveQuery);
  usePersistQuery(appQueryKeys.exploreDiscoveryExtras, extrasQuery);

  // מדף שהנתונים שלו עוד לא הגיעו — שלד במקומו (ולא רשימת ביניים שמתחלפת ומקפיצה את הסדר)
  const gridLoading = gridQuery.dataUpdatedAt === 0 && gridQuery.isFetching;
  const extrasLoading = extrasQuery.data === undefined;
  const sectionLoading = {
    followed: followCountsQuery.data === undefined,
    excess: excessLeadersQuery.data === undefined,
    recent: recentlyActiveQuery.data === undefined || extrasLoading,
    extras: extrasLoading,
    grid: gridLoading,
  };

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
    // עד שמספרי העוקבים מגיעים — שלד (לא הקטלוג בסדר זמני שמתחלף)
    if (followCountsQuery.data === undefined) return [];
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
          subtitle: known?.subtitle ?? i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s1'),
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
            subtitle: ago ? i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s2', { v0: ago }) : i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s3'),
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
          subtitle: ago ? i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s2', { v0: ago }) : row.subtitle,
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

  /** הצעות לשיט החיפוש לפני הקלדה — בלי כפילויות בין הרשימות */
  const searchSuggestions = useMemo(() => {
    // רשימה אחת: הכי במעקב, ואחריהם פעילים לאחרונה — בלי כפילויות, עד 10
    const seen = new Set<string>();
    const out: ExplorePerson[] = [];
    for (const p of [...mostFollowed, ...recentlyActive]) {
      const k = `${p.kind}:${p.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
      if (out.length >= 10) break;
    }
    return out;
  }, [mostFollowed, recentlyActive]);

  // YTD להצעות — RPC אחד לכל הרשימה (מהפורטפוליו המחושב בשרת); בלי נתון — בלי תג
  const suggestionIds = useMemo(() => searchSuggestions.map((p) => p.id), [searchSuggestions]);
  const ytdQuery = useQuery({
    queryKey: ['darkpool', 'explore', 'suggestion-ytd', suggestionIds.join('|')],
    enabled: searchOpen && suggestionIds.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dark_pool_person_ytd', { p_ids: suggestionIds });
      if (error) return new Map<string, number>();
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { person_id: string; kind: string; ytd: number | string | null }[]) {
        const v = r.ytd == null ? NaN : Number(r.ytd);
        if (Number.isFinite(v)) m.set(`${r.kind}:${r.person_id}`, v);
      }
      return m;
    },
  });

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
          title={i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s4')}
          onMenuPress={openDrawer}
          rightAccessory={
            <DayNavBlurButton
              onPress={() => {
                void HapticFeedback.selection();
                setSearchOpen(true);
              }}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel={i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s5')}
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
                {(gridQuery.error as Error).message ?? i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s6')}
              </Text>
            </UICard>
          ) : null}

          <ExploreDiscoverySections
            loading={sectionLoading}
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
          {/* שורה אחת: כפתור סגירה + שדה החיפוש (בלי כותרת נפרדת) */}
          <View style={styles.searchTopRow}>
            <SearchSheetClose onClose={closeSearch} />
          <View style={[styles.searchShell, formFieldShellStyle({ tokens, focused: searchFocused, multiline: false })]}>
            <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s13')}
              placeholderTextColor={tokens.colors.text.tertiary}
              keyboardAppearance={(tokens.colors.background.primary as string) === LIGHT_CANVAS ? 'light' : 'dark'}
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              accessibilityLabel={i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s5')}
            />
            {query ? (
              <Pressable
                onPress={() => {
                  void HapticFeedback.selection();
                  setQuery('');
                }}
                hitSlop={10}
                accessibilityLabel={i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s9')}
              >
                <Ionicons name="close-circle" size={18} color={tokens.colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {searchResults == null ? (
              // בלי טקסט: חיפוש מהיר — הכי במעקב ופעילים לאחרונה, לחיצה פותחת את הפרופיל
              <View style={styles.suggestions}>
                {searchSuggestions.length ? (
                  <View>
                    <DarkPoolSectionHeader title={i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s14')} />
                    <UICard {...CHROME_UICARD} style={styles.suggestionCard}>
                      {searchSuggestions.map((person, i) => (
                        <React.Fragment key={`${person.kind}:${person.id}`}>
                          {i > 0 ? <View style={styles.suggestionDivider} /> : null}
                          <SearchSuggestionRow
                            person={person}
                            ytd={ytdQuery.data?.get(`${person.kind}:${person.id}`)}
                            onPress={() => openFromSearch(person)}
                          />
                        </React.Fragment>
                      ))}
                    </UICard>
                  </View>
                ) : null}
              </View>
            ) : searchResults.length ? (
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
              <Text style={styles.noResults}>{i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s10')}</Text>
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
      direction: UI_DIR,
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: tokens.spacing.sm,
      paddingBottom: bottomPad,
    },
    sheetRoot: {
      flex: 1,
      direction: UI_DIR,
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 4,
    },
    sheetScroll: { flex: 1 },
    sheetScrollContent: { paddingBottom: 48 },
    searchShell: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingHorizontal: 16,
      gap: APP_LAYOUT.stackGapSmall,
      borderRadius: tokens.borderRadius.search,
      flex: 1,
      minWidth: 0,
    },
    searchTopRow: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapSmall,
      marginTop: APP_LAYOUT.stackGapSmall,
      marginBottom: APP_LAYOUT.componentGap,
    },
    searchInput: {
      ...DARK_POOL_TYPE.body,
      ...darkPoolPhysicalRightText,
      flex: 1,
      color: tokens.colors.text.primary,
      padding: 0,
    },
    resultsGrid: {
      direction: UI_DIR,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: EXPLORE_GRID_GAP,
      marginBottom: tokens.spacing.xl,
    },
    suggestions: { direction: UI_DIR },
    // כמו כרטיס «במעקב» (DarkPoolFollowingScreen)
    suggestionCard: {
      marginBottom: APP_LAYOUT.sectionGap,
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.cardSolid,
      borderWidth: 0,
      ...tokens.shadows.none,
    },
    suggestionDivider: {
      height: 1,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: APP_LAYOUT.cardPadding,
      alignSelf: 'stretch',
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

/** שורת הצעה בשיט החיפוש — פורטרט 40 · שם · שברון (בלי שורת משנה) */
function SearchSuggestionRow({ person, ytd, onPress }: { person: ExplorePerson; ytd?: number; onPress: () => void }) {
  const tokens = useDesignTokens();
  const name = person.kind === 'insider' ? formatInsiderDisplayName(person.name) : person.name;
  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.selection();
        onPress();
      }}
      style={suggestionStyles.row}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <InvestorPortrait
        name={name}
        imageUrl={person.image_url}
        ticker={person.ticker}
        kind={person.kind}
        personId={person.id}
        logoTicker={person.entity_type === 'company' ? person.ticker : undefined}
        layout="circle"
        size={40}
        style={[suggestionStyles.avatar, { backgroundColor: tokens.colors.background.cardSolid }]}
      />
      <View style={suggestionStyles.gap} />
      <Text style={[suggestionStyles.name, { color: tokens.colors.text.primary }]} numberOfLines={1}>
        {name}
      </Text>
      {ytd != null ? (
        // פיל YTD בשורה אחת (כמו פיל התזמון בדיווחי רווח): «YTD» אפור · תשואה בירוק/אדום
        <View
          style={[
            suggestionStyles.ytdBadge,
            { backgroundColor: `${ytd >= 0 ? tokens.colors.primary.main : tokens.colors.text.danger}18` },
          ]}
        >
          <Text style={[suggestionStyles.ytdLabel, { color: tokens.colors.text.secondary }]}>YTD</Text>
          <Text
            style={[suggestionStyles.ytdValue, { color: ytd >= 0 ? tokens.colors.primary.main : tokens.colors.text.danger }]}
            numberOfLines={1}
          >
            {toDataIsland(`${ytd >= 0 ? '+' : '−'}${Math.abs(ytd).toFixed(2)}%`)}
          </Text>
        </View>
      ) : (
        <Ionicons name={dirIcon('chevron-back')} size={18} color={tokens.colors.text.tertiary} />
      )}
    </Pressable>
  );
}

/** כפתור סגירה בשורת החיפוש — סגירה מונפשת של השיט */
function SearchSheetClose({ onClose }: { onClose: () => void }) {
  const tokens = useDesignTokens();
  const dismiss = useChatSheetDismiss(onClose);
  return (
    <DayNavBlurButton
      onPress={dismiss}
      size={DAY_NAV_BUTTON_SIZE}
      glass={false}
      style={{ backgroundColor: headerExitButtonFill(tokens.colors.background.cardSolid) }}
      accessibilityLabel={i18n.t('auto.screens__DarkPool__DarkPoolExploreScreen.s9')}
    >
      <Ionicons name="close" size={20} color={tokens.colors.text.primary} />
    </DayNavBlurButton>
  );
}

// = FollowedRow ב-DarkPoolFollowingScreen
const suggestionStyles = StyleSheet.create({
  row: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  avatar: { overflow: 'hidden', borderWidth: 0 },
  // פיל בשורה אחת — גובה 24 ו-caption כמו פיל התזמון (טופו)
  ytdBadge: {
    flexShrink: 0,
    marginStart: APP_LAYOUT.cardTitleToBodyGap,
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 9999,
  },
  ytdLabel: { ...DARK_POOL_TYPE.caption },
  ytdValue: { ...DARK_POOL_TYPE.caption, fontWeight: '600', fontVariant: ['tabular-nums'], writingDirection: 'ltr' },
  gap: { width: APP_LAYOUT.cardTitleToBodyGap, flexShrink: 0 },
  text: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  name: {
    ...ltrNameText,
    flex: 1,
    minWidth: 0,
    fontSize: DARK_POOL_TYPE.cardBody.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
    fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
  },
  sub: {
    ...darkPoolPhysicalRightText,
    width: '100%',
    fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
    fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
  },
});
