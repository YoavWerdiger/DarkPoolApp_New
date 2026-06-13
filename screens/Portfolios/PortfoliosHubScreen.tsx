import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import PortfoliosTab from './PortfoliosTab';
import CommunityPortfoliosTab from './CommunityPortfoliosTab';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { MarketsEmbedSwitcher } from '../Markets/components/MarketsEmbedSwitcher';
import type { SegmentedOption } from '../Markets/components/MarketsSegmentedControl';

type HubTab = 'mine' | 'community';

const HUB_SEGMENTS: SegmentedOption<HubTab>[] = [
  { id: 'mine', label: 'התיקים שלי' },
  { id: 'community', label: 'מהקהילה' },
];

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfoliosHub'>;

export default function PortfoliosHubScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  const [activeTab, setActiveTab] = useState<HubTab>('mine');

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
        screenRoot: { flex: 1, backgroundColor: '#0A0E0A' },
        safeArea: { flex: 1, backgroundColor: 'transparent' },
        appHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: tokens.layout.screenPadding,
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
          color: tokens.colors.text.primary,
          letterSpacing: -0.3,
        },
        appHeaderTitleCenter: { flex: 1, textAlign: 'center' },
        tabBarWrap: {
          paddingHorizontal: tokens.layout.screenPadding,
        },
        tabContent: { flex: 1, minHeight: 0 },
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
          backgroundColor: tokens.colors.primary.main,
          ...tokens.shadows.md,
        },
        fabBtnText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
      }),
    [tokens, mainTabsHeight]
  );

  return (
    <View style={styles.screenRoot}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.appHeader}>
          <View style={styles.appHeaderActions}>
            <DayNavBlurButton
              onPress={openMainDrawer}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="תפריט ראשי"
            >
              <Ionicons name="menu" size={24} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          </View>
          <Text style={[styles.appHeaderTitle, styles.appHeaderTitleCenter]} numberOfLines={1}>
            יומן מסחר
          </Text>
          <View style={styles.appHeaderActions} />
        </View>

        <View style={styles.tabBarWrap}>
          <MarketsEmbedSwitcher
            options={HUB_SEGMENTS}
            value={activeTab}
            onChange={setActiveTab}
            accessibilityGroupLabel="יומן מסחר"
          />
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'mine' ? <PortfoliosTab /> : <CommunityPortfoliosTab />}
        </View>

        {activeTab === 'mine' ? (
          <View style={styles.fabWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.fabBtn}
              onPress={() => {
                void HapticFeedback.medium();
                navigation.navigate('CreatePortfolio');
              }}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="תיק חדש"
            >
              <Ionicons name="add" size={26} color={tokens.colors.text.inverse} />
              <Text style={styles.fabBtnText}>תיק חדש</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
