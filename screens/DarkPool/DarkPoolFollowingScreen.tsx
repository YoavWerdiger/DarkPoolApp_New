/**
 * רשימת בכירים/פוליטיקאים במעקב + קיצור לגילוי.
 */

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
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
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useFollowedInvestors } from '../../hooks/useFollowedInvestors';
import { unfollowInvestor, type FollowedInvestor } from '../../services/darkpool/darkPoolFollowService';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import type { DarkPoolTabParamList } from '../../navigation/DarkPoolTabs';
import { useDarkPoolFollowingFeed } from '../../hooks/useDarkPoolFollowingFeed';
import { InvestorPortrait } from './components/InvestorPortrait';
import { ActivityFeedCard } from './components/ActivityFeedCard';

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

  const goToTicker = useCallback(
    (ticker: string) => {
      stackNav.navigate('DarkPoolTicker', { ticker, tab: 'insider' });
    },
    [stackNav]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          direction: 'rtl',
          paddingBottom: bottomPad,
          paddingHorizontal: tokens.layout.screenPadding,
        },
        empty: {
          alignItems: 'center',
          paddingVertical: 48,
          gap: 12,
        },
        emptyText: {
          fontSize: 14,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          lineHeight: 22,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.subtle,
        },
        avatar: {},
        textCol: { flex: 1, alignItems: 'flex-start' },
        name: {
          fontSize: 16,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        },
        sub: {
          marginTop: 2,
          fontSize: 12,
          color: tokens.colors.text.tertiary,
        },
        actions: {
          marginTop: tokens.spacing.md,
          marginBottom: tokens.spacing.lg,
        },
        activityTitle: {
          fontSize: 18,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          marginBottom: tokens.spacing.sm,
          textAlign: 'left',
        },
      }),
    [tokens, bottomPad]
  );

  if (loading && list.length === 0) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <MainDrawerScreenHeader inRtlTree title="מעקב" onMenuPress={openDrawer} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
          title="מעקב"
          subtitle={list.length ? `${list.length} במעקב` : 'עקוב אחרי בכירים ופוליטיקאים'}
          onMenuPress={openDrawer}
        />
        <ScrollView
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
                <ActivityIndicator color={tokens.colors.primary.main} />
              ) : activityFeed.items.length === 0 ? (
                <Text style={styles.emptyText}>אין עסקאות חדשות מהמעקב.</Text>
              ) : (
                activityFeed.items.map((item) => (
                  <ActivityFeedCard
                    key={item.id}
                    item={item}
                    onPersonPress={() => openActivityPerson(item)}
                    onTickerPress={goToTicker}
                  />
                ))
              )}
            </>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={tokens.colors.text.tertiary} />
              <Text style={styles.emptyText}>
                עדיין לא עוקב אחרי אף משקיע.{'\n'}
                גלה פוליטיקאים ובכירים בטאב גילוי ולחץ «עקוב».
              </Text>
              <UIButton title="לאנשים" variant="primary" onPress={goExplore} />
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
    row: object;
    avatar: object;
    textCol: object;
    name: object;
    sub: object;
  };
  onPress: () => void;
  onUnfollow: () => void;
}) {
  const kindLabel =
    person.kind === 'politician'
      ? 'פוליטיקאי'
      : person.kind === 'fund_manager'
        ? 'קרן · 13F'
        : 'בכיר';

  return (
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
        <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.35)" />
      </Pressable>
      <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.25)" />
    </Pressable>
  );
}
