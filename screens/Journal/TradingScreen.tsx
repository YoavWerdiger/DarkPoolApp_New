import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
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
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={DesignTokens.colors.background.primary} />
      
      <SafeAreaView style={styles.content} edges={['top']}>
        {/* Tabs */}
        <View style={styles.tabsContainer}>
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
        </View>

        {/* Content */}
        <View style={styles.tabContent}>
          {activeTab === 'trades' && <TradesListTab />}
          {activeTab === 'calendar' && <CalendarTab />}
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  header: {
    backgroundColor: tokens.colors.background.secondary,
    borderBottomLeftRadius: tokens.borderRadius.lg,
    borderBottomRightRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  },
  headerContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
  },
  headerTitle: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.normal,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    marginTop: tokens.spacing.xs,
  },
  content: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  tabsContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 30,
    padding: 4,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
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
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.text.secondary,
  },
  tabTextActive: {
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  tabContent: {
    flex: 1,
  },
});

