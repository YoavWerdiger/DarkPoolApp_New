/**
 * רשימת בכירים/פוליטיקאים במעקב + קיצור לגילוי.
 */

import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UIButton from '../../components/ui/UIButton';
import UICard from '../../components/ui/UICard';
import { CHROME_UICARD, chromeSurfaceCardStyle } from '../../components/ui/chromeControl';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ListItemSkeleton, CardSkeleton } from '../../components/ui/SkeletonLoader';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import { prefetchPersonPortfolio } from '../../services/darkpool/prefetchPersonPortfolio';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useFollowedInvestors } from '../../hooks/useFollowedInvestors';
import { darkPoolRtlContent, darkPoolPhysicalRightText, darkPoolSectionTitleStyle, darkPoolTransparentFill, DARK_POOL_TYPE } from './darkPoolLayout';
import { unfollowInvestor, type FollowedInvestor } from '../../services/darkpool/darkPoolFollowService';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import type { DarkPoolTabParamList } from '../../navigation/DarkPoolTabs';
import { useDarkPoolFollowingFeed } from '../../hooks/useDarkPoolFollowingFeed';
import { InvestorPortrait } from './components/InvestorPortrait';
import { ActivityFeedCard } from './components/ActivityFeedCard';
import {
  followingActivityToTradeDetail,
  hasTradeDetailPayload,
} from './utils/tradeDetailParams';

