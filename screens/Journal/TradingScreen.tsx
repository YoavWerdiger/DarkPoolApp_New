import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
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
        screenRoot: {
          flex: 1,
          backgroundColor: '#0A0E0A',
        },
        safeAreaContainer: {
          flex: 1,
          backgroundColor: 'transparent',
        },
        appHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: DesignTokens.layout.screenPadding,
          paddingVertical: 14,
        },
        appHeaderActions: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          minWidth: 72,
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
    <View style={styles.screenRoot}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        <View style={styles.appHeader}>
          <View style={styles.appHeaderActions}>
            <DayNavBlurButton
              onPress={openMainDrawer}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="תפריט ראשי"
            >
              <Ionicons name="menu" size={24} color={DesignTokens.colors.text.primary} />
            </DayNavBlurButton>
          </View>
          <Text style={[styles.appHeaderTitle, styles.appHeaderTitleCenter]} numberOfLines={1}>
            יומן מסחר
          </Text>
          <View style={styles.appHeaderActions} />
        </View>

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
    </View>
  );
}
