import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable, TouchableOpacity, ScrollView, Dimensions, Animated, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Clock, Sun, Moon, ChevronUp } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import EarningsService, { EarningsReport } from '../../services/earningsService';
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';

const EARNINGS_QUERY_KEY = appQueryKeys.earningsList('window');
type ReportsByDate = Record<string, EarningsReport[]>;
import BottomSheet, { useBottomSheetClose } from '../../components/ui/BottomSheet/BottomSheet';
import UICard from '../../components/ui/UICard';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { TickerLogo } from '../../components/ui/TickerLogo';
import { HapticFeedback } from '../../utils/hapticFeedback';
import EarningsWeeklyView, { WeekDay, getSymbolDisplay as getWeeklySymbolDisplay } from './EarningsWeeklyView';

export type EarningsViewMode = 'daily' | 'weekly';

type EarningsReportsTabProps = {
  /** תצוגה יומית/שבועית — נשלטת מהכותרת (ברירת מחדל: יומי) */
  viewMode?: EarningsViewMode;
  /** פתיחה מהתראת Push */
  openReportId?: string | null;
  openTicker?: string | null;
  openReportDate?: string | null;
  onOpenReportConsumed?: () => void;
};

const EarningsReportCard: React.FC<{ 
  report: EarningsReport; 
  onPress: (report: EarningsReport) => void 
}> = ({ report, onPress }) => {
  const DesignTokens = useDesignTokens();
  
  // פונקציה לקבלת צבע לפי surprise
  const getSurpriseColor = (percent: number | null | undefined): string => {
    if (percent === null || percent === undefined) return DesignTokens.colors.text.secondary;
    if (percent > 0) return DesignTokens.colors.primary.main; // ירוק
    if (percent < 0) return DesignTokens.colors.danger.main; // אדום
    return DesignTokens.colors.text.secondary; // אפור (percent === 0)
  };

  // פונקציה לעיצוב Revenue (B, M, K)
  const formatRevenue = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === 0 || value === '0') return '$0';
    
    let num: number;
    if (typeof value === 'string') {
      // הסרת B, M, K אם יש
      let cleanValue = value.trim().toUpperCase();
      if (cleanValue.endsWith('B')) {
        num = parseFloat(cleanValue.slice(0, -1)) * 1_000_000_000;
      } else if (cleanValue.endsWith('M')) {
        num = parseFloat(cleanValue.slice(0, -1)) * 1_000_000;
      } else if (cleanValue.endsWith('K')) {
        num = parseFloat(cleanValue.slice(0, -1)) * 1_000;
      } else {
        num = parseFloat(cleanValue);
      }
    } else {
      num = value;
    }
    
    if (isNaN(num) || num === 0) return '$0';
    
    if (Math.abs(num) >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (Math.abs(num) >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(num) >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    } else {
      return `$${num.toFixed(2)}`;
    }
  };

  // מנרמל "BeforeMarket" / "Before Market" / "pre-market" / "BMO" / "Before" וכד' לערך אחד
  const normalizeMarketTiming = (value: string | null | undefined): 'BeforeMarket' | 'AfterMarket' | null => {
    if (!value) return null;
    const lower = String(value).toLowerCase();
    if (lower.includes('before') || lower.includes('pre-market') || lower.includes('premarket') || lower.includes('bmo')) {
      return 'BeforeMarket';
    }
    if (lower.includes('after') || lower.includes('post-market') || lower.includes('postmarket') || lower.includes('amc')) {
      return 'AfterMarket';
    }
    return null;
  };

  // פונקציה לעיצוב זמן
  const getTimeDisplay = (beforeAfterMarket: string | null): string => {
    const n = normalizeMarketTiming(beforeAfterMarket);
    if (n === 'BeforeMarket') return 'Pre Market';
    if (n === 'AfterMarket') return 'After Market';
    return beforeAfterMarket ? beforeAfterMarket : 'טרם נקבע';
  };

  // פונקציה לקבלת אייקון וצבע לזמן
  const getTimeIcon = (beforeAfterMarket: string | null) => {
    const n = normalizeMarketTiming(beforeAfterMarket);
    if (n === 'BeforeMarket') {
      return { icon: Sun, color: '#d1a11d', text: 'Pre Market' };
    }
    if (n === 'AfterMarket') {
      return { icon: Moon, color: '#007AFF', text: 'After Market' };
    }
    return { icon: Clock, color: DesignTokens.colors.text.secondary, text: beforeAfterMarket || 'טרם נקבע' };
  };

  // פונקציה לעיצוב סימבול
  const getSymbolDisplay = (code: string): string => {
    // הסרת סיומת .US וכל סימנים מיותרים
    let cleanCode = code.replace('.US', '');
    
    // הסרת מינוס מהתחלה אם יש
    if (cleanCode.startsWith('-')) {
      cleanCode = cleanCode.substring(1);
    }
    
    // הסרת רווחים מיותרים
    cleanCode = cleanCode.trim();
    
    return cleanCode;
  };

  const screenPad = DesignTokens.layout?.screenPadding ?? 20;
  const cardRadius = DesignTokens.borderRadius['2xl'];
  const companyLabel = (report.company_name || report.asset_name || '').trim();
  // חשוב: לא `{value && <View/>}` כש-value יכול להיות 0 — ב-RN זה מרנדר "0" כטקסט חשוף.
  const hasEpsBlock =
    report.estimate != null || report.actual != null || report.eps_estimate != null;
  const hasRevenueBlock =
    report.revenue_estimate != null ||
    report.revenue_estimate_avg != null ||
    report.revenue_actual != null;
  return (
    <Pressable onPress={() => onPress(report)} style={{ marginHorizontal: screenPad, marginBottom: 12 }}>
      <UICard
        variant="blur"
        padding="lg"
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          overflow: 'hidden',
          borderRadius: cardRadius,
        }}
      >
        {/* פס צבע משמאל */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: getSurpriseColor(report.percent),
          }}
        />

        {/* תוכן משמאל */}
        <View style={{ flex: 1, alignItems: 'flex-start', marginLeft: 16 }}>
        {/* שורה עליונה - לוגו + טיקר + badge לפני/אחרי מסחר */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          {/* לוגו + טיקר + שם חברה */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 }}>
            <View style={{ marginRight: 12 }}>
              <TickerLogo symbol={getSymbolDisplay(report.code)} size={40} />
            </View>
            <View style={{ flex: 1, justifyContent: 'flex-start' }}>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '700', 
                color: DesignTokens.colors.text.primary,
                lineHeight: 20
              }}>
                {getSymbolDisplay(report.code)}
              </Text>
              {companyLabel ? (
                <Text 
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{ 
                    fontSize: 11, 
                    fontWeight: '500', 
                    color: DesignTokens.colors.text.secondary,
                    lineHeight: 14,
                    marginTop: 1
                  }}>
                  {companyLabel}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Badge לפני/אחרי מסחר (השעה המדויקת רק בפירוט) */}
          {(() => {
            const timeInfo = getTimeIcon(report.before_after_market);
            const IconComponent = timeInfo.icon;
            
            return (
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                backgroundColor: timeInfo.color === '#d1a11d' ? 'rgba(209, 161, 29, 0.15)' : 
                                timeInfo.color === '#007AFF' ? 'rgba(0, 122, 255, 0.15)' : 
                                `${DesignTokens.colors.success.main}26`,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: DesignTokens.borderRadius.full,
              }}>
                <IconComponent 
                  size={11} 
                  color={timeInfo.color || DesignTokens.colors.primary.main} 
                  strokeWidth={2} 
                  style={{ marginRight: 5 }} 
                />
                <Text style={{ 
                  fontSize: 11, 
                  color: timeInfo.color || DesignTokens.colors.primary.main,
                  fontWeight: '600'
                }}>
                  {timeInfo.text}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* בלוק ערכים - EPS מימין, Revenue משמאל, בשורה אחת */}
        {hasEpsBlock || hasRevenueBlock ? (
          <View style={{ marginTop: 12, width: '100%' }}>
            {/* פס הפרדה אופקי עליון */}
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                marginBottom: 12,
              }}
            />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              {/* Revenue - משמאל */}
              {hasRevenueBlock ? (
                <View style={{ flex: 1, alignItems: 'center', paddingRight: 8 }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 8, fontWeight: '600', textAlign: 'center' }}>
                    הכנסות (Revenue)
                  </Text>
                  {report.revenue_actual !== null && report.revenue_actual !== 0 ? (
                    (() => {
                      // חישוב surprise אם אין
                      let surprisePercent = report.revenue_surprise_percent;
                      if (surprisePercent === null && report.revenue_actual && (report.revenue_estimate || report.revenue_estimate_avg)) {
                        const estimate = typeof report.revenue_estimate === 'number' ? report.revenue_estimate :
                                       typeof report.revenue_estimate_avg === 'number' ? report.revenue_estimate_avg : null;
                        if (estimate !== null && estimate !== 0) {
                          surprisePercent = ((report.revenue_actual - estimate) / Math.abs(estimate)) * 100;
                        }
                      }
                      
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 9, color: DesignTokens.colors.text.tertiary, marginRight: 4, lineHeight: 20 }}>
                            (תוצאה)
                          </Text>
                          {surprisePercent !== null && surprisePercent !== undefined ? (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: getSurpriseColor(surprisePercent), marginRight: 6, lineHeight: 20 }}>
                              {surprisePercent > 0 ? '+' : ''}{surprisePercent.toFixed(1)}%
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 16, fontWeight: '700', color: getSurpriseColor(surprisePercent ?? null), textAlign: 'center', lineHeight: 20 }}>
                            {formatRevenue(report.revenue_actual)}
                          </Text>
                        </View>
                      );
                    })()
                  ) : (report.revenue_estimate || report.revenue_estimate_avg) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 9, color: DesignTokens.colors.text.tertiary, marginRight: 4, lineHeight: 20 }}>
                        (תחזית)
                      </Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: DesignTokens.colors.text.primary, textAlign: 'center', lineHeight: 20 }}>
                        {formatRevenue(report.revenue_estimate || report.revenue_estimate_avg || 0)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* פס הפרדה אנכי */}
              {hasEpsBlock && hasRevenueBlock ? (
                <View
                  style={{
                    width: 1,
                    height: 35,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    marginHorizontal: 8,
                  }}
                />
              ) : null}

              {/* EPS - מימין */}
              {hasEpsBlock ? (
                <View style={{ flex: 1, alignItems: 'center', paddingLeft: 8 }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 8, fontWeight: '600', textAlign: 'center' }}>
                    רווחיות (EPS)
                  </Text>
                  {report.actual !== null && report.actual !== 0 ? (
                    (() => {
                      // חישוב surprise אם אין
                      let surprisePercent = report.percent;
                      if (surprisePercent === null && report.actual && (report.estimate || report.eps_estimate)) {
                        const estimate = typeof report.estimate === 'number' ? report.estimate : 
                                       typeof report.eps_estimate === 'number' ? report.eps_estimate :
                                       typeof report.eps_estimate === 'string' ? parseFloat(report.eps_estimate) : null;
                        if (estimate !== null && estimate !== 0) {
                          surprisePercent = ((report.actual - estimate) / Math.abs(estimate)) * 100;
                        }
                      }
                      
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 9, color: DesignTokens.colors.text.tertiary, marginRight: 4, lineHeight: 20 }}>
                            (תוצאה)
                          </Text>
                          {surprisePercent !== null ? (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: getSurpriseColor(surprisePercent), marginRight: 6, lineHeight: 20 }}>
                              {surprisePercent > 0 ? '+' : ''}{surprisePercent.toFixed(1)}%
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 16, fontWeight: '700', color: getSurpriseColor(surprisePercent), textAlign: 'center', lineHeight: 20 }}>
                            ${report.actual.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })()
                  ) : (report.estimate || report.eps_estimate) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 9, color: DesignTokens.colors.text.tertiary, marginRight: 4, lineHeight: 20 }}>
                        (תחזית)
                      </Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: DesignTokens.colors.text.primary, textAlign: 'center', lineHeight: 20 }}>
                        ${typeof report.estimate === 'number' ? report.estimate.toFixed(2) :
                          typeof report.eps_estimate === 'number' ? report.eps_estimate.toFixed(2) :
                          typeof report.eps_estimate === 'string' ? parseFloat(report.eps_estimate).toFixed(2) : '0.00'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        </View>
      </UICard>
    </Pressable>
  );
};

