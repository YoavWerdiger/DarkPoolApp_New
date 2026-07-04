import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { EconomicEvent } from '../../services/economicCalendarService';
type EconEvent = EconomicEvent;
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { getIndicatorExplanation } from '../../utils/economicIndicatorExplanations';
import { translateEconomicEventNameSmart } from '../../utils/economicEventTranslations';
import UICard from '../../components/ui/UICard';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import { formatEconomicDisplayValue, parseEconomicNumber } from '../../utils/economicNumberFormat';

const EconomicEventCard: React.FC<{ event: EconEvent; onPress: (event: EconEvent) => void }> = ({ 
  event, 
  onPress 
}) => {
  const DesignTokens = useDesignTokens();
  
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return DesignTokens.colors.danger.main;
      case 'medium':
        return DesignTokens.colors.warning.main;
      case 'low':
        return DesignTokens.colors.success.main;
      default:
        return DesignTokens.colors.border.primary;
    }
  };

  const stripEmojis = (text: string) => {
    return text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const importanceColor = getImportanceColor(event.importance);
  // תרגום שם האירוע לעברית
  const translatedTitle = translateEconomicEventNameSmart(event.title || '');
  const cleanTitle = stripEmojis(translatedTitle);

  const getActualColor = (): string => {
    const actual = parseEconomicNumber(event.actual);
    const forecast = parseEconomicNumber(event.forecast);
    if (!isFinite(actual) || !isFinite(forecast)) {
      return DesignTokens.colors.text.primary;
    }
    // כלל פשוט: תוצאה >= תחזית → ירוק עדין, אחרת אדום עדין
    return actual >= forecast ? DesignTokens.colors.primary.main : DesignTokens.colors.danger.main;
  };

  const screenPad = DesignTokens.layout?.screenPadding ?? 20;
  return (
    <Pressable onPress={() => onPress(event)} style={{ marginHorizontal: screenPad, marginBottom: 12 }}>
      <UICard variant="blur" padding="lg" style={{ flexDirection: 'row', alignItems: 'flex-start', overflow: 'hidden' }}>
      {/* פס חשיבות דק מיושר לימין, מעוגל בפינות - מתאים לגובה הכרטיסיה */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: importanceColor,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
        }}
      />

      {/* תוכן מימין */}
      <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 12 }}>
        {/* שורה עליונה - זמן וכותרת (RTL: זמן משמאל, כותרת מימין) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
          <Text 
            style={{ 
              fontSize: 18, 
              fontWeight: '700', 
              color: DesignTokens.colors.text.primary,
              textAlign: 'right',
              lineHeight: 24,
              flex: 1,
              marginRight: 8
            }}
            numberOfLines={2}
          >
            {cleanTitle}
          </Text>
          <View style={{
            backgroundColor: (DesignTokens.colors.primary as any).dim || 'rgba(0, 210, 106, 0.12)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20
          }}>
            <Text style={{ 
              fontSize: 16, 
              color: DesignTokens.colors.primary.main,
              fontWeight: '600',
              textAlign: 'center'
            }}>
              {event.time}
            </Text>
          </View>
        </View>

      {/* בלוק ערכים ויזואلي – ללא מסגרות, עם פסי הפרדה */}
      {/* מציגים רק אם יש תוצאה/תחזית/קודם - אחרת רק שעה ושם האירוע */}
      {(event.actual || event.forecast || event.previous) && (
        <View style={{ marginTop: 12 }}>
          {/* פס הפרדה אופקי עליון */}
          <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)', marginBottom: 12 }} />
          
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%' }}>
            {event.actual && (
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 6, fontWeight: '500', textAlign: 'center' }}>תוצאה</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: getActualColor(), textAlign: 'center' }}>{formatEconomicDisplayValue(event.actual)}</Text>
              </View>
            )}
              {event.actual && (event.forecast || event.previous) && (
              <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.12)', marginHorizontal: 16, alignSelf: 'flex-start', marginTop: 0 }} />
            )}
            {event.forecast && (
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 6, fontWeight: '500', textAlign: 'center' }}>תחזית</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: DesignTokens.colors.text.primary, textAlign: 'center' }}>{formatEconomicDisplayValue(event.forecast)}</Text>
              </View>
            )}
            {event.forecast && event.previous && (
              <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.12)', marginHorizontal: 16, alignSelf: 'flex-start', marginTop: 0 }} />
            )}
            {event.previous && (
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 6, fontWeight: '500', textAlign: 'center' }}>קודם</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: DesignTokens.colors.text.secondary, textAlign: 'center' }}>{formatEconomicDisplayValue(event.previous)}</Text>
              </View>
            )}
          </View>
        </View>
      )}
      </View>
      </UICard>
    </Pressable>
  );
};

