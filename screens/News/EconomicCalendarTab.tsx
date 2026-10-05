import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { EconomicCalendarListSkeleton } from '../../components/ui/SkeletonLoader';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { EconomicEvent } from '../../services/economicCalendarService';
type EconEvent = EconomicEvent;
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { getIndicatorExplanation } from '../../utils/economicIndicatorExplanations';
import { translateEconomicEventNameSmart } from '../../utils/economicEventTranslations';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import { formatEconomicDisplayValue, parseEconomicNumber } from '../../utils/economicNumberFormat';
import {
  APP_TYPE,
  appPhysicalRightText,
} from '../../components/ui/appType';
import {
  isTaxonomyFlaggedEvent,
  matchEconomicFlagTier,
  resolveEconomicEventImportance,
  type EconomicImportance,
} from '../../utils/economicEventImportance';

/** חלון קצר אחרי זמן האירוע — מציגים "עכשיו" לפני מעבר לקאונטדאון הבא. */
const COUNTDOWN_GRACE_MS = 45_000;

function parseEventTimeParts(time: string): { h: number; m: number; s: number } {
  const parts = (time || '00:00').split(':').map((p) => Number(p) || 0);
  return { h: parts[0] || 0, m: parts[1] || 0, s: parts[2] || 0 };
}

function getEventDateOnDay(day: Date, time: string): Date {
  const { h, m, s } = parseEventTimeParts(time);
  const d = new Date(day);
  d.setHours(h, m, s, 0);
  return d;
}

/** פורמט קומפקטי לבייג': MM:SS מתחת לשעה, H:MM:SS מעל. */
function formatEventCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return 'עכשיו';
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * האירוע העתידי הקרוב ביותר להיום — אותה כוונה כמו גלילה ל־nearest,
 * עם דיוק שניות + חלון "עכשיו" קצר אחרי הזמן.
 */
function findCountdownTarget(
  list: EconEvent[],
  day: Date,
  now: Date,
): { index: number; label: string } | null {
  if (list.length === 0) return null;
  if (day.toDateString() !== now.toDateString()) return null;

  for (let i = 0; i < list.length; i++) {
    const eventAt = getEventDateOnDay(day, list[i].time);
    const remaining = eventAt.getTime() - now.getTime();
    if (remaining > 0) {
      return { index: i, label: formatEventCountdown(remaining) };
    }
    if (remaining > -COUNTDOWN_GRACE_MS) {
      return { index: i, label: 'עכשיו' };
    }
  }
  return null;
}

function displayImportance(event: EconEvent): EconomicImportance {
  const fallback = (event.importance as EconomicImportance) || 'low';
  return resolveEconomicEventImportance(
    event.title || '',
    fallback,
    event.description || '',
    event.category || '',
  );
}

/** פס צד: רק טקסונומיית אדום/כתום — לא importance גולמי של הספק. */
function stripFlagImportance(event: EconEvent): EconomicImportance {
  // תיאורי Benzinga ארוכים יוצרים התאמות שווא; משתמשים בתיאור רק אם קצר (סוג EODHD)
  const shortDesc =
    (event.description || '').length > 0 && (event.description || '').length < 80
      ? event.description
      : undefined;
  const tier = matchEconomicFlagTier(event.title, event.category, shortDesc);
  if (tier === 'red') return 'high';
  if (tier === 'orange') return 'medium';
  return 'low';
}