// Helper: מנרמל "BeforeMarket" / "Before Market" / "pre-market" / "BMO" / "Before" וכד' לערך אחד.
// שימוש ב-module-level כדי למנוע recreate בכל render של הקומפוננטה.
const normalizeTiming = (value: string | null | undefined): 'BeforeMarket' | 'AfterMarket' | null => {
  if (!value) return null;
  const lower = String(value).toLowerCase();
  if (lower.includes('before') || lower.includes('pre-market') || lower.includes('premarket') || lower.includes('bmo')) return 'BeforeMarket';
  if (lower.includes('after') || lower.includes('post-market') || lower.includes('postmarket') || lower.includes('amc')) return 'AfterMarket';
  return null;
};

/** שעת סיום חלון BMO בישראל (אחרי פתיחת מסחר ארה"ב ~16:30) — 17:00 Asia/Jerusalem */
const PRE_MARKET_DONE_MINUTES_IL = 17 * 60;

/** דקות מהחצות לפי שעון ישראל */
function getIsraelMinutesNow(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  let hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  if (hours === 24) hours = 0; // חלק ממנועים מחזירים 24 בחצות
  return hours * 60 + minutes;
}

/**
 * האם חלון מסחר מוקדם נגמר ליום הנבחר — רק להיום.
 * יוריסטיקה: אחרי 17:00 ישראל, או שכל דיווחי BMO כבר עם actual.
 */
function isPreMarketOverForDay(
  reports: EarningsReport[],
  selectedIsToday: boolean,
): boolean {
  if (!selectedIsToday) return false;
  if (getIsraelMinutesNow() >= PRE_MARKET_DONE_MINUTES_IL) return true;
  const beforeReports = reports.filter(r => normalizeTiming(r.before_after_market) === 'BeforeMarket');
  if (beforeReports.length === 0) return false;
  return beforeReports.every(r => r.actual != null);
}

