import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../components/ui/DesignTokens';
import EconomicCalendarService, { EconomicEvent } from '../../services/economicCalendarService';
// הימנעות מ-`import type` כדי למנוע בעיות טרנספילציה ב-Metro
type EconEvent = EconomicEvent;
import EODHDService, { SUPPORTED_ECONOMIC_INDICATORS, SUPPORTED_COUNTRIES } from '../../services/eodhdService';
import EconomicDataCacheService, { CachedEconomicEvent } from '../../services/economicDataCache';
import ScheduledUpdatesService from '../../services/scheduledUpdates';
import FinnhubService from '../../services/finnhubService';
import { supabase } from '../../lib/supabase';
import { getIndicatorExplanation, getIndicatorTitle } from '../../utils/economicIndicatorExplanations';

const EconomicEventCard: React.FC<{ event: EconEvent; onPress: (event: EconEvent) => void }> = ({ 
  event, 
  onPress 
}) => {
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return DesignTokens.colors.danger.main;
      case 'medium': return DesignTokens.colors.warning.main;
      case 'low': return DesignTokens.colors.success.main;
      default: return 'rgba(255,255,255,0.18)';
    }
  };

  const stripEmojis = (text: string) => {
    return text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const importanceColor = getImportanceColor(event.importance);
  const cleanTitle = stripEmojis(event.title || '');

  const getActualColor = (): string => {
    const actual = Number(event.actual);
    const forecast = Number(event.forecast);
    if (!isFinite(actual) || !isFinite(forecast)) {
      return DesignTokens.colors.text.primary;
    }
    // כלל פשוט: תוצאה >= תחזית → ירוק עדין, אחרת אדום עדין
    return actual >= forecast ? '#00D84A' : DesignTokens.colors.danger.main;
  };

  return (
    <Pressable
      onPress={() => onPress(event)}
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: DesignTokens.colors.background.secondary,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
      }}
    >
      {/* פס חשיבות דק מיושר לימין, עם פינות מעוגלות */}
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: importanceColor, borderTopRightRadius: 16, borderBottomRightRadius: 16 }} />

      {/* כותרת נקייה */}
      <Text 
        style={{ 
          fontSize: 16, 
          fontWeight: '700', 
          color: DesignTokens.colors.text.primary,
          textAlign: 'right',
          lineHeight: 22
        }}
        numberOfLines={2}
      >
        {cleanTitle}
      </Text>

      {/* מטא־דאטה ניטרלי: שעה בלבד + מדינה/מטבע */}
      <View style={{ flexDirection: 'row-reverse', marginTop: 12, gap: 8 }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          paddingHorizontal: 10, 
          paddingVertical: 6, 
          borderRadius: 12, 
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)'
        }}>
          <Clock size={12} color={DesignTokens.colors.text.tertiary} strokeWidth={2} style={{ marginLeft: 6 }} />
          <Text style={{ fontSize: 12, color: DesignTokens.colors.text.secondary, fontWeight: '600' }}>{event.time}</Text>
        </View>
        <View style={{ 
          paddingHorizontal: 10, 
          paddingVertical: 6, 
          borderRadius: 12, 
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)'
        }}>
          <Text style={{ fontSize: 12, color: DesignTokens.colors.text.secondary, fontWeight: '500' }}>{event.country} ({event.currency})</Text>
        </View>
      </View>

      {/* בלוק ערכים ויזואלי – קופסאות */}
      {(event.actual || event.forecast || event.previous) && (
        <View style={{ flexDirection: 'row-reverse', marginTop: 14, gap: 8 }}>
          {event.actual && (
            <View style={{ 
              flex: 1, 
              paddingVertical: 12, 
              paddingHorizontal: 10, 
              borderRadius: 12, 
              backgroundColor: 'rgba(0, 216, 74, 0.08)', 
              borderWidth: 1, 
              borderColor: 'rgba(0, 216, 74, 0.2)', 
              alignItems: 'center' 
            }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4, fontWeight: '500' }}>תוצאה</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: getActualColor() }}>{event.actual}</Text>
            </View>
          )}
          {event.forecast && (
            <View style={{ 
              flex: 1, 
              paddingVertical: 12, 
              paddingHorizontal: 10, 
              borderRadius: 12, 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderWidth: 1, 
              borderColor: 'rgba(255,255,255,0.08)', 
              alignItems: 'center' 
            }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4, fontWeight: '500' }}>תחזית</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: DesignTokens.colors.text.primary }}>{event.forecast}</Text>
            </View>
          )}
          {event.previous && (
            <View style={{ 
              flex: 1, 
              paddingVertical: 12, 
              paddingHorizontal: 10, 
              borderRadius: 12, 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderWidth: 1, 
              borderColor: 'rgba(255,255,255,0.08)', 
              alignItems: 'center' 
            }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4, fontWeight: '500' }}>קודם</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: DesignTokens.colors.text.secondary }}>{event.previous}</Text>
            </View>
          )}
        </View>
      )}
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
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EconEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImportance, setSelectedImportance] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week'>('week');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  
  // תצוגה יומית חדשה
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyEvents, setDailyEvents] = useState<EconEvent[]>([]);

  // פילטרים מתקדמים
  // פישוט: אין פילטרים מתקדמים, אין טעינת היסטוריה ידנית

  // פונקציות ניווט יומי
  const goToPreviousDay = () => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(selectedDate.getDate() - 1);
    setSelectedDate(previousDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // בדיקה אם אירוע הוא חשוב
  const isCriticalEvent = (event: EconEvent): boolean => {
    const titleLower = event.title.toLowerCase();
    const descLower = (event.description || '').toLowerCase();
    const categoryLower = (event.category || '').toLowerCase();
    
    return CRITICAL_EVENTS.some(keyword => 
      titleLower.includes(keyword.toLowerCase()) ||
      descLower.includes(keyword.toLowerCase()) ||
      categoryLower.includes(keyword.toLowerCase())
    );
  };

  // פילטור אירועים לפי יום נבחר עם תיקון שעה
  const filterEventsByDate = useCallback(() => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
    console.log(`🔍 DEBUG: Filtering for date: ${selectedDateStr}`);
    console.log(`🔍 DEBUG: Selected date object:`, selectedDate);
    console.log(`🔍 DEBUG: Total events available:`, events.length);
    
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
          
          console.log(`🕐 Early event ${event.title} at ${eventTime} - should be on ${previousDayStr}, not ${selectedDateStr}`);
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
          console.log(`🕐 Late event ${event.title} at ${eventTime} - should be on ${selectedDateStr}, not ${nextDayStr}`);
          return true; // להציג אותו ביום הנוכחי
        }
      }
      
      return false;
    });
    
    console.log(`🔍 DEBUG: Events found for ${selectedDateStr} (with time correction):`, eventsForDay.length);
    console.log(`🔍 DEBUG: Sample events:`, eventsForDay.slice(0, 3).map(e => ({ title: e.title, date: e.date, time: e.time, actual: e.actual })));
    
    // סינון אירועים חשובים אם הפילטר פעיל
    if (showCriticalOnly) {
      eventsForDay = eventsForDay.filter(isCriticalEvent);
      console.log(`⭐ Filtering critical events for ${selectedDateStr}: found ${eventsForDay.length} critical events`);
    } else {
      console.log(`📅 Filtering events for ${selectedDateStr}: found ${eventsForDay.length} events`);
    }
    
    setDailyEvents(eventsForDay);
  }, [events, selectedDate, showCriticalOnly]);

  // עדכון אירועים יומיים כשמשתנה התאריך או האירועים
  useEffect(() => {
    filterEventsByDate();
  }, [filterEventsByDate]);

  // טעינת אירועים מ-Supabase Database
  const loadFromDatabase = async (): Promise<EconEvent[]> => {
    try {
      console.log('💾 Loading from Supabase Database...');
      
      // קבלת טווח תאריכים - 3 חודשים אחורה ו-3 חודשים קדימה מהיום (לא מהתאריך הנבחר)
      const today = new Date(); // תמיד התאריך הנוכחי
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 3);
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 3);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`📅 Fetching events from ${startDateStr} to ${endDateStr}`);
      
      const { data, error } = await supabase
        .from('economic_events')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true })
        .limit(1000);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log('⚠️ No data in database');
        return [];
      }
      
      console.log(`✅ Loaded ${data.length} events from database`);
      console.log(`🔍 DEBUG: Sample data from DB:`, data.slice(0, 3).map(e => ({ title: e.title, date: e.date, actual: e.actual })));
      
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
          console.warn(`⚠️ WARNING: Event ${convertedEvent.title} on ${convertedEvent.date} has actual value but is in the future!`);
        }
        
        return convertedEvent;
      });
    } catch (error) {
      console.error('❌ Error loading from database:', error);
      return [];
    }
  };

  // טעינת אירועים כלכליים מ-Database בלבד
  const loadEconomicEvents = useCallback(async () => {
    try {
      console.log('📅 EconomicCalendarTab: Loading economic events from Database');
      
      // טעינה מ-Supabase Database
      const loadedEvents = await loadFromDatabase();
      
      if (loadedEvents.length === 0) {
        Alert.alert('אין נתונים', 'הטבלה ריקה. הרץ את daily-economic-sync להביא נתונים.');
      }
      
      console.log('✅ EconomicCalendarTab: Loaded', loadedEvents.length, 'events');
      setEvents(loadedEvents);
      filterEvents(loadedEvents, selectedImportance);
    } catch (error) {
      console.error('❌ EconomicCalendarTab: Error loading events:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את האירועים הכלכליים');
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
    console.log('🔄 Subscribing to economic_events realtime updates...');
    
    const subscription = supabase
      .channel('economic_events_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'economic_events' },
        (payload) => {
          console.log('📡 Economic event realtime update:', payload);
          // רענן את הנתונים
          loadEconomicEvents();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Unsubscribing from economic_events realtime');
      subscription.unsubscribe();
    };
  }, [loadEconomicEvents]);

  // רענון
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadEconomicEvents();
  }, [loadEconomicEvents]);

  // בוטל: טעינת נתונים היסטוריים ידנית – היסטוריה נטענת בדיפולט דרך ה-cache

  // בחירת אירוע
  const handleEventPress = useCallback((event: EconomicEvent) => {
    console.log('📅 EconomicCalendarTab: Event pressed:', event.title);
    
    // קבלת הסבר מקצועי למדד
    const explanation = getIndicatorExplanation(event.title, event.description, event.category);
    
    // הצגת נתונים אם יש
    let message = '';
    
    if (event.forecast || event.actual || event.previous) {
      message += 'נתונים:\n';
      if (event.forecast) message += `תחזית: ${event.forecast}\n`;
      if (event.actual) message += `תוצאה: ${event.actual}\n`;
      if (event.previous) message += `ערך קודם: ${event.previous}\n`;
      message += '\n';
    }
    
    message += explanation;
    
    Alert.alert(
      event.title,
      message,
      [{ text: 'סגור', style: 'cancel' }]
    );
  }, []);

  // רינדור אירוע
  const renderEvent = ({ item }: { item: EconomicEvent }) => (
    <EconomicEventCard
      event={item}
      onPress={handleEventPress}
    />
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
            backgroundColor: 'rgba(0, 216, 74, 0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24
          }}
        >
          <Ionicons 
            name="calendar-outline" 
            size={56} 
            color="#00D84A" 
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
      <TouchableOpacity
        style={{
          marginTop: 24,
          paddingHorizontal: 28,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: 'rgba(0, 216, 74, 0.15)',
          borderWidth: 1,
          borderColor: 'rgba(0, 216, 74, 0.3)'
        }}
        onPress={loadEconomicEvents}
      >
        <Text style={{
          fontSize: 15,
          fontWeight: '700',
          color: '#00D84A'
        }}>
          רענן נתונים
        </Text>
      </TouchableOpacity>
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
      {/* ניווט יומי */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)'
        }}>
          {/* שורה עליונה - ניווט תאריכים */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: 14
          }}>
            {/* חץ שמאל - יום קודם */}
            <TouchableOpacity
              onPress={goToPreviousDay}
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <ChevronLeft size={20} color={DesignTokens.colors.text.primary} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* תאריך נוכחי */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{
                fontSize: 17,
                fontWeight: '700',
                color: DesignTokens.colors.text.primary,
                textAlign: 'center'
              }}>
                {selectedDate.toLocaleDateString('he-IL', { 
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
              {selectedDate.toDateString() === new Date().toDateString() && (
                <Text style={{
                  fontSize: 12,
                  color: '#00D84A',
                  fontWeight: '600',
                  marginTop: 3
                }}>
                  היום
                </Text>
              )}
            </View>

            {/* חץ ימין - יום הבא */}
            <TouchableOpacity
              onPress={goToNextDay}
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <ChevronRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* שורה תחתונה - כפתורים נוספים */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 10
          }}>
            {/* כפתור אירועים חשובים */}
            <TouchableOpacity
              onPress={() => setShowCriticalOnly(!showCriticalOnly)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 12,
                backgroundColor: showCriticalOnly ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: showCriticalOnly ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <Ionicons 
                name={showCriticalOnly ? "star" : "star-outline"} 
                size={15} 
                color={showCriticalOnly ? '#F59E0B' : DesignTokens.colors.text.secondary} 
                style={{ marginLeft: 5 }}
              />
              <Text style={{
                fontSize: 12,
                color: showCriticalOnly ? '#F59E0B' : DesignTokens.colors.text.secondary,
                fontWeight: '600'
              }}>
                {showCriticalOnly ? 'כל האירועים' : 'רק חשובים'}
              </Text>
            </TouchableOpacity>

            {/* כפתור חזרה להיום - מוצג רק כשלא בהיום */}
            {selectedDate.toDateString() !== new Date().toDateString() && (
              <TouchableOpacity
                onPress={goToToday}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 12,
                  backgroundColor: 'rgba(0, 216, 74, 0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 216, 74, 0.3)'
                }}
              >
                <Ionicons 
                  name="today" 
                  size={15} 
                  color="#00D84A" 
                  style={{ marginLeft: 5 }}
                />
                <Text style={{
                  fontSize: 12,
                  color: '#00D84A',
                  fontWeight: '600'
                }}>
                  היום
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </View>

      {/* כפתור טעינת נתונים היסטוריים – בוטל לפי דרישה */}

      {/* אירועים יומיים */}
      <FlatList
        data={dailyEvents}
        keyExtractor={(item, index) => `${item.id}-${item.time}-${index}`}
        renderItem={renderEvent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={DesignTokens.colors.primary.main}
            colors={[DesignTokens.colors.primary.main]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
      />
    </View>
  );
}
