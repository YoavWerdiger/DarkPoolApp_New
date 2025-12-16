import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import UICard from '../../components/ui/UICard';
import TradesListTab from './TradesListTab';
import CalendarTab from './CalendarTab';

export default function TradingScreen() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'trades' | 'calendar'>('trades');
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const tabs = [
    {
      id: 'trades' as const,
      title: 'רשימת טריידים',
      icon: 'list',
    },
    {
      id: 'calendar' as const,
      title: 'לוח שנה',
      icon: 'calendar',
    },
  ];

  return (
    <LinearGradient
      colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={styles.gradientContainer}
    >
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <UICard variant="blur" padding="none" style={styles.tabsCard}>
            <View style={styles.tabs}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.7}
                  style={styles.tab}
                >
                  {isActive && <View style={styles.tabActiveIndicator} />}
                  <Ionicons 
                    name={tab.icon as any} 
                    size={20} 
                    color={isActive ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary} 
                  />
                  <Text style={[
                    styles.tabText,
                    isActive && styles.tabTextActive
                  ]}>
                    {tab.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
            </View>
          </UICard>
        </View>

        {/* Content */}
        <View style={styles.tabContent}>
          {activeTab === 'trades' && <TradesListTab />}
          {activeTab === 'calendar' && <CalendarTab />}
        </View>
      </RNSafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeAreaContainer: {
    flex: 1,
  },
  tabsContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  tabsCard: {
    borderRadius: 30,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
  },
  tab: {
    flex: 1,
    height: 44,
    borderRadius: 26,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 2,
    position: 'relative',
  },
  tabActiveIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 26,
    backgroundColor: `${tokens.colors.primary.main}14`,
  },
  tabText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.secondary,
  },
  tabTextActive: {
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.bold as any,
  },
  tabContent: {
    flex: 1,
  },
});