const EconomicEventCard: React.FC<{
  event: EconEvent;
  onPress: (event: EconEvent) => void;
  /** קאונטדאון חי לאירוע הקרוב ביותר בלבד — מחליף את בייג' השעה. */
  countdownLabel?: string;
}> = ({
  event,
  onPress,
  countdownLabel,
}) => {
  const DesignTokens = useDesignTokens();
  
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return DesignTokens.colors.danger.main; // 🔴 אדום
      case 'medium':
        return DesignTokens.colors.warning.main; // 🟠 כתום
      case 'low':
      default:
        return DesignTokens.colors.border.primary; // נייטרלי — לא דגל
    }
  };

  const stripEmojis = (text: string) => {
    return text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const importanceColor = getImportanceColor(stripFlagImportance(event));
  // תרגום שם האירוע לעברית
  const translatedTitle = translateEconomicEventNameSmart(event.title || '');
  const cleanTitle = stripEmojis(translatedTitle);
  const importanceLevel = stripFlagImportance(event);
  // דגל צבעוני אחרי שם הדוח — רק לחשיבות אדומה/כתומה
  const showFlag = importanceLevel === 'high' || importanceLevel === 'medium';

  const getActualColor = (): string => {
    const actual = parseEconomicNumber(event.actual);
    const forecast = parseEconomicNumber(event.forecast);
    if (!isFinite(actual) || !isFinite(forecast)) {
      return DesignTokens.colors.text.primary;
    }
    // כלל פשוט: תוצאה >= תחזית → ירוק עדין, אחרת אדום עדין
    return actual >= forecast ? DesignTokens.colors.primary.main : DesignTokens.colors.danger.main;
  };

  const screenPad = APP_LAYOUT.screenPaddingHorizontal;
  const cardRadius = UI_CARD_RADIUS;
  const cardPad = APP_LAYOUT.cardPadding;
  // פס חשיבות עבה יותר — אדום/כתום ברורים במבט ראשון
  const accentW = 4;
  return (
    <Pressable onPress={() => onPress(event)} style={{ marginHorizontal: screenPad, marginBottom: APP_LAYOUT.cardStackGap }}>
      <UICard
        variant="soft"
        padding="none"
        disableBlur
        style={{
          overflow: 'hidden',
          borderRadius: cardRadius,
        }}
      >
        {/*
          פס חשיבות כ־flex sibling (לא absolute) — כמו דיווחי רווח:
          לא חופף טקסט, פינות מעוגלות נחתכות ע״י overflow של הכרטיס.
          LTR Yoga: תוכן ואז פס → פס פיזי מימין.
        */}
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <View
            style={{
              flex: 1,
              alignItems: 'flex-end',
              paddingVertical: cardPad,
              paddingLeft: cardPad,
              paddingRight: cardPad,
            }}
          >
            {/* שורה עליונה - זמן וכותרת (RTL: זמן משמאל, כותרת מימין) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Text
                style={{
                  ...APP_TYPE.cardTitle,
                  color: DesignTokens.colors.text.primary,
                  ...appPhysicalRightText,
                  flex: 1,
                  marginRight: APP_LAYOUT.cardTitleToBodyGap,
                }}
                numberOfLines={2}
              >
                {cleanTitle}
                {showFlag ? (
                  <Text>
                    {'  '}
                    <Ionicons name="flag-outline" size={15} color={importanceColor} />
                  </Text>
                ) : null}
              </Text>
              <View
                style={{
                  backgroundColor: DesignTokens.colors.background.primary,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: DesignTokens.borderRadius.full,
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    ...APP_TYPE.cardMetricLabel,
                    color: DesignTokens.colors.text.primary,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {countdownLabel ?? event.time}
                </Text>
              </View>
            </View>

            {/* בלוק ערכים ויזואלי – ללא מסגרות, עם פסי הפרדה */}
            {(event.actual || event.forecast || event.previous) && (
              <View style={{ marginTop: APP_LAYOUT.cardTitleToBodyGap, width: '100%' }}>
                <View
                  style={{
                    height: 1,
                    backgroundColor: DesignTokens.colors.border.divider,
                    marginBottom: APP_LAYOUT.cardTitleToBodyGap,
                  }}
                />

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%' }}>
                  {event.actual && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text
                        style={{
                          ...APP_TYPE.cardMetricLabel,
                          color: DesignTokens.colors.text.secondary,
                          marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
                          textAlign: 'center',
                        }}
                      >
                        תוצאה
                      </Text>
                      <Text
                        style={{
                          ...APP_TYPE.cardBody,
                          fontWeight: APP_TYPE.cardTitle.fontWeight,
                          color: getActualColor(),
                          textAlign: 'center',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {formatEconomicDisplayValue(event.actual, event.title)}
                      </Text>
                    </View>
                  )}
                  {event.actual && (event.forecast || event.previous) && (
                    <View
                      style={{
                        width: 1,
                        height: 34,
                        backgroundColor: DesignTokens.colors.border.divider,
                        marginHorizontal: 8,
                        alignSelf: 'flex-start',
                      }}
                    />
                  )}
                  {event.forecast && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text
                        style={{
                          ...APP_TYPE.cardMetricLabel,
                          color: DesignTokens.colors.text.secondary,
                          marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
                          textAlign: 'center',
                        }}
                      >
                        תחזית
                      </Text>
                      <Text
                        style={{
                          ...APP_TYPE.cardBody,
                          fontWeight: APP_TYPE.cardTitle.fontWeight,
                          color: DesignTokens.colors.text.primary,
                          textAlign: 'center',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {formatEconomicDisplayValue(event.forecast, event.title)}
                      </Text>
                    </View>
                  )}
                  {event.forecast && event.previous && (
                    <View
                      style={{
                        width: 1,
                        height: 34,
                        backgroundColor: DesignTokens.colors.border.divider,
                        marginHorizontal: 8,
                        alignSelf: 'flex-start',
                      }}
                    />
                  )}
                  {event.previous && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text
                        style={{
                          ...APP_TYPE.cardMetricLabel,
                          color: DesignTokens.colors.text.secondary,
                          marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
                          textAlign: 'center',
                        }}
                      >
                        קודם
                      </Text>
                      <Text
                        style={{
                          ...APP_TYPE.cardBody,
                          fontWeight: APP_TYPE.cardTitle.fontWeight,
                          color: DesignTokens.colors.text.secondary,
                          textAlign: 'center',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {formatEconomicDisplayValue(event.previous, event.title)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          <View
            style={{
              width: accentW,
              alignSelf: 'stretch',
              backgroundColor: importanceColor,
            }}
          />
        </View>
      </UICard>
    </Pressable>
  );
};

export default function EconomicCalendarTab() {
  const DesignTokens = useDesignTokens();
  const isFocused = useIsFocused();
  const screenPad = APP_LAYOUT.screenPaddingHorizontal;
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
  /** טיק לשנייה — מפעיל קאונטדאון חי לאירוע הקרוב בהיום. */
  const [nowMs, setNowMs] = useState(() => Date.now());
  
  // Ref לגלילה לאירוע הקרוב ביותר
  const dailyEventsListRef = useRef<FlatList>(null);
  // מונע גלילה כפולה לאותו תוכן; מתאפס כשעוזבים את היום
  const autoScrolledForKeyRef = useRef<string | null>(null);

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
    autoScrolledForKeyRef.current = null;
    setSelectedDate(new Date());
  }, []);

  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();

  // קאונטדאון חי — טיק כל שנייה רק כשמסתכלים על היום והטאב בפוקוס
  useEffect(() => {
    if (!isFocused || !isSelectedToday) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isFocused, isSelectedToday]);

  const countdownTarget = useMemo(
    () => findCountdownTarget(dailyEvents, selectedDate, new Date(nowMs)),
    [dailyEvents, selectedDate, nowMs],
  );

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
      }),
    [fabBottomInset],
  );

  // אדום/כתום לפי טקסונומיה, או high/medium שכבר ב-DB
  const isCriticalEvent = useCallback((event: EconEvent): boolean => {
    const importance = displayImportance(event);
    if (importance === 'high' || importance === 'medium') return true;
    return isTaxonomyFlaggedEvent(event.title, event.description, event.category);
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

  // אינדקס האירוע העתידי הקרוב ביותר (כמו TradingView). אם כולם עברו — האחרון ברשימה.
  const findNearestUpcomingEventIndex = useCallback((list: EconEvent[]): number => {
    if (list.length === 0) return -1;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < list.length; i++) {
      const [hours, minutes] = (list[i].time || '00:00').split(':').map(Number);
      const eventMinutes = (hours || 0) * 60 + (minutes || 0);
      if (eventMinutes >= currentMinutes) return i;
    }
    return list.length - 1;
  }, []);

  // גלילה לאינדקס — ליד החלק העליון של הרשימה (TradingView-like)
  const scrollToEventIndex = useCallback((index: number, animated: boolean = true) => {
    const list = dailyEventsListRef.current;
    if (!list || index < 0) return;
    try {
      list.scrollToIndex({
        index,
        animated,
        viewPosition: 0.15,
      });
    } catch {
      const estimatedItemHeight = 112;
      list.scrollToOffset({
        offset: Math.max(0, index * estimatedItemHeight),
        animated,
      });
    }
  }, []);

  // גלילה אוטומטית לאירוע הקרוב כשהרשימה נטענת / חוזרים להיום
  useEffect(() => {
    if (loading) return;

    const isToday = selectedDate.toDateString() === new Date().toDateString();
    if (!isToday) {
      autoScrolledForKeyRef.current = null;
      return;
    }
    if (dailyEvents.length === 0) return;

    const contentKey = dailyEvents.map((e) => `${e.id}:${e.time}`).join('|');
    if (autoScrolledForKeyRef.current === contentKey) return;
    autoScrolledForKeyRef.current = contentKey;

    const targetIndex = findNearestUpcomingEventIndex(dailyEvents);
    if (targetIndex < 0) return;

    // המתנה קצרה לרינדור ה-FlatList לפני scrollToIndex
    const t1 = setTimeout(() => scrollToEventIndex(targetIndex, false), 200);
    const t2 = setTimeout(() => scrollToEventIndex(targetIndex, false), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading, dailyEvents, selectedDate, findNearestUpcomingEventIndex, scrollToEventIndex]);

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
      
      // המרה לפורמט של האפליקציה + טקסונומיית אדום/כתום לתצוגה
      return data.map(event => {
        const dbImportance = (event.importance as EconomicImportance) || 'low';
        const importance = resolveEconomicEventImportance(
          event.title || '',
          dbImportance,
          event.description || '',
          event.category || '',
        );
        const convertedEvent = {
          id: event.id,
          title: event.title,
          country: event.country,
          currency: event.currency || '',
          importance,
          date: typeof event.date === 'string' ? event.date : new Date(event.date).toISOString().split('T')[0],
          time: event.time || '',
          actual: event.actual || '',
          forecast: event.forecast || '',
          previous: event.previous || '',
          description: event.description || '',
          category: event.category || '',
          impact: event.impact || importance,
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
  const loadEconomicEventsRef = useRef(loadEconomicEvents);
  loadEconomicEventsRef.current = loadEconomicEvents;

  useEffect(() => {
    // שם ייחודי לכל mount: supabase-js מחזיר ערוץ קיים לפי שם, ו-on() אחרי subscribe() זורק
    const channel = supabase
      .channel(`economic_events_${Date.now()}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'economic_events' },
        () => {
          void loadEconomicEventsRef.current();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

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
      if (event.forecast) message += `תחזית: ${formatEconomicDisplayValue(event.forecast, event.title)}\n`;
      if (event.actual) message += `תוצאה: ${formatEconomicDisplayValue(event.actual, event.title)}\n`;
      if (event.previous) message += `ערך קודם: ${formatEconomicDisplayValue(event.previous, event.title)}\n`;
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
        paddingTop: APP_LAYOUT.stackGapSmall,
        paddingBottom: APP_LAYOUT.componentGap,
      }}
    >
      <UICard
        variant="soft"
        padding="none"
        style={{
          borderRadius: DesignTokens.borderRadius.full,
          overflow: 'hidden',
          paddingVertical: APP_LAYOUT.stackGapSmall,
          paddingHorizontal: APP_LAYOUT.stackGapSmall,
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
          <DayNavBlurButton onPress={goToPreviousDay} style={{ backgroundColor: DesignTokens.colors.background.primary }}>
            <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>

          <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
            <Text
              style={{
                ...APP_TYPE.cardTitle,
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
                  ...APP_TYPE.caption,
                  color: DesignTokens.colors.text.secondary,
                  marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
                }}
              >
                היום
              </Text>
            )}
          </View>

          <DayNavBlurButton onPress={goToNextDay} style={{ backgroundColor: DesignTokens.colors.background.primary }}>
            <Ionicons name="chevron-forward" size={20} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>
      </UICard>
    </View>
  );

  const renderEvent = ({ item, index }: { item: EconomicEvent; index: number }) => (
    <View>
      <EconomicEventCard
        event={item}
        onPress={handleEventPress}
        countdownLabel={
          countdownTarget?.index === index ? countdownTarget.label : undefined
        }
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
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: DesignTokens.colors.background.cardSolid,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: APP_LAYOUT.componentGap
          }}
        >
          <Ionicons 
            name="calendar-outline"
            size={32}
            color={DesignTokens.colors.text.secondary}
          />
        </View>
        <Text 
          style={{ 
            ...APP_TYPE.sectionTitle,
            marginBottom: APP_LAYOUT.cardTitleToBodyGap, 
            textAlign: 'center',
            color: DesignTokens.colors.text.primary 
          }}
        >
          {isToday ? 'יום שקט היום' : 'יום שקט'}
        </Text>
        <Text 
          style={{ 
            ...APP_TYPE.body,
            marginBottom: APP_LAYOUT.groupLabelToContent, 
            textAlign: 'center',
            color: DesignTokens.colors.text.secondary,
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

  if (loading && events.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        {renderDateNavigator()}
        <View style={{ flex: 1, paddingTop: 6 }}>
          <EconomicCalendarListSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <FlatList
          ref={dailyEventsListRef}
          data={dailyEvents}
          extraData={countdownTarget}
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
          const estimatedItemHeight = info.averageItemLength || 112;
          const targetOffset = Math.max(0, info.index * estimatedItemHeight);
          dailyEventsListRef.current?.scrollToOffset({
            offset: targetOffset,
            animated: false,
          });
          setTimeout(() => {
            try {
              dailyEventsListRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
                viewPosition: 0.15,
              });
            } catch {
              // offset כבר הוחל
            }
          }, 120);
        }}
        />
      </View>

      {!isSelectedToday ? (
        <View style={fabStyles.wrap} pointerEvents="box-none">
          <UIButton
            title="חזרה להיום"
            variant="primary"
            icon="today-outline"
            iconPosition="right"
            onPress={goToToday}
            haptic={false}
          />
        </View>
      ) : null}
    </View>
  );
}