// רשימת אירועים חשובים ביותר לסוחרים
const CRITICAL_EVENTS = [
  // מדיניות מוניטרית - הכי חשוב!
  'FED', 'FOMC', 'ריבית', 'פד', 'ישיבת הפד', 'החלטת ריבית', 'Federal Reserve',
  'Interest Rate', 'Rate Decision', 'Beige Book', 'Fed Chair', 'Powell',
  'Balance Sheet', 'Monetary Policy',
  
  // אינפלציה - קריטי לשווקים
  'CPI', 'PPI', 'PCE', 'Core CPI', 'Core PCE', 'אינפלציה', 'Inflation',
  'Consumer Price', 'Producer Price', 'Personal Consumption',
  'Import Price', 'Export Price',
  
  // שוק עבודה - מניע מרכזי
  'NFP', 'Non-Farm', 'Payrolls', 'אבטלה', 'Unemployment', 'Jobless Claims', 
  'תביעות אבטלה', 'ADP', 'Employment', 'שכר ממוצע', 'Hourly Earnings',
  'Wages', 'Labor Force', 'תעסוקה',
  
  // צמיחה - מדדים מרכזיים
  'GDP', 'מכירות קמעונאיות', 'Retail Sales', 'ייצור תעשייתי', 
  'Industrial Production', 'Capacity Utilization', 'Business Inventories',
  'Manufacturing', 'Factory Orders',
  
  // סנטימנט - מנבא מגמות
  'ISM', 'PMI', 'אמון צרכן', 'Consumer Confidence', 'Michigan Sentiment',
  'S&P Global', 'Services PMI', 'Manufacturing PMI', 'Composite PMI',
  
  // נדל"ן - מחוון כלכלי
  'Housing Starts', 'Building Permits', 'Home Sales', 'התחלות בנייה', 
  'היתרי בנייה', 'Existing Home', 'New Home', 'NAHB', 'Case-Shiller',
  
  // סחר - גלובלי
  'Trade Balance', 'מאזן סחר', 'Current Account', 'Exports', 'Imports',
  
  // שווקים - תנודתיות
  'VIX', 'Treasury', 'תשואות', 'Yields', '10-Year', '2-Year', 'Yield Curve',
  
  // בנקים מרכזיים אחרים
  'ECB', 'BOE', 'BOJ', 'Bank of England', 'European Central Bank',
  
  // אנרגיה - משפיע על אינפלציה
  'Oil', 'Crude', 'WTI', 'Brent', 'Energy', 'נפט',
  
  // מטבעות - חשוב לפורקס
  'Dollar Index', 'DXY', 'EUR/USD', 'Currency',
  
  // דוחות רווחים חשובים
  'Earnings', 'רווחים', 'תוצאות', 'דוח רבעוני'
];

