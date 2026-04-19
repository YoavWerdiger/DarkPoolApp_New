import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import TradesListTab from './TradesListTab';
import CalendarTab from './CalendarTab';
import JournalDataTab from './JournalDataTab';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import type { JournalStackParamList } from '../../navigation/JournalStack';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

const HEADER_HP = 20;

type JournalTab = 'trades' | 'calendar' | 'performance';

const JOURNAL_SEGMENTS: {
  id: JournalTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'trades', label: 'רשימת טריידים', icon: 'list-outline' },
  { id: 'calendar', label: 'לוח שנה', icon: 'calendar-outline' },
  { id: 'performance', label: 'ביצועים', icon: 'bar-chart-outline' },
];

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalMain'>;

export default function TradingScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  const [activeTab, setActiveTab] = useState<JournalTab>('trades');

  const showAddTradeFab = activeTab === 'trades' || activeTab === 'calendar';

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
        segmentRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          paddingHorizontal: HEADER_HP,
          paddingTop: 4,
          paddingBottom: 12,
        },
        segmentPill: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: DesignTokens.colors.background.tertiary,
          borderRadius: 20,
          paddingHorizontal: 14,
          paddingVertical: 8,
          gap: 6,
        },
        segmentPillActive: {
          backgroundColor: 'rgba(0, 200, 5, 0.12)',
        },
        segmentPillText: {
          fontSize: 13,
          fontWeight: '500',
          color: DesignTokens.colors.text.secondary,
        },
        segmentPillTextActive: {
          color: DesignTokens.colors.primary.main,
          fontWeight: '600',
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
          paddingBottom: mainTabsHeight,
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
            יומן מסחר
          </Text>
          <View style={styles.appHeaderActions} />
        </View>

        <View style={styles.segmentRow} accessibilityRole="tablist">
          {JOURNAL_SEGMENTS.map((seg) => {
            const active = activeTab === seg.id;
            return (
              <TouchableOpacity
                key={seg.id}
                style={[styles.segmentPill, active && styles.segmentPillActive]}
                onPress={() => setActiveTab(seg.id)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${seg.label}`}
              >
                <Ionicons
                  name={seg.icon}
                  size={16}
                  color={active ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary}
                />
                <Text style={[styles.segmentPillText, active && styles.segmentPillTextActive]}>{seg.label}</Text>
              </TouchableOpacity>
            );
          })}
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
              onPress={() => navigation.navigate('AddTrade')}
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
