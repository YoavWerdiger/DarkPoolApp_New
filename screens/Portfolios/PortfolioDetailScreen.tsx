import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { supabase } from '../../lib/supabase';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import PortfolioActionsBottomSheet from './components/PortfolioActionsBottomSheet';
import { PortfolioSummaryHeader } from './components/PortfolioSummaryHeader';
import {
  PORTFOLIO_DETAIL_TABS,
  PORTFOLIO_BROKER_TAB,
  type PortfolioDetailTab,
} from './portfolioConstants';
import {
  getPortfolio,
  loadPortfolioHoldings,
  loadPortfolioSummary,
  updatePortfolio,
} from '../../services/portfolios';
import type {
  Portfolio,
  PortfolioHolding,
  PortfolioSummary,
} from './portfolioTypes';
import OverviewTab from './tabs/OverviewTab';
import HoldingsTab from './tabs/HoldingsTab';
import TransactionsTab from './tabs/TransactionsTab';
import BrokerOrdersTab from './tabs/BrokerOrdersTab';
import OpenTradesTab from './tabs/OpenTradesTab';
import HistoryTab from './tabs/HistoryTab';
import CalendarTab from './tabs/CalendarTab';
import { useRealtimeHoldings } from './hooks/useRealtimeHoldings';
import { HapticFeedback } from '../../utils/hapticFeedback';

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
  const tabsScrollRef = useRef<ScrollView | null>(null);

  const isOwner = useMemo(
    () =>
      !!(portfolio && viewerUserId && portfolio.user_id === viewerUserId),
    [portfolio, viewerUserId]
  );
  const isBrokerSynced = portfolio?.source === 'colmex_pro';
  const canAddTransaction = isOwner && !isBrokerSynced;

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

  const handleImport = useCallback(() => {
    navigation.navigate('ImportTransactions', { portfolioId });
  }, [navigation, portfolioId]);

  const handleShare = useCallback(() => {
    if (!portfolio) return;
    const isPublic = portfolio.is_public === true;
    if (isPublic) {
      Alert.alert(
        'הפסקת שיתוף',
        `התיק "${portfolio.name}" משותף כעת עם הקהילה. האם להסיר אותו?`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'הסר שיתוף',
            style: 'destructive',
            onPress: async () => {
              try {
                await updatePortfolio(portfolio.id, { is_public: false });
                await load();
              } catch (e) {
                console.error('toggle public:', e);
                Alert.alert('שגיאה', 'לא הצלחנו לעדכן את הגדרת השיתוף.');
              }
            },
          },
        ]
      );
      return;
    }
    Alert.alert(
      'שיתוף עם הקהילה',
      `לשתף את "${portfolio.name}" עם הקהילה? משתמשים מאומתים אחרים יראו את התיק בלשונית «מהקהילה» (צפייה בלבד).`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שתף',
          onPress: async () => {
            try {
              await updatePortfolio(portfolio.id, { is_public: true });
              await load();
            } catch (e) {
              console.error('toggle public:', e);
              Alert.alert('שגיאה', 'לא הצלחנו לעדכן את הגדרת השיתוף.');
            }
          },
        },
      ]
    );
  }, [portfolio, load]);

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
        tabsScroll: {
          marginTop: 6,
          marginBottom: 2,
        },
        tabsScrollContent: {
          flexDirection: 'row-reverse',
          paddingHorizontal: 16,
          gap: 8,
        },
        tabBtn: {
          paddingHorizontal: 16,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
        },
        tabBtnActive: {
          backgroundColor: `${tokens.colors.primary.main}24`,
          borderColor: `${tokens.colors.primary.main}55`,
        },
        tabText: {
          fontSize: 13,
          fontWeight: '600',
          color: tokens.colors.text.secondary,
        },
        tabTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
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
          subtitle={portfolio && !isOwner ? 'צפייה בלבד' : undefined}
          onBack={() => navigation.goBack()}
          moreAction={
            isOwner ? (
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => {
                  void HapticFeedback.impactLight();
                  openPortfolioActions();
                }}
                hitSlop={10}
                accessibilityLabel="פעולות תיק"
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={tokens.colors.text.primary}
                />
              </TouchableOpacity>
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
          <PortfolioSummaryHeader
            summary={liveSummary ?? summary}
            portfolio={portfolio}
            isOwner={isOwner}
            onAddAsset={canAddTransaction ? handleAddTransaction : undefined}
            onImport={canAddTransaction ? handleImport : undefined}
            onShare={handleShare}
          />

          <ScrollView
            ref={tabsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsScrollContent}
            onContentSizeChange={() =>
              tabsScrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            {(portfolio?.source === 'colmex_pro'
              ? [...PORTFOLIO_DETAIL_TABS, PORTFOLIO_BROKER_TAB]
              : PORTFOLIO_DETAIL_TABS
            ).map((tab) => {
              const active = tab.id === activeTab;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    if (!active) void HapticFeedback.selection();
                    setActiveTab(tab.id);
                  }}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  activeOpacity={0.85}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 60 }}>
            {activeTab === 'overview' && portfolio && (
              <OverviewTab
                portfolio={portfolio}
                summary={liveSummary ?? summary}
                holdings={liveHoldings.length ? liveHoldings : holdings}
              />
            )}
            {activeTab === 'open_trades' && portfolio && (
              <OpenTradesTab
                portfolioId={portfolio.id}
                holdings={liveHoldings.length ? liveHoldings : holdings}
                onChanged={() => void load()}
                readOnly={!canAddTransaction}
              />
            )}
            {activeTab === 'history' && portfolio && (
              <HistoryTab
                portfolioId={portfolio.id}
                holdings={liveHoldings.length ? liveHoldings : holdings}
              />
            )}
            {activeTab === 'holdings' && portfolio && (
              <HoldingsTab
                portfolio={portfolio}
                holdings={liveHoldings.length ? liveHoldings : holdings}
              />
            )}
            {activeTab === 'calendar' && portfolio && (
              <CalendarTab
                portfolioId={portfolio.id}
                currency={portfolio.currency}
              />
            )}
            {activeTab === 'transactions' && portfolio && (
              <TransactionsTab
                portfolio={portfolio}
                onAddPress={handleAddTransaction}
                readOnly={!canAddTransaction}
              />
            )}
            {activeTab === 'broker' && portfolio && portfolio.source === 'colmex_pro' && (
              <BrokerOrdersTab portfolioId={portfolio.id} currency={portfolio.currency} />
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
