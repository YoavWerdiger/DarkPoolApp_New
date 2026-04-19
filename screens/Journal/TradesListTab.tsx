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
import ExportTradeImage from '../../components/Journal/ExportTradeImage';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all' | 'long' | 'short'>('all');
  const [filterPnl, setFilterPnl] = useState<'all' | 'profit' | 'loss'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const styles = React.useMemo(() => createStyles(DesignTokens, mainTabsHeight), [DesignTokens, mainTabsHeight]);

  const filtersActive = filterDirection !== 'all' || filterPnl !== 'all';

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
      <UICard variant="blur" padding="md" style={{ marginBottom: DesignTokens.spacing.sm }}>
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
                setShowExportModal(true);
              }}
              style={styles.shareButton}
            >
              <Ionicons name="image-outline" size={18} color={DesignTokens.colors.primary.main} />
            </TouchableOpacity>
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

  // סינון טריידים
  const filteredTrades = trades.filter(trade => {
    // חיפוש לפי ticker
    if (searchQuery && !trade.symbol.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // סינון לפי כיוון
    if (filterDirection !== 'all' && trade.direction !== filterDirection) {
      return false;
    }
    // סינון לפי רווח/הפסד
    if (filterPnl === 'profit' && trade.pnl <= 0) {
      return false;
    }
    if (filterPnl === 'loss' && trade.pnl >= 0) {
      return false;
    }
    return true;
  });

  return (
    <View style={[styles.container, styles.rtlRoot]}>
      {/* Search Bar */}
      <View style={styles.searchCard}>
        <UICard variant="blur" padding="sm" style={styles.searchCardInner}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={DesignTokens.colors.text.secondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="חפש לפי ticker..."
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color={DesignTokens.colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </UICard>
      </View>

      {/* פילטרים — רק אייקון; פתיחה/סגירה, בלי טקסט וללא יישור לשני קצוות */}
      <View style={styles.filtersOuter}>
        <TouchableOpacity
          style={styles.filtersIconButton}
          onPress={() => setFiltersOpen((v) => !v)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={filtersOpen ? 'סגור פילטרים' : 'פתח פילטרים'}
          accessibilityState={{ expanded: filtersOpen }}
        >
          <Ionicons
            name={filtersOpen ? 'close' : 'options-outline'}
            size={24}
            color={
              filtersOpen || filtersActive
                ? DesignTokens.colors.primary.main
                : DesignTokens.colors.text.secondary
            }
          />
        </TouchableOpacity>

        {filtersOpen ? (
          <View style={styles.filtersPanel}>
              <Text style={styles.filterSectionLabel}>כיוון</Text>
              <View style={styles.filterButtonsRow}>
                <TouchableOpacity
                  style={[styles.filterButton, filterDirection === 'all' && styles.filterButtonActive]}
                  onPress={() => setFilterDirection('all')}
                >
                  <Text style={[styles.filterButtonText, filterDirection === 'all' && styles.filterButtonTextActive]}>
                    הכל
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filterDirection === 'long' && styles.filterButtonActive]}
                  onPress={() => setFilterDirection('long')}
                >
                  <Text style={[styles.filterButtonText, filterDirection === 'long' && styles.filterButtonTextActive]}>
                    Long
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filterDirection === 'short' && styles.filterButtonActive]}
                  onPress={() => setFilterDirection('short')}
                >
                  <Text style={[styles.filterButtonText, filterDirection === 'short' && styles.filterButtonTextActive]}>
                    Short
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.filterSectionLabel, styles.filterSectionLabelSecond]}>תוצאה</Text>
              <View style={styles.filterButtonsRow}>
                <TouchableOpacity
                  style={[styles.filterButton, filterPnl === 'all' && styles.filterButtonActive]}
                  onPress={() => setFilterPnl('all')}
                >
                  <Text style={[styles.filterButtonText, filterPnl === 'all' && styles.filterButtonTextActive]}>
                    הכל
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filterPnl === 'profit' && styles.filterButtonActive]}
                  onPress={() => setFilterPnl('profit')}
                >
                  <Text style={[styles.filterButtonText, filterPnl === 'profit' && styles.filterButtonTextActive]}>
                    רווח
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filterPnl === 'loss' && styles.filterButtonActive]}
                  onPress={() => setFilterPnl('loss')}
                >
                  <Text style={[styles.filterButtonText, filterPnl === 'loss' && styles.filterButtonTextActive]}>
                    הפסד
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
      </View>

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color={DesignTokens.colors.text.tertiary} />
          <Text style={styles.emptyText}>אין טריידים עדיין</Text>
          <Text style={styles.emptySubtext}>הוסף טרייד ראשון כדי להתחיל</Text>
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

      {/* Export Trade Image Modal */}
      {selectedTrade && (
        <ExportTradeImage
          trade={selectedTrade}
          visible={showExportModal}
          onClose={() => {
            setShowExportModal(false);
            setSelectedTrade(null);
          }}
        />
      )}
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
    lineHeight: tokens.typography.body.size * tokens.typography.body.lineHeight,
    color: tokens.colors.text.secondary,
  },
  searchCard: {
    marginHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.xl,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  searchCardInner: {
    borderRadius: tokens.borderRadius.lg,
    minHeight: 44,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  searchIcon: {
    marginHorizontal: tokens.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    paddingVertical: 0,
  },
  clearButton: {
    padding: tokens.spacing.xs,
  },
  filtersOuter: {
    alignSelf: 'stretch',
    marginHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.xl,
    marginBottom: tokens.spacing.sm,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
  },
  filtersIconButton: {
    padding: 6,
    backgroundColor: 'transparent',
  },
  filtersPanel: {
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xs,
    backgroundColor: 'transparent',
  },
  filterSectionLabel: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
    writingDirection: 'rtl' as any,
    marginBottom: 4,
  },
  filterSectionLabelSecond: {
    marginTop: tokens.spacing.sm,
  },
  filterButtonsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.lg,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
    minWidth: 50,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(0, 200, 5, 0.08)',
    borderColor: tokens.colors.primary.main,
  },
  filterButtonText: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.bodySmall.weight as any,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.bold as any,
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
    paddingHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.xl,
    paddingTop: tokens.spacing.xs,
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
  tradeDetails: {
    gap: 4,
    marginBottom: tokens.spacing.xs,
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
  },
  footerReturnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 14,
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
    lineHeight: tokens.typography.body.size * tokens.typography.body.lineHeight,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
});

