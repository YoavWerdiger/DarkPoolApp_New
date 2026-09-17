/**
 * חיפוש / גילוי לוויתנים.
 * גריד ברירת מחדל = CURATED_EXPLORE_PROFILES בלבד.
 * חיפוש חופשי יכול להחזיר תוצאות נוספות; לחיצה → פרופיל.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ProfileGridSkeleton } from '../../components/ui/SkeletonLoader';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { useInvestorSearch } from '../../hooks/useInvestorSearch';
import {
  fetchExplorePeopleMerged,
  getExplorePeopleMergedSync,
} from '../../services/darkpool/featuredProfilesService';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { ExploreProfileGrid } from './components/ExploreProfileGrid';
import { ExploreKindFilterBar } from './components/ExploreKindFilter';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';
import {
  buildExploreProfileGrid,
  type ExploreKindFilter,
  withResolvedPhoto,
} from './utils/exploreGrid';
import { portraitDisplayUrl } from './utils/investorPlaceholder';
import { hebrewText, rowMixed } from './utils/bidi';

const EXPLORE_GRID_KEY = [...appQueryKeys.uwExplore, 'grid-profiles'] as const;
const CURATED_SYNC = getExplorePeopleMergedSync({ requirePhoto: true });

async function loadExploreGridPeople(): Promise<ExplorePerson[]> {
  return fetchExplorePeopleMerged({ requirePhoto: true });
}

function prefetchPortraitUris(people: ExplorePerson[]) {
  const urls = people
    .slice(0, 16)
    .map((p) => portraitDisplayUrl(p.image_url, 480) ?? p.image_url)
    .filter((u): u is string => !!u?.trim());
  if (urls.length) {
    void ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
  }
}

export default function DarkPoolExploreScreen() {
  const tokens = useDesignTokens();
  const stackNav = useDarkPoolStackNav();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<ExploreKindFilter>('all');
  const search = useInvestorSearch(query);
  const isSearching = query.trim().length >= 2;

  const gridQuery = useQuery({
    queryKey: EXPLORE_GRID_KEY,
    queryFn: loadExploreGridPeople,
    initialData: CURATED_SYNC,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    prefetchPortraitUris(gridQuery.data ?? CURATED_SYNC);
  }, [gridQuery.data]);

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

  const allProfiles = useMemo(
    () => buildExploreProfileGrid(gridQuery.data ?? CURATED_SYNC),
    [gridQuery.data]
  );

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
      insider: allProfiles.filter(
        (p) => p.kind === 'insider' || p.kind === 'fund_manager'
      ).length,
    }),
    [allProfiles]
  );

  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const displayPeople = isSearching ? searchGrid : filtered;

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="שם לוויתן / טיקר..."
            placeholderTextColor={tokens.colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>

        {!isSearching ? (
          <ExploreKindFilterBar
            value={kindFilter}
            onChange={setKindFilter}
            counts={counts}
          />
        ) : null}

        {gridQuery.error ? (
          <UICard variant="outlined" padding="md" style={styles.errCard}>
            <Text style={styles.errorText}>
              {(gridQuery.error as Error).message ?? 'שגיאה'}
            </Text>
          </UICard>
        ) : null}

        {isSearching && search.loading ? (
          <View style={{ marginVertical: 24 }}>
            <ProfileGridSkeleton columns={2} rows={2} delay={0} />
          </View>
        ) : null}
      </View>
    ),
    [
      styles,
      tokens.colors.text.tertiary,
      tokens.colors.primary.main,
      query,
      isSearching,
      kindFilter,
      counts,
      gridQuery.error,
      search.loading,
    ]
  );

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ChatSubScreenHeader
          inRtlTree
          title="גילוי לוויתנים"
          subtitle="לחץ על פרופיל כדי לראות את שווי התיק"
          onBack={() => stackNav.goBack()}
        />

        <ExploreProfileGrid
          people={displayPeople}
          onPersonPress={onPersonPress}
          ListHeaderComponent={listHeader}
          refreshing={gridQuery.isRefetching}
          onRefresh={() => void gridQuery.refetch()}
          contentPaddingBottom={40}
          emptyMessage={
            isSearching ? 'לא נמצא פרופיל' : 'אין פרופילים — משוך לרענון'
          }
        />
      </SafeAreaView>
    </ScreenChrome>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    searchWrap: {
      marginTop: tokens.spacing.sm,
      marginBottom: tokens.spacing.md,
      ...rowMixed,
      gap: 10,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: 'rgba(255,255,255,0.04)',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    searchInput: {
      ...hebrewText,
      flex: 1,
      fontSize: tokens.typography.callout.size,
      lineHeight: tokens.typography.callout.lineHeight,
      fontWeight: tokens.typography.callout.weight,
      letterSpacing: tokens.typography.letterSpacing.normal,
      color: tokens.colors.text.primary,
    },
    errorText: {
      ...hebrewText,
      color: tokens.colors.text.danger,
      fontSize: tokens.typography.footnote.size,
      lineHeight: tokens.typography.footnote.lineHeight,
      fontWeight: tokens.typography.footnote.weight,
      letterSpacing: tokens.typography.footnote.letterSpacing,
    },
    errCard: { marginBottom: 12 },
  });
}
