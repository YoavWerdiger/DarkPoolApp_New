import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Animated
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Clock, Sun, Moon, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import EarningsService, { EarningsReport } from '../../services/earningsService';
import { supabase } from '../../lib/supabase';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import UICard from '../../components/ui/UICard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

const EarningsReportCard: React.FC<{ 
  report: EarningsReport; 
  onPress: (report: EarningsReport) => void 
}> = ({ report, onPress }) => {
  const DesignTokens = useDesignTokens();
  
  // פונקציה לקבלת צבע לפי surprise
  const getSurpriseColor = (percent: number | null | undefined): string => {
    if (percent === null || percent === undefined) return DesignTokens.colors.text.secondary;
    if (percent > 0) return '#00D84A'; // ירוק
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


  // פונקציה לעיצוב זמן
  const getTimeDisplay = (beforeAfterMarket: string | null): string => {
    if (!beforeAfterMarket) return 'טרם נקבע';
    if (beforeAfterMarket === 'BeforeMarket') return 'מסחר מוקדם';
    if (beforeAfterMarket === 'AfterMarket') return 'מסחר מאוחר';
    return beforeAfterMarket;
  };

  // פונקציה לקבלת אייקון וצבע לזמן
  const getTimeIcon = (beforeAfterMarket: string | null) => {
    if (!beforeAfterMarket) {
      return { icon: Clock, color: DesignTokens.colors.text.secondary, text: 'טרם נקבע' };
    }
    if (beforeAfterMarket === 'BeforeMarket') {
      return { icon: Sun, color: '#d1a11d', text: 'מסחר מוקדם' }; // צהוב זהב
    }
    if (beforeAfterMarket === 'AfterMarket') {
      return { icon: Moon, color: '#007AFF', text: 'מסחר מאוחר' }; // כחול בהיר יותר
    }
    return { icon: Clock, color: DesignTokens.colors.text.secondary, text: beforeAfterMarket };
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

  // פונקציה לקבלת URL לוגו מ-Brandfetch
  const getLogoUrl = (symbol: string): string => {
    const cleanSymbol = getSymbolDisplay(symbol);
    // Brandfetch CDN - הפורמט הנכון
    return `https://cdn.brandfetch.io/${cleanSymbol}?c=1idgv-PUKssFHXQBcKA`;
  };

  return (
    <Pressable onPress={() => onPress(report)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <UICard
        variant="blur"
        padding="lg"
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          overflow: 'hidden',
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
            <Image
              source={{ uri: getLogoUrl(report.code) }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                marginRight: 12,
                backgroundColor: DesignTokens.colors.background.tertiary
              }}
              onError={(error) => {
                console.log('Logo load error for', report.code, error);
              }}
            />
            <View style={{ flex: 1, justifyContent: 'flex-start' }}>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '700', 
                color: DesignTokens.colors.text.primary,
                lineHeight: 20
              }}>
                {getSymbolDisplay(report.code)}
              </Text>
              {(report.company_name || report.asset_name) && (
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
                  {report.company_name || report.asset_name}
                </Text>
              )}
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
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 16
              }}>
                <IconComponent 
                  size={11} 
                  color={timeInfo.color || '#00D84A'} 
                  strokeWidth={2} 
                  style={{ marginRight: 5 }} 
                />
                <Text style={{ 
                  fontSize: 11, 
                  color: timeInfo.color || '#00D84A',
                  fontWeight: '600'
                }}>
                  {timeInfo.text}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* בלוק ערכים - EPS מימין, Revenue משמאל, בשורה אחת */}
        {((report.estimate || report.actual || report.eps_estimate) || (report.revenue_estimate || report.revenue_estimate_avg || report.revenue_actual)) && (
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
              {(report.revenue_estimate || report.revenue_estimate_avg || report.revenue_actual) && (
                <View style={{ flex: 1, alignItems: 'center', paddingRight: 8 }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 8, fontWeight: '600', textAlign: 'center' }}>
                    הכנסות (Revenue)
                  </Text>
                  {report.revenue_actual !== null && report.revenue_actual !== 0 ? (
                    /* תוצאה */
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
                          {surprisePercent !== null && surprisePercent !== undefined && (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: getSurpriseColor(surprisePercent), marginRight: 6, lineHeight: 20 }}>
                              {surprisePercent > 0 ? '+' : ''}{surprisePercent.toFixed(1)}%
                            </Text>
                          )}
                          <Text style={{ fontSize: 16, fontWeight: '700', color: getSurpriseColor(surprisePercent ?? null), textAlign: 'center', lineHeight: 20 }}>
                            {formatRevenue(report.revenue_actual)}
                          </Text>
                        </View>
                      );
                    })()
                  ) : (report.revenue_estimate || report.revenue_estimate_avg) ? (
                    /* תחזית */
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
              )}

              {/* פס הפרדה אנכי */}
              {((report.estimate || report.actual || report.eps_estimate) &&
                (report.revenue_estimate || report.revenue_estimate_avg || report.revenue_actual)) && (
                <View
                  style={{
                    width: 1,
                    height: 35,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    marginHorizontal: 8,
                  }}
                />
              )}

              {/* EPS - מימין */}
              {(report.estimate || report.actual || report.eps_estimate) && (
                <View style={{ flex: 1, alignItems: 'center', paddingLeft: 8 }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 8, fontWeight: '600', textAlign: 'center' }}>
                    רווחיות (EPS)
                  </Text>
                  {report.actual !== null && report.actual !== 0 ? (
                    /* תוצאה */
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
                          {surprisePercent !== null && (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: getSurpriseColor(surprisePercent), marginRight: 6, lineHeight: 20 }}>
                              {surprisePercent > 0 ? '+' : ''}{surprisePercent.toFixed(1)}%
                            </Text>
                          )}
                          <Text style={{ fontSize: 16, fontWeight: '700', color: getSurpriseColor(surprisePercent), textAlign: 'center', lineHeight: 20 }}>
                            ${report.actual.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })()
                  ) : (report.estimate || report.eps_estimate) ? (
                    /* תחזית */
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
              )}
            </View>
          </View>
        )}
        </View>
      </UICard>
    </Pressable>
  );
};

