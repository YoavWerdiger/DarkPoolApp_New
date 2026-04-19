import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import UICard from '../../components/ui/UICard';
import { Trade } from './TradesListTab';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

interface DailyPnl {
  date: string;
  pnl: number;
}

export default function CalendarTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const mainTabsHeight = useMainTabsHeight();

  /** רוחב פנימי אחיד + רווחים בין עמודות — כדי שהגריד יתאים למרכז המסך בלי חפיפה */
  const gridLayout = React.useMemo(() => {
    const horizontalPad = DesignTokens.layout?.screenPadding ?? DesignTokens.spacing.xl;
    const inner = windowWidth - horizontalPad * 2;
    const colGap = 4;
    const dayWidth = Math.max(0, (inner - colGap * 6) / 7);
    return { horizontalPad, inner, colGap, dayWidth };
  }, [DesignTokens, windowWidth]);

  const styles = React.useMemo(
    () => createStyles(DesignTokens, mainTabsHeight, gridLayout),
    [DesignTokens, mainTabsHeight, gridLayout]
  );

  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyPnl, setDailyPnl] = useState<DailyPnl[]>([]);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);

  const loadTrades = useCallback(async () => {
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
    } finally {
      setLoading(false);
    }
  }, [user, currentDate]);

  useFocusEffect(
    useCallback(() => {
      void loadTrades();
    }, [loadTrades])
  );

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

  // יצירת מערך לוח שנה עם תאים ריקים בתחילה
  const getCalendarData = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // היום הראשון בחודש
    const firstDayOfMonth = new Date(year, month, 1);
    // באיזה יום בשבוע מתחיל החודש (0=ראשון, 6=שבת)
    const startDayOfWeek = firstDayOfMonth.getDay();
    
    // מספר ימים בחודש
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // יצירת מערך עם תאים ריקים בתחילה
    const calendarData: (DailyPnl | null)[] = [];
    
    // הוספת תאים ריקים לפני היום הראשון
    for (let i = 0; i < startDayOfWeek; i++) {
      calendarData.push(null);
    }
    
    // הוספת הימים של החודש
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(year, month, day).toISOString().split('T')[0];
      const existingPnl = dailyPnl.find(d => d.date === dateStr);
      calendarData.push({
        date: dateStr,
        pnl: existingPnl?.pnl || 0,
      });
    }
    
    return calendarData;
  };

  const calendarData = getCalendarData();

  const renderCalendarDay = ({ item, index }: { item: DailyPnl | null; index: number }) => {
    const cellGap = index % 7 !== 6 ? gridLayout.colGap : 0;
    const cellBase = [styles.calendarDay, { width: gridLayout.dayWidth, marginRight: cellGap }];

    // תא ריק
    if (!item) {
      return (
        <View style={[...cellBase, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />
      );
    }
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
      <View style={[...cellBase, { backgroundColor }]}>
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
      <View style={[styles.loadingContainer, styles.rtlRoot]}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={styles.loadingText}>טוען לוח שנה...</Text>
      </View>
    );
  }

  const monthTotal = dailyPnl.reduce((sum, day) => sum + day.pnl, 0);
  const isMonthProfit = monthTotal >= 0;

  return (
    <View style={[styles.outer, styles.rtlRoot]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: mainTabsHeight + 100 }}
        showsVerticalScrollIndicator={true}
      >
        {/* Month Header */}
        <View style={styles.monthHeaderContainer}>
          <UICard variant="blur" padding="md">
            <View style={styles.monthHeader}>
              <View style={styles.monthHeaderSide}>
                <TouchableOpacity
                  onPress={() => navigateMonth('prev')}
                  style={styles.navButton}
                  accessibilityRole="button"
                  accessibilityLabel="חודש קודם"
                >
                  <Ionicons name="chevron-back" size={24} color={DesignTokens.colors.text.primary} />
                </TouchableOpacity>
              </View>

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

              <View style={styles.monthHeaderSide}>
                <TouchableOpacity
                  onPress={() => navigateMonth('next')}
                  style={styles.navButton}
                  accessibilityRole="button"
                  accessibilityLabel="חודש הבא"
                >
                  <Ionicons name="chevron-forward" size={24} color={DesignTokens.colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </UICard>
        </View>

        {/* Calendar Grid */}
        {/* כותרת ימי השבוע */}
        <View style={[styles.weekDaysHeader, { paddingHorizontal: gridLayout.horizontalPad }]}>
          {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day, index) => (
            <View
              key={index}
              style={[
                styles.weekDayCell,
                { width: gridLayout.dayWidth, marginRight: index < 6 ? gridLayout.colGap : 0 },
              ]}
            >
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>
        
        {calendarData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={DesignTokens.colors.text.tertiary} />
            <Text style={styles.emptyText}>אין טריידים בחודש הזה</Text>
          </View>
        ) : (
          <FlatList
            data={calendarData}
            renderItem={renderCalendarDay}
            keyExtractor={(item, index) => item ? item.date : `empty-${index}`}
            numColumns={7}
            contentContainerStyle={[
              styles.calendarGrid,
              { paddingHorizontal: gridLayout.horizontalPad, maxWidth: windowWidth, alignSelf: 'center' },
            ]}
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
      </ScrollView>
    </View>
  );
}

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  mainTabsHeight: number,
  _grid: { horizontalPad: number; inner: number; colGap: number; dayWidth: number }
) => StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  rtlRoot: {
    direction: 'rtl',
  },
  outer: {
    flex: 1,
    minHeight: 0,
  },
  monthHeaderContainer: {
    paddingHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.xl,
    paddingTop: 0,
    marginBottom: tokens.spacing.sm,
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthHeaderSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  navButton: {
    padding: tokens.spacing.sm,
  },
  monthInfo: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  monthName: {
    fontSize: tokens.typography.displayXs.size,
    fontWeight: tokens.typography.displayXs.weight as any,
    letterSpacing: tokens.typography.displayXs.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  monthTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    flexWrap: 'wrap',
  },
  monthTotalLabel: {
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.body.weight as any,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  monthTotalValue: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold as any,
    textAlign: 'center',
  },
  monthTotalProfit: {
    color: tokens.colors.primary.main,
  },
  monthTotalLoss: {
    color: tokens.colors.text.danger,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    alignSelf: 'center',
    maxWidth: '100%',
    marginBottom: 2,
  },
  weekDayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.secondary,
  },
  calendarGrid: {
    paddingBottom: tokens.spacing.sm,
  },
  calendarDay: {
    aspectRatio: 1,
    borderRadius: tokens.borderRadius.lg,
    padding: 2, // padding קטן יותר כדי שהמספר יכנס
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
    backgroundColor: tokens.colors.glass.card.bg,
    overflow: 'hidden', // חיתוך תוכן שחורג
  },
  dayName: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
    marginBottom: 2,
    display: 'none', // הסתרת שם היום כי יש כותרת נפרדת
  },
  dayNumber: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    marginBottom: 1,
  },
  pnlIndicator: {
    marginTop: 1,
    maxWidth: '100%',
  },
  pnlText: {
    fontSize: 9, // גודל קטן יותר כדי להכנס בתא
    fontWeight: tokens.typography.fontWeight.bold as any,
    textAlign: 'center',
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
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
    marginTop: tokens.spacing.sm,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  legendItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  legendText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
});

