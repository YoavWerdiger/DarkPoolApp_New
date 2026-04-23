import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import UICard from '../../components/ui/UICard';
import ShareTradeModal from './ShareTradeModal';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { HapticFeedback } from '../../utils/hapticFeedback';

function TradeSymbolLogo({
  symbol,
  size,
  fallbackColor,
  backgroundColor,
}: {
  symbol: string;
  size: number;
  fallbackColor: string;
  backgroundColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const uri = !failed ? brandfetchTickerLogoUri(symbol) : null;
  const initials = symbol.trim().slice(0, 4).toUpperCase() || '—';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
          recyclingKey={symbol}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{
            fontSize: Math.max(11, size * 0.26),
            fontWeight: '700',
            color: fallbackColor,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_date: string;
  exit_date: string;
  pnl: number;
  return_percentage?: number; // תשואה באחוזים
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export default function TradesListTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const mainTabsHeight = useMainTabsHeight();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const styles = React.useMemo(() => createStyles(DesignTokens, mainTabsHeight), [DesignTokens, mainTabsHeight]);

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

  const handleDeleteTrade = async (tradeId: string) => {
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
              loadTrades();
            } catch (error: any) {
              legacyAlert('שגיאה', 'לא ניתן למחוק את הטרייד');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
    return formatted;
  };

  const formatCurrencyWithColor = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return formatted;
  };

  const renderTrade = ({ item }: { item: Trade }) => {
    const isProfit = item.pnl >= 0;
    const directionText = item.direction === 'long' ? 'Long' : 'Short';
    const directionColor = item.direction === 'long'
      ? DesignTokens.colors.primary.main
      : DesignTokens.colors.text.danger;

    // חישוב תשואה אם לא קיים
    const calculateReturnPercentage = () => {
      if (item.return_percentage !== undefined && item.return_percentage !== null) {
        return item.return_percentage;
      }
      // חישוב ידני אם לא קיים
      if (item.entry_price > 0) {
        if (item.direction === 'long') {
          return ((item.exit_price - item.entry_price) / item.entry_price) * 100;
        } else {
          return ((item.entry_price - item.exit_price) / item.entry_price) * 100;
        }
      }
      return 0;
    };

    const returnPercentage = calculateReturnPercentage();

    return (
      <UICard variant="blur" padding="md" style={styles.tradeCard}>
        <View style={styles.tradeHeader}>
          <View style={styles.tradeHeaderMain}>
            <TradeSymbolLogo
              symbol={item.symbol}
              size={48}
              fallbackColor={DesignTokens.colors.text.primary}
              backgroundColor="rgba(255,255,255,0.08)"
            />
            <View style={styles.tradeSymbolContainer}>
              <Text style={styles.tradeSymbol} numberOfLines={1}>
                {item.symbol}
              </Text>
              <View style={[styles.directionBadge, { backgroundColor: `${directionColor}20` }]}>
                <Text style={[styles.directionText, { color: directionColor }]}>
                  {directionText}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                setSelectedTrade(item);
                setShowShareModal(true);
              }}
              style={styles.shareButton}
            >
              <Ionicons name="share-outline" size={18} color={DesignTokens.colors.primary.main} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteTrade(item.id)}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={18} color={DesignTokens.colors.text.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tradeDetails}>
          <View style={styles.tradeRow}>
            <Text style={styles.tradeLabel}>כניסה:</Text>
            <Text style={styles.tradePrice}>
              <Text style={styles.tradePrice}>$</Text>
              {formatCurrencyWithColor(item.entry_price)}
            </Text>
          </View>
          <View style={styles.tradeRow}>
            <Text style={styles.tradeLabel}>יציאה:</Text>
            <Text style={styles.tradePrice}>
              <Text style={styles.tradePrice}>$</Text>
              {formatCurrencyWithColor(item.exit_price)}
            </Text>
          </View>
          <View style={styles.tradeRow}>
            <Text style={styles.tradeLabel}>כמות:</Text>
            <Text style={styles.tradePrice}>{item.quantity}</Text>
          </View>
          <View style={styles.tradeRow}>
            <Text style={styles.tradeLabel}>תאריך:</Text>
            <Text style={styles.tradeValue}>{formatDate(item.exit_date)}</Text>
          </View>
        </View>

        <View style={styles.tradeFooter}>
          <View style={styles.footerPnlRow}>
            <Text style={styles.pnlLabel}>
              {isProfit ? 'רווח נטו' : 'הפסד נטו'}
            </Text>
            <Text
              style={[
                styles.pnlText,
                isProfit ? styles.pnlTextProfit : styles.pnlTextLoss,
              ]}
            >
              ${formatCurrencyWithColor(item.pnl)}
            </Text>
          </View>
          <View style={styles.footerReturnRow}>
            <Text style={styles.returnLabel}>תשואה</Text>
            <Text
              style={[
                styles.returnValue,
                returnPercentage >= 0 ? styles.returnValueProfit : styles.returnValueLoss,
              ]}
            >
              {returnPercentage >= 0 ? '+' : ''}
              {returnPercentage.toFixed(2)}%
            </Text>
          </View>
        </View>
      </UICard>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, styles.rtlRoot]}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={styles.loadingText}>טוען טריידים...</Text>
      </View>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredTrades = trades.filter((trade) => {
    if (q && !trade.symbol.toLowerCase().includes(q)) return false;
    return true;
  });

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
  summaryContainer: {
    backgroundColor: tokens.colors.background.cardSolid,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: tokens.spacing.xs,
  },
  summaryLabel: {
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.body.weight as any,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  summaryCount: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.primary.main,
    textAlign: 'right',
  },
  summaryPnl: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold as any,
    textAlign: 'right',
  },
  summaryProfit: {
    color: tokens.colors.primary.main,
  },
  summaryLoss: {
    color: tokens.colors.text.danger,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: tokens.layout?.screenPadding ?? 20,
    paddingTop: 0,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  tradeHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  tradeSymbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  tradeSymbol: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: '800' as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  directionBadge: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  directionText: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: '800' as any,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  shareButton: {
    padding: tokens.spacing.xs,
  },
  deleteButton: {
    padding: tokens.spacing.xs,
  },
  tradeCard: {
    marginBottom: tokens.spacing.sm,
    borderRadius: tokens.borderRadius['2xl'],
    borderWidth: 1,
    borderColor: `${tokens.colors.primary.main}24`,
    overflow: 'hidden',
    ...tokens.shadows.sm,
  },
  tradeDetails: {
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: tokens.spacing.sm,
  },
  tradeLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    fontWeight: '700' as any,
    flexShrink: 0,
  },
  tradePrice: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.primary.main,
    fontWeight: '800' as any,
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  tradeValue: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
    fontWeight: '800' as any,
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  tradeFooter: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
    gap: 0,
  },
  footerPnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: tokens.spacing.sm,
  },
  footerReturnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 14,
    gap: tokens.spacing.sm,
  },
  pnlLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    fontWeight: '700' as any,
    flexShrink: 0,
  },
  pnlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  pnlProfit: {
    // Styles applied via conditional
  },
  pnlLoss: {
    // Styles applied via conditional
  },
  pnlText: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: '800' as any,
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  pnlTextProfit: {
    color: tokens.colors.primary.main,
  },
  pnlTextLoss: {
    color: tokens.colors.text.danger,
  },
  returnLabel: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: '700' as any,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  returnValue: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: '800' as any,
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  returnValueProfit: {
    color: tokens.colors.primary.main,
  },
  returnValueLoss: {
    color: tokens.colors.text.danger,
  },
  notesContainer: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  notesText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'right',
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