export default function EarningsReportsTab() {
  const DesignTokens = useDesignTokens();
  const mainTabsHeight = useMainTabsHeight();
  const [reports, setReports] = useState<EarningsReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<EarningsReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedReport, setSelectedReport] = useState<EarningsReport | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // Refs וstate לכפתור גלילה לראש
  const flatListRef = useRef<FlatList>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;

  // פונקציה לגלילה לראש הרשימה
  const scrollToTop = useCallback(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
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

  // פילטור דיווחים לפי תאריך (מובנה ב-loadEarningsReports)

  // טעינת דיווחי תוצאות
  const loadEarningsReports = useCallback(async () => {
    try {
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      console.log('📈 EarningsReportsTab: ===== Starting loadEarningsReports =====');
      console.log('📅 Selected date:', selectedDateStr);
      console.log('📅 Selected date object:', selectedDate);
      setLoading(true);
      
      // שליפה אחת של כל הנתונים
      console.log('🔄 EarningsReportsTab: Calling EarningsService.getAll()...');
      const startTime = Date.now();
      const allReports = await EarningsService.getAll();
      const loadTime = Date.now() - startTime;
      console.log(`✅ EarningsReportsTab: getAll() completed in ${loadTime}ms`);
      console.log(`📊 Total reports loaded: ${allReports.length}`);
      
      if (allReports.length > 0) {
        console.log('📋 Sample report:', {
          code: allReports[0].code,
          report_date: allReports[0].report_date,
          before_after_market: allReports[0].before_after_market,
          actual: allReports[0].actual,
          estimate: allReports[0].estimate
        });
      }
      
      // סינון לפי התאריך הנבחר
      console.log(`🔍 Filtering reports for date: ${selectedDateStr}`);
      console.log(`📅 All available dates in reports:`, 
        Array.from(new Set(allReports.map(r => r.report_date))).sort().slice(0, 10)
      );
      let dateReports = EarningsService.filterByDate(allReports, selectedDateStr);
      console.log(`📊 Reports for selected date: ${dateReports.length}`);
      
      // אם אין דיווחים לתאריך הנבחר, נבדוק אם יש דיווחים קרובים
      if (dateReports.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const todayReports = EarningsService.filterByDate(allReports, today);
        const tomorrowReports = EarningsService.filterByDate(allReports, tomorrowStr);
        
        console.log(`⚠️ No reports for ${selectedDateStr}`);
        console.log(`   📅 Today (${today}): ${todayReports.length} reports`);
        console.log(`   📅 Tomorrow (${tomorrowStr}): ${tomorrowReports.length} reports`);
        
        // מציגים את הדיווחים הקרובים ביותר (אם יש)
        const closestReports = allReports
          .filter(r => r.report_date >= selectedDateStr)
          .sort((a, b) => a.report_date.localeCompare(b.report_date))
          .slice(0, 5);
        
        if (closestReports.length > 0) {
          console.log(`   📅 Closest future reports:`, 
            closestReports.map(r => `${r.report_date} (${r.code})`)
          );
        }
      }
      
      // מיון: BeforeMarket מעל AfterMarket, ואז לפי שעה (שעון ישראל)
      const sortedReports = dateReports.sort((a, b) => {
        // פונקציה עזר לקבלת סדר עדיפות
        const getPriority = (type: string | null): number => {
          if (type === 'BeforeMarket') return 1; // ראשון
          if (type === 'AfterMarket') return 2; // שני
          return 3; // אחרון
        };
        
        // השוואת עדיפות (BeforeMarket > AfterMarket > אחר)
        const priorityA = getPriority(a.before_after_market);
        const priorityB = getPriority(b.before_after_market);
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // אם שניהם באותה קטגוריה, נמיין לפי שעה (שעון ישראל)
        // המרה לשעון ישראל והשוואה
        const getTimeInIsrael = (report: EarningsReport): number => {
          if (!report.earnings_date_time) {
            // אם אין זמן, נשתמש ב-report_date + זמן ברירת מחדל
            // BeforeMarket - 8:00, AfterMarket - 16:00
            if (report.before_after_market === 'BeforeMarket') return 8 * 60; // 8:00
            if (report.before_after_market === 'AfterMarket') return 16 * 60; // 16:00
            return 0;
          }
          try {
            // המרה ל-Date object
            const date = new Date(report.earnings_date_time);
            // המרה לשעון ישראל - שימוש ב-Intl.DateTimeFormat
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Jerusalem',
              hour12: false,
              hour: '2-digit',
              minute: '2-digit'
            });
            const parts = formatter.formatToParts(date);
            const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
            const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
            // החזרת זמן בדקות מהתחלת היום
            return hours * 60 + minutes;
          } catch {
            // במקרה של שגיאה, נשתמש בערכי ברירת מחדל
            if (report.before_after_market === 'BeforeMarket') return 8 * 60;
            if (report.before_after_market === 'AfterMarket') return 16 * 60;
            return 0;
          }
        };
        
        const timeA = getTimeInIsrael(a);
        const timeB = getTimeInIsrael(b);
        
        // מיון לפי זמן - מהמוקדם למאוחר (באותה קטגוריה)
        return timeA - timeB;
      });
      
      // דיבאג: כמה BeforeMarket vs AfterMarket?
      const beforeCount = dateReports.filter(r => r.before_after_market === 'BeforeMarket').length;
      const afterCount = dateReports.filter(r => r.before_after_market === 'AfterMarket').length;
      const nullCount = dateReports.filter(r => !r.before_after_market).length;
      
      console.log(`✅ EarningsReportsTab: Filtered ${sortedReports.length} reports for ${selectedDateStr}`);
      console.log(`   📊 Breakdown: BeforeMarket: ${beforeCount}, AfterMarket: ${afterCount}, NULL: ${nullCount}`);
      
      if (sortedReports.length > 0) {
        console.log('📋 First filtered report:', {
          code: sortedReports[0].code,
          report_date: sortedReports[0].report_date,
          before_after_market: sortedReports[0].before_after_market
        });
      }
      
      setReports(allReports); // שמירת כל הנתונים
      setFilteredReports(sortedReports); // הצגת דיווחי התאריך הנבחר ממוינים
      
      console.log('✅ EarningsReportsTab: ===== loadEarningsReports completed successfully =====');
      
    } catch (error) {
      console.error('❌ EarningsReportsTab: ===== Error in loadEarningsReports =====');
      console.error('❌ Error details:', error);
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      Alert.alert('שגיאה', 'לא ניתן לטעון את דיווחי התוצאות');
      setReports([]);
      setFilteredReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('🏁 EarningsReportsTab: loadEarningsReports finished (loading set to false)');
    }
  }, [selectedDate]);

  // טעינה ראשונית
  useEffect(() => {
    loadEarningsReports();
  }, [loadEarningsReports]);

  // Realtime subscription
  useEffect(() => {
    console.log('🔄 Subscribing to earnings_calendar realtime updates...');
    
    const subscription = supabase
      .channel('earnings_calendar_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'earnings_calendar' },
        (payload) => {
          console.log('📡 Earnings report realtime update:', payload);
          loadEarningsReports();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Unsubscribing from earnings_calendar realtime');
      subscription.unsubscribe();
    };
  }, []); // הסרנו את התלות ב-loadEarningsReports

  // רענון
  const handleRefresh = useCallback(async () => {
    console.log('🔄 EarningsReportsTab: Starting refresh...');
    setRefreshing(true);
    
    // טען את הנתונים מהטבלה (ללא קריאה ל-Edge Function שלא קיים)
    await loadEarningsReports();
    
    console.log('✅ EarningsReportsTab: Refresh completed');
  }, [loadEarningsReports]);

  // בחירת דיווח - פתיחת bottom sheet
  const handleReportPress = useCallback((report: EarningsReport) => {
    console.log('📈 EarningsReportsTab: Report pressed:', report.code);
    setSelectedReport(report);
    setDetailModalVisible(true);
  }, []);

  // סגירת bottom sheet
  const handleCloseDetail = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedReport(null);
  }, []);

  // רינדור דיווח עם מרווח בין סוגים
  const renderReport = ({ item, index }: { item: EarningsReport; index: number }) => {
    const reports = filteredReports;
    const currentType = item.before_after_market;
    const prevType = index > 0 ? reports[index - 1].before_after_market : null;
    
    // בדיקה אם זה הפריט הראשון של BeforeMarket
    const isFirstBeforeMarket = currentType === 'BeforeMarket' && (index === 0 || prevType !== 'BeforeMarket');
    
    // בדיקה אם צריך להוסיף הפרדה - מעבר מ-BeforeMarket ל-AfterMarket
    const showDivider = currentType === 'AfterMarket' && prevType === 'BeforeMarket';
    
    return (
      <>
        {/* כותרת "לפני פתיחה" בתחילת הרשימה */}
        {isFirstBeforeMarket && (
          <View style={{ 
            marginTop: 12,
            marginBottom: 8,
            marginHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <View style={{ 
              flex: 1, 
              height: 1, 
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }} />
            <View style={{ 
              marginHorizontal: 10,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.12)',
            }}>
              <Text style={{ 
                fontSize: 11, 
                fontWeight: '600',
                color: DesignTokens.colors.text.secondary
              }}>
                מסחר מוקדם
              </Text>
            </View>
            <View style={{ 
              flex: 1, 
              height: 1, 
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }} />
          </View>
        )}
        
        {/* הפרדה בין לפני פתיחה לאחרי סגירה */}
        {showDivider && (
          <View style={{ 
            marginVertical: 14,
            marginHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <View style={{ 
              flex: 1, 
              height: 1, 
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }} />
            <View style={{ 
              marginHorizontal: 10,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.12)',
            }}>
              <Text style={{ 
                fontSize: 11, 
                fontWeight: '600',
                color: DesignTokens.colors.text.secondary
              }}>
                מסחר מאוחר
              </Text>
            </View>
            <View style={{ 
              flex: 1, 
              height: 1, 
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }} />
          </View>
        )}
        
        <EarningsReportCard
          report={item}
          onPress={handleReportPress}
        />
      </>
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
    
    // מציאת הדיווחים הקרובים ביותר
    const closestReports = reports
      .filter(r => r.report_date >= selectedDate.toISOString().split('T')[0])
      .sort((a, b) => a.report_date.localeCompare(b.report_date))
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
            name="bar-chart-outline" 
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
        <TouchableOpacity
          style={{
            marginTop: 24,
            paddingHorizontal: 28,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: DesignTokens.colors.background.secondary
          }}
          onPress={loadEarningsReports}
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
      {/* ניווט תאריכים - SwiftUI style */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <UICard
          variant="blur"
          padding="md"
          style={{
            borderRadius: 20,
            marginBottom: 12,
          }}
        >
          {/* שורה עליונה - ניווט תאריכים */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: 8
          }}>
            {/* חץ שמאל - יום קודם */}
            <TouchableOpacity
              onPress={goToPreviousDay}
              activeOpacity={1}
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: DesignTokens.colors.background.tertiary
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
                  color: DesignTokens.colors.success.main,
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
              activeOpacity={1}
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: DesignTokens.colors.background.tertiary
              }}
            >
              <ChevronRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* שורה תחתונה - כפתור היום בלבד */}
          {selectedDate.toDateString() !== new Date().toDateString() && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}>
              <TouchableOpacity
                onPress={goToToday}
                activeOpacity={1}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: `${DesignTokens.colors.primary.main}26`
                }}
              >
                <Text style={{
                  fontSize: 12,
                  color: DesignTokens.colors.success.main,
                  fontWeight: '600'
                }}>
                  היום
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </UICard>
      </View>

      {/* רשימת דיווחים */}
      <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
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
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        // אופטימיזציות ביצועים
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={10}
        removeClippedSubviews={false}
        />
      </View>
      
      {/* כפתור גלילה לראש */}
      {showScrollToTop && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 90,
            right: 16,
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
          <TouchableOpacity
            onPress={scrollToTop}
            activeOpacity={0.8}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: DesignTokens.colors.background.secondary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: DesignTokens.colors.border.primary,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 6,
            }}
          >
            <ChevronUp size={22} color={DesignTokens.colors.text.primary} strokeWidth={2.3} />
          </TouchableOpacity>
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
  console.log('📊 EarningsDetailSheet: visible =', visible, 'report =', report?.code);
  
  const getSurpriseColor = (percent: number | null): string => {
    if (!percent) return DesignTokens.colors.text.secondary;
    if (percent > 0) return '#00D84A';
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

  const getLogoUrl = (symbol: string): string => {
    const cleanSymbol = getSymbolDisplay(symbol);
    return `https://cdn.brandfetch.io/${cleanSymbol}?c=1idgv-PUKssFHXQBcKA`;
  };


  const getTimeDisplay = (beforeAfterMarket: string | null): string => {
    if (!beforeAfterMarket) return 'טרם נקבע';
    if (beforeAfterMarket === 'BeforeMarket') return 'מסחר מוקדם';
    if (beforeAfterMarket === 'AfterMarket') return 'מסחר מאוחר';
    return beforeAfterMarket;
  };

  const getTimeIcon = (beforeAfterMarket: string | null) => {
    if (!beforeAfterMarket) {
      return { icon: Clock, color: DesignTokens.colors.text.secondary, text: 'טרם נקבע' };
    }
    if (beforeAfterMarket === 'BeforeMarket') {
      return { icon: Sun, color: '#d1a11d', text: 'מסחר מוקדם' };
    }
    if (beforeAfterMarket === 'AfterMarket') {
      return { icon: Moon, color: '#007AFF', text: 'מסחר מאוחר' };
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
    
    // המרת צבע hex ל-rgba
    const hexToRgba = (hex: string, alpha: number = 1): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (result) {
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      return backgroundColor;
    };
    
    const bgRgba = hexToRgba(backgroundColor, 1);
    const gridColor = hexToRgba(backgroundColor, 0);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${backgroundColor};
      overflow: hidden;
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
  <div class="tradingview-widget-container" style="height:400px;width:100%">
    <div class="tradingview-widget-container__widget" style="flex:1;min-height:0;width:100%"></div>
    <div class="tradingview-widget-copyright" style="display:none;visibility:hidden;height:0;overflow:hidden;">
      <a href="https://il.tradingview.com/symbols/${symbolForChart}/" rel="noopener nofollow" target="_blank">
        <span class="blue-text">Track all markets on TradingView</span>
      </a>
    </div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
    {
      "allow_symbol_change": true,
      "calendar": false,
      "details": false,
      "hide_side_toolbar": true,
      "hide_top_toolbar": true,
      "hide_legend": true,
      "hide_volume": true,
      "hotlist": false,
      "interval": "3",
      "locale": "he_IL",
      "save_image": false,
      "style": "2",
      "symbol": "${symbolForChart}",
      "theme": "dark",
      "timezone": "Asia/Jerusalem",
      "backgroundColor": "${bgRgba}",
      "gridColor": "${gridColor}",
      "watchlist": [],
      "withdateranges": false,
      "compareSymbols": [],
      "studies": [],
      "autosize": false,
      "height": 400,
      "width": "100%"
    }
    </script>
  </div>
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
  const IconComponent = timeInfo.icon;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.9]}
      showHandle={true}
      enablePanDownToClose={true}
      backdropOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        {/* כפתור סגירה */}
        <View style={{ position: 'absolute', top: 8, right: 12, zIndex: 100 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: DesignTokens.colors.overlay,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Ionicons 
              name="close" 
              size={20} 
              color={DesignTokens.colors.text.primary} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          style={{ direction: 'rtl' }}
        >
          {/* כותרת - לוגו + טיקר + שם חברה */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 6 }}>
              <Image
                source={{ uri: getLogoUrl(report.code) }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  marginLeft: 12,
                  backgroundColor: DesignTokens.colors.background.tertiary
                }}
                onError={(error) => {
                  console.log('Logo load error for', report.code, error);
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: 20, 
                  fontWeight: '700', 
                  color: DesignTokens.colors.text.primary,
                  marginBottom: 2
                }}>
                  {getSymbolDisplay(report.code)}
                </Text>
                {(report.company_name || report.asset_name) && (
                  <Text style={{ 
                    fontSize: 13, 
                    color: DesignTokens.colors.text.secondary,
                    fontWeight: '500'
                  }}>
                    {report.company_name || report.asset_name}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* פרטי דיווח */}
          <View style={{ paddingHorizontal: 12 }}>
            {/* גרף TradingView */}
            <View style={{ 
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 10,
              paddingTop: 4,
              paddingBottom: 8,
              paddingHorizontal: 8,
              marginBottom: 6,
              height: 400
            }}>
              <WebView
                source={{ html: getTradingViewChartHTML(report.code, DesignTokens.colors.background.secondary, report.earnings_date_time, report.before_after_market, (report as any).exchange) }}
                style={{ 
                  flex: 1,
                  backgroundColor: DesignTokens.colors.background.secondary,
                  borderRadius: 8,
                  height: 392
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>

            {/* רווחיות (EPS) */}
            <View style={{ 
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 10,
              paddingTop: 8,
              paddingBottom: 12,
              paddingHorizontal: 12,
              marginBottom: 8,
              marginTop: -12
            }}>
              <Text style={{ 
                fontSize: 12, 
                color: DesignTokens.colors.text.tertiary,
                marginBottom: 6,
                fontWeight: '600',
                textAlign: 'center'
              }}>
                רווחיות למניה (EPS)
              </Text>
              
              {/* פס הפרדה */}
              <View style={{ height: 1, backgroundColor: DesignTokens.colors.background.tertiary, marginBottom: 10 }} />
              
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'flex-start',
                width: '100%'
              }}>
                {/* תחזית */}
                {(report.estimate || report.eps_estimate) && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ 
                      fontSize: 11, 
                      color: DesignTokens.colors.text.tertiary, 
                      marginBottom: 6,
                      fontWeight: '500'
                    }}>
                      תחזית
                    </Text>
                    <Text style={{ 
                      fontSize: 22, 
                      fontWeight: '700', 
                      color: DesignTokens.colors.text.primary
                    }}>
                      ${typeof report.estimate === 'number' ? report.estimate.toFixed(2) : 
                        typeof report.eps_estimate === 'number' ? report.eps_estimate.toFixed(2) :
                        typeof report.eps_estimate === 'string' ? parseFloat(report.eps_estimate).toFixed(2) : '0.00'}
                    </Text>
                  </View>
                )}

                {/* פס הפרדה אנכי */}
                {(report.estimate || report.eps_estimate) && report.actual !== null && report.actual !== 0 && (
                  <View style={{ width: 1, height: 60, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 12 }} />
                )}

                {/* תוצאה */}
                {report.actual !== null && report.actual !== 0 && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ 
                      fontSize: 11, 
                      color: DesignTokens.colors.text.tertiary, 
                      marginBottom: 6,
                      fontWeight: '500'
                    }}>
                      תוצאה
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginLeft: 4 }}>
                      <Text style={{ 
                        fontSize: 22, 
                        fontWeight: '700', 
                        color: surpriseColor,
                        marginLeft: 6
                      }}>
                        ${report.actual.toFixed(2)}
                      </Text>
                      {calculatedPercent !== null && calculatedPercent !== undefined && (
                        <Text style={{ 
                          fontSize: 12, 
                          fontWeight: '600', 
                          color: surpriseColor,
                          marginLeft: 6
                        }}>
                          {calculatedPercent > 0 ? '+' : ''}{calculatedPercent.toFixed(1)}%
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* פס הפרדה אנכי - רק אם אין תוצאה אבל יש תחזית */}
                {(!report.actual || report.actual === 0) && (report.estimate || report.eps_estimate) && (
                  <View style={{ width: 1, height: 45, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 12 }} />
                )}

                {/* ערך קודם - רק אם אין תוצאה אבל יש תחזית */}
                {(!report.actual || report.actual === 0) && (report.estimate || report.eps_estimate) && (report as any).eps_prior !== null && (report as any).eps_prior !== undefined && (
                  <>
                    <View style={{ width: 1, height: 45, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 12 }} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ 
                        fontSize: 11, 
                        color: DesignTokens.colors.text.tertiary, 
                        marginBottom: 6,
                        fontWeight: '500'
                      }}>
                        תקופה קודמת
                      </Text>
                      <Text style={{ 
                        fontSize: 22, 
                        fontWeight: '700', 
                        color: DesignTokens.colors.text.secondary
                      }}>
                        ${(report as any).eps_prior.toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* הכנסות (Revenue) */}
            {(report.revenue_estimate || report.revenue_estimate_avg || report.revenue_actual) && (
              <View style={{ 
                backgroundColor: DesignTokens.colors.background.secondary,
                borderRadius: 10,
                paddingTop: 8,
                paddingBottom: 12,
                paddingHorizontal: 12,
                marginBottom: 8,
                marginTop: -12
              }}>
                <Text style={{ 
                  fontSize: 12, 
                  color: DesignTokens.colors.text.tertiary,
                  marginBottom: 6,
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  הכנסות (Revenue)
                </Text>
                
                {/* פס הפרדה */}
                <View style={{ height: 1, backgroundColor: DesignTokens.colors.background.tertiary, marginBottom: 10 }} />
                
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'flex-start',
                  width: '100%'
                }}>
                  {/* תחזית */}
                  {(report.revenue_estimate || report.revenue_estimate_avg) && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ 
                        fontSize: 11, 
                        color: DesignTokens.colors.text.tertiary, 
                        marginBottom: 6,
                        fontWeight: '500'
                      }}>
                        תחזית
                      </Text>
                      <Text style={{ 
                        fontSize: 22, 
                        fontWeight: '700', 
                        color: DesignTokens.colors.text.primary
                      }}>
                        {formatRevenue(
                          report.revenue_estimate || report.revenue_estimate_avg || 0
                        )}
                      </Text>
                    </View>
                  )}

                  {/* פס הפרדה אנכי */}
                  {(report.revenue_estimate || report.revenue_estimate_avg) && report.revenue_actual !== null && report.revenue_actual !== 0 && (
                    <View style={{ width: 1, height: 60, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 12 }} />
                  )}

                  {/* תוצאה */}
                  {report.revenue_actual !== null && report.revenue_actual !== 0 && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ 
                        fontSize: 11, 
                        color: DesignTokens.colors.text.tertiary, 
                        marginBottom: 6,
                        fontWeight: '500'
                      }}>
                        תוצאה
                      </Text>
                      {(() => {
                        // חישוב surprise percent אם לא קיים (כמו בכרטיסיה)
                        let revenuePercent = report.revenue_surprise_percent;
                        if ((revenuePercent === null || revenuePercent === undefined) && report.revenue_actual !== null && report.revenue_actual !== undefined && report.revenue_actual !== 0 && (report.revenue_estimate || report.revenue_estimate_avg)) {
                          const estimate = typeof report.revenue_estimate === 'number' ? report.revenue_estimate :
                                         typeof report.revenue_estimate_avg === 'number' ? report.revenue_estimate_avg : null;
                          if (estimate !== null && estimate !== 0 && report.revenue_actual !== null && report.revenue_actual !== undefined) {
                            revenuePercent = ((report.revenue_actual - estimate) / Math.abs(estimate)) * 100;
                          }
                        }
                        const revenueColor = getSurpriseColor(revenuePercent ?? null);
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginLeft: 6 }}>
                            <Text style={{ 
                              fontSize: 22, 
                              fontWeight: '700', 
                              color: revenueColor,
                              marginLeft: 4
                            }}>
                              {formatRevenue(report.revenue_actual)}
                            </Text>
                            {revenuePercent !== null && revenuePercent !== undefined && (
                              <Text style={{ 
                                fontSize: 12, 
                                fontWeight: '600', 
                                color: revenueColor,
                                marginLeft: 6
                              }}>
                                {revenuePercent > 0 ? '+' : ''}{revenuePercent.toFixed(1)}%
                              </Text>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* פס הפרדה אנכי - רק אם אין תוצאה אבל יש תחזית */}
                  {(!report.revenue_actual || report.revenue_actual === 0) && (report.revenue_estimate || report.revenue_estimate_avg) && (
                    <View style={{ width: 1, height: 45, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 12 }} />
                  )}

                  {/* ערך קודם - רק אם אין תוצאה אבל יש תחזית */}
                  {(!report.revenue_actual || report.revenue_actual === 0) && (report.revenue_estimate || report.revenue_estimate_avg) && (report as any).revenue_estimate_year_ago !== null && (report as any).revenue_estimate_year_ago !== undefined && (
                    <>
                      <View style={{ width: 1, height: 45, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 12 }} />
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ 
                          fontSize: 11, 
                          color: DesignTokens.colors.text.tertiary, 
                          marginBottom: 6,
                          fontWeight: '500'
                        }}>
                          תקופה קודמת
                        </Text>
                        <Text style={{ 
                          fontSize: 22, 
                          fontWeight: '700', 
                          color: DesignTokens.colors.text.secondary
                        }}>
                          {formatRevenue((report as any).revenue_estimate_year_ago)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* תאריכים - קומפקטי יותר */}
            <View style={{ 
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 10,
              padding: 12,
              margin: -4
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                  תאריך דיווח:
                </Text>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
                  {new Date(report.report_date).toLocaleDateString('he-IL')}
                </Text>
              </View>
              {/* זמן דיווח - מסחר מוקדם/מאוחר */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                  זמן דיווח:
                </Text>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
                  {getTimeDisplay(report.before_after_market)}
                </Text>
              </View>
              {/* שעה מדויקת - זמן ישראל */}
              {report.earnings_date_time && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                    שעה מדויקת (זמן ישראל):
                  </Text>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
                    {(() => {
                      const date = new Date(report.earnings_date_time);
                      const formatter = new Intl.DateTimeFormat('he-IL', {
                        timeZone: 'Asia/Jerusalem',
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });
                      return formatter.format(date);
                    })()}
                  </Text>
                </View>
              )}
              {report.date && report.date !== report.report_date && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                    תקופת דיווח:
                  </Text>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
                    {new Date(report.date).toLocaleDateString('he-IL')}
                  </Text>
                </View>
              )}
              {/* רבעון */}
              {(report.period || report.period_year) && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                    רבעון:
                  </Text>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
                    {report.period || `Q${Math.floor((new Date(report.report_date).getMonth() / 3) + 1)}`} {report.period_year || new Date(report.report_date).getFullYear()}
                  </Text>
                </View>
              )}
              {/* חשיבות */}
              {report.importance && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                    חשיבות:
                  </Text>
                  <Text style={{ 
                    fontSize: 12, 
                    color: report.importance >= 4 ? '#FFC107' : DesignTokens.colors.text.primary, 
                    fontWeight: '600' 
                  }}>
                    {report.importance}
                  </Text>
                </View>
              )}
            </View>


          </View>
        </ScrollView>
      </View>
    </BottomSheet>
  );
};
