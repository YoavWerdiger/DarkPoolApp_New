/**
 * חיפוש אנשים — נפתח מהבית (לא טאב).
 * לחיצה על אדם → פרופיל עם גרף תיק.
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
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { useInvestorSearch } from '../../hooks/useInvestorSearch';
import { fetchExplorePeopleMerged } from '../../services/darkpool/featuredProfilesService';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { ExplorePeopleGrid } from './components/ExplorePeopleGrid';
import { ExploreKindFilterBar } from './components/ExploreKindFilter';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';
import {
  buildExploreProfileGrid,
  type ExploreKindFilter,
  withResolvedPhoto,
} from './utils/exploreGrid';

async function loadExploreGridPeople(): Promise<ExplorePerson[]> {
  return fetchExplorePeopleMerged({ requirePhoto: true });
}

export default function DarkPoolExploreScreen() {
  const tokens = useDesignTokens();
  const stackNav = useDarkPoolStackNav();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<ExploreKindFilter>('all');
  const search = useInvestorSearch(query);
  const isSearching = query.trim().length >= 2;

  const gridQuery = useQuery({
    queryKey: [...appQueryKeys.uwExplore, 'grid-profiles'],
    queryFn: loadExploreGridPeople,
  });

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
    () => buildExploreProfileGrid(gridQuery.data ?? []),
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
  const loading = gridQuery.isLoading && !gridQuery.data;
  const displayPeople = isSearching ? searchGrid : filtered;

  return (
    <ScreenChrome rtl withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ChatSubScreenHeader
          inRtlTree
          title="חיפוש אנשים"
          subtitle="לחץ על אדם כדי לראות את שווי התיק"
          onBack={() => stackNav.goBack()}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={gridQuery.isRefetching}
                onRefresh={() => void gridQuery.refetch()}
                tintColor={tokens.colors.primary.main}
              />
            }
          >
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="שם / טיקר..."
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
              <ActivityIndicator
                color={tokens.colors.primary.main}
                style={{ marginVertical: 24 }}
              />
            ) : null}

            <ExplorePeopleGrid
              people={displayPeople}
              onPersonPress={onPersonPress}
              emptyMessage={
                isSearching ? 'לא נמצא פרופיל' : 'אין פרופילים — משוך לרענון'
              }
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </ScreenChrome>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    scroll: { paddingBottom: 40 },
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { color: tokens.colors.text.danger, fontSize: 13, textAlign: 'left' },
    errCard: { marginHorizontal: tokens.layout.screenPadding, marginBottom: 12 },
  });
}
