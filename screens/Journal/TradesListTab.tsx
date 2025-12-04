import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import AddTradeModal from './AddTradeModal';
import ShareTradeModal from './ShareTradeModal';

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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all' | 'long' | 'short'>('all');
  const [filterPnl, setFilterPnl] = useState<'all' | 'profit' | 'loss'>('all');
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  useEffect(() => {
    if (user) {
      loadTrades();
    }
  }, [user]);

  const loadTrades = async () => {
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
      console.error('Error loading trades:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את הטריידים');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    Alert.alert(
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
              console.error('Error deleting trade:', error);
              Alert.alert('שגיאה', 'לא ניתן למחוק את הטרייד');
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
      <View style={styles.tradeCard}>
        <View style={styles.tradeHeader}>
          <View style={styles.tradeSymbolContainer}>
            <Text style={styles.tradeSymbol}>{item.symbol}</Text>
            <View style={[styles.directionBadge, { backgroundColor: `${directionColor}20` }]}>
              <Text style={[styles.directionText, { color: directionColor }]}>
                {directionText}
              </Text>
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
          <View style={styles.footerRow}>
            <View style={styles.pnlRow}>
              <Text style={styles.pnlLabel}>
                {isProfit ? 'רווח ממוצע:' : 'הפסד ממוצע:'}
              </Text>
              <Text style={[
                styles.pnlText,
                isProfit ? styles.pnlTextProfit : styles.pnlTextLoss
              ]}>
                <Text style={[
                  styles.pnlText,
                  isProfit ? styles.pnlTextProfit : styles.pnlTextLoss
                ]}>$</Text>
                {formatCurrencyWithColor(item.pnl)}
              </Text>
            </View>
            <Text style={[
              styles.returnText,
              isProfit ? styles.returnTextProfit : styles.returnTextLoss
            ]}>
              ({returnPercentage > 0 ? '+' : ''}{returnPercentage.toFixed(2)}%)
            </Text>
          </View>
        </View>

      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
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

  const totalPnl = filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const isTotalProfit = totalPnl >= 0;

  // חישוב סטטיסטיקות
  const calculateAveragePnl = () => {
    if (filteredTrades.length === 0) return 0;
    const totalPnl = filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    return totalPnl / filteredTrades.length;
  };

  const calculateWinRate = () => {
    if (filteredTrades.length === 0) return 0;
    const winningTrades = filteredTrades.filter(trade => trade.pnl > 0).length;
    return Math.round((winningTrades / filteredTrades.length) * 100);
  };

  return (
    <View style={styles.container}>
      {/* Statistics Cards - Moved to top */}
      {trades.length > 0 && (
        <View style={styles.statsContainer}>
          {/* סה"כ טריידים */}
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="list" size={18} color={DesignTokens.colors.primary.main} />
            </View>
            <Text style={styles.statValue}>{filteredTrades.length}</Text>
            <Text style={styles.statLabel}>סה"כ טריידים</Text>
          </View>

          {/* P&L כולל */}
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons 
                name={isTotalProfit ? 'trending-up' : 'trending-down'} 
                size={18} 
                color={isTotalProfit ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger} 
              />
            </View>
            <Text style={[
              styles.statValue,
              isTotalProfit ? styles.statValueProfit : styles.statValueLoss
            ]}>
              <Text style={[
                styles.statValue,
                isTotalProfit ? styles.statValueProfit : styles.statValueLoss
              ]}>$</Text>
              {formatCurrencyWithColor(totalPnl)}
            </Text>
            <Text style={styles.statLabel}>P&L כולל</Text>
          </View>

          {/* רווח/הפסד ממוצע */}
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons 
                name={calculateAveragePnl() >= 0 ? 'trending-up' : 'trending-down'} 
                size={18} 
                color={DesignTokens.colors.primary.main} 
              />
            </View>
            <Text style={[
              styles.statValue,
              calculateAveragePnl() >= 0 ? styles.statValueProfit : styles.statValueLoss
            ]}>
              <Text style={[
                styles.statValue,
                calculateAveragePnl() >= 0 ? styles.statValueProfit : styles.statValueLoss
              ]}>$</Text>
              {formatCurrencyWithColor(calculateAveragePnl())}
            </Text>
            <Text style={styles.statLabel}>
              {calculateAveragePnl() >= 0 ? 'רווח ממוצע' : 'הפסד ממוצע'}
            </Text>
          </View>

          {/* Win Rate */}
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="trophy" size={18} color={DesignTokens.colors.primary.main} />
            </View>
            <Text style={[styles.statValue, styles.statValueWinRate]}>
              {calculateWinRate()}%
            </Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={DesignTokens.colors.text.secondary} style={styles.searchIcon} />
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
            <Ionicons name="close-circle" size={20} color={DesignTokens.colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Buttons - Compact */}
      <View style={styles.filtersContainer}>
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
          <View style={styles.filterDivider} />
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

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color={DesignTokens.colors.text.tertiary} />
          <Text style={styles.emptyText}>אין טריידים עדיין</Text>
          <Text style={styles.emptySubtext}>הוסף טרייד ראשון כדי להתחיל</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTrades}
          renderItem={renderTrade}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
        />
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={DesignTokens.colors.text.primary} />
      </TouchableOpacity>

      {/* Add Trade Modal */}
      <AddTradeModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          loadTrades();
        }}
      />

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

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  searchIcon: {
    marginLeft: tokens.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  clearButton: {
    padding: tokens.spacing.xs,
  },
  filtersContainer: {
    marginHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
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
    backgroundColor: tokens.colors.background.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
    minWidth: 50,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: tokens.colors.border.primary,
    marginHorizontal: tokens.spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: `${tokens.colors.primary.main}20`,
    borderColor: tokens.colors.primary.main,
  },
  filterButtonText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  summaryContainer: {
    backgroundColor: tokens.colors.background.secondary,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: tokens.spacing.xs,
  },
  summaryLabel: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  summaryCount: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary.main,
    textAlign: 'right',
  },
  summaryPnl: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    textAlign: 'right',
  },
  summaryProfit: {
    color: tokens.colors.primary.main,
  },
  summaryLoss: {
    color: tokens.colors.text.danger,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 120,
    paddingTop: tokens.spacing.sm,
  },
  tradeCard: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  tradeHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  tradeSymbolContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  tradeSymbol: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  directionBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.sm,
  },
  directionText: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  headerActions: {
    flexDirection: 'row-reverse',
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
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  tradeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  tradePrice: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.medium,
    textAlign: 'right',
  },
  tradeValue: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
    fontWeight: tokens.typography.fontWeight.medium,
    textAlign: 'right',
  },
  tradeFooter: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  footerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnlRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  pnlLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  pnlContainer: {
    flexDirection: 'row-reverse',
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
    fontWeight: tokens.typography.fontWeight.bold,
    textAlign: 'right',
  },
  pnlTextProfit: {
    color: tokens.colors.primary.main,
  },
  pnlTextLoss: {
    color: tokens.colors.text.danger,
  },
  returnText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold,
    textAlign: 'right',
  },
  returnTextProfit: {
    color: tokens.colors.primary.main,
  },
  returnTextLoss: {
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  emptyText: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  statsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${tokens.colors.primary.main}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  statValueProfit: {
    color: tokens.colors.primary.main,
  },
  statValueLoss: {
    color: tokens.colors.text.danger,
  },
  statValueWinRate: {
    color: tokens.colors.primary.main,
  },
  statLabel: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
});

