/**
 * גילוי — גריד פרופילים עם תמונות (Insider Wave).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { useDarkPoolExplore } from '../../hooks/useDarkPoolExplore';
import { useInvestorSearch } from '../../hooks/useInvestorSearch';
import { fetchExploreProfilesGrid } from '../../services/darkpool/personPortraitService';
import { triggerPersonPortraitSync } from '../../services/darkpool/darkPoolDbCacheService';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useNavigation } from '@react-navigation/native';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { ExplorePeopleGrid } from './components/ExplorePeopleGrid';
import { ExploreKindFilterBar } from './components/ExploreKindFilter';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';
import {
  buildExploreProfileGrid,
  collectExploreSources,
  type ExploreKindFilter,
  withResolvedPhoto,
} from './utils/exploreGrid';

async function loadExploreGridPeople(): Promise<ExplorePerson[]> {
  return fetchExploreProfilesGrid();
}

export default function DarkPoolExploreScreen() {
  const tokens = useDesignTokens();
  const drawerNav = useNavigation();
  const stackNav = useDarkPoolStackNav();
  const bottomPad = useDarkPoolTabBarHeight();
  const explore = useDarkPoolExplore();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<ExploreKindFilter>('all');
  const search = useInvestorSearch(query);
  const isSearching = query.trim().length >= 2;

  const gridQuery = useQuery({
    queryKey: [...appQueryKeys.uwExplore, 'grid-profiles'],
    queryFn: loadExploreGridPeople,
  });

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(drawerNav as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [drawerNav]);

  const onPersonPress = useCallback(
    (person: ExplorePerson) => {
      const resolved = withResolvedPhoto(person);
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

  const fallbackSources = useMemo(
    () => collectExploreSources(explore.data, []),
    [explore.data]
  );

  const allProfiles = useMemo(() => {
    const portraitRows = gridQuery.data ?? [];
    const merged = buildExploreProfileGrid(
      portraitRows.length ? portraitRows : fallbackSources
    );
    if (merged.length) return merged;
    return buildExploreProfileGrid(fallbackSources);
  }, [gridQuery.data, fallbackSources]);

  const filtered = useMemo(
    () =>
      buildExploreProfileGrid(allProfiles, {
        kind: kindFilter,
        query: isSearching ? undefined : query.trim() || undefined,
      }),
    [allProfiles, kindFilter, query, isSearching]
  );

  const searchGrid = useMemo(
    () =>
      buildExploreProfileGrid(search.results.map(withResolvedPhoto), {
        kind: kindFilter,
      }),
    [search.results, kindFilter]
  );

  const counts = useMemo(
    () => ({
      all: allProfiles.length,
      politician: allProfiles.filter((p) => p.kind === 'politician').length,
      insider: allProfiles.filter((p) => p.kind === 'insider').length,
    }),
    [allProfiles]
  );

  const handleRefresh = useCallback(async () => {
    await triggerPersonPortraitSync(true).catch(() => undefined);
    await Promise.all([gridQuery.refetch(), explore.refetch()]);
  }, [gridQuery, explore]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { paddingBottom: bottomPad },
        searchWrap: {
          marginHorizontal: tokens.layout.screenPadding,
          marginTop: tokens.spacing.sm,
          marginBottom: tokens.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: tokens.borderRadius.lg,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.04)',
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        searchInput: {
          flex: 1,
          fontSize: 15,
          color: tokens.colors.text.primary,
          textAlign: 'left',
          writingDirection: 'rtl',
        },
        hint: {
          marginHorizontal: tokens.layout.screenPadding,
          marginBottom: tokens.spacing.sm,
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'left',
        },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        errorText: { color: tokens.colors.text.danger, fontSize: 13, textAlign: 'left' },
        errCard: { marginHorizontal: tokens.layout.screenPadding, marginBottom: 12 },
      }),
    [tokens, bottomPad]
  );

  const loading =
    (explore.loading && !explore.data) || (gridQuery.isLoading && !gridQuery.data);

  if (loading) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <MainDrawerScreenHeader inRtlTree title="גילוי" onMenuPress={openDrawer} />
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  const displayPeople = isSearching ? searchGrid : filtered;
  const refreshing = explore.refreshing || gridQuery.isRefetching;

  return (
    <ScreenChrome rtl withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="גילוי"
          subtitle={`${counts.all} פרופילים`}
          onMenuPress={openDrawer}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={tokens.colors.primary.main}
            />
          }
        >
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="חיפוש פרופיל..."
              placeholderTextColor={tokens.colors.text.tertiary}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {!isSearching ? (
            <>
              <Text style={styles.hint}>לחץ על פרופיל לפתיחת תיק · תמונות מ-STIR ו-Form 4</Text>
              <ExploreKindFilterBar
                value={kindFilter}
                onChange={setKindFilter}
                counts={counts}
              />
            </>
          ) : null}

          {(explore.error || gridQuery.error) && (
            <UICard variant="outlined" padding="md" style={styles.errCard}>
              <Text style={styles.errorText}>
                {(explore.error || (gridQuery.error as Error)?.message) ?? 'שגיאה'}
              </Text>
            </UICard>
          )}

          {isSearching && search.loading ? (
            <ActivityIndicator
              color={tokens.colors.primary.main}
              style={{ marginVertical: 24 }}
            />
          ) : null}

          <ExplorePeopleGrid
            people={displayPeople}
            onPersonPress={onPersonPress}
            emptyMessage={
              isSearching
                ? 'לא נמצא פרופיל'
                : 'אין פרופילים. משוך למטה לסנכרון תמונות.'
            }
          />
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}
