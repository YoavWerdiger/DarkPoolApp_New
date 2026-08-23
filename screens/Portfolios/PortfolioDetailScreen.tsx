import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  portfolioDetailTabLabelStyle,
  type PortfolioDetailTab,
} from './portfolioConstants';
import {
  getPortfolio,
  loadPortfolioHoldings,
  loadPortfolioDisplaySummary,
  updatePortfolio,
} from '../../services/portfolios';
import type {
  Portfolio,
  PortfolioHolding,
  PortfolioSummary,
} from './portfolioTypes';
import OverviewTab from './tabs/OverviewTab';
import TransactionsTab from './tabs/TransactionsTab';
import OpenTradesTab from './tabs/OpenTradesTab';
import HistoryTab from './tabs/HistoryTab';
import CalendarTab from './tabs/CalendarTab';
import { useRealtimeHoldings } from './hooks/useRealtimeHoldings';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { useAuth } from '../../context/AuthContext';
import { useColmexSync } from '../../hooks/useColmexSync';
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfolioDetail'>;
type Route = RouteProp<PortfoliosStackParamList, 'PortfolioDetail'>;

export default function PortfolioDetailScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { portfolioId } = route.params;
  const { user: authUser } = useAuth();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PortfolioDetailTab>('overview');
  const [portfolioActionsOpen, setPortfolioActionsOpen] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  /** מפתח שמשתנה בכל פעם שנסגרת פוזיציה — מאלץ את OverviewTab לרענן את הגרף */
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  /** מפתח שמשתנה בכל טעינה של נתוני התיק — מאלץ טאבים לרענן את הנתונים שלהם */
  const [dataVersion, setDataVersion] = useState(0);
  const tabsScrollRef = useRef<ScrollView | null>(null);

  const viewerAvatarUrl = authUser?.profile_picture ?? null;
  const viewerInitial = (authUser?.display_name ?? authUser?.full_name ?? authUser?.email ?? '').charAt(0).toUpperCase();

  const mainTabsHeight = useMainTabsHeight();

  const isOwner = useMemo(
    () =>
      !!(portfolio && viewerUserId && portfolio.user_id === viewerUserId),
    [portfolio, viewerUserId]
  );
  const isBrokerSynced = portfolio?.source === 'colmex_pro';
  const canAddTransaction = isOwner && !isBrokerSynced;

  const { lastSync, syncNow, isSyncing } = useColmexSync(portfolioId, isBrokerSynced);

  const { holdings: liveHoldings, summary: liveSummary } = useRealtimeHoldings({
    baseHoldings: holdings,
    baseSummary: summary,
    // תיקי Colmex + מודל trades: אל תדרוס עם מחירים חיים מ-holdings ישנים.
    enabled:
      !loading &&
      !isBrokerSynced &&
      holdings.length > 0 &&
      portfolio?.available_cash == null,
  });

  const displaySummary = isBrokerSynced ? summary : (liveSummary ?? summary);
  const displayHoldings = isBrokerSynced
    ? []
    : liveHoldings.length
      ? liveHoldings
      : holdings;

  const handleLiveSummaryUpdate = useCallback((patch: Partial<PortfolioSummary>) => {
    setSummary((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

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

      // Colmex: equity/trades בלבד. ידני: holdings + transactions.
      const display = await loadPortfolioDisplaySummary(p);
      if (!isMounted) return;
      setSummary(display);
      if (p.source === 'colmex_pro') {
        setHoldings([]);
      } else {
        const h = await loadPortfolioHoldings(portfolioId).catch(() => []);
        if (!isMounted) return;
        setHoldings(h);
      }
      setDataVersion((v) => v + 1);
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

  // אחרי sync מוצלח של Colmex — רענון נתוני התיק + גרף + טאבים
  useEffect(() => {
    if (!isBrokerSynced || !lastSync) return;
    setChartRefreshKey((k) => k + 1);
    void load();
  }, [isBrokerSynced, lastSync, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (isBrokerSynced) {
      void syncNow().finally(() => {
        void load();
      });
      return;
    }
    void load();
  }, [load, isBrokerSynced, syncNow]);

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
          borderRadius: 999,
          overflow: 'hidden',
        },
        tabBtnInner: {
          paddingHorizontal: 16,
          paddingVertical: 7,
        },
        tabBtnActive: {
          borderWidth: 1,
          borderColor: `${tokens.colors.primary.main}55`,
        },
        tabText: portfolioDetailTabLabelStyle(tokens.colors.text.secondary),
        tabTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        fabWrap: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          paddingBottom: mainTabsHeight + 8,
          zIndex: 40,
          pointerEvents: 'box-none',
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
              <DayNavBlurButton
                onPress={() => {
                  void HapticFeedback.impactLight();
                  openPortfolioActions();
                }}
                size={HEADER_BACK_BTN_SIZE}
                glassIntensity="subtle"
                accessibilityLabel="פעולות תיק"
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={tokens.colors.text.primary}
                />
              </DayNavBlurButton>
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
            summary={displaySummary}
            portfolio={portfolio}
          />

          <ScrollView
            ref={tabsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsScrollContent}
            onContentSizeChange={() =>
              tabsScrollRef.current?.scrollTo({ x: 0, animated: false })
            }
          >
            {PORTFOLIO_DETAIL_TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <UICard
                  key={tab.id}
                  variant="glass"
                  glassIntensity="subtle"
                  padding="none"
                  haptic={false}
                  showGlassBorder={!active}
                  onPress={() => {
                    if (!active) void HapticFeedback.selection();
                    setActiveTab(tab.id);
                  }}
                  style={[
                    styles.tabBtn,
                    active && styles.tabBtnActive,
                  ]}
                  contentContainerStyle={styles.tabBtnInner}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {tab.label}
                  </Text>
                </UICard>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: canAddTransaction ? mainTabsHeight + 90 : 60 }}>
            {activeTab === 'overview' && portfolio && (
              <OverviewTab
                portfolio={portfolio}
                summary={displaySummary}
                holdings={displayHoldings}
                avatarUrl={viewerAvatarUrl}
                userInitial={viewerInitial}
                chartRefreshKey={chartRefreshKey}
                onLiveSummaryUpdate={handleLiveSummaryUpdate}
              />
            )}
            {activeTab === 'open_trades' && portfolio && (
              <OpenTradesTab
                portfolioId={portfolio.id}
                holdings={displayHoldings}
                onChanged={() => {
                  void load();
                  setChartRefreshKey((k) => k + 1);
                }}
                readOnly={!canAddTransaction}
                refreshKey={dataVersion}
              />
            )}
            {activeTab === 'calendar' && portfolio && (
              <CalendarTab
                portfolioId={portfolio.id}
                currency={portfolio.currency}
                refreshKey={dataVersion}
              />
            )}
            {activeTab === 'transactions' && portfolio && (
              <View>
                {/* עסקאות מסחר סגורות — עם רווח/הפסד ממומש */}
                <HistoryTab
                  portfolioId={portfolio.id}
                  holdings={displayHoldings}
                  refreshKey={dataVersion}
                />
                {/* הפקדות, משיכות, דיבידנדים, עמלות */}
                <TransactionsTab
                  portfolio={portfolio}
                  onAddPress={handleAddTransaction}
                  readOnly={!canAddTransaction}
                  typeFilter={['deposit', 'withdrawal', 'dividend', 'fee']}
                  sectionTitle="הפקדות, דיבידנדים ופעולות"
                  refreshKey={dataVersion}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {canAddTransaction ? (
        <View style={styles.fabWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fabBtn}
            onPress={() => {
              void HapticFeedback.selection();
              handleAddTransaction();
            }}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="פעולה חדשה"
          >
            <Ionicons name="add" size={26} color={tokens.colors.text.inverse} />
            <Text style={styles.fabBtnText}>פעולה חדשה</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {portfolio && isOwner ? (
        <PortfolioActionsBottomSheet
          visible={portfolioActionsOpen}
          onClose={() => setPortfolioActionsOpen(false)}
          portfolioId={portfolioId}
          portfolioName={portfolio.name}
          portfolio={portfolio}
          navigation={navigation}
          onPortfolioUpdated={() => {
            setChartRefreshKey((k) => k + 1);
            void load();
          }}
          onSyncBroker={
            isBrokerSynced
              ? async () => {
                  await syncNow({ full: true });
                  setChartRefreshKey((k) => k + 1);
                  void load();
                }
              : undefined
          }
          lastSyncAt={lastSync}
          isSyncing={isSyncing}
        />
      ) : null}
    </View>
  );
}
