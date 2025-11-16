import React, { useState, useEffect, useCallback } from 'react';
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
  TextInput,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Clock, Sun, Moon, ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import EarningsService, { EarningsReport } from '../../services/earningsService';
import { supabase } from '../../lib/supabase';
import UIBottomSheet from '../../components/ui/UIBottomSheet';

const EarningsReportCard: React.FC<{ 
  report: EarningsReport; 
  onPress: (report: EarningsReport) => void 
}> = ({ report, onPress }) => {
  const DesignTokens = useDesignTokens();
  
  // פונקציה לקבלת צבע לפי surprise
  const getSurpriseColor = (percent: number | null): string => {
    if (!percent) return DesignTokens.colors.text.secondary;
    if (percent > 0) return '#00D84A'; // ירוק
    if (percent < 0) return DesignTokens.colors.danger.main; // אדום
    return DesignTokens.colors.text.secondary; // אפור
  };


  // פונקציה לעיצוב זמן
  const getTimeDisplay = (beforeAfterMarket: string | null): string => {
    if (!beforeAfterMarket) return 'טרם נקבע';
    if (beforeAfterMarket === 'BeforeMarket') return 'לפני פתיחה';
    if (beforeAfterMarket === 'AfterMarket') return 'אחרי סגירה';
    return beforeAfterMarket;
  };

  // פונקציה לקבלת אייקון וצבע לזמן
  const getTimeIcon = (beforeAfterMarket: string | null) => {
    if (!beforeAfterMarket) {
      return { icon: Clock, color: DesignTokens.colors.text.secondary, text: 'טרם נקבע' };
    }
    if (beforeAfterMarket === 'BeforeMarket') {
      return { icon: Sun, color: '#d1a11d', text: 'לפני פתיחה' }; // צהוב זהב
    }
    if (beforeAfterMarket === 'AfterMarket') {
      return { icon: Moon, color: '#007AFF', text: 'אחרי סגירה' }; // כחול בהיר יותר
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
    <Pressable
      onPress={() => onPress(report)}
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: DesignTokens.colors.background.secondary,
        flexDirection: 'row',
        alignItems: 'flex-start'
      }}
    >
      {/* פס צבע משמאל */}
      <View style={{ 
        position: 'absolute', 
        left: 0, 
        top: 0, 
        bottom: 0, 
        width: 3, 
        backgroundColor: getSurpriseColor(report.percent), 
        borderTopLeftRadius: 12, 
        borderBottomLeftRadius: 12 
      }} />

      {/* תוכן משמאל */}
      <View style={{ flex: 1, alignItems: 'flex-start', marginLeft: 12 }}>
        {/* שורה עליונה - לוגו + טיקר + זמן */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
          {/* לוגו + טיקר */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
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
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '700', 
              color: DesignTokens.colors.text.primary,
              lineHeight: 28
            }}>
              {getSymbolDisplay(report.code)}
            </Text>
          </View>

          {/* זמן דיווח */}
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
                paddingVertical: 6,
                borderRadius: 20
              }}>
                <IconComponent 
                  size={12} 
                  color={timeInfo.color || '#00D84A'} 
                  strokeWidth={2} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={{ 
                  fontSize: 12, 
                  color: timeInfo.color || '#00D84A',
                  fontWeight: '600'
                }}>
                  {timeInfo.text}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* בלוק ערכים - ללא מסגרות, עם פסי הפרדה */}
        {(report.estimate || report.actual) && (
          <View style={{ marginTop: 12, width: '100%' }}>
            {/* פס הפרדה אופקי עליון */}
            <View style={{ height: 1, backgroundColor: DesignTokens.colors.background.tertiary, marginBottom: 12 }} />
            
            <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', width: '100%' }}>
              {/* תוצאה */}
              {report.actual !== null && report.actual !== 0 && (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 6, fontWeight: '500', textAlign: 'center' }}>
                    תוצאה
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: getSurpriseColor(report.percent), textAlign: 'center' }}>
                    ${report.actual.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* פס הפרדה אנכי */}
              {report.actual !== null && report.actual !== 0 && report.estimate && (
                <View style={{ width: 1, height: 40, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 16, alignSelf: 'flex-start', marginTop: 0 }} />
              )}

              {/* תחזית */}
              {report.estimate && (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 6, fontWeight: '500', textAlign: 'center' }}>
                    תחזית
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: DesignTokens.colors.text.primary, textAlign: 'center' }}>
                    ${report.estimate.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* פס הפרדה אנכי */}
              {report.percent !== null && report.actual !== null && report.actual !== 0 && (
                <View style={{ width: 1, height: 40, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 16, alignSelf: 'flex-start', marginTop: 0 }} />
              )}

              {/* Surprise % */}
              {report.percent !== null && report.actual !== null && report.actual !== 0 && (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginBottom: 6, fontWeight: '500', textAlign: 'center' }}>
                    הפתעה
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: getSurpriseColor(report.percent), textAlign: 'center' }}>
                    {report.percent > 0 ? '+' : ''}{report.percent.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
      
    </Pressable>
  );
};

