import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { MarketsErrorBoundary } from './MarketsErrorBoundary';
import { MarketsIndicesTab } from './tabs/MarketsIndicesTab';
import { MarketsHeatmapsTab } from './tabs/MarketsHeatmapsTab';
import { MarketsScreenerTab } from './tabs/MarketsScreenerTab';
import { MarketsFearGreedTab } from './tabs/MarketsFearGreedTab';
import { MarketsSectionGrid } from './components/MarketsSectionGrid';
import type { SectionItem } from './components/MarketsSectionGrid';

export type MarketsTabId = 'indices' | 'heatmaps' | 'screener' | 'feargreed';

/** כמו `ChatGroupsListScreen` — מרווח אופקי לכותרת */
const HEADER_HP = 20;

const MAIN_SECTIONS: SectionItem[] = [
  { id: 'indices', title: 'מדדים', icon: 'stats-chart-outline' },
  { id: 'heatmaps', title: 'מפת חום', icon: 'apps-outline' },
  { id: 'screener', title: 'סורק', icon: 'search-outline' },
  { id: 'feargreed', title: 'מדד הפחד', icon: 'pulse-outline' },
];

export default function MarketsScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<MarketsTabId>('indices');

  const mainTabsHeight = useMainTabsHeight();

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeAreaContainer: {
          flex: 1,
        },
        /** כמו מסך רשימת הצ׳אטים: תפריט בימין, כותרת במרכז */
        appHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: HEADER_HP,
          paddingVertical: 14,
        },
        appHeaderActions: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          minWidth: 72,
        },
        headerMenuBtn: {
          width: 46,
          height: 46,
          borderRadius: 23,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: DesignTokens.colors.background.secondary,
          borderWidth: 1,
          borderColor: DesignTokens.colors.border.strong,
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        appHeaderTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: DesignTokens.colors.text.primary,
          letterSpacing: -0.3,
        },
        appHeaderTitleCenter: {
          flex: 1,
          textAlign: 'center',
        },
        sectionPicker: {
          paddingHorizontal: HEADER_HP,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabContent: {
          flex: 1,
        },
      }),
    [DesignTokens]
  );

  const tabPanel = useMemo(() => {
    switch (activeTab) {
      case 'indices':
        return <MarketsIndicesTab mainTabsHeight={mainTabsHeight} />;
      case 'heatmaps':
        return <MarketsHeatmapsTab mainTabsHeight={mainTabsHeight} />;
      case 'screener':
        return <MarketsScreenerTab mainTabsHeight={mainTabsHeight} />;
      case 'feargreed':
        return <MarketsFearGreedTab mainTabsHeight={mainTabsHeight} />;
      default:
        return null;
    }
  }, [activeTab, mainTabsHeight]);

  return (
    <ScreenChrome>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        <View style={styles.appHeader}>
          <View style={styles.appHeaderActions}>
            <TouchableOpacity
              style={styles.headerMenuBtn}
              onPress={openMainDrawer}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="תפריט ראשי"
            >
              <Ionicons name="menu" size={28} color={DesignTokens.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.appHeaderTitle, styles.appHeaderTitleCenter]} numberOfLines={1}>
            שווקים
          </Text>
          <View style={styles.appHeaderActions} />
        </View>

        <View style={styles.sectionPicker}>
          <MarketsSectionGrid
            sections={MAIN_SECTIONS}
            activeId={activeTab}
            onSelect={(id) => setActiveTab(id as MarketsTabId)}
          />
        </View>

        <View style={styles.tabContent}>
          <MarketsErrorBoundary>{tabPanel}</MarketsErrorBoundary>
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
}
