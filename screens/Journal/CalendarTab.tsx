import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import UICard from '../../components/ui/UICard';
import AddTradeModal from './AddTradeModal';
import { Trade } from './TradesListTab';
import StatisticsCarousel, { StatisticItem } from '../../components/Journal/StatisticsCarousel';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

interface DailyPnl {
  date: string;
  pnl: number;
}

export default function CalendarTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const mainTabsHeight = useMainTabsHeight();
  const styles = React.useMemo(() => createStyles(DesignTokens, mainTabsHeight), [DesignTokens, mainTabsHeight]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyPnl, setDailyPnl] = useState<DailyPnl[]>([]);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadTrades();
    }
  }, [user, currentDate]);

  const loadTrades = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      // טעינת כל הטריידים של החודש
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('exit_date', startDate.toISOString())
        .lte('exit_date', endDate.toISOString())
        .order('exit_date', { ascending: true });

      if (error) throw error;

      setTrades(data || []);

      // חישוב P&L יומי
      const pnlByDate: Record<string, number> = {};
      (data || []).forEach((trade: Trade) => {
        const date = new Date(trade.exit_date).toISOString().split('T')[0];
        pnlByDate[date] = (pnlByDate[date] || 0) + trade.pnl;
      });

      // המרה למערך
      const dailyPnlArray: DailyPnl[] = Object.entries(pnlByDate).map(([date, pnl]) => ({
        date,
        pnl,
      }));

      // הוספת כל הימים של החודש (גם בלי טריידים)
      const daysInMonth = new Date(year, month, 0).getDate();
      const allDays: DailyPnl[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day).toISOString().split('T')[0];
        const existingPnl = dailyPnlArray.find((d) => d.date === date);
        allDays.push({
          date,
          pnl: existingPnl?.pnl || 0,
        });
      }

      setDailyPnl(allDays);
    } catch (error: any) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyWithColor = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return formatted;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate();
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDayName = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    return dayNames[date.getDay()];
  };

  const renderCalendarDay = ({ item }: { item: DailyPnl }) => {
    const dayNumber = formatDate(item.date);
    const dayName = getDayName(item.date);
    const hasTrades = item.pnl !== 0;
    const isProfit = item.pnl > 0;
    const isLoss = item.pnl < 0;

    // צבע רקע בהתאם ל-P&L
    let backgroundColor = 'transparent';
    if (isProfit) {
      backgroundColor = `${DesignTokens.colors.success.main}20`;
    } else if (isLoss) {
      backgroundColor = `${DesignTokens.colors.text.danger}20`;
    }

    return (
      <View style={[styles.calendarDay, { backgroundColor }]}>
        <Text style={styles.dayName}>{dayName}</Text>
        <Text style={styles.dayNumber}>{dayNumber}</Text>
        {hasTrades && (
          <View style={styles.pnlIndicator}>
            <Text style={[
              styles.pnlText,
              isProfit && styles.pnlTextProfit,
              isLoss && styles.pnlTextLoss
            ]}>
              <Text style={[
                styles.pnlText,
                isProfit && styles.pnlTextProfit,
                isLoss && styles.pnlTextLoss
              ]}>$</Text>
              {formatCurrencyWithColor(item.pnl)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={styles.loadingText}>טוען לוח שנה...</Text>
      </View>
    );
  }

  const monthTotal = dailyPnl.reduce((sum, day) => sum + day.pnl, 0);
  const isMonthProfit = monthTotal >= 0;

  // חישוב סטטיסטיקות
  const calculateAveragePnl = () => {
    if (trades.length === 0) return 0;
    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    return totalPnl / trades.length;
  };

  const calculateWinRate = () => {
    if (trades.length === 0) return 0;
    const winningTrades = trades.filter(trade => trade.pnl > 0).length;
    return Math.round((winningTrades / trades.length) * 100);
  };

  return (
    <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Month Header */}
        <View style={styles.monthHeaderContainer}>
          <UICard variant="blur" padding="md">
            <View style={styles.monthHeader}>
              <TouchableOpacity
                onPress={() => navigateMonth('prev')}
                style={styles.navButton}
              >
                <Ionicons name="chevron-back" size={24} color={DesignTokens.colors.text.primary} />
              </TouchableOpacity>

              <View style={styles.monthInfo}>
                <Text style={styles.monthName}>{getMonthName(currentDate)}</Text>
                <View style={styles.monthTotal}>
                  <Text style={styles.monthTotalLabel}>סה"כ חודש:</Text>
                  <Text style={[
                    styles.monthTotalValue,
                    isMonthProfit ? styles.monthTotalProfit : styles.monthTotalLoss
                  ]}>
                    <Text style={[
                      styles.monthTotalValue,
                      isMonthProfit ? styles.monthTotalProfit : styles.monthTotalLoss
                    ]}>$</Text>
                    {formatCurrencyWithColor(monthTotal)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => navigateMonth('next')}
                style={styles.navButton}
              >
                <Ionicons name="chevron-forward" size={24} color={DesignTokens.colors.text.primary} />
              </TouchableOpacity>
            </View>
          </UICard>
        </View>

        {/* Calendar Grid */}
        {dailyPnl.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={DesignTokens.colors.text.tertiary} />
            <Text style={styles.emptyText}>אין טריידים בחודש הזה</Text>
          </View>
        ) : (
          <FlatList
            data={dailyPnl}
            renderItem={renderCalendarDay}
            keyExtractor={(item) => item.date}
            numColumns={7}
            contentContainerStyle={styles.calendarGrid}
            scrollEnabled={false}
          />
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: `${DesignTokens.colors.success.main}20` }]} />
            <Text style={styles.legendText}>רווח</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: `${DesignTokens.colors.text.danger}20` }]} />
            <Text style={styles.legendText}>הפסד</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: 'transparent' }]} />
            <Text style={styles.legendText}>ללא טריידים</Text>
          </View>
        </View>

        {/* Statistics Carousel */}
        {(() => {
          const statistics: StatisticItem[] = trades.length > 0 ? [
            {
              id: 'total-trades',
              title: 'כמות עסקאות',
              value: trades.length,
              icon: 'list',
              color: DesignTokens.colors.primary.main,
              subtitle: `בחודש ${getMonthName(currentDate)}`,
            },
            {
              id: 'month-pnl',
              title: 'סה"כ חודש',
              value: `$${formatCurrencyWithColor(monthTotal)}`,
              icon: isMonthProfit ? 'trending-up' : 'trending-down',
              color: isMonthProfit ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger,
              subtitle: isMonthProfit ? 'רווח חודשי' : 'הפסד חודשי',
            },
            {
              id: 'average-pnl',
              title: calculateAveragePnl() >= 0 ? 'רווח ממוצע' : 'הפסד ממוצע',
              value: `$${formatCurrencyWithColor(calculateAveragePnl())}`,
              icon: calculateAveragePnl() >= 0 ? 'trending-up' : 'trending-down',
              color: calculateAveragePnl() >= 0 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger,
              subtitle: 'לעסקה',
            },
            {
              id: 'win-rate',
              title: 'Win Rate',
              value: `${calculateWinRate()}%`,
              icon: 'trophy',
              color: DesignTokens.colors.primary.main,
              subtitle: `${trades.filter(t => t.pnl > 0).length} מתוך ${trades.length}`,
            },
          ] : [];
          return statistics.length > 0 ? <StatisticsCarousel statistics={statistics} /> : null;
        })()}
      </ScrollView>

      {/* Add Trade FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color={DesignTokens.colors.text.primary} />
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
    </View>
  );
}

const { width } = Dimensions.get('window');
const dayWidth = (width - 48) / 7; // 7 columns with padding

const createStyles = (tokens: ReturnType<typeof useDesignTokens>, mainTabsHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  fab: {
    position: 'absolute',
    bottom: mainTabsHeight + 16,
    left: tokens.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 100,
  },
  scrollContent: {
  },
  monthHeaderContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
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
  monthHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    padding: tokens.spacing.sm,
  },
  monthInfo: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  monthName: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  monthTotal: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  monthTotalLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  monthTotalValue: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold as any,
    textAlign: 'right',
  },
  monthTotalProfit: {
    color: tokens.colors.primary.main,
  },
  monthTotalLoss: {
    color: tokens.colors.text.danger,
  },
  calendarGrid: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  calendarDay: {
    width: dayWidth,
    aspectRatio: 1,
    margin: 2,
    borderRadius: tokens.borderRadius.sm,
    padding: tokens.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  dayName: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    marginBottom: 2,
  },
  pnlIndicator: {
    marginTop: 2,
  },
  pnlText: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.bold as any,
    textAlign: 'right',
  },
  pnlTextProfit: {
    color: tokens.colors.primary.main,
  },
  pnlTextLoss: {
    color: tokens.colors.text.danger,
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
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
    marginTop: tokens.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
});

