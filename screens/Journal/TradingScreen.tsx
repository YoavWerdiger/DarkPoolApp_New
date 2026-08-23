import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { MarketsEmbedSwitcher } from '../Markets/components/MarketsEmbedSwitcher';
import TradesListTab from './TradesListTab';
import CalendarTab from './CalendarTab';
import JournalDataTab from './JournalDataTab';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic, HapticFeedback } from '../../utils/hapticFeedback';
import type { JournalStackParamList } from '../../navigation/JournalStack';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

type JournalTab = 'trades' | 'calendar' | 'performance';

const JOURNAL_SEGMENTS: { id: JournalTab; label: string }[] = [
  { id: 'trades', label: 'רשימת טריידים' },
  { id: 'calendar', label: 'לוח שנה' },
  { id: 'performance', label: 'ביצועים' },
];

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalMain'>;

export default function TradingScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  const [activeTab, setActiveTab] = useState<JournalTab>('trades');

  const showAddTradeFab = true;

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
          backgroundColor: 'transparent',
        },
        tabBarWrap: {
          paddingHorizontal: DesignTokens.layout.screenPadding,
          paddingTop: 2,
          paddingBottom: DesignTokens.spacing.sm,
          alignItems: 'center',
        },
        tabContent: {
          flex: 1,
          minHeight: 0,
        },
        fabWrap: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          paddingBottom: mainTabsHeight + 8,
          zIndex: 40,
        },
        fabBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 28,
          backgroundColor: DesignTokens.colors.primary.main,
          ...DesignTokens.shadows.md,
        },
        fabBtnText: {
          fontSize: 16,
          fontWeight: '700',
          color: DesignTokens.colors.text.inverse,
        },
      }),
    [DesignTokens, mainTabsHeight]
  );

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        <MainDrawerScreenHeader title="יומן מסחר" onMenuPress={openMainDrawer} />

        <View style={styles.tabBarWrap} accessibilityRole="tablist">
          <MarketsEmbedSwitcher
            options={JOURNAL_SEGMENTS}
            value={activeTab}
            onChange={setActiveTab}
            accessibilityGroupLabel="יומן מסחר"
          />
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'trades' && <TradesListTab />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'performance' && <JournalDataTab />}
        </View>

        {showAddTradeFab ? (
          <View style={styles.fabWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.fabBtn}
              onPress={() => {
                void HapticFeedback.medium();
                navigation.navigate('AddTrade');
              }}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="הוסף טרייד"
            >
              <Ionicons name="add" size={26} color={DesignTokens.colors.text.inverse} />
              <Text style={styles.fabBtnText}>הוסף טרייד</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </RNSafeAreaView>
    </ScreenChrome>
  );
}
