import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SlidingPillGroup } from '../../components/ui/DayDividerPill';
import { CardSkeleton } from '../../components/ui/SkeletonLoader';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import ShareDestinationSheet from '../../components/share/ShareDestinationSheet';
import ExportTradeImage from '../../components/Journal/ExportTradeImage';
import { buildTradeAttachment } from '../../types/shareableEntity';
import type { ShareableAttachment } from '../../types/shareableEntity';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { Trade } from './tradeTypes';
import { TradeListCard, createTradeCardStyles } from './TradeListCard';
import type { JournalStackParamList } from '../../navigation/JournalStack';
import UICard from '../../components/ui/UICard';
import { DayDividerPill } from '../../components/ui/DayDividerPill';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalCardMetricLabelStyle,
  journalCardMetricValueSecondaryStyle,
  journalPhysicalRightText,
  journalRow,
  journalRtlContent,
  journalSectionTitleStyle,
} from './journalLayout';

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
  const [shareAttachment, setShareAttachment] = useState<ShareableAttachment | null>(null);
  const [shareTrade, setShareTrade] = useState<Trade | null>(null);
  const [showExportImage, setShowExportImage] = useState(false);
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
    setShareTrade(item);
    setShareAttachment(buildTradeAttachment(item));
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

  if (loading && trades.length === 0) {
    return (
      <View style={[styles.loadingContainer, styles.rtlRoot]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} delay={i * 70} />
        ))}
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
          variant="soft"
          padding="md"
          style={{ marginBottom: JOURNAL_LAYOUT.cardStackGap }}
        >
          <View
            style={{
              ...journalRow,
              alignItems: 'flex-start',
              gap: JOURNAL_LAYOUT.cardStackGap,
            }}
          >
            {(
              [
                { label: 'P&L כולל', value: `${summary.totalPnl >= 0 ? '+' : '-'}$${Math.abs(summary.totalPnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: pnlColor },
                { label: 'Win Rate', value: `${summary.winRate.toFixed(0)}%`, color: summary.winRate >= 50 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger },
                { label: 'טריידים', value: String(summary.totalTrades), color: DesignTokens.colors.text.primary },
                ...(summary.profitFactor != null
                  ? [{
                      label: 'Profit F.',
                      value: summary.profitFactor.toFixed(1),
                      color: summary.profitFactor >= 1 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger,
                    }]
                  : []),
              ] as const
            ).map((cell) => (
              <View
                key={cell.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  alignItems: 'center',
                  gap: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
                }}
              >
                <Text
                  style={{
                    ...journalCardMetricLabelStyle,
                    color: DesignTokens.colors.text.secondary,
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}
                  numberOfLines={1}
                >
                  {cell.label}
                </Text>
                <Text
                  style={{
                    ...journalCardMetricValueSecondaryStyle,
                    color: cell.color,
                    textAlign: 'center',
                    writingDirection: 'ltr',
                    includeFontPadding: false,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {cell.value}
                </Text>
              </View>
            ))}
          </View>
        </UICard>
      ) : null}

      {/* Filter chips */}
      {/* מחוון מחליק — כמו בורר האינטרוולים */}
      <SlidingPillGroup
        scroll
        options={allFilters}
        value={activeFilter}
        onChange={setActiveFilter}
        contentContainerStyle={{ ...journalRow, gap: 8, paddingBottom: 10 }}
      />
    </View>
  );

  return (
    <View style={[styles.container, styles.rtlRoot]}>
      <View style={styles.searchSection}>
        <View accessibilityRole="search">
        <DayDividerPill
          style={[styles.searchPill, { backgroundColor: DesignTokens.colors.background.cardSolid }]}
          contentContainerStyle={styles.searchPillContent}
          accessibilityLabel="חיפוש רשימת טריידים לפי סמל"
        >
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
        </DayDividerPill>
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

      <ShareDestinationSheet
        visible={showShareModal && !!shareAttachment}
        attachment={shareAttachment}
        onClose={() => {
          setShowShareModal(false);
          setShareAttachment(null);
        }}
        onShareAsImage={() => {
          setShowShareModal(false);
          setShareAttachment(null);
          setShowExportImage(true);
        }}
      />

      <ExportTradeImage
        trade={shareTrade}
        visible={showExportImage && !!shareTrade}
        onClose={() => {
          setShowExportImage(false);
          setShareTrade(null);
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
    ...journalRtlContent,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    ...journalBodyTextStyle,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  searchSection: {
    marginHorizontal: tokens.layout?.screenPadding ?? 20,
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  searchPill: {
    width: '100%',
    minHeight: 50,
    borderRadius: tokens.borderRadius['3xl'],
  },
  searchPillContent: {
    ...journalRow,
    alignItems: 'center',
    minHeight: 50,
    paddingVertical: 4,
    paddingHorizontal: 4,
    paddingLeft: 10,
    gap: 4,
  },
  searchLeadingIcon: {
    paddingHorizontal: 6,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    ...journalPhysicalRightText,
    fontSize: JOURNAL_TYPE.body.fontSize,
    fontWeight: JOURNAL_TYPE.body.fontWeight,
    lineHeight: JOURNAL_TYPE.body.lineHeight,
    color: tokens.colors.text.primary,
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
    ...journalSectionTitleStyle,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...journalBodyTextStyle,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
});