export default function EarningsReportsTab() {
  const DesignTokens = useDesignTokens();
  const [reports, setReports] = useState<EarningsReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<EarningsReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedReport, setSelectedReport] = useState<EarningsReport | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      let dateReports = EarningsService.filterByDate(allReports, selectedDateStr);
      console.log(`📊 Reports for selected date: ${dateReports.length}`);
      
      // סינון לפי חיפוש
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toUpperCase();
        dateReports = dateReports.filter(report => 
          report.code.toUpperCase().includes(query)
        );
        console.log(`🔍 Filtered by search "${searchQuery}": ${dateReports.length} reports`);
      }
      
      // מיון: BeforeMarket מעל AfterMarket
      const sortedReports = dateReports.sort((a, b) => {
        // BeforeMarket ראשון
        if (a.before_after_market === 'BeforeMarket' && b.before_after_market !== 'BeforeMarket') return -1;
        if (a.before_after_market !== 'BeforeMarket' && b.before_after_market === 'BeforeMarket') return 1;
        // AfterMarket שני
        if (a.before_after_market === 'AfterMarket' && b.before_after_market !== 'AfterMarket') return -1;
        if (a.before_after_market !== 'AfterMarket' && b.before_after_market === 'AfterMarket') return 1;
        // שאר הדיווחים אחרון
        return 0;
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
  }, [selectedDate, searchQuery]);

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
    
    // בדיקה אם צריך להוסיף מרווח - מעבר מ-BeforeMarket ל-AfterMarket
    const showSpacer = currentType === 'AfterMarket' && prevType === 'BeforeMarket';
    
    return (
      <>
        {/* מרווח בין לפני פתיחה לאחרי סגירה */}
        {showSpacer && (
          <View style={{ height: 24 }} />
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

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 }}>
        <View 
          style={{ 
            width: 120, 
            height: 120, 
            borderRadius: 60, 
            backgroundColor: `${DesignTokens.colors.success.main}1A`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24
          }}
        >
          <Ionicons 
            name="bar-chart-outline" 
            size={56} 
            color={DesignTokens.colors.success.main} 
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
          {isToday ? 'אין דיווחי תוצאות היום' : 'אין דיווחי תוצאות'}
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
            backgroundColor: `${DesignTokens.colors.success.main}26`,
            borderColor: `${DesignTokens.colors.success.main}4D`
          }}
          onPress={loadEarningsReports}
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
        <View style={{ 
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginBottom: 12
        }}>
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
        </View>

        {/* סרגל חיפוש */}
        <View style={{ 
          marginTop: -1,
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 4,
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={{
                padding: 6,
                borderRadius: 12,
                backgroundColor: DesignTokens.colors.background.tertiary,
                marginLeft: 8
              }}
            >
              <X size={16} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="חפש לפי טיקר..."
            placeholderTextColor={DesignTokens.colors.text.tertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              flex: 1,
              fontSize: 15,
              color: DesignTokens.colors.text.primary,
              paddingHorizontal: 12,
              paddingVertical: 10,
              textAlign: 'right',
              fontWeight: '500'
            }}
          />
          <Search size={18} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
        </View>
      </View>

      {/* רשימת דיווחים */}
      <FlatList
        data={filteredReports}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item, index }) => renderReport({ item, index })}
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
        contentContainerStyle={{ paddingBottom: 24 }}
      />

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
    if (beforeAfterMarket === 'BeforeMarket') return 'לפני פתיחה';
    if (beforeAfterMarket === 'AfterMarket') return 'אחרי סגירה';
    return beforeAfterMarket;
  };

  const getTimeIcon = (beforeAfterMarket: string | null) => {
    if (!beforeAfterMarket) {
      return { icon: Clock, color: DesignTokens.colors.text.secondary, text: 'טרם נקבע' };
    }
    if (beforeAfterMarket === 'BeforeMarket') {
      return { icon: Sun, color: '#d1a11d', text: 'לפני פתיחה' };
    }
    if (beforeAfterMarket === 'AfterMarket') {
      return { icon: Moon, color: '#007AFF', text: 'אחרי סגירה' };
    }
    return { icon: Clock, color: DesignTokens.colors.text.secondary, text: beforeAfterMarket };
  };

  const surpriseColor = getSurpriseColor(report.percent);
  const timeInfo = getTimeIcon(report.before_after_market);
  const IconComponent = timeInfo.icon;

  return (
    <UIBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      dragToClose={true}
    >
      <View style={{ flex: 1 }}>
        {/* כפתור סגירה */}
        <View style={{ position: 'absolute', top: 8, left: 12, zIndex: 100 }}>
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
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* כותרת - לוגו + טיקר */}
          <View style={{ paddingHorizontal: 16, paddingTop: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Image
                source={{ uri: getLogoUrl(report.code) }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  marginRight: 12,
                  backgroundColor: DesignTokens.colors.background.tertiary
                }}
                onError={(error) => {
                  console.log('Logo load error for', report.code, error);
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: 24, 
                  fontWeight: '700', 
                  color: DesignTokens.colors.text.primary,
                  marginBottom: 4
                }}>
                  {getSymbolDisplay(report.code)}
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: DesignTokens.colors.text.secondary,
                  fontWeight: '500'
                }}>
                  דיווח רבעוני
                </Text>
              </View>
            </View>

            {/* זמן דיווח */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              backgroundColor: DesignTokens.colors.background.tertiary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              alignSelf: 'flex-start'
            }}>
              <IconComponent 
                size={14} 
                color={timeInfo.color} 
                strokeWidth={2} 
                style={{ marginRight: 8 }} 
              />
              <Text style={{ 
                fontSize: 13, 
                color: timeInfo.color,
                fontWeight: '600'
              }}>
                {timeInfo.text}
              </Text>
            </View>
          </View>

          {/* פרטי דיווח */}
          <View style={{ paddingHorizontal: 16 }}>
            {/* תאריכים */}
            <View style={{ 
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16
            }}>
              <Text style={{ 
                fontSize: 12, 
                color: DesignTokens.colors.text.tertiary,
                marginBottom: 8,
                fontWeight: '500'
              }}>
                תאריכים
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: DesignTokens.colors.text.secondary }}>
                  תאריך דיווח:
                </Text>
                <Text style={{ fontSize: 13, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
                  {new Date(report.report_date).toLocaleDateString('he-IL')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: DesignTokens.colors.text.secondary }}>
                  תקופת דיווח:
                </Text>
                <Text style={{ fontSize: 13, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
                  {new Date(report.date).toLocaleDateString('he-IL')}
                </Text>
              </View>
            </View>

            {/* רווחיות (EPS) */}
            <View style={{ 
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16
            }}>
              <Text style={{ 
                fontSize: 13, 
                color: DesignTokens.colors.text.tertiary,
                marginBottom: 16,
                fontWeight: '600',
                textAlign: 'center'
              }}>
                רווחיות למניה (EPS)
              </Text>
              
              {/* פס הפרדה */}
              <View style={{ height: 1, backgroundColor: DesignTokens.colors.background.tertiary, marginBottom: 16 }} />
              
              <View style={{ 
                flexDirection: 'row-reverse', 
                alignItems: 'flex-start',
                width: '100%'
              }}>
                {/* תוצאה */}
                {report.actual !== null && report.actual !== 0 && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ 
                      fontSize: 12, 
                      color: DesignTokens.colors.text.tertiary, 
                      marginBottom: 8,
                      fontWeight: '500'
                    }}>
                      תוצאה
                    </Text>
                    <Text style={{ 
                      fontSize: 24, 
                      fontWeight: '700', 
                      color: surpriseColor
                    }}>
                      ${report.actual.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* פס הפרדה אנכי */}
                {report.actual !== null && report.actual !== 0 && report.estimate && (
                  <View style={{ width: 1, height: 50, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 16 }} />
                )}

                {/* תחזית */}
                {report.estimate && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ 
                      fontSize: 12, 
                      color: DesignTokens.colors.text.tertiary, 
                      marginBottom: 8,
                      fontWeight: '500'
                    }}>
                      תחזית
                    </Text>
                    <Text style={{ 
                      fontSize: 24, 
                      fontWeight: '700', 
                      color: DesignTokens.colors.text.primary
                    }}>
                      ${report.estimate.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* פס הפרדה אנכי */}
                {report.percent !== null && report.actual !== null && report.actual !== 0 && (
                  <View style={{ width: 1, height: 50, backgroundColor: DesignTokens.colors.background.tertiary, marginHorizontal: 16 }} />
                )}

                {/* Surprise % */}
                {report.percent !== null && report.actual !== null && report.actual !== 0 && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ 
                      fontSize: 12, 
                      color: DesignTokens.colors.text.tertiary, 
                      marginBottom: 8,
                      fontWeight: '500'
                    }}>
                      הפתעה
                    </Text>
                    <Text style={{ 
                      fontSize: 24, 
                      fontWeight: '700', 
                      color: surpriseColor
                    }}>
                      {report.percent > 0 ? '+' : ''}{report.percent.toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </UIBottomSheet>
  );
};