export default function EconomicCalendarTab() {
  const DesignTokens = useDesignTokens();
  const screenPad = DesignTokens.layout?.screenPadding ?? 20;
  // זריעה אופטימית מה-cache (נטען מהדיסק בהפעלה קרה) — רינדור מיידי
  const [events, setEvents] = useState<EconEvent[]>(
    () => queryClient.getQueryData<EconEvent[]>(appQueryKeys.economicEvents) ?? []
  );
  const [filteredEvents, setFilteredEvents] = useState<EconEvent[]>([]);
  const [loading, setLoading] = useState(
    () => !queryClient.getQueryData<EconEvent[]>(appQueryKeys.economicEvents)
  );
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImportance, setSelectedImportance] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week'>('week');
  
  // תצוגה יומית חדשה
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyEvents, setDailyEvents] = useState<EconEvent[]>([]);
  
  // Ref לגלילה לאירוע הקרוב ביותר
  const dailyEventsListRef = useRef<FlatList>(null);

  // דיבאג - בדיקה מתי הref מוכן (useLayoutEffect רץ סינכרוני אחרי DOM update)
  useLayoutEffect(() => {
    if (!loading) {
    }
  }, [loading]);
  
  // בדיקה נוספת אחרי טיימר
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // פילטרים מתקדמים
  // פישוט: אין פילטרים מתקדמים, אין טעינת היסטוריה ידנית

  // פונקציות ניווט יומי
  const goToPreviousDay = () => {
    void HapticFeedback.impactLight();
    const previousDay = new Date(selectedDate);
    previousDay.setDate(selectedDate.getDate() - 1);
    setSelectedDate(previousDay);
  };

  const goToNextDay = () => {
    void HapticFeedback.impactLight();
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToToday = useCallback(() => {
    void HapticFeedback.medium();
    setSelectedDate(new Date());
    dailyEventsListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();

  const fabBottomInset = DesignTokens.spacing.lg;
  const listBottomPad = isSelectedToday ? DesignTokens.spacing.md : fabBottomInset + 68;

  const fabStyles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          paddingBottom: fabBottomInset,
          zIndex: 40,
        },
        btn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 28,
          backgroundColor: DesignTokens.colors.primary.main,
          ...DesignTokens.shadows.md,
        },
        btnText: {
          fontSize: 16,
          fontWeight: '700',
          color: DesignTokens.colors.text.inverse,
        },
      }),
    [DesignTokens, fabBottomInset],
  );

  // בדיקה אם אירוע הוא "מוכר" — נכלל ברשימת ה-CRITICAL_EVENTS או מסומן כ-high
  // importance ב-DB. מספיק שאחד מהשניים יתקיים כדי שהאירוע ייחשב חשוב.
  const isCriticalEvent = useCallback((event: EconEvent): boolean => {
    if (event.importance === 'high') return true;
    const titleLower = (event.title || '').toLowerCase();
    const descLower = (event.description || '').toLowerCase();
    const categoryLower = (event.category || '').toLowerCase();
    return CRITICAL_EVENTS.some(keyword => {
      const k = keyword.toLowerCase();
      return titleLower.includes(k) || descLower.includes(k) || categoryLower.includes(k);
    });
  }, []);

  // פילטור אירועים לפי יום נבחר עם תיקון שעה
  const filterEventsByDate = useCallback(() => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
    // פילטור חכם: דיווחים מ-00:00 עד 06:00 שייכים ליום הקודם
    // דיווחים מ-06:00 והלאה שייכים ליום הנוכחי
    let eventsForDay = events.filter(event => {
      const eventDate = event.date;
      const eventTime = event.time || '00:00';
      
      // אם התאריך תואם בדיוק
      if (eventDate === selectedDateStr) {
        // בדיקה אם זה דיווח מוקדם (מ-00:00 עד 06:00) שצריך להיות מיוחס ליום הקודם
        const [hours, minutes] = eventTime.split(':').map(Number);
        const eventHour = hours * 60 + minutes;
        const cutoffHour = 6 * 60; // 06:00
        
        if (eventHour <= cutoffHour) {
          // זה דיווח מוקדם - בדוק אם צריך להיות מיוחס ליום הקודם
          const selectedDateObj = new Date(selectedDate);
          const previousDay = new Date(selectedDateObj);
          previousDay.setDate(selectedDateObj.getDate() - 1);
          const previousDayStr = previousDay.toISOString().split('T')[0];
          
          return false; // לא להציג אותו ביום הנוכחי
        }
        
        return true; // דיווח רגיל ביום הנוכחי (אחרי 06:00)
      }
      
      // בדיקה אם זה דיווח מוקדם של היום הבא שצריך להיות מיוחס ליום הנוכחי
      const selectedDateObj = new Date(selectedDate);
      const nextDay = new Date(selectedDateObj);
      nextDay.setDate(selectedDateObj.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      
      if (eventDate === nextDayStr) {
        const [hours, minutes] = eventTime.split(':').map(Number);
        const eventHour = hours * 60 + minutes;
        const cutoffHour = 6 * 60; // 06:00
        
        if (eventHour <= cutoffHour) {
          return true; // להציג אותו ביום הנוכחי
        }
      }
      
      return false;
    });
    
    // סינון קבוע לדוחות מוכרים בלבד (FED / CPI / NFP / ...) — מסיר אלפי
    // אירועים מקומיים/קלים שלא משפיעים על השווקים האמריקאיים.
    eventsForDay = eventsForDay.filter(isCriticalEvent);

    // מיון לפי זמן (מהשעה הקטנה לגדולה)
    eventsForDay.sort((a, b) => {
      const timeA = (a.time || '00:00').split(':').map(Number);
      const timeB = (b.time || '00:00').split(':').map(Number);
      const minutesA = timeA[0] * 60 + timeA[1];
      const minutesB = timeB[0] * 60 + timeB[1];
      return minutesA - minutesB;
    });
    
    setDailyEvents(eventsForDay);
  }, [events, selectedDate, isCriticalEvent]);

  // עדכון אירועים יומיים כשמשתנה התאריך או האירועים
  useEffect(() => {
    filterEventsByDate();
  }, [filterEventsByDate]);

  // חישוב אינדקס האירוע הקרוב ביותר לשעה הנוכחית מתוך dailyEvents
  const findClosestEventIndex = useCallback((events: EconEvent[]): number => {
    if (events.length === 0) return -1;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let closestIndex = 0;
    let smallestDiff = Infinity;
    events.forEach((event, index) => {
      const [hours, minutes] = (event.time || '00:00').split(':').map(Number);
      const eventMinutes = hours * 60 + minutes;
      const diff = Math.abs(eventMinutes - currentMinutes);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestIndex = index;
      }
    });
    return closestIndex;
  }, []);

  // גלילה אקטיבית לאינדקס מסוים עם fallback אם scrollToIndex נכשל
  const scrollToEventIndex = useCallback((index: number, animated: boolean = true) => {
    const list = dailyEventsListRef.current;
    if (!list || index < 0) return;
    try {
      list.scrollToIndex({
        index,
        animated,
        viewPosition: 0.2,
      });
    } catch {
      // ה-onScrollToIndexFailed יתפוס – בנוסף ננסה fallback ידני
      const estimatedItemHeight = 100;
      list.scrollToOffset({
        offset: Math.max(0, index * estimatedItemHeight - 80),
        animated,
      });
    }
  }, []);

  // כפתור "כעת" – גלילה ידנית לאירוע הקרוב לשעה הנוכחית
  const scrollToClosestEvent = useCallback(() => {
    if (dailyEvents.length === 0) return;
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    if (!isToday) {
      setSelectedDate(new Date());
      return;
    }
    const closestIndex = findClosestEventIndex(dailyEvents);
    if (closestIndex >= 0) {
      void HapticFeedback.selection();
      scrollToEventIndex(closestIndex, true);
    }
  }, [dailyEvents, selectedDate, findClosestEventIndex, scrollToEventIndex]);

  // גלילה אוטומטית לאירוע הקרוב ביותר ברגע שהנתונים נטענים והתאריך הוא היום
  const autoScrolledForKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (dailyEvents.length === 0) return;
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    if (!isToday) return;

    const todayKey = selectedDate.toDateString();
    if (autoScrolledForKeyRef.current === todayKey) return;
    autoScrolledForKeyRef.current = todayKey;

    const closestIndex = findClosestEventIndex(dailyEvents);
    if (closestIndex < 0) return;

    // המתנה לרינדור הראשוני של ה-FlatList לפני קריאה ל-scrollToIndex
    const t1 = setTimeout(() => scrollToEventIndex(closestIndex, false), 250);
    const t2 = setTimeout(() => scrollToEventIndex(closestIndex, true), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading, dailyEvents, selectedDate, findClosestEventIndex, scrollToEventIndex]);

  // טעינת אירועים מ-Supabase Database – קודם טווח קצר (היום והלאה), אחר כך עבר
  const loadFromDatabase = async (): Promise<EconEvent[]> => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 3);
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 3);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // שליפה 1: אירועים מהיום והלאה (טווח קצר) – עד 600 רשומות
      const { data: futureData, error: futureError } = await supabase
        .from('economic_events')
        .select('*')
        .gte('date', todayStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true })
        .limit(600);
      
      if (futureError) {
      }
      
      // שליפה 2: אירועים לפני היום (עבר) – עד 600 רשומות
      const { data: pastData, error: pastError } = await supabase
        .from('economic_events')
        .select('*')
        .gte('date', startDateStr)
        .lt('date', todayStr)
        .order('date', { ascending: false })
        .limit(600);
      
      if (pastError) {
      }
      
      const future = futureData || [];
      const past = (pastData || []).reverse();
      const byId = new Map<string, (typeof future)[0]>();
      [...past, ...future].forEach(e => byId.set(e.id, e));
      const data = Array.from(byId.values()).sort(
        (a, b) => (a.date as string).localeCompare(b.date as string)
      );
      
      if (data.length === 0) {
        return [];
      }
      
      // המרה לפורמט של האפליקציה
      return data.map(event => {
        const convertedEvent = {
          id: event.id,
          title: event.title,
          country: event.country,
          currency: event.currency || '',
          importance: event.importance as 'high' | 'medium' | 'low',
          date: typeof event.date === 'string' ? event.date : new Date(event.date).toISOString().split('T')[0],
          time: event.time || '',
          actual: event.actual || '',
          forecast: event.forecast || '',
          previous: event.previous || '',
          description: event.description || '',
          category: event.category || '',
          impact: event.impact || '',
          source: event.source || 'Database',
          createdAt: event.created_at
        };
        
        // בדיקה: אם יש actual אבל זה אירוע עתידי
        const eventDateTime = new Date(`${convertedEvent.date}T${convertedEvent.time}`);
        const now = new Date();
        if (convertedEvent.actual && eventDateTime > now) {
        }
        
        return convertedEvent;
      });
    } catch (error) {
      return [];
    }
  };

  // טעינת אירועים כלכליים מ-Database בלבד
  const loadEconomicEvents = useCallback(async () => {
    try {
      // טעינה מ-Supabase Database
      const loadedEvents = await loadFromDatabase();
      
      if (loadedEvents.length === 0) {
      } else {
        const datesWithEvents = [...new Set(loadedEvents.map(e => e.date))].sort();
        const todayStr = new Date().toISOString().split('T')[0];
        const hasEventsForToday = loadedEvents.some(e => e.date === todayStr);
        if (datesWithEvents.length > 0 && !hasEventsForToday) {
          setSelectedDate(new Date(datesWithEvents[0] + 'T12:00:00'));
        }
      }
      
      setEvents(loadedEvents);
      queryClient.setQueryData(appQueryKeys.economicEvents, loadedEvents);
      filterEvents(loadedEvents, selectedImportance);
    } catch (error) {
      legacyAlert('שגיאה', 'לא ניתן לטעון את האירועים הכלכליים');
      setEvents([]);
      setFilteredEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTimeframe, selectedImportance]);

  // פונקציית סינון
  const filterEvents = useCallback((allEvents: EconEvent[], importance: 'all' | 'high' | 'medium' | 'low') => {
    let filtered = allEvents;
    
    // סינון לפי חשיבות
    if (importance !== 'all') {
      filtered = allEvents.filter(event => event.importance === importance);
    }
    
    // מיון לפי תאריך ושעה
    filtered.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
    
    setFilteredEvents(filtered);
  }, []);

  // עדכון סינון כשמשנים פילטרים
  useEffect(() => {
    filterEvents(events, selectedImportance);
  }, [events, selectedImportance, filterEvents]);

  // טעינה ראשונית
  useEffect(() => {
    loadEconomicEvents();
  }, [loadEconomicEvents]);

  // Realtime subscription - עדכונים אוטומטיים מ-Supabase
  useEffect(() => {
    const subscription = supabase
      .channel('economic_events_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'economic_events' },
        (payload) => {
          // רענן את הנתונים
          loadEconomicEvents();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadEconomicEvents]);

  // רענון
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEconomicEvents();
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [loadEconomicEvents]);

  // בוטל: טעינת נתונים היסטוריים ידנית – היסטוריה נטענת בדיפולט דרך ה-cache

  // בחירת אירוע
  const handleEventPress = useCallback((event: EconomicEvent) => {
    // קבלת הסבר מקצועי למדד
    const translatedTitle = translateEconomicEventNameSmart(event.title);
    const explanation = getIndicatorExplanation(event.title, event.description, event.category);
    
    // הצגת נתונים אם יש
    let message = '';
    
    if (event.forecast || event.actual || event.previous) {
      message += 'נתונים:\n';
      if (event.forecast) message += `תחזית: ${formatEconomicDisplayValue(event.forecast)}\n`;
      if (event.actual) message += `תוצאה: ${formatEconomicDisplayValue(event.actual)}\n`;
      if (event.previous) message += `ערך קודם: ${formatEconomicDisplayValue(event.previous)}\n`;
      message += '\n';
    }
    
    message += explanation;
    
    legacyAlert(
      translatedTitle,
      message,
      [{ text: 'סגור', style: 'cancel' }]
    );
  }, []);

  // רינדור אירוע
  const renderDateNavigator = () => (
    <View
      style={{
        paddingHorizontal: screenPad,
        paddingTop: 10,
        paddingBottom: 20,
        marginBottom: 4,
      }}
    >
      <UICard
        variant="blur"
        glassIntensity="subtle"
        padding="none"
        style={{
          borderRadius: DesignTokens.borderRadius.full,
          overflow: 'hidden',
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            direction: 'ltr',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <DayNavBlurButton onPress={goToPreviousDay} glassIntensity="subtle">
            <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>

          <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                lineHeight: 21,
                color: DesignTokens.colors.text.primary,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {selectedDate.toLocaleDateString('he-IL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            {isSelectedToday && (
              <Text
                style={{
                  fontSize: 11,
                  color: DesignTokens.colors.primary.main,
                  fontWeight: '600',
                  marginTop: 2,
                }}
              >
                היום
              </Text>
            )}
          </View>

          <DayNavBlurButton onPress={goToNextDay} glassIntensity="subtle">
            <Ionicons name="chevron-forward" size={20} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>
      </UICard>
    </View>
  );

  const renderEvent = ({ item, index }: { item: EconomicEvent; index: number }) => (
    <View style={index === 0 ? { marginTop: 8 } : undefined}>
      <EconomicEventCard
        event={item}
        onPress={handleEventPress}
      />
    </View>
  );

  // רינדור רשימה ריקה - יום שקט
  const renderEmptyState = () => {
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    const dateStr = selectedDate.toLocaleDateString('he-IL', { 
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 }}>
        <View 
          style={{ 
            width: 120, 
            height: 120, 
            borderRadius: 60, 
            backgroundColor: `${DesignTokens.colors.primary.main}1A`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24
          }}
        >
          <Ionicons 
            name="calendar-outline" 
            size={56} 
            color={DesignTokens.colors.primary.main} 
          />
        </View>
        <Text 
          style={{ 
            fontSize: 22, 
            fontWeight: '700', 
            marginBottom: 12, 
            textAlign: 'center',
            color: DesignTokens.colors.text.primary 
          }}
        >
          {isToday ? 'יום שקט היום' : 'יום שקט'}
        </Text>
        <Text 
          style={{ 
            fontSize: 15, 
            marginBottom: 8, 
            textAlign: 'center',
            color: DesignTokens.colors.text.secondary,
            lineHeight: 20
          }}
        >
          {isToday 
            ? 'השווקים רגועים - אין פרסומים כלכליים חשובים מתוכננים להיום'
            : `לא נמצאו אירועים כלכליים ב${dateStr}`
          }
        </Text>
    </View>
  );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text 
          style={{ 
            marginTop: 20, 
            fontSize: 16,
            fontWeight: '600',
            color: DesignTokens.colors.text.secondary 
          }}
        >
          טוען יומן כלכלי...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <FlatList
          ref={dailyEventsListRef}
          data={dailyEvents}
          keyExtractor={(item, index) => `${item.id}-${item.time}-${index}`}
          renderItem={renderEvent}
          style={{ flex: 1 }}
          ListHeaderComponent={renderDateNavigator}
          contentContainerStyle={{
            paddingTop: 6,
            paddingBottom: listBottomPad,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={true}
          // אופטימיזציות ביצועים
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={10}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={DesignTokens.colors.primary.main}
            colors={[DesignTokens.colors.primary.main]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        onScrollToIndexFailed={(info) => {
          const estimatedItemHeight = info.averageItemLength || 100;
          const targetOffset = Math.max(0, info.index * estimatedItemHeight - 100);
          setTimeout(() => {
            try {
              dailyEventsListRef.current?.scrollToOffset({
                offset: targetOffset,
                animated: true,
              });
            } catch (e) {
            }
          }, 100);
        }}
        />
      </View>

      {!isSelectedToday ? (
        <View style={fabStyles.wrap} pointerEvents="box-none">
          <TouchableOpacity
            style={fabStyles.btn}
            onPress={goToToday}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="חזרה להיום"
          >
            <Ionicons name="today-outline" size={24} color={DesignTokens.colors.text.inverse} />
            <Text style={fabStyles.btnText}>חזרה להיום</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