export default function DarkPoolFollowingScreen() {
  const tokens = useDesignTokens();
  const drawerNav = useNavigation();
  const tabNav = useNavigation<BottomTabNavigationProp<DarkPoolTabParamList>>();
  const stackNav = useDarkPoolStackNav();
  const bottomPad = useDarkPoolTabBarHeight();
  const { list, loading, refetch } = useFollowedInvestors();
  const activityFeed = useDarkPoolFollowingFeed();

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(drawerNav as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [drawerNav]);

  const openProfile = useCallback(
    (person: FollowedInvestor) => {
      void HapticFeedback.selection();
      prefetchPersonPortfolio({
        id: person.id,
        kind: person.kind,
        ticker: person.ticker,
        nameHint: person.name,
      });
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

  const goExplore = useCallback(() => {
    tabNav.navigate('DarkPoolExplore');
  }, [tabNav]);

  const openActivityPerson = useCallback(
    (item: { person_id: string; person_kind: 'politician' | 'insider'; person_name: string; person_image_url: string | null; ticker: string }) => {
      prefetchPersonPortfolio({
        id: item.person_id,
        kind: item.person_kind,
        nameHint: item.person_name,
        ticker: item.person_kind === 'insider' ? item.ticker : undefined,
      });
      stackNav.navigate('DarkPoolInvestor', {
        id: item.person_id,
        kind: item.person_kind,
        nameHint: item.person_name,
        imageHint: item.person_image_url,
        ticker: item.person_kind === 'insider' ? item.ticker : undefined,
      });
    },
    [stackNav]
  );

  const openActivityDetail = useCallback(
    (item: Parameters<typeof followingActivityToTradeDetail>[0]) => {
      const params = followingActivityToTradeDetail(item);
      if (!hasTradeDetailPayload(params)) return;
      void HapticFeedback.selection();
      stackNav.navigate('DarkPoolTradeDetail', params);
    },
    [stackNav]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          direction: 'rtl',
          paddingBottom: bottomPad,
          paddingHorizontal: tokens.layout?.screenPadding ?? 20,
        },
        empty: {
          alignItems: 'center',
          paddingVertical: 48,
          gap: 12,
        },
        emptyText: {
          ...darkPoolPhysicalRightText,
          fontSize: DARK_POOL_TYPE.body.fontSize,
          lineHeight: DARK_POOL_TYPE.body.lineHeight,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
        },
        followCard: {
          marginBottom: 8,
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
          ...chromeSurfaceCardStyle(tokens),
          ...tokens.shadows.none,
        },
        row: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 12,
        },
        avatar: {},
        textCol: { flex: 1, minWidth: 0, alignItems: 'stretch' },
        name: {
          ...darkPoolPhysicalRightText,
          width: '100%',
          fontSize: DARK_POOL_TYPE.body.fontSize,
          lineHeight: 20,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        },
        sub: {
          ...darkPoolPhysicalRightText,
          width: '100%',
          marginTop: 2,
          fontSize: DARK_POOL_TYPE.sectionSubtitle.fontSize,
          lineHeight: DARK_POOL_TYPE.sectionSubtitle.lineHeight,
          color: tokens.colors.text.tertiary,
        },
        actions: {
          marginTop: tokens.spacing.md,
          marginBottom: tokens.spacing.lg,
        },
        activityTitle: {
          ...darkPoolSectionTitleStyle,
          color: tokens.colors.text.primary,
          marginBottom: 4,
        },
      }),
    [tokens, bottomPad]
  );

  if (loading && list.length === 0) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
          <MainDrawerScreenHeader inRtlTree title="מעקב" onMenuPress={openDrawer} />
          <View style={styles.scroll}>
            {Array.from({ length: 3 }).map((_, i) => (
              <UICard key={i} {...CHROME_UICARD} style={styles.followCard}>
                <ListItemSkeleton showAvatar />
              </UICard>
            ))}
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="מעקב"
          subtitle={list.length ? `${list.length} במעקב` : 'עקוב אחרי בכירים ופוליטיקאים'}
          onMenuPress={openDrawer}
        />
        <ScrollView
          style={darkPoolTransparentFill}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={loading || activityFeed.refreshing}
              onRefresh={() => {
                void refetch();
                void activityFeed.refetch();
              }}
              tintColor={tokens.colors.primary.main}
            />
          }
        >
          {list.length > 0 ? (
            <>
              {list.map((person) => (
                <FollowedRow
                  key={`${person.kind}:${person.id}`}
                  person={person}
                  styles={styles}
                  onPress={() => openProfile(person)}
                  onUnfollow={() => void unfollowInvestor(person)}
                />
              ))}

              <Text style={styles.activityTitle}>פעילות אחרונה</Text>
              {activityFeed.loading ? (
                <View style={{ marginTop: 12 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <CardSkeleton key={i} delay={i * 70} />
                  ))}
                </View>
              ) : activityFeed.items.length === 0 ? (
                <Text style={styles.emptyText}>אין עסקאות חדשות מהמעקב.</Text>
              ) : (
                <View>
                  {activityFeed.items.map((item) => (
                    <ActivityFeedCard
                      key={item.id}
                      item={item}
                      onPersonPress={() => openActivityPerson(item)}
                      onDetailPress={() => openActivityDetail(item)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={tokens.colors.text.tertiary} />
              <Text style={styles.emptyText}>
                עדיין לא עוקב אחרי אף משקיע.{'\n'}
                גלה פוליטיקאים ובכירים בטאב חקור ולחץ «עקוב».
              </Text>
              <UIButton title="לחקור" variant="primary" onPress={goExplore} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function FollowedRow({
  person,
  styles,
  onPress,
  onUnfollow,
}: {
  person: FollowedInvestor;
  styles: {
    followCard: object;
    row: object;
    avatar: object;
    textCol: object;
    name: object;
    sub: object;
  };
  onPress: () => void;
  onUnfollow: () => void;
}) {
  const tokens = useDesignTokens();
  const kindLabel =
    person.kind === 'politician'
      ? 'פוליטיקאי'
      : person.kind === 'fund_manager'
        ? 'קרן · 13F'
        : 'בכיר';

  return (
    <UICard {...CHROME_UICARD} style={styles.followCard}>
      <Pressable onPress={onPress} style={styles.row}>
        <InvestorPortrait
          name={person.name}
          imageUrl={person.image_url}
          ticker={person.ticker}
          kind={person.kind}
          personId={person.id}
          layout="circle"
          size={52}
          style={styles.avatar}
        />
        <View style={styles.textCol}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {kindLabel}
            {person.ticker ? ` · ${person.ticker}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onUnfollow();
          }}
          hitSlop={10}
        >
          <Ionicons name="close-circle" size={22} color={tokens.colors.text.tertiary} />
        </Pressable>
        <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
      </Pressable>
    </UICard>
  );
}
