/**
 * גילוי — חיפוש ומעקב אחרי פוליטיקאים ובכירי חברות (לא פיד עסקאות).
 */

import React, { useCallback, useMemo } from 'react';
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
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import { useDarkPoolExplore } from '../../hooks/useDarkPoolExplore';
import { useFeaturedProfiles } from '../../hooks/useFeaturedProfiles';
import { useInvestorSearch } from '../../hooks/useInvestorSearch';
import { featuredToExplorePerson } from '../../services/darkpool/featuredProfilesService';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useNavigation } from '@react-navigation/native';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { UwRateLimitBanner } from './components/UwRateLimitBanner';
import { ExploreSection } from './components/ExploreSection';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';
import { DARK_POOL_SEC_PRODUCTION } from '../../types/darkpool.types';

export default function DarkPoolExploreScreen() {
  const tokens = useDesignTokens();
  const drawerNav = useNavigation();
  const stackNav = useDarkPoolStackNav();
  const bottomPad = useDarkPoolTabBarHeight();
  const { data, loading, refreshing, error, refetch } = useDarkPoolExplore();
  const featured = useFeaturedProfiles();
  const [query, setQuery] = React.useState('');
  const search = useInvestorSearch(query);
  const isSearching = query.trim().length >= 2;

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
      void HapticFeedback.impactLight();
      stackNav.navigate('DarkPoolInvestor', {
        id: person.id,
        kind: person.kind,
        ticker: person.ticker,
        nameHint: person.name,
        imageHint: person.image_url,
      });
    },
    [stackNav]
  );

  const filterList = useCallback(
    (list: ExplorePerson[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return list;
      return list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          (p.ticker || '').toLowerCase().includes(q)
      );
    },
    [query]
  );

  const politicianPeople = useMemo(() => {
    if (!data) return [] as ExplorePerson[];
    const merged = new Map<string, ExplorePerson>();
    for (const p of [...(data.top_active ?? []), ...(data.recently_active ?? [])]) {
      if (p.kind === 'politician' && !merged.has(p.id)) merged.set(p.id, p);
    }
    for (const p of data.most_followed ?? []) {
      if (p.kind === 'politician' && !merged.has(p.id)) merged.set(p.id, p);
    }
    return Array.from(merged.values()).slice(0, 16);
  }, [data]);

  const insiderPeople = useMemo(() => {
    if (!data) return [] as ExplorePerson[];
    const fromDb = data.insiders_with_photo?.length
      ? data.insiders_with_photo
      : data.executives ?? [];
    return filterList(fromDb).slice(0, 16);
  }, [data, filterList]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { paddingBottom: bottomPad, direction: 'rtl' },
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
          direction: 'rtl',
        },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        errorText: {
          color: tokens.colors.text.danger,
          fontSize: 13,
          textAlign: 'left',
          writingDirection: 'rtl',
        },
        emptyExplore: {
          marginHorizontal: tokens.layout.screenPadding,
          marginBottom: tokens.spacing.lg,
        },
        emptyText: {
          fontSize: 14,
          color: tokens.colors.text.tertiary,
          textAlign: 'left',
          lineHeight: 20,
        },
        searchHint: {
          marginHorizontal: tokens.layout.screenPadding,
          marginBottom: tokens.spacing.sm,
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'left',
        },
      }),
    [tokens, bottomPad]
  );

  const featuredPeople = useMemo(
    () => featured.list.map(featuredToExplorePerson),
    [featured.list]
  );

  const handleRefresh = useCallback(() => {
    void refetch();
    void featured.refetch();
  }, [refetch, featured.refetch]);

  if (loading && !data) {
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

  return (
    <ScreenChrome rtl withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="גילוי"
          subtitle="מי לעקוב אחריו"
          onMenuPress={openDrawer}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={tokens.colors.primary.main}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="חיפוש לפי שם או טיקר"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {isSearching ? (
            <>
              {search.loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={tokens.colors.primary.main} />
                </View>
              ) : null}
              {search.error ? (
                <UICard
                  variant="outlined"
                  padding="md"
                  style={{ marginHorizontal: tokens.layout.screenPadding, marginBottom: 12 }}
                >
                  <Text style={styles.errorText}>{search.error}</Text>
                </UICard>
              ) : null}
              {search.results.length > 0 ? (
                <ExploreSection
                  title="תוצאות חיפוש"
                  subtitle={`«${query.trim()}»`}
                  people={search.results}
                  onPersonPress={onPersonPress}
                />
              ) : !search.loading && !search.error ? (
                <UICard variant="outlined" padding="md" style={styles.emptyExplore}>
                  <Text style={styles.emptyText}>לא נמצאו תוצאות. נסה שם אחר או טיקר.</Text>
                </UICard>
              ) : null}
            </>
          ) : (
            <>
          {featuredPeople.length > 0 ? (
            <ExploreSection
              title="מומלצים"
              subtitle="נבחרו ידנית מנתונים ציבוריים"
              people={featuredPeople}
              variant="large"
              onPersonPress={onPersonPress}
            />
          ) : null}

          {error ? (
            <UICard
              variant="outlined"
              padding="md"
              style={{ marginHorizontal: tokens.layout.screenPadding, marginBottom: 12 }}
            >
              <Text style={styles.errorText}>{error}</Text>
            </UICard>
          ) : null}

          {!DARK_POOL_SEC_PRODUCTION ? (
            <UwRateLimitBanner warnings={data?.warnings} />
          ) : null}

          {politicianPeople.length > 0 ? (
            <ExploreSection
              title="פוליטיקאים"
              subtitle="עסקאות מדיווחי STIR · STOCK Act"
              people={politicianPeople}
              variant="large"
              onPersonPress={onPersonPress}
            />
          ) : null}

          {insiderPeople.length > 0 ? (
            <ExploreSection
              title="בכירי חברות"
              subtitle="מדיווחי Form 4 · SEC"
              people={insiderPeople}
              onPersonPress={onPersonPress}
            />
          ) : null}

          {!featuredPeople.length && !politicianPeople.length && !insiderPeople.length ? (
            <UICard variant="outlined" padding="md" style={styles.emptyExplore}>
              <Text style={styles.emptyText}>
                אין עדיין משקיעים להצגה. משוך למטה לרענון — הנתונים יופיעו אחרי סנכרון Form 4 ו-STIR.
              </Text>
            </UICard>
          ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}
