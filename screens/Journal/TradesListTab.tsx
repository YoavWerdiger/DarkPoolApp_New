import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import ShareTradeModal from './ShareTradeModal';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { Trade } from './tradeTypes';
import { TradeListCard, createTradeCardStyles } from './TradeListCard';
import type { JournalStackParamList } from '../../navigation/JournalStack';
import UICard from '../../components/ui/UICard';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';

export type { Trade } from './tradeTypes';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalMain'>;
type FilterId = 'all' | 'long' | 'short' | 'win' | 'loss' | string;
const BASE_FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'long', label: 'Long' },
  { id: 'short', label: 'Short' },
  { id: 'win', label: 'Win ✓' },
  { id: 'loss', label: 'Loss ✗' },
];

export default function TradesListTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  // זריעה אופטימית מה-cache (נטען מהדיסק בהפעלה קרה) — רינדור מיידי
  const [trades, setTrades] = useState<Trade[]>(
    () => queryClient.getQueryData<Trade[]>(appQueryKeys.trades(user?.id ?? 'anon')) ?? []
  );
  const [loading, setLoading] = useState(
    () => !queryClient.getQueryData<Trade[]>(appQueryKeys.trades(user?.id ?? 'anon'))
  );
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const styles = useMemo(() => createStyles(DesignTokens, mainTabsHeight), [DesignTokens, mainTabsHeight]);
  const tradeCardStyles = useMemo(() => createTradeCardStyles(DesignTokens), [DesignTokens]);

  const loadTrades = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('exit_date', { ascending: false });

      if (error) throw error;
      setTrades(data || []);
      queryClient.setQueryData(appQueryKeys.trades(user.id), data || []);
    } catch (error: any) {
      legacyAlert('שגיאה', 'לא ניתן לטעון את הטריידים');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadTrades();
    }, [loadTrades])
  );

  const handleDeleteTrade = useCallback(
    (tradeId: string) => {
      legacyAlert(
        'מחיקת טרייד',
        'האם אתה בטוח שברצונך למחוק את הטרייד הזה?',
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'מחק',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('trades')
                  .delete()
                  .eq('id', tradeId)
                  .eq('user_id', user?.id);

                if (error) throw error;
                void HapticFeedback.impactLight();
                void loadTrades();
              } catch {
                legacyAlert('שגיאה', 'לא ניתן למחוק את הטרייד');
              }
            },
          },
        ]
      );
    },
    [user?.id, loadTrades]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrencyWithColor = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return formatted;
  };

  const openShareForTrade = useCallback((item: Trade) => {
    setSelectedTrade(item);
    setShowShareModal(true);
  }, []);

  const renderTrade = useCallback(
    ({ item }: { item: Trade }) => (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          void HapticFeedback.impactLight();
          navigation.navigate('TradeDetail', { tradeId: item.id });
        }}
      >
        <TradeListCard
          item={item}
          styles={tradeCardStyles}
          onShare={openShareForTrade}
          onDelete={handleDeleteTrade}
          formatDate={formatDate}
          formatUsd={formatCurrencyWithColor}
        />
      </TouchableOpacity>
    ),
    [tradeCardStyles, handleDeleteTrade, openShareForTrade, navigation]
  );

  const q = searchQuery.trim().toLowerCase();
  const filteredTrades = useMemo(() => {
    let result = trades;
    if (q) result = result.filter((t) => t.symbol.toLowerCase().includes(q));
    switch (activeFilter) {
      case 'long': result = result.filter((t) => t.direction === 'long'); break;
      case 'short': result = result.filter((t) => t.direction === 'short'); break;
      case 'win': result = result.filter((t) => t.pnl >= 0); break;
      case 'loss': result = result.filter((t) => t.pnl < 0); break;
      default:
        if (activeFilter !== 'all') {
          result = result.filter((t) => t.strategy_name === activeFilter);
        }
        break;
    }
    return result;
  }, [trades, q, activeFilter]);

  // Unique strategy names
  const strategyFilters = useMemo(() => {
    const names = Array.from(
      new Set(trades.map((t) => t.strategy_name).filter((n): n is string => !!n))
    );
    return names.map((n) => ({ id: n, label: `⚡ ${n}` }));
  }, [trades]);

  const allFilters = useMemo(
    () => [...BASE_FILTERS, ...strategyFilters],
    [strategyFilters]
  );

  // Summary KPIs — computed on filteredTrades so KPIs match what's visible
  const summary = useMemo(() => {
    if (filteredTrades.length === 0) return null;
    const wins = filteredTrades.filter((t) => t.pnl >= 0);
    const totalPnl = filteredTrades.reduce((s, t) => s + t.pnl, 0);
    const winRate = (wins.length / filteredTrades.length) * 100;
    const avgWin =
      wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const losses = filteredTrades.filter((t) => t.pnl < 0);
    const avgLoss =
      losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : null;
    return { totalPnl, winRate, totalTrades: filteredTrades.length, wins: wins.length, profitFactor };
  }, [filteredTrades]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, styles.rtlRoot]}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={styles.loadingText}>טוען טריידים...</Text>
      </View>
    );
  }

  const placeholderColor = 'rgba(255, 255, 255, 0.4)';
  const pnlColor =
    summary && summary.totalPnl >= 0
      ? DesignTokens.colors.primary.main
      : DesignTokens.colors.text.danger;

  const listHeader = (
    <View>
      {/* Summary */}
      {summary ? (
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="md"
          style={{ borderRadius: 16, marginBottom: 12 }}
        >
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 3 }}>
                P&L כולל
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: pnlColor }}>
                {summary.totalPnl >= 0 ? '+' : '-'}$
                {Math.abs(summary.totalPnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 3 }}>
                Win Rate
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: summary.winRate >= 50 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger }}>
                {summary.winRate.toFixed(0)}%
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 3 }}>
                טריידים
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: DesignTokens.colors.text.primary }}>
                {summary.totalTrades}
              </Text>
            </View>
            {summary.profitFactor != null ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 3 }}>
                  Profit F.
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: summary.profitFactor >= 1 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger }}>
                  {summary.profitFactor.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        </UICard>
      ) : null}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 }}
      >
        {allFilters.map((f) => {
          const active = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => {
                if (!active) void HapticFeedback.selection();
                setActiveFilter(f.id);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: active ? DesignTokens.colors.primary.main : DesignTokens.colors.border.subtle,
                backgroundColor: active ? 'rgba(0,200,5,0.12)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, styles.rtlRoot]}>
      <View style={styles.searchSection}>
        <View style={styles.searchPill} accessibilityRole="search">
          <View style={styles.searchLeadingIcon} pointerEvents="none" accessibilityElementsHidden>
            <Ionicons
              name="search"
              size={20}
              color={DesignTokens.colors.text.tertiary}
            />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש לפי סמל"
            placeholderTextColor={placeholderColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="characters"
            clearButtonMode="never"
            accessibilityLabel="חיפוש רשימת טריידים לפי סמל"
          />
          {q.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.selection();
                setSearchQuery('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearSearchBtn}
              accessibilityRole="button"
              accessibilityLabel="נקה חיפוש"
            >
              <Ionicons
                name="close-circle"
                size={22}
                color={DesignTokens.colors.text.secondary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {filteredTrades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color={DesignTokens.colors.text.tertiary} />
          {trades.length === 0 ? (
            <>
              <Text style={styles.emptyText}>אין טריידים עדיין</Text>
              <Text style={styles.emptySubtext}>הוסף טרייד ראשון כדי להתחיל</Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyText}>אין תוצאות</Text>
              <Text style={styles.emptySubtext}>בדוק את הסמל, החיפוש או הפילטר</Text>
            </>
          )}
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            data={filteredTrades}
            ListHeaderComponent={listHeader}

            renderItem={renderTrade}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: mainTabsHeight + 100 }]}
            showsVerticalScrollIndicator={true}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={false}
          />
        </View>
      )}

      {/* Share Trade Modal */}
      <ShareTradeModal
        trade={selectedTrade}
        visible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedTrade(null);
        }}
      />

    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>, mainTabsHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  rtlRoot: {
    direction: 'rtl',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.body.weight as any,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.secondary,
  },
  searchSection: {
    marginHorizontal: tokens.layout?.screenPadding ?? 20,
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  searchPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minHeight: 50,
    paddingVertical: 4,
    paddingHorizontal: 4,
    paddingLeft: 10,
    borderRadius: tokens.borderRadius['3xl'],
    backgroundColor: tokens.colors.glass.card.bg,
    borderWidth: 1,
    borderColor: tokens.colors.glass.card.border,
    gap: 4,
  },
  searchLeadingIcon: {
    paddingHorizontal: 6,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: tokens.typography.bodySmall.size,
    lineHeight: tokens.typography.bodySmall.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  clearSearchBtn: {
    padding: 4,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: tokens.layout?.screenPadding ?? 20,
    paddingTop: 0,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing['3xl'],
    paddingBottom: mainTabsHeight + 100,
    gap: tokens.spacing.md,
  },
  emptyText: {
    fontSize: tokens.typography.displayXs.size,
    fontWeight: tokens.typography.displayXs.weight as any,
    letterSpacing: tokens.typography.displayXs.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.body.weight as any,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
});

