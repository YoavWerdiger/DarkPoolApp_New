import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
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
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import type { Trade } from './tradeTypes';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

interface DailyPnl {
  date: string;
  pnl: number;
}

/** אלפא (סיומת RRGGBBAA) לשכבות רווח/הפסד בלוח — חזק יותר מהגרסה הקודמת (~14%) כדי שהירוק/אדום יבלטו דרך הזכוכית */
const CALENDAR_CELL_TINT_ALPHA = '65';
const CALENDAR_LEGEND_SWATCH_ALPHA = '4A';

export default function CalendarTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const mainTabsHeight = useMainTabsHeight();

  /** רוחב פנימי אחיד + רווחים בין עמודות — כדי שהגריד יתאים למרכז המסך בלי חפיפה */
  const gridLayout = React.useMemo(() => {
    const horizontalPad = DesignTokens.layout?.screenPadding ?? 20;
    const inner = windowWidth - horizontalPad * 2;
    /** אותו מרווח בין עמודות ובין שורות */
    const cellGap = 4;
    const dayWidth = Math.max(0, (inner - cellGap * 6) / 7);
    return { horizontalPad, inner, cellGap, dayWidth };
  }, [DesignTokens, windowWidth]);

  const glassDayBase = React.useMemo(
    () => ({
      ...DesignTokens.getGlassCardStyle('light'),
      borderRadius: DesignTokens.borderRadius.lg,
    }),
    [DesignTokens]
  );

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

  /**
   * מספרי P&L קצרים: 1000→$1k, 21000→$21k, מעל מיליון → $1.2M
   * מחרוזת אחת — בלי פסיקים ששוברים שורה
   */
  const formatPnlForCell = (pnl: number) => {
    if (pnl === 0) return '$0';
    const sign = pnl < 0 ? '-' : '';
    const v = Math.abs(pnl);
    if (v >= 1_000_000) {
      const m = v / 1_000_000;
      const s = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
      return `${sign}$${s}M`;
    }
    if (v >= 1_000) {
      const k = v / 1_000;
      const s = k % 1 < 0.05 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
      return `${sign}$${s}k`;
    }
    return `${sign}$${v.toFixed(0)}`;
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
    const g = gridLayout.cellGap;
    const hGap = index % 7 !== 6 ? g : 0;
    const numRows = Math.ceil(calendarData.length / 7);
    const row = Math.floor(index / 7);
    const vGap = row < numRows - 1 ? g : 0;
    const cellSize = { width: gridLayout.dayWidth, marginRight: hGap, marginBottom: vGap };

    const cellShell = (children: React.ReactNode, accent?: 'profit' | 'loss' | null) => (
      <View
        style={[
          styles.calendarDay,
          glassDayBase,
          cellSize,
          styles.calendarDayClip,
          accent === 'profit' && {
            borderWidth: 1,
            borderColor: `${DesignTokens.colors.success.main}B3`,
          },
          accent === 'loss' && {
            borderWidth: 1,
            borderColor: `${DesignTokens.colors.text.danger}B3`,
          },
        ]}
      >
        {accent === 'profit' && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: DesignTokens.borderRadius.lg,
                backgroundColor: `${DesignTokens.colors.success.main}${CALENDAR_CELL_TINT_ALPHA}`,
              },
            ]}
          />
        )}
        {accent === 'loss' && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: DesignTokens.borderRadius.lg,
                backgroundColor: `${DesignTokens.colors.text.danger}${CALENDAR_CELL_TINT_ALPHA}`,
              },
            ]}
          />
        )}
        {children}
      </View>
    );

    if (!item) {
      return cellShell(null);
    }

    const dayNumber = formatDate(item.date);
    const dayName = getDayName(item.date);
    const hasTrades = item.pnl !== 0;
    const isProfit = item.pnl > 0;
    const isLoss = item.pnl < 0;
    const accent = isProfit ? 'profit' : isLoss ? 'loss' : null;

    return cellShell(
      <>
        <Text style={styles.dayName}>{dayName}</Text>
        <Text style={styles.dayNumber}>{dayNumber}</Text>
        {hasTrades && (
          <View style={styles.pnlIndicator} pointerEvents="none">
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              ellipsizeMode="clip"
              allowFontScaling
              style={[
                styles.pnlText,
                isProfit && styles.pnlTextProfit,
                isLoss && styles.pnlTextLoss,
              ]}
            >
              {formatPnlForCell(item.pnl)}
            </Text>
          </View>
        )}
      </>,
      accent
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
          {/** מעטפת כמו ניווט תאריך ב"דיווחי רווח" (EarningsReportsTab) */}
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={styles.monthNavCard}
            contentContainerStyle={styles.monthNavCardInner}
          >
            <View style={styles.monthHeader}>
              <DayNavBlurButton
                onPress={() => navigateMonth('prev')}
                glassIntensity="subtle"
                accessibilityLabel="חודש קודם"
              >
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.primary} />
              </DayNavBlurButton>

              <View style={styles.monthInfo}>
                <Text style={styles.monthName} numberOfLines={2}>
                  {getMonthName(currentDate)}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={[
                    styles.monthTotalCaption,
                    isMonthProfit ? styles.monthTotalCaptionProfit : styles.monthTotalCaptionLoss,
                  ]}
                >
                  {`סה״כ חודש ${formatPnlForCell(monthTotal)}`}
                </Text>
              </View>

              <DayNavBlurButton
                onPress={() => navigateMonth('next')}
                glassIntensity="subtle"
                accessibilityLabel="חודש הבא"
              >
                <Ionicons name="chevron-forward" size={20} color={DesignTokens.colors.text.primary} />
              </DayNavBlurButton>
            </View>
          </UICard>
        </View>

        {/* Calendar Grid */}
        {/* כותרת ימי השבוע */}
        <View
          style={[
            styles.weekDaysHeader,
            { paddingHorizontal: gridLayout.horizontalPad, marginBottom: gridLayout.cellGap },
          ]}
        >
          {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day, index) => (
            <View
              key={index}
              style={[
                styles.weekDayCell,
                { width: gridLayout.dayWidth, marginRight: index < 6 ? gridLayout.cellGap : 0 },
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
            <View
              style={[
                styles.legendColor,
                { backgroundColor: `${DesignTokens.colors.success.main}${CALENDAR_LEGEND_SWATCH_ALPHA}` },
              ]}
            />
            <Text style={styles.legendText}>רווח</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: `${DesignTokens.colors.text.danger}${CALENDAR_LEGEND_SWATCH_ALPHA}` },
              ]}
            />
            <Text style={styles.legendText}>הפסד</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: DesignTokens.colors.glass.card.bg, borderColor: DesignTokens.colors.glass.card.border },
              ]}
            />
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
  _grid: { horizontalPad: number; inner: number; cellGap: number; dayWidth: number }
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
    paddingHorizontal: tokens.layout?.screenPadding ?? 20,
    paddingVertical: 11,
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
  /** כמו EarningsReportsTab — כרטיס blur + padding 12 */
  monthNavCard: {
    borderRadius: 16,
    marginBottom: 10,
  },
  monthNavCardInner: {
    padding: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    /** בלי זה, ב־rtlRoot הכפתור הראשון נזרק לימין והחצים נראים הפוכים */
    direction: 'ltr' as 'ltr' | 'rtl',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthInfo: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  monthName: {
    fontSize: 16,
    fontWeight: '600' as any,
    lineHeight: 21,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: 'rtl' as any,
  },
  /** שורה משנית — כמו תג "היום" בדיווח רווח */
  monthTotalCaption: {
    fontSize: 12,
    fontWeight: '700' as any,
    marginTop: 1,
    textAlign: 'center',
    writingDirection: 'rtl' as any,
  },
  monthTotalCaptionProfit: {
    color: tokens.colors.success.main,
  },
  monthTotalCaptionLoss: {
    color: tokens.colors.text.danger,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
  },
  weekDayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  weekDayText: {
    fontSize: tokens.typography.footnote.size,
    lineHeight: tokens.typography.footnote.lineHeight,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  calendarGrid: {
    paddingBottom: 0,
  },
  /** מבנה — רקע/מסגרת מ־getGlassCardStyle + glassDayBase */
  calendarDay: {
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayClip: {
    overflow: 'hidden',
  },
  dayName: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
    marginBottom: 2,
    display: 'none', // הסתרת שם היום כי יש כותרת נפרדת
  },
  dayNumber: {
    fontSize: tokens.typography.subhead.size,
    lineHeight: tokens.typography.subhead.lineHeight,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    marginBottom: 1,
  },
  pnlIndicator: {
    width: '100%',
    maxWidth: '100%',
    marginTop: 2,
    paddingHorizontal: 0,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  pnlText: {
    fontSize: 11,
    maxWidth: '100%',
    fontWeight: '800' as any,
    textAlign: 'center',
    lineHeight: 13,
  },
  pnlTextProfit: {
    color: tokens.colors.success.main,
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

