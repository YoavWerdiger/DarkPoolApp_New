import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import ShareTradeModal from './ShareTradeModal';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { Trade } from './tradeTypes';
import { TradeListCard, createTradeCardStyles } from './TradeListCard';

export type { Trade } from './tradeTypes';

export default function TradesListTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const mainTabsHeight = useMainTabsHeight();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
      <TradeListCard
        item={item}
        styles={tradeCardStyles}
        onShare={openShareForTrade}
        onDelete={handleDeleteTrade}
        formatDate={formatDate}
        formatUsd={formatCurrencyWithColor}
      />
    ),
    [tradeCardStyles, handleDeleteTrade, openShareForTrade]
  );

  const q = searchQuery.trim().toLowerCase();
  const filteredTrades = useMemo(() => {
    if (!q) return trades;
    return trades.filter((trade) => trade.symbol.toLowerCase().includes(q));
  }, [trades, q]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, styles.rtlRoot]}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={styles.loadingText}>טוען טריידים...</Text>
      </View>
    );
  }

  const placeholderColor = 'rgba(255, 255, 255, 0.4)';

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
              onPress={() => setSearchQuery('')}
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

      {/* Trades List */}
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
              <Text style={styles.emptySubtext}>בדוק את הסמל או נקה את החיפוש</Text>
            </>
          )}
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            data={filteredTrades}
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

