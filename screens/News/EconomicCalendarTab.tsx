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
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: DesignTokens.colors.background.secondary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
      }}
    >
      {/* פס חשיבות דק מיושר לימין, עם פינות מעוגלות */}
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: importanceColor, borderTopRightRadius: 18, borderBottomRightRadius: 18 }} />

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
      <View style={{ flexDirection: 'row-reverse', marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 8 }}>
          <Clock size={12} color={DesignTokens.colors.text.secondary} strokeWidth={2} style={{ marginLeft: 6 }} />
          <Text style={{ fontSize: 12, color: DesignTokens.colors.text.secondary, fontWeight: '600' }}>{event.time}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Text style={{ fontSize: 12, color: DesignTokens.colors.text.secondary }}>{event.country} ({event.currency})</Text>
        </View>
      </View>

      {/* בלוק ערכים ויזואלי – קופסאות */}
      {(event.actual || event.forecast || event.previous) && (
        <View style={{ flexDirection: 'row-reverse', marginTop: 12 }}>
          {event.actual && (
            <View style={{ flex: 1, marginLeft: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4 }}>תוצאה</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: getActualColor() }}>{event.actual}</Text>
            </View>
          )}
          {event.forecast && (
            <View style={{ flex: 1, marginLeft: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4 }}>תחזית</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: DesignTokens.colors.text.secondary }}>{event.forecast}</Text>
            </View>
          )}
          {event.previous && (
            <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4 }}>קודם</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: DesignTokens.colors.text.secondary }}>{event.previous}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
};

export default function EconomicCalendarTab() {
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EconEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImportance, setSelectedImportance] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week'>('week');
  
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

  // פילטור אירועים לפי יום נבחר
  const filterEventsByDate = useCallback(() => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const eventsForDay = events.filter(event => event.date === selectedDateStr);
    
    console.log(`📅 Filtering events for ${selectedDateStr}: found ${eventsForDay.length} events`);
    setDailyEvents(eventsForDay);
  }, [events, selectedDate]);

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
        .order('date', { ascending: false })
        .limit(500);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log('⚠️ No data in database');
        return [];
      }
      
      console.log(`✅ Loaded ${data.length} events from database`);
      
      // המרה לפורמט של האפליקציה
      return data.map(event => ({
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
      }));
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
    Alert.alert(
      event.title,
      event.description || 'אירוע כלכלי חשוב',
      [
        { text: 'סגור', style: 'cancel' },
        { text: 'פרטים נוספים', onPress: () => console.log('פתיחת פרטים') }
      ]
    );
  }, []);

  // רינדור אירוע
  const renderEvent = ({ item }: { item: EconomicEvent }) => (
    <EconomicEventCard
      event={item}
      onPress={handleEventPress}
    />
  );

  // רינדור רשימה ריקה
  const renderEmptyState = () => {
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    const dateStr = selectedDate.toLocaleDateString('he-IL', { 
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Ionicons 
          name="calendar-outline" 
          size={64} 
          color={DesignTokens.colors.text.tertiary} 
        />
        <Text 
          style={{ 
            fontSize: 20, 
            fontWeight: '600', 
            marginTop: 16, 
            textAlign: 'center',
            color: DesignTokens.colors.text.primary 
          }}
        >
          {isToday ? 'אין אירועים כלכליים היום' : `אין אירועים ב${dateStr}`}
        </Text>
        <Text 
          style={{ 
            fontSize: 14, 
            marginTop: 8, 
            textAlign: 'center',
            color: DesignTokens.colors.text.secondary,
            lineHeight: 20
          }}
        >
          {isToday 
            ? 'השווקים רגועים היום - אין פרסומים כלכליים מתוכננים'
            : `לא נמצאו אירועים כלכליים בתאריך זה`
          }{'\n'}מקור: FRED API (פדרל ריזרב) - נתונים אמיתיים
        </Text>
      <TouchableOpacity
        style={{
          marginTop: 20,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 20,
          backgroundColor: '#00D84A'
        }}
        onPress={loadEconomicEvents}
      >
        <Text style={{
          fontSize: 14,
          fontWeight: '600',
          color: '#FFFFFF'
        }}>
          רענן נתונים
        </Text>
      </TouchableOpacity>
    </View>
  );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text 
          className="mt-4 text-lg"
          style={{ color: DesignTokens.colors.text.secondary }}
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
        {/* בקרת תאריך */}
        {/* ניווט תאריכים */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: 12
        }}>
          {/* חץ שמאל - יום קודם */}
          <TouchableOpacity
            onPress={goToPreviousDay}
            style={{
              padding: 8,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            <ChevronLeft size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </TouchableOpacity>

          {/* תאריך נוכחי */}
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
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
                fontWeight: '500',
                marginTop: 2
              }}>
                היום
              </Text>
            )}
          </View>

          {/* חץ ימין - יום הבא */}
          <TouchableOpacity
            onPress={goToNextDay}
            style={{
              padding: 8,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            <ChevronRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* כפתור חזרה להיום */}
        {selectedDate.toDateString() !== new Date().toDateString() && (
          <TouchableOpacity
            onPress={goToToday}
            style={{
              alignSelf: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: '#00D84A',
              borderRadius: 16,
              marginBottom: 12
            }}
          >
            <Text style={{
              color: 'white',
              fontWeight: '600',
              fontSize: 14
            }}>
              חזור להיום
            </Text>
          </TouchableOpacity>
        )}

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
            tintColor="#00D84A"
            colors={['#00D84A']}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
