/**
 * פיד ראשי — קונגרס + בכירי חברות (Insider Wave style).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { CongressTradeCard } from './components/CongressTradeCard';
import { InsiderTradeCard } from './components/InsiderTradeCard';
import { DarkPoolTabToggle } from './components/DarkPoolTabToggle';
import { useCongressFeed } from '../../hooks/useCongressFeed';
import { useDarkPoolInsiderFeed } from '../../hooks/useDarkPoolInsiderFeed';
import type { DarkPoolFeedTab } from '../../hooks/useDarkPoolInsiderFeed';
import { DARK_POOL_SEC_PRODUCTION } from '../../types/darkpool.types';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DarkPoolTabParamList } from '../../navigation/DarkPoolTabs';

const FEED_LIMIT = 50;

export default function DarkPoolFeedScreen() {
  const tokens = useDesignTokens();
  const navigation = useDarkPoolStackNav();
  const tabNav = useNavigation<BottomTabNavigationProp<DarkPoolTabParamList>>();
  const bottomPad = useDarkPoolTabBarHeight();
  const [segment, setSegment] = useState<DarkPoolFeedTab>(
    DARK_POOL_SEC_PRODUCTION ? 'all' : 'congress'
  );

  const congress = useCongressFeed(FEED_LIMIT, segment === 'congress');
  const insiders = useDarkPoolInsiderFeed({
    tab: 'all',
    limit: FEED_LIMIT,
    enabled: segment === 'all',
  });

  const active = segment === 'congress' ? congress : insiders;
  const loading = active.loading && (segment === 'congress' ? congress.trades.length === 0 : insiders.trades.length === 0);

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const goToTicker = useCallback(
    (ticker: string) => {
      navigation.navigate('DarkPoolTicker', { ticker, tab: 'insider' });
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

  const goToExplore = useCallback(() => {
    tabNav.navigate('DarkPoolExplore');
  }, [tabNav]);

  const handleRefresh = useCallback(() => {
    if (segment === 'congress') {
      void congress.refetch();
    } else {
      void insiders.refetch();
    }
  }, [segment, congress, insiders]);

  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);

  const subtitle =
    segment === 'congress' ? 'עסקאות חברי קונגרס' : 'רכישות בכירי חברות · Form 4';

  if (loading) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <MainDrawerScreenHeader
            inRtlTree
            title="Dark Pool"
            subtitle={subtitle}
            onMenuPress={openDrawer}
          />
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
            <Text style={styles.loadingHint}>טוען עסקאות…</Text>
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
          title="Dark Pool"
          subtitle={subtitle}
          onMenuPress={openDrawer}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={active.refreshing}
              onRefresh={handleRefresh}
              tintColor={tokens.colors.primary.main}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <DarkPoolTabToggle
            value={segment}
            onChange={setSegment}
            hideWatchlist
            hideFollowing
          />

          {active.error ? (
            <UICard variant="outlined" padding="md" style={styles.errorCard}>
              <Text style={styles.errorText}>{active.error}</Text>
              <Text style={styles.errorHint}>משוך למטה לרענון.</Text>
            </UICard>
          ) : null}

          {segment === 'congress' ? (
            congress.trades.length === 0 ? (
              <UICard variant="outlined" padding="lg" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>אין עסקאות קונגרס</Text>
                <Text style={styles.emptyBody}>
                  עדיין לא הגיעו דיווחי STOCK Act. משוך למטה לרענון — הנתונים מגיעים מדיווחים ציבוריים בלבד.
                </Text>
                <Text style={styles.emptyLink} onPress={goToExplore}>
                  חפש אנשים ←
                </Text>
              </UICard>
            ) : (
              congress.trades.map((item, index) => (
                <CongressTradeCard
                  key={`${item.trade.id}:${item.trade.filed_at}:${index}`}
                  item={item}
                  onPersonPress={(pid) => {
                    const t = item.trade;
                    openPolitician(pid, t.politician_name, t.politician_image_url);
                  }}
                />
              ))
            )
          ) : insiders.trades.length === 0 ? (
            <UICard variant="outlined" padding="lg" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>אין רכישות בכירים</Text>
              <Text style={styles.emptyBody}>
                אין עדיין רכישות Form 4. משוך למטה לרענון — הנתונים נטענים מ-SEC / Form4API.
              </Text>
            </UICard>
          ) : (
            insiders.trades.map((item) => (
              <InsiderTradeCard
                key={`${item.trade.source}-${item.trade.id}`}
                item={item}
                onPersonPress={(personId, name) =>
                  openInsider(personId, name, item.trade.ticker)
                }
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  bottomPadding: number
) {
  return StyleSheet.create({
    scrollContent: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingBottom: bottomPadding + 32,
      paddingTop: 4,
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
    errorCard: {
      marginBottom: tokens.spacing.md,
      borderColor: tokens.colors.border.danger,
    },
    errorText: {
      color: tokens.colors.text.danger,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'left',
    },
    errorHint: {
      marginTop: 8,
      fontSize: 12,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      lineHeight: 18,
    },
    emptyCard: {
      marginTop: tokens.spacing.sm,
      alignItems: 'flex-start',
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
    emptyLink: {
      marginTop: 14,
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.primary.main,
      textAlign: 'left',
    },
  });
}
