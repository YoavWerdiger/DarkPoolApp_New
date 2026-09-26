/**
 * גילוי — מדפי הקטגוריות.
 * בלי גריד «כל הפרופילים», בלי "$ copied" ובלי דירוג ALL משוחזר.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
  type ExploreKindFilter,
  withResolvedPhoto,
} from './utils/exploreGrid';
import { portraitDisplayUrl } from './utils/investorPlaceholder';
import { darkPoolPhysicalRightText, darkPoolRtlContent, darkPoolTransparentFill } from './darkPoolLayout';
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

const EXPLORE_GRID_KEY = [...appQueryKeys.uwExplore, 'grid-profiles'] as const;
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
  const [kindFilter, setKindFilter] = useState<ExploreKindFilter | null>(null);

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
      buildExploreProfileGrid(
        filterCuratedExplorePeople([
          ...curatedProfiles,
          ...extras.most_active,
          ...extras.fund_books,
          ...extras.new_profiles,
          ...extras.executives,
          ...extras.recently_active_insiders,
        ])
      ),
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

  const politicians = useMemo(
    () => takeUniqueExplorePeople(withPhoto(shelves.politicians), EXPLORE_FEATURED_LIMIT),
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

  const kindCounts = useMemo(
    () => ({
      politician: shelves.politicians.length,
      insider: shelves.insiders.length,
      fund: shelves.funds.length,
    }),
    [shelves]
  );

  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);
  const hasFollowCounts = mostFollowed.some((p) => (p.followers_count ?? 0) > 0);
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
      <StatusBar style="light" />
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="חקור"
          onMenuPress={openDrawer}
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
            hasFollowCounts={hasFollowCounts}
            fundBooks={fundBooks}
            recentlyActive={recentlyActive}
            newProfiles={newProfiles}
            mostActive={mostActive}
            excessLeaders={excessLeaders}
            politicians={politicians}
            executives={executives}
            funds={funds}
            kindFilter={kindFilter}
            onKindChange={setKindFilter}
            kindCounts={kindCounts}
            onPersonPress={onPersonPress}
          />
        </ScrollView>
      </SafeAreaView>
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
      paddingBottom: bottomPad + 24,
    },
    errorText: {
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.danger,
      fontSize: tokens.typography.footnote.size,
      lineHeight: tokens.typography.footnote.lineHeight,
      fontWeight: tokens.typography.footnote.weight,
      letterSpacing: tokens.typography.footnote.letterSpacing,
    },
    errCard: { marginBottom: 12 },
  });
}
