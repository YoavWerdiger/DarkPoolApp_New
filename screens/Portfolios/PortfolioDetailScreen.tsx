import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { supabase } from '../../lib/supabase';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import PortfolioActionsBottomSheet from './components/PortfolioActionsBottomSheet';
import { PortfolioSummaryHeader } from './components/PortfolioSummaryHeader';
import {
  PORTFOLIO_DETAIL_TABS,
  type PortfolioDetailTab,
} from './portfolioConstants';
import {
  getPortfolio,
  loadPortfolioHoldings,
  loadPortfolioSummary,
} from '../../services/portfolios';
import type {
  Portfolio,
  PortfolioHolding,
  PortfolioSummary,
} from './portfolioTypes';
import OverviewTab from './tabs/OverviewTab';
import HoldingsTab from './tabs/HoldingsTab';
import TransactionsTab from './tabs/TransactionsTab';
import AnalysisTab from './tabs/AnalysisTab';
import { useRealtimeHoldings } from './hooks/useRealtimeHoldings';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfolioDetail'>;
type Route = RouteProp<PortfoliosStackParamList, 'PortfolioDetail'>;

export default function PortfolioDetailScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { portfolioId } = route.params;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PortfolioDetailTab>('overview');
  const [portfolioActionsOpen, setPortfolioActionsOpen] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);

  const isOwner = useMemo(
    () =>
      !!(portfolio && viewerUserId && portfolio.user_id === viewerUserId),
    [portfolio, viewerUserId]
  );

  const { holdings: liveHoldings, summary: liveSummary } = useRealtimeHoldings({
    baseHoldings: holdings,
    baseSummary: summary,
    enabled: !loading && holdings.length > 0,
  });

  const load = useCallback(async () => {
    let isMounted = true;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!isMounted) return;
      setViewerUserId(auth?.user?.id ?? null);

      const p = await getPortfolio(portfolioId);
      if (!isMounted) return;
      if (!p) {
        Alert.alert('שגיאה', 'התיק לא נמצא');
        navigation.goBack();
        return;
      }
      setPortfolio(p);
      const [s, h] = await Promise.all([
        loadPortfolioSummary(portfolioId, p.currency),
        loadPortfolioHoldings(portfolioId),
      ]);
      if (!isMounted) return;
      setSummary(s);
      setHoldings(h);
    } catch (err) {
      console.error('load portfolio error:', err);
    } finally {
      if (isMounted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    return () => { isMounted = false; };
  }, [portfolioId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const handleAddTransaction = useCallback(() => {
    navigation.navigate('AddTransaction', { portfolioId, initialMode: 'asset' });
  }, [navigation, portfolioId]);

  const openPortfolioActions = useCallback(() => {
    setPortfolioActionsOpen(true);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: '#0A0E0A' },
        loading: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabsRow: {
          flexDirection: 'row-reverse',
          paddingHorizontal: 10,
          paddingVertical: 8,
          gap: 6,
        },
        tabsCard: {
          marginHorizontal: 16,
          marginBottom: 2,
          marginTop: 2,
        },
        tabBtn: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 10,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        tabBtnActive: {
          backgroundColor: 'rgba(0, 200, 5, 0.12)',
          borderColor: tokens.colors.primary.main,
        },
        tabText: {
          fontSize: 13,
          fontWeight: '600',
          color: tokens.colors.text.secondary,
        },
        tabTextActive: {
          color: tokens.colors.primary.main,
        },
        addBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 200, 5, 0.18)',
          borderWidth: 1,
          borderColor: tokens.colors.primary.main,
        },
        moreBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        headerActions: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
        },
      }),
    [tokens]
  );

  if (loading) {
    return (
      <View style={styles.root}>
        <ChatSessionBackdrop />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <PortfolioScreenHeader
            title="טוען..."
            onBack={() => navigation.goBack()}
          />
          <View style={styles.loading}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <PortfolioScreenHeader
          title={portfolio?.name ?? ''}
          subtitle={
            portfolio
              ? isOwner
                ? `${portfolio.currency} · benchmark ${portfolio.benchmark_symbol}`
                : `צפייה בלבד · ${portfolio.currency} · benchmark ${portfolio.benchmark_symbol}`
              : undefined
          }
          onBack={() => navigation.goBack()}
          rightAction={
            isOwner ? (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={handleAddTransaction}
                  hitSlop={10}
                >
                  <Ionicons name="add" size={20} color={tokens.colors.primary.main} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={openPortfolioActions}
                  hitSlop={10}
                  accessibilityLabel="פעולות תיק"
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={tokens.colors.text.primary}
                  />
                </TouchableOpacity>
              </View>
            ) : undefined
          }
        />

        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.colors.primary.main}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <PortfolioSummaryHeader summary={liveSummary ?? summary} />

          <UICard
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={[styles.tabsCard, { borderRadius: tokens.borderRadius.xl }]}
          >
            <View style={styles.tabsRow}>
              {PORTFOLIO_DETAIL_TABS.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </UICard>

          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 60 }}>
            {activeTab === 'overview' && portfolio && (
              <OverviewTab
                portfolio={portfolio}
                summary={liveSummary ?? summary}
                holdings={liveHoldings.length ? liveHoldings : holdings}
              />
            )}
            {activeTab === 'holdings' && portfolio && (
              <HoldingsTab
                portfolio={portfolio}
                holdings={liveHoldings.length ? liveHoldings : holdings}
              />
            )}
            {activeTab === 'transactions' && portfolio && (
              <TransactionsTab
                portfolio={portfolio}
                onAddPress={handleAddTransaction}
                readOnly={!isOwner}
              />
            )}
            {activeTab === 'analysis' && portfolio && (
              <AnalysisTab
                portfolio={portfolio}
                holdings={liveHoldings.length ? liveHoldings : holdings}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {portfolio && isOwner ? (
        <PortfolioActionsBottomSheet
          visible={portfolioActionsOpen}
          onClose={() => setPortfolioActionsOpen(false)}
          portfolioId={portfolioId}
          portfolioName={portfolio.name}
          portfolio={portfolio}
          navigation={navigation}
          onPortfolioUpdated={() => {
            void load();
          }}
        />
      ) : null}
    </View>
  );
}