// מפריד סקשן עם תווית על רקע זכוכית אמיתית (BlurView)
const SectionDivider: React.FC<{
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconColor?: string;
  marginTop?: number;
}> = ({ label, icon: Icon, iconColor, marginTop = 12 }) => {
  const DesignTokens = useDesignTokens();
  const pillRadius = DesignTokens.borderRadius.full;
  return (
    <View
      style={{
        marginTop,
        marginBottom: 10,
        marginHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
      <View
        style={{
          marginHorizontal: 10,
          borderRadius: pillRadius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.14)',
        }}
      >
        <BlurView intensity={40} tint="dark" style={{ paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' }}>
          {Icon ? (
            <Icon size={11} color={iconColor || DesignTokens.colors.text.secondary} strokeWidth={2.2} />
          ) : null}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: DesignTokens.colors.text.primary,
              marginLeft: Icon ? 6 : 0,
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
        </BlurView>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
    </View>
  );
};

// ימים לפני/אחרי התאריך הנבחר שנטעין מראש כדי שניווט יום קדימה/אחורה יהיה מיידי.
const WINDOW_DAYS_BEFORE = 3;
const WINDOW_DAYS_AFTER = 7;

/** YYYY-MM-DD לפי יום מקומי — לא UTC (חשוב לניווט יומי בישראל). */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// מחזיר את יום שני (12:00 מקומי) של שבוע המסחר שמכיל את התאריך הנתון.
function startOfWeekMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay(); // 0=ראשון..6=שבת
  const diff = day === 0 ? -6 : 1 - day; // הזזה ליום שני
  date.setDate(date.getDate() + diff);
  return date;
}

export default function EarningsReportsTab({
  viewMode = 'daily',
  openReportId = null,
  openTicker = null,
  openReportDate = null,
  onOpenReportConsumed,
}: EarningsReportsTabProps) {
  const DesignTokens = useDesignTokens();
  const screenPad = DesignTokens.layout?.screenPadding ?? 20;
  // Map of date string → reports for that day. נטען הדרגתית.
  // זריעה אופטימית מה-cache (נטען מהדיסק בהפעלה קרה) — רינדור מיידי
  const [reportsByDate, setReportsByDate] = useState<ReportsByDate>(
    () => queryClient.getQueryData<ReportsByDate>(EARNINGS_QUERY_KEY) ?? {}
  );
  // tracking של אילו ימים כבר נטענו, כדי למנוע קריאות כפולות.
  const loadedDatesRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(
    () => Object.keys(queryClient.getQueryData<ReportsByDate>(EARNINGS_QUERY_KEY) ?? {}).length === 0
  );
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // יום שני של השבוע המוצג בתצוגה השבועית
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [selectedReport, setSelectedReport] = useState<EarningsReport | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // Refs וstate לכפתור גלילה לראש
  const flatListRef = useRef<FlatList>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  /** מפתח תאריך שעבורו כבר בוצעה גלילה אוטומטית ל-AfterMarket (פעם אחת ליום) */
  const autoScrolledToAfterDateKeyRef = useRef<string | null>(null);
  /** גבהי פריטים למדידת offset מדויק (המנווט קבוע מחוץ ל-FlatList) */
  const itemHeightByIndexRef = useRef<Map<number, number>>(new Map());
  const LIST_CONTENT_PADDING_TOP = 6;

  // פונקציה לגלילה לראש הרשימה
  const scrollToTop = useCallback(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  /** גלילה כך שראש פריט האינדקס (כולל דיביידר AfterMarket) צמוד לראש ה-viewport */
  const scrollItemToTop = useCallback((index: number, animated: boolean) => {
    const heights = itemHeightByIndexRef.current;
    let offset = LIST_CONTENT_PADDING_TOP;
    let measured = true;
    for (let i = 0; i < index; i++) {
      const h = heights.get(i);
      if (h == null) {
        measured = false;
        break;
      }
      offset += h;
    }
    if (measured) {
      flatListRef.current?.scrollToOffset({ offset, animated });
      return;
    }
    flatListRef.current?.scrollToIndex({
      index,
      animated,
      viewPosition: 0,
    });
  }, []);

  // טיפול באירוע גלילה
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 300; // הצג כפתור אחרי גלילה של 300px
    
    if (shouldShow !== showScrollToTop) {
      setShowScrollToTop(shouldShow);
      Animated.timing(scrollButtonOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showScrollToTop, scrollButtonOpacity]);

  const handleScrollToIndexFailed = useCallback((info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    // קופצים קרוב לאינדקס לפי ממוצע (מכריח מדידה), ואז מנסים שוב לצמוד לראש.
    const offset = Math.max(0, info.averageItemLength * info.index);
    flatListRef.current?.scrollToOffset({ offset, animated: false });
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollItemToTop(info.index, true);
      }, 50);
    });
  }, [scrollItemToTop]);

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
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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

  // טעינת חלון ימים סביב תאריך נתון (ברירת מחדל: selectedDate).
  // שליפה בודדת לטווח קטן (~11 ימים) → ~100-300 רשומות בלבד → טעינה מהירה מאוד.
  // שליפות חוזרות על ימים שכבר נטענו נחסמות ב-cache ברמת ה-service.
  const loadWindowAround = useCallback(async (centerDate: Date, opts: { forceReload?: boolean } = {}) => {
    try {
      const t0 = Date.now();
      const reports = await EarningsService.getDateWindow(centerDate, WINDOW_DAYS_BEFORE, WINDOW_DAYS_AFTER);

      // בונים map לפי תאריך ומסמנים את הימים כטעונים
      const byDate: Record<string, EarningsReport[]> = {};
      for (const r of reports) {
        (byDate[r.report_date] = byDate[r.report_date] || []).push(r);
      }
      // מוודאים שגם ימים ללא דיווחים בחלון יסומנו כ"טעונים"
      const centerStr = toDateKey(centerDate);
      for (let i = -WINDOW_DAYS_BEFORE; i <= WINDOW_DAYS_AFTER; i++) {
        const d = new Date(centerDate);
        d.setDate(d.getDate() + i);
        const key = toDateKey(d);
        if (!(key in byDate)) byDate[key] = [];
        loadedDatesRef.current.add(key);
      }

      const prevCached = queryClient.getQueryData<ReportsByDate>(EARNINGS_QUERY_KEY) ?? {};
      const merged = opts.forceReload ? byDate : { ...prevCached, ...byDate };
      queryClient.setQueryData(EARNINGS_QUERY_KEY, merged);
      setReportsByDate(prev => (opts.forceReload ? byDate : { ...prev, ...byDate }));

      if (__DEV__) {
        console.log(`[EarningsReportsTab] window around ${centerStr}: ${reports.length} rows in ${Date.now() - t0}ms`);
      }
    } catch (error) {
      console.error('[EarningsReportsTab] load window failed:', error instanceof Error ? error.message : error);
      legacyAlert('שגיאה', 'לא ניתן לטעון את דיווחי התוצאות');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // טעינת שבוע מסחר שלם (שני..ראשון) בשליפה בודדת דרך getDateWindow.
  // ממזג לאותו reportsByDate/cache של התצוגה היומית כדי לחלוק realtime.
  const loadWeek = useCallback(async (weekMonday: Date) => {
    try {
      const reports = await EarningsService.getDateWindow(weekMonday, 0, 6);
      const byDate: Record<string, EarningsReport[]> = {};
      for (const r of reports) {
        (byDate[r.report_date] = byDate[r.report_date] || []).push(r);
      }
      // מסמנים את כל ימי השבוע כ"טעונים" (כולל ימים ללא דיווחים)
      for (let i = 0; i <= 6; i++) {
        const d = new Date(weekMonday);
        d.setDate(weekMonday.getDate() + i);
        const key = toDateKey(d);
        if (!(key in byDate)) byDate[key] = [];
        loadedDatesRef.current.add(key);
      }
      const prevCached = queryClient.getQueryData<ReportsByDate>(EARNINGS_QUERY_KEY) ?? {};
      queryClient.setQueryData(EARNINGS_QUERY_KEY, { ...prevCached, ...byDate });
      setReportsByDate(prev => ({ ...prev, ...byDate }));
    } catch (error) {
      console.error('[EarningsReportsTab] load week failed:', error instanceof Error ? error.message : error);
      legacyAlert('שגיאה', 'לא ניתן לטעון את דיווחי התוצאות');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // בתצוגה שבועית — טוען את השבוע המוצג אם עדיין לא נטען.
  useEffect(() => {
    if (viewMode !== 'weekly') return;
    const monday = startOfWeekMonday(weekStart);
    let needLoad = false;
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      if (!loadedDatesRef.current.has(toDateKey(d))) {
        needLoad = true;
        break;
      }
    }
    if (needLoad) void loadWeek(monday);
  }, [viewMode, weekStart, loadWeek]);

  // טעינה ראשונית: לפני שמטעינים, בודקים אם היום יש דיווחים. אם אין — קופצים לתאריך הקרוב.
  const didInitialLoadRef = useRef(false);
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    (async () => {
      const todayStr = toDateKey(new Date());
      // שליפה זעירה (LIMIT 1) כדי למצוא את התאריך הקרוב ביותר עם דיווחים
      const nextDate = await EarningsService.getNextDateWithReports(todayStr);
      const center = nextDate && nextDate !== todayStr
        ? new Date(nextDate + 'T12:00:00')
        : new Date();
      if (nextDate && nextDate !== todayStr) {
        setSelectedDate(center);
      }
      await loadWindowAround(center);
    })();
  }, [loadWindowAround]);

  // בכל שינוי של selectedDate — טוען חלון סביב התאריך אם הוא לא כבר טעון.
  useEffect(() => {
    const key = toDateKey(selectedDate);
    if (loadedDatesRef.current.has(key)) return; // כבר טעון
    loadWindowAround(selectedDate);
  }, [selectedDate, loadWindowAround]);

  // סינון + מיון לוקאלי — רץ מיידית בכל שינוי תאריך (ללא רשת).
  const filteredReports = useMemo(() => {
    const key = toDateKey(selectedDate);
    const dateReports = reportsByDate[key];
    if (!dateReports || dateReports.length === 0) return [];

    const getPriority = (type: string | null): number => {
      const n = normalizeTiming(type);
      if (n === 'BeforeMarket') return 1;
      if (n === 'AfterMarket') return 2;
      return 3;
    };

    const getTimeInIsrael = (report: EarningsReport): number => {
      const n = normalizeTiming(report.before_after_market);
      if (!report.earnings_date_time) {
        if (n === 'BeforeMarket') return 8 * 60;
        if (n === 'AfterMarket') return 16 * 60;
        return 0;
      }
      try {
        const date = new Date(report.earnings_date_time);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Jerusalem',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        });
        const parts = formatter.formatToParts(date);
        const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
        return hours * 60 + minutes;
      } catch {
        if (n === 'BeforeMarket') return 8 * 60;
        if (n === 'AfterMarket') return 16 * 60;
        return 0;
      }
    };

    return [...dateReports].sort((a, b) => {
      const pa = getPriority(a.before_after_market);
      const pb = getPriority(b.before_after_market);
      if (pa !== pb) return pa - pb;
      return getTimeInIsrael(a) - getTimeInIsrael(b);
    });
  }, [reportsByDate, selectedDate]);

  // איפוס דגל גלילה אוטומטית + מדידות גובה כשמשנים תאריך
  useEffect(() => {
    autoScrolledToAfterDateKeyRef.current = null;
    itemHeightByIndexRef.current = new Map();
  }, [selectedDate]);

  // בתצוגה יומית: אחרי שמסחר מוקדם נגמר — גלילה חד־פעמית למפריד "מסחר מאוחר"
  useEffect(() => {
    if (viewMode !== 'daily') return;
    if (filteredReports.length === 0) return;

    const dateKey = toDateKey(selectedDate);
    if (autoScrolledToAfterDateKeyRef.current === dateKey) return;

    const firstAfterIdx = filteredReports.findIndex(
      r => normalizeTiming(r.before_after_market) === 'AfterMarket',
    );
    // אין AfterMarket, או שהוא כבר בראש (אין BeforeMarket לפניו)
    if (firstAfterIdx <= 0) return;

    const hasBefore = filteredReports.some(
      r => normalizeTiming(r.before_after_market) === 'BeforeMarket',
    );
    if (!hasBefore) return;

    if (!isPreMarketOverForDay(filteredReports, isSelectedToday)) return;

    // מסמנים מיד — פעם אחת ליום; טיימר בלי cleanup כדי שרענון נתונים לא יבטל
    autoScrolledToAfterDateKeyRef.current = dateKey;
    const scheduledFor = dateKey;
    const idx = firstAfterIdx;
    setTimeout(() => {
      // אם עברנו תאריך בינתיים — הדגל אופס / השתנה
      if (autoScrolledToAfterDateKeyRef.current !== scheduledFor) return;
      // מעדיפים offset ממדידות onLayout; אחרת scrollToIndex עם viewPosition: 0
      scrollItemToTop(idx, true);
    }, 160);
  }, [viewMode, filteredReports, selectedDate, isSelectedToday, scrollItemToTop]);

  // בניית נתוני השבוע (שני..שישי) לתצוגה השבועית — פיצול לפי מוקדם/מאוחר.
  const weekDays = useMemo<WeekDay[]>(() => {
    const monday = startOfWeekMonday(weekStart);
    const todayStr = new Date().toDateString();
    const sortByImportance = (a: EarningsReport, b: EarningsReport) =>
      (b.importance ?? 0) - (a.importance ?? 0) ||
      getWeeklySymbolDisplay(a.code).localeCompare(getWeeklySymbolDisplay(b.code));

    const days: WeekDay[] = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateKey = toDateKey(date);
      const list = reportsByDate[dateKey] ?? [];
      const before: EarningsReport[] = [];
      const after: EarningsReport[] = [];
      for (const r of list) {
        const n = normalizeTiming(r.before_after_market);
        if (n === 'AfterMarket') after.push(r);
        else before.push(r); // BeforeMarket או לא ידוע → מוקדם
      }
      before.sort(sortByImportance);
      after.sort(sortByImportance);
      days.push({
        dateKey,
        date,
        dayLabel: date.toLocaleDateString('he-IL', { weekday: 'long' }),
        dateLabel: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }),
        before,
        after,
        isToday: date.toDateString() === todayStr,
      });
    }
    return days;
  }, [reportsByDate, weekStart]);

  const weekLabel = useMemo(() => {
    const monday = startOfWeekMonday(weekStart);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const startDay = monday.getDate();
    const endDay = friday.getDate();
    const endMonth = friday.toLocaleDateString('he-IL', { month: 'long' });
    const year = friday.getFullYear();
    if (monday.getMonth() === friday.getMonth()) {
      return `${startDay}–${endDay} ב${endMonth} ${year}`;
    }
    const startMonth = monday.toLocaleDateString('he-IL', { month: 'long' });
    return `${startDay} ב${startMonth} – ${endDay} ב${endMonth} ${year}`;
  }, [weekStart]);

  const isCurrentWeek = useMemo(
    () => startOfWeekMonday(weekStart).toDateString() === startOfWeekMonday(new Date()).toDateString(),
    [weekStart],
  );

  const goToPreviousWeek = useCallback(() => {
    void HapticFeedback.impactLight();
    setWeekStart(prev => {
      const d = startOfWeekMonday(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    void HapticFeedback.impactLight();
    setWeekStart(prev => {
      const d = startOfWeekMonday(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    void HapticFeedback.medium();
    setWeekStart(startOfWeekMonday(new Date()));
  }, []);

  // Realtime subscription — patch נקודתי ב-state במקום refetch. זול וחלק.
  useEffect(() => {
    const subscription = supabase
      .channel('earnings_calendar_channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'earnings_calendar' },
        (payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          if (eventType === 'DELETE') {
            const oldRow = (payload.old ?? {}) as Partial<EarningsReport>;
            if (!oldRow.id) return;
            const oldDate = oldRow.report_date;
            EarningsService.removeReport(oldRow.id, oldDate);
            if (oldDate && loadedDatesRef.current.has(oldDate)) {
              setReportsByDate(prev => {
                const list = prev[oldDate];
                if (!list) return prev;
                const next = list.filter(r => r.id !== oldRow.id);
                if (next.length === list.length) return prev;
                return { ...prev, [oldDate]: next };
              });
            }
            return;
          }

          const row = (payload.new ?? {}) as EarningsReport;
          if (!row.id || !row.report_date) return;
          // מעדכנים גם את ה-cache ברמת ה-service
          EarningsService.patchReport(row);

          // מעדכנים state רק אם היום כבר ב-window הטעון
          if (!loadedDatesRef.current.has(row.report_date)) return;
          setReportsByDate(prev => {
            const list = prev[row.report_date] ?? [];
            const idx = list.findIndex(r => r.id === row.id);
            const nextList = idx >= 0
              ? [...list.slice(0, idx), row, ...list.slice(idx + 1)]
              : [...list, row];
            return { ...prev, [row.report_date]: nextList };
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // רענון ידני (pull-to-refresh) — מאפס cache וטוען את החלון הנוכחי מחדש.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      EarningsService.clearCache();
      loadedDatesRef.current.clear();
      if (viewMode === 'weekly') {
        await loadWeek(startOfWeekMonday(weekStart));
      } else {
        await loadWindowAround(selectedDate, { forceReload: true });
      }
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [viewMode, weekStart, selectedDate, loadWeek, loadWindowAround]);

  // בחירת דיווח - פתיחת bottom sheet
  const handleReportPress = useCallback((report: EarningsReport) => {
    void HapticFeedback.impactLight();
    setSelectedReport(report);
    setDetailModalVisible(true);
  }, []);

  const openedReportFromPushRef = useRef<string | null>(null);

  // פתיחה מהתראת Push (earnings_report_id / ticker+date)
  useEffect(() => {
    const pushKey = `${openReportId || ''}|${openTicker || ''}|${openReportDate || ''}`;
    if (!openReportId && !openTicker) {
      openedReportFromPushRef.current = null;
      return;
    }
    if (openedReportFromPushRef.current === pushKey) return;
    let cancelled = false;

    const findInLoaded = (): EarningsReport | null => {
      if (openReportId) {
        for (const list of Object.values(reportsByDate)) {
          const hit = list.find((r) => r.id === openReportId);
          if (hit) return hit;
        }
      }
      if (openTicker && openReportDate) {
        const dayList = reportsByDate[openReportDate] || [];
        const tickerUpper = openTicker.toUpperCase();
        return (
          dayList.find(
            (r) =>
              (r.ticker || r.code || '').toUpperCase() === tickerUpper ||
              (r.code || '').toUpperCase().replace(/\.US$/i, '') ===
                tickerUpper.replace(/\.US$/i, ''),
          ) || null
        );
      }
      return null;
    };

    const openFromParams = async () => {
      let report = findInLoaded();
      if (!report && openReportId) {
        report = await EarningsService.getById(openReportId);
      }
      if (!report && openTicker) {
        const bySymbol = await EarningsService.getBySymbol(openTicker);
        if (openReportDate) {
          report =
            bySymbol.find((r) => (r.report_date || r.date) === openReportDate) ||
            null;
        } else {
          report = bySymbol[0] || null;
        }
      }
      if (cancelled) return;
      if (!report) {
        openedReportFromPushRef.current = pushKey;
        onOpenReportConsumed?.();
        return;
      }
      openedReportFromPushRef.current = pushKey;
      const dateStr = report.report_date || report.date;
      if (dateStr) {
        setSelectedDate(new Date(`${dateStr}T12:00:00`));
      }
      handleReportPress(report);
      onOpenReportConsumed?.();
    };

    void openFromParams();
    return () => {
      cancelled = true;
    };
  }, [
    openReportId,
    openTicker,
    openReportDate,
    reportsByDate,
    handleReportPress,
    onOpenReportConsumed,
  ]);

  // סגירת bottom sheet
  const handleCloseDetail = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedReport(null);
  }, []);

  const renderDateNavigator = () => (
    <View
      style={{
        paddingHorizontal: screenPad,
        paddingTop: 10,
        paddingBottom: 12,
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

  // רינדור דיווח עם מרווח בין סוגים
  const renderReport = ({ item, index }: { item: EarningsReport; index: number }) => {
    const reports = filteredReports;
    const currentType = normalizeTiming(item.before_after_market);
    const prevType = index > 0 ? normalizeTiming(reports[index - 1].before_after_market) : null;
    
    // בדיקה אם זה הפריט הראשון של BeforeMarket
    const isFirstBeforeMarket = currentType === 'BeforeMarket' && (index === 0 || prevType !== 'BeforeMarket');
    const isListHead = index === 0;
    
    // מפריד "מסחר מאוחר" בפעם הראשונה שמופיע AfterMarket
    const isFirstAfterMarket =
      currentType === 'AfterMarket' &&
      (index === 0 || prevType !== 'AfterMarket');
    
    // עטיפת View יחידה (לא Fragment) — חובה למדידת גובה תקינה ב-FlatList/scrollToIndex
    return (
      <View
        onLayout={(e) => {
          itemHeightByIndexRef.current.set(index, e.nativeEvent.layout.height);
        }}
      >
        {isFirstBeforeMarket && (
          <SectionDivider
            label="מסחר מוקדם"
            icon={Sun}
            iconColor="#d1a11d"
            marginTop={isListHead ? 4 : 12}
          />
        )}
        {isFirstAfterMarket && (
          <SectionDivider label="מסחר מאוחר" icon={Moon} iconColor="#007AFF" marginTop={14} />
        )}
        <View style={isListHead && !isFirstBeforeMarket && !isFirstAfterMarket ? { marginTop: 8 } : undefined}>
          <EarningsReportCard
            report={item}
            onPress={handleReportPress}
          />
        </View>
      </View>
    );
  };

  // רינדור רשימה ריקה
  const renderEmptyState = () => {
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    const dateStr = selectedDate.toLocaleDateString('he-IL', { 
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    
    // מציאת הדיווחים הקרובים ביותר מתוך החלון הטעון
    const selectedDateStr = toDateKey(selectedDate);
    const closestReports = Object.entries(reportsByDate)
      .filter(([date]) => date >= selectedDateStr)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, list]) => list)
      .slice(0, 3);
    
    const hasClosestReports = closestReports.length > 0;
    const closestDate = hasClosestReports ? new Date(closestReports[0].report_date) : null;
    const daysUntilClosest = closestDate 
      ? Math.ceil((closestDate.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

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
            name="notifications-outline" 
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
          {isToday ? 'אין דיווחי תוצאות היום' : `אין דיווחי תוצאות ל-${dateStr}`}
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
            ? 'השווקים רגועים היום - אין דיווחי תוצאות מתוכננים'
            : `לא נמצאו דיווחי תוצאות ב${dateStr}`
          }
        </Text>
        {hasClosestReports && closestDate && (
          <TouchableOpacity
            style={{
              marginTop: 16,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: DesignTokens.borderRadius.full,
              backgroundColor: DesignTokens.colors.primary.main
            }}
            onPress={() => setSelectedDate(closestDate)}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>
              עבור לתאריך עם דיווחים ({closestDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })})
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={{
            marginTop: 12,
            paddingHorizontal: 28,
            paddingVertical: 14,
            borderRadius: DesignTokens.borderRadius.full,
            backgroundColor: DesignTokens.colors.background.secondary
          }}
          onPress={handleRefresh}
        >
          <Text style={{
            fontSize: 15,
            fontWeight: '700',
            color: DesignTokens.colors.primary.main
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
                  טוען דיווחי תוצאות...
                </Text>
              </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {viewMode === 'weekly' ? (
        <EarningsWeeklyView
          weekDays={weekDays}
          weekLabel={weekLabel}
          isCurrentWeek={isCurrentWeek}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onReportPress={handleReportPress}
          onPrevWeek={goToPreviousWeek}
          onNextWeek={goToNextWeek}
          onGoToCurrentWeek={goToCurrentWeek}
          bottomPad={isCurrentWeek ? DesignTokens.spacing.lg : DesignTokens.spacing.lg + 84}
        />
      ) : (
        <>
          <View style={{ flex: 1, minHeight: 0 }}>
            {renderDateNavigator()}
            <FlatList
              ref={flatListRef}
              data={filteredReports}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({ item, index }) => renderReport({ item, index })}
              style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={DesignTokens.colors.success.main}
                colors={[DesignTokens.colors.success.main]}
              />
            }
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingTop: LIST_CONTENT_PADDING_TOP, paddingBottom: listBottomPad }}
            onScroll={handleScroll}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            scrollEventThrottle={16}
            // אופטימיזציות ביצועים
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={10}
            removeClippedSubviews={false}
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
        </>
      )}

      {/* כפתור גלילה לראש — מיקום כמו צ'אט (ימין תחתון), זכוכית UICard glass/light, גודל 44 */}
      {viewMode === 'daily' && showScrollToTop && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: isSelectedToday ? fabBottomInset : fabBottomInset + 72,
            right: 12,
            width: 44,
            height: 44,
            opacity: scrollButtonOpacity,
            transform: [
              {
                scale: scrollButtonOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
            zIndex: 1000,
          }}
          pointerEvents="auto"
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <UICard
              variant="glass"
              glassIntensity="light"
              padding="none"
              onPress={scrollToTop}
              accessibilityLabel="גלול לראש הרשימה"
              style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}
              contentContainerStyle={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronUp size={22} color={DesignTokens.colors.text.primary} strokeWidth={2.3} />
            </UICard>
          </View>
        </Animated.View>
      )}

      {/* Bottom Sheet לפירוט דיווח */}
      {selectedReport && (
        <EarningsDetailSheet
          visible={detailModalVisible}
          report={selectedReport}
          onClose={handleCloseDetail}
        />
      )}
    </View>
  );
}

// Bottom Sheet לפירוט דיווח
interface EarningsDetailSheetProps {
  visible: boolean;
  report: EarningsReport;
  onClose: () => void;
}

const EarningsDetailSheet: React.FC<EarningsDetailSheetProps> = ({ visible, report, onClose }) => {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const getSurpriseColor = (percent: number | null): string => {
    if (!percent) return DesignTokens.colors.text.secondary;
    if (percent > 0) return DesignTokens.colors.primary.main;
    if (percent < 0) return DesignTokens.colors.danger.main;
    return DesignTokens.colors.text.secondary;
  };

  // פונקציה לעיצוב Revenue (B, M, K)
  const formatRevenue = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === 0 || value === '0') return '$0';
    
    let num: number;
    if (typeof value === 'string') {
      // הסרת B, M, K אם יש
      let cleanValue = value.trim().toUpperCase();
      if (cleanValue.endsWith('B')) {
        num = parseFloat(cleanValue.slice(0, -1)) * 1_000_000_000;
      } else if (cleanValue.endsWith('M')) {
        num = parseFloat(cleanValue.slice(0, -1)) * 1_000_000;
      } else if (cleanValue.endsWith('K')) {
        num = parseFloat(cleanValue.slice(0, -1)) * 1_000;
      } else {
        num = parseFloat(cleanValue);
      }
    } else {
      num = value;
    }
    
    if (isNaN(num) || num === 0) return '$0';
    
    if (Math.abs(num) >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (Math.abs(num) >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(num) >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    } else {
      return `$${num.toFixed(2)}`;
    }
  };

  const getSymbolDisplay = (code: string): string => {
    let cleanCode = code.replace('.US', '');
    if (cleanCode.startsWith('-')) {
      cleanCode = cleanCode.substring(1);
    }
    return cleanCode.trim();
  };

  const getTimeDisplay = (beforeAfterMarket: string | null): string => {
    if (!beforeAfterMarket) return 'טרם נקבע';
    if (beforeAfterMarket === 'BeforeMarket') return 'Pre Market';
    if (beforeAfterMarket === 'AfterMarket') return 'After Market';
    return beforeAfterMarket;
  };

  const getTimeIcon = (beforeAfterMarket: string | null) => {
    if (!beforeAfterMarket) {
      return { icon: Clock, color: DesignTokens.colors.text.secondary, text: 'טרם נקבע' };
    }
    if (beforeAfterMarket === 'BeforeMarket') {
      return { icon: Sun, color: '#d1a11d', text: 'Pre Market' };
    }
    if (beforeAfterMarket === 'AfterMarket') {
      return { icon: Moon, color: '#007AFF', text: 'After Market' };
    }
    return { icon: Clock, color: DesignTokens.colors.text.secondary, text: beforeAfterMarket };
  };

  // פונקציה ליצירת HTML עם TradingView Advanced Chart
  const getTradingViewChartHTML = (symbol: string, backgroundColor: string, earningsDateTime?: string | null, beforeAfterMarket?: string | null, exchange?: string | null): string => {
    const cleanSymbol = getSymbolDisplay(symbol);
    // אם יש .US, נסיר אותו
    let symbolForChart = cleanSymbol.replace(/\.US$/, '');
    
    // זיהוי בורסה - אם יש exchange, נשתמש בו; אחרת ננסה לזהות לפי הטיקר
    if (!symbolForChart.includes(':')) {
      if (exchange) {
        // אם יש exchange, נשתמש בו
        const exchangeUpper = exchange.toUpperCase();
        if (exchangeUpper === 'NYSE' || exchangeUpper === 'NASDAQ') {
          symbolForChart = `${exchangeUpper}:${symbolForChart}`;
        } else if (exchangeUpper.includes('NYSE')) {
          symbolForChart = `NYSE:${symbolForChart}`;
        } else if (exchangeUpper.includes('NASDAQ')) {
          symbolForChart = `NASDAQ:${symbolForChart}`;
        } else {
          // אם exchange לא מזוהה, ננסה את הטיקר בלי prefix (TradingView מזהה אוטומטית)
          // או ננסה NYSE ואז NASDAQ
          symbolForChart = symbolForChart; // נשאיר בלי prefix - TradingView מזהה אוטומטית
        }
      } else {
        // אם אין exchange, ננסה את הטיקר בלי prefix (TradingView מזהה אוטומטית)
        symbolForChart = symbolForChart;
      }
    }
    
    // #0A0E0A בפורמט rgba — TradingView לא מקבל hex, רק rgba
    const SHEET_BG = 'rgba(10, 14, 10, 1)';
    const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';

    const config = {
      allow_symbol_change: true,
      calendar: false,
      details: false,
      enabled_features: ['pre_post_market_sessions'],
      hide_side_toolbar: true,
      hide_top_toolbar: true,
      hide_legend: true,
      hide_volume: true,
      hotlist: false,
      interval: '5',
      locale: 'he_IL',
      overrides: {
        'mainSeriesProperties.sessionId': 'extended',
      },
      save_image: false,
      style: '1',
      symbol: symbolForChart,
      theme: 'dark',
      timezone: 'Asia/Jerusalem',
      isTransparent: false,
      backgroundColor: SHEET_BG,
      gridColor: GRID_COLOR,
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      autosize: false,
      height: 400,
      width: '100%',
    };

    // הזרקה ידנית של script TradingView חיונית ב-iOS WKWebView:
    // הסקריפט החיצוני קורא את ה-config מתוך textContent של תג ה-script שמצורף
    // אליו. עם <script src async> שכולל JSON inline, document.currentScript עלול
    // להיות null ב-WebKit וה-config לא ייטען — וכתוצאה הגרף לא מאותחל ב-iOS.
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      background-color: #0A0E0A;
      overflow: hidden;
      -webkit-overflow-scrolling: touch;
    }
    .tradingview-widget-container {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    .tradingview-widget-container__widget {
      flex: 1;
      min-height: 0;
      position: relative;
    }
    .tradingview-widget-container__widget iframe,
    .tradingview-widget-container__widget > div {
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      background: #0A0E0A !important;
    }
    .tradingview-widget-copyright {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <script type="application/json" id="tv-config">${JSON.stringify(config)}</script>
    <script>
      (function () {
        try {
          var cfg = document.getElementById('tv-config').textContent;
          var s = document.createElement('script');
          s.type = 'text/javascript';
          s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
          s.async = true;
          s.text = cfg;
          document.querySelector('.tradingview-widget-container').appendChild(s);
        } catch (err) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage('tv-init-error: ' + (err && err.message ? err.message : err));
          }
        }
      })();
    </script>
</body>
</html>
    `;
  };

  // חישוב surprise color - אם אין percent, נחשב מ-actual ו-estimate (כמו בכרטיסיה)
  let calculatedPercent = report.percent;
  if ((calculatedPercent === null || calculatedPercent === undefined) && report.actual !== null && report.actual !== 0 && (report.estimate || report.eps_estimate)) {
    const estimate = typeof report.estimate === 'number' ? report.estimate :
                     typeof report.eps_estimate === 'number' ? report.eps_estimate :
                     typeof report.eps_estimate === 'string' ? parseFloat(report.eps_estimate) : null;
    if (estimate !== null && estimate !== 0) {
      calculatedPercent = ((report.actual - estimate) / Math.abs(estimate)) * 100;
    }
  }
  const surpriseColor = getSurpriseColor(calculatedPercent);
  const timeInfo = getTimeIcon(report.before_after_market);
  const TimeIcon = timeInfo.icon;
  const animatedClose = useBottomSheetClose();
  const sheetStyles = useMemo(() => createEarningsDetailSheetStyles(DesignTokens), [DesignTokens]);

  const handleSheetClose = useCallback(() => {
    if (animatedClose) animatedClose();
    else onClose();
  }, [animatedClose, onClose]);

  const epsEstimate =
    typeof report.estimate === 'number'
      ? report.estimate
      : typeof report.eps_estimate === 'number'
        ? report.eps_estimate
        : typeof report.eps_estimate === 'string'
          ? parseFloat(report.eps_estimate)
          : null;

  const hasEpsActual = report.actual !== null && report.actual !== 0;
  const hasEpsEstimate = epsEstimate !== null && !Number.isNaN(epsEstimate);
  const epsPrior = (report as { eps_prior?: number }).eps_prior;

  const revenueEstimate =
    typeof report.revenue_estimate === 'number'
      ? report.revenue_estimate
      : typeof report.revenue_estimate_avg === 'number'
        ? report.revenue_estimate_avg
        : null;

  const hasRevenueActual = report.revenue_actual !== null && report.revenue_actual !== 0;
  const hasRevenueEstimate = revenueEstimate !== null && revenueEstimate !== 0;

  let revenuePercent = report.revenue_surprise_percent;
  if (
    (revenuePercent === null || revenuePercent === undefined) &&
    hasRevenueActual &&
    hasRevenueEstimate &&
    report.revenue_actual != null &&
    revenueEstimate
  ) {
    revenuePercent = ((report.revenue_actual - revenueEstimate) / Math.abs(revenueEstimate)) * 100;
  }
  const revenueColor = getSurpriseColor(revenuePercent ?? null);
  const revenuePrior = (report as { revenue_estimate_year_ago?: number }).revenue_estimate_year_ago;

  const quarterLabel =
    report.period ||
    `Q${Math.floor(new Date(report.report_date).getMonth() / 3) + 1}`;
  const quarterYear = report.period_year || new Date(report.report_date).getFullYear();

  const preciseTimeLabel = report.earnings_date_time
    ? new Intl.DateTimeFormat('he-IL', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(report.earnings_date_time))
    : null;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={handleSheetClose}
      snapPoints={[0.9]}
      edgeToEdge
      showHandle
      enablePanDownToClose
      showBrandBackground={false}
      useGlassBackground
      topCornerRadius={28}
    >
      <View style={sheetStyles.container}>
        <View style={sheetStyles.header}>
          <DayNavBlurButton
            onPress={handleSheetClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="סגור"
          >
            <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>

          <View style={sheetStyles.headerMain}>
            <TickerLogo symbol={getSymbolDisplay(report.code)} size={42} />
            <View style={sheetStyles.headerTextCol}>
              <Text style={[sheetStyles.ticker, { color: DesignTokens.colors.text.primary }]}>
                {getSymbolDisplay(report.code)}
              </Text>
              {(report.company_name || report.asset_name) ? (
                <Text
                  numberOfLines={1}
                  style={[sheetStyles.companyName, { color: DesignTokens.colors.text.secondary }]}
                >
                  {report.company_name || report.asset_name}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={[
              sheetStyles.timeBadge,
              {
                backgroundColor:
                  timeInfo.color === '#d1a11d'
                    ? 'rgba(209, 161, 29, 0.15)'
                    : timeInfo.color === '#007AFF'
                      ? 'rgba(0, 122, 255, 0.15)'
                      : `${DesignTokens.colors.success.main}26`,
              },
            ]}
          >
            <TimeIcon size={13} color={timeInfo.color} strokeWidth={2.2} />
            <Text style={[sheetStyles.timeBadgeText, { color: timeInfo.color }]}>
              {timeInfo.text}
            </Text>
          </View>
        </View>

        <ScrollView
          style={sheetStyles.scroll}
          contentContainerStyle={[
            sheetStyles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 16, 32) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <UICard
            variant="blur"
            padding="none"
            style={sheetStyles.chartCard}
            contentContainerStyle={{ flex: 1 }}
          >
            <WebView
              key={`tv-${report.id ?? report.code}`}
              source={{
                html: getTradingViewChartHTML(
                  report.code,
                  'transparent',
                  report.earnings_date_time,
                  report.before_after_market,
                  (report as { exchange?: string }).exchange,
                ),
              }}
              style={sheetStyles.chartWebView}
              androidLayerType="hardware"
              allowsTransparency
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              startInLoadingState
              originWhitelist={['*']}
              mixedContentMode="always"
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              onError={(e) => {
                if (__DEV__) console.warn('[TV chart] WebView error', e.nativeEvent);
              }}
              onHttpError={(e) => {
                if (__DEV__) console.warn('[TV chart] WebView http error', e.nativeEvent);
              }}
            />
          </UICard>

          {(hasEpsEstimate || hasEpsActual) ? (
            <UICard variant="blur" padding="md" style={sheetStyles.sectionCard}>
              <Text style={[sheetStyles.sectionTitle, { color: DesignTokens.colors.text.secondary }]}>
                רווחיות למניה (EPS)
              </Text>
              <View style={sheetStyles.metricRow}>
                {hasEpsEstimate ? (
                  <MetricColumn
                    label="תחזית"
                    value={`$${epsEstimate!.toFixed(2)}`}
                    valueColor={DesignTokens.colors.text.primary}
                    styles={sheetStyles}
                  />
                ) : null}
                {hasEpsEstimate && hasEpsActual ? <View style={sheetStyles.metricDivider} /> : null}
                {hasEpsActual ? (
                  <MetricColumn
                    label="תוצאה"
                    value={`$${report.actual!.toFixed(2)}`}
                    valueColor={surpriseColor}
                    subValue={
                      calculatedPercent != null
                        ? `${calculatedPercent > 0 ? '+' : ''}${calculatedPercent.toFixed(1)}%`
                        : undefined
                    }
                    subValueColor={surpriseColor}
                    styles={sheetStyles}
                  />
                ) : null}
                {!hasEpsActual && hasEpsEstimate && epsPrior != null ? (
                  <>
                    <View style={sheetStyles.metricDivider} />
                    <MetricColumn
                      label="תקופה קודמת"
                      value={`$${epsPrior.toFixed(2)}`}
                      valueColor={DesignTokens.colors.text.secondary}
                      styles={sheetStyles}
                    />
                  </>
                ) : null}
              </View>
            </UICard>
          ) : null}

          {(hasRevenueEstimate || hasRevenueActual) ? (
            <UICard variant="blur" padding="md" style={sheetStyles.sectionCard}>
              <Text style={[sheetStyles.sectionTitle, { color: DesignTokens.colors.text.secondary }]}>
                הכנסות (Revenue)
              </Text>
              <View style={sheetStyles.metricRow}>
                {hasRevenueEstimate ? (
                  <MetricColumn
                    label="תחזית"
                    value={formatRevenue(revenueEstimate)}
                    valueColor={DesignTokens.colors.text.primary}
                    styles={sheetStyles}
                  />
                ) : null}
                {hasRevenueEstimate && hasRevenueActual ? <View style={sheetStyles.metricDivider} /> : null}
                {hasRevenueActual ? (
                  <MetricColumn
                    label="תוצאה"
                    value={formatRevenue(report.revenue_actual)}
                    valueColor={revenueColor}
                    subValue={
                      revenuePercent != null
                        ? `${revenuePercent > 0 ? '+' : ''}${revenuePercent.toFixed(1)}%`
                        : undefined
                    }
                    subValueColor={revenueColor}
                    styles={sheetStyles}
                  />
                ) : null}
                {!hasRevenueActual && hasRevenueEstimate && revenuePrior != null ? (
                  <>
                    <View style={sheetStyles.metricDivider} />
                    <MetricColumn
                      label="תקופה קודמת"
                      value={formatRevenue(revenuePrior)}
                      valueColor={DesignTokens.colors.text.secondary}
                      styles={sheetStyles}
                    />
                  </>
                ) : null}
              </View>
            </UICard>
          ) : null}

          <UICard variant="blur" padding="md" style={sheetStyles.sectionCard}>
            <SheetMetaRow
              label="תאריך דיווח"
              value={new Date(report.report_date).toLocaleDateString('he-IL')}
              styles={sheetStyles}
              valueColor={DesignTokens.colors.text.primary}
              labelColor={DesignTokens.colors.text.tertiary}
            />
            <SheetMetaRow
              label="זמן דיווח"
              value={getTimeDisplay(report.before_after_market)}
              styles={sheetStyles}
              valueColor={DesignTokens.colors.text.primary}
              labelColor={DesignTokens.colors.text.tertiary}
            />
            {preciseTimeLabel ? (
              <SheetMetaRow
                label="שעה מדויקת (ישראל)"
                value={preciseTimeLabel}
                styles={sheetStyles}
                valueColor={DesignTokens.colors.text.primary}
                labelColor={DesignTokens.colors.text.tertiary}
              />
            ) : null}
            {report.date && report.date !== report.report_date ? (
              <SheetMetaRow
                label="תקופת דיווח"
                value={new Date(report.date).toLocaleDateString('he-IL')}
                styles={sheetStyles}
                valueColor={DesignTokens.colors.text.primary}
                labelColor={DesignTokens.colors.text.tertiary}
              />
            ) : null}
            {(report.period || report.period_year) ? (
              <SheetMetaRow
                label="רבעון"
                value={`${quarterLabel} ${quarterYear}`}
                styles={sheetStyles}
                valueColor={DesignTokens.colors.text.primary}
                labelColor={DesignTokens.colors.text.tertiary}
              />
            ) : null}
            {report.importance ? (
              <SheetMetaRow
                label="חשיבות"
                value={String(report.importance)}
                styles={sheetStyles}
                valueColor={report.importance >= 4 ? '#FFC107' : DesignTokens.colors.text.primary}
                labelColor={DesignTokens.colors.text.tertiary}
                isLast
              />
            ) : null}
          </UICard>
        </ScrollView>
      </View>
    </BottomSheet>
  );
};

const rtlSheetText = {
  writingDirection: 'rtl' as const,
  textAlign: 'left' as const,
};

function MetricColumn({
  label,
  value,
  valueColor,
  subValue,
  subValueColor,
  styles,
}: {
  label: string;
  value: string;
  valueColor: string;
  subValue?: string;
  subValueColor?: string;
  styles: ReturnType<typeof createEarningsDetailSheetStyles>;
}) {
  return (
    <View style={styles.metricCol}>
      <Text style={[styles.metricLabel, rtlSheetText]}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
        {subValue ? (
          <Text style={[styles.metricSubValue, { color: subValueColor ?? valueColor }]}>{subValue}</Text>
        ) : null}
      </View>
    </View>
  );
}

function SheetMetaRow({
  label,
  value,
  styles,
  valueColor,
  labelColor,
  isLast,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createEarningsDetailSheetStyles>;
  valueColor: string;
  labelColor: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.metaRow, !isLast && styles.metaRowBorder]}>
      <Text style={[styles.metaLabel, rtlSheetText, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.metaValue, rtlSheetText, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const SHEET_BORDER = 'rgba(255, 255, 255, 0.10)';

function createEarningsDetailSheetStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      direction: 'rtl',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: SHEET_BORDER,
    },
    headerMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    logo: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: tokens.colors.background.tertiary,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
    },
    ticker: {
      fontSize: 18,
      fontWeight: '800',
      ...rtlSheetText,
    },
    companyName: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      ...rtlSheetText,
    },
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9999,
      flexShrink: 0,
    },
    timeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 12,
      direction: 'rtl',
    },
    chartCard: {
      borderRadius: 24,
      overflow: 'hidden',
      height: 360,
    },
    chartWebView: {
      flex: 1,
      backgroundColor: '#0A0E0A',
    },
    sectionCard: {
      borderRadius: 24,
      overflow: 'hidden',
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 12,
      ...rtlSheetText,
    },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    metricCol: {
      flex: 1,
      alignItems: 'flex-start',
      gap: 4,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      flexWrap: 'wrap',
    },
    metricValue: {
      fontSize: 22,
      fontWeight: '800',
    },
    metricSubValue: {
      fontSize: 12,
      fontWeight: '700',
    },
    metricDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: SHEET_BORDER,
      marginHorizontal: 10,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      gap: 12,
    },
    metaRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: SHEET_BORDER,
    },
    metaLabel: {
      fontSize: 13,
      fontWeight: '500',
      flexShrink: 0,
    },
    metaValue: {
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
    },
  });
}
