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
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Clock, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { DesignTokens } from '../../components/ui/DesignTokens';
import EarningsService, { EarningsReport } from '../../services/earningsService';
import { supabase } from '../../lib/supabase';

const EarningsReportCard: React.FC<{ 
  report: EarningsReport; 
  onPress: (report: EarningsReport) => void 
}> = ({ report, onPress }) => {
  
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

  // פונקציה לחשב רבעון מתאריך
  const getQuarterFromDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    
    let quarter = 'Q1';
    if (month >= 1 && month <= 3) quarter = 'Q1';
    else if (month >= 4 && month <= 6) quarter = 'Q2';
    else if (month >= 7 && month <= 9) quarter = 'Q3';
    else if (month >= 10 && month <= 12) quarter = 'Q4';
    
    return `${quarter} ${year}`;
  };

  return (
    <Pressable
      onPress={() => onPress(report)}
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        paddingVertical: 16,
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
      {/* פס צבע לפי surprise */}
      <View style={{ 
        position: 'absolute', 
        right: 0, 
        top: 0, 
        bottom: 0, 
        width: 3, 
        backgroundColor: getSurpriseColor(report.percent), 
        borderTopRightRadius: 18, 
        borderBottomRightRadius: 18 
      }} />

      {/* כותרת - לוגו + טיקר + רבעון */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, justifyContent: 'space-between' }}>
        
        {/* צד שמאל - לוגו + טיקר */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* לוגו החברה */}
          <Image
            source={{ uri: getLogoUrl(report.code) }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              marginRight: 10,
              backgroundColor: 'rgba(255,255,255,0.1)'
            }}
            onError={(error) => {
              console.log('Logo load error for', report.code, error);
            }}
          />
          
          {/* סימבול */}
          <Text style={{ 
            fontSize: 18, 
            fontWeight: '700', 
            color: DesignTokens.colors.text.primary
          }}>
            {getSymbolDisplay(report.code)}
          </Text>
        </View>
        
        {/* צד ימין - רבעון */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ 
            fontSize: 11, 
            fontWeight: '500', 
            marginTop: 5,
            color: DesignTokens.colors.text.tertiary,
            marginBottom: 2
          }}>
            דיווח רבעוני
          </Text>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '700', 
            color: DesignTokens.colors.text.primary
          }}>
            {getQuarterFromDate(report.date)}
          </Text>
        </View>
        
      </View>

      {/* זמן מתחת לתמונה והטיקר - עם אייקון */}
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {(() => {
          const timeInfo = getTimeIcon(report.before_after_market);
          const IconComponent = timeInfo.icon;
          
          return (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              backgroundColor: timeInfo.color === '#d1a11d' ? 'rgba(209, 161, 29, 0.15)' : 
                              timeInfo.color === '#007AFF' ? 'rgba(0, 122, 255, 0.15)' : 
                              'rgba(255,255,255,0.06)',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16
            }}>
              <IconComponent 
                size={12} 
                color={timeInfo.color} 
                strokeWidth={2} 
                style={{ marginRight: 6 }} 
              />
              <Text style={{ 
                fontSize: 12, 
                color: timeInfo.color,
                fontWeight: '600'
              }}>
                {timeInfo.text}
              </Text>
            </View>
          );
        })()}
      </View>

      {/* בלוק ערכים - EarningsHub Style */}
      <View style={{ flexDirection: 'row-reverse', marginTop: 8, gap: 8 }}>
        
        {/* הכנסות - תחזית או תוצאה */}
        <View style={{ 
          flex: 1, 
          paddingVertical: 8, 
          paddingHorizontal: 8, 
          borderRadius: 8, 
          backgroundColor: 'rgba(255,255,255,0.06)', 
          borderWidth: 1, 
          borderColor: 'rgba(255,255,255,0.1)', 
          alignItems: 'center' 
        }}>
          <Text style={{ fontSize: 10, color: DesignTokens.colors.text.tertiary, marginBottom: 2, fontWeight: '500' }}>
            {(report.actual && report.actual !== 0) ? 'הכנסות' : 'תחזית הכנסות'}
          </Text>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '700', 
            color: (report.actual && report.actual !== 0) ? getSurpriseColor(report.percent) : DesignTokens.colors.text.secondary
          }}>
            {(report.actual && report.actual !== 0) ? '$87.5B' : '$85.2B'}
          </Text>
        </View>
        
        {/* רווחיות - תחזית או תוצאה */}
        <View style={{ 
          flex: 1, 
          paddingVertical: 8, 
          paddingHorizontal: 8, 
          borderRadius: 8, 
          backgroundColor: 'rgba(255,255,255,0.06)', 
          borderWidth: 1, 
          borderColor: 'rgba(255,255,255,0.1)', 
          alignItems: 'center' 
        }}>
          <Text style={{ fontSize: 10, color: DesignTokens.colors.text.tertiary, marginBottom: 2, fontWeight: '500' }}>
            {(report.actual && report.actual !== 0) ? 'רווחיות' : 'תחזית רווחיות'}
          </Text>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '700', 
            color: (report.actual && report.actual !== 0) ? getSurpriseColor(report.percent) : DesignTokens.colors.text.secondary
          }}>
            {(report.actual && report.actual !== 0) ? report.actual.toFixed(2) : (report.estimate ? report.estimate.toFixed(2) : '1.25')}
          </Text>
        </View>
        
      </View>

      {/* Surprise - קטן ונקי - רק אם יש תוצאות אמיתיות */}
      {report.percent && report.actual && report.actual !== 0 && (
        <View style={{ 
          marginTop: 8, 
          paddingVertical: 6, 
          paddingHorizontal: 10, 
          borderRadius: 8, 
          backgroundColor: getSurpriseColor(report.percent) === '#00D84A' 
            ? 'rgba(0, 216, 74, 0.08)' 
            : 'rgba(255, 59, 48, 0.08)', 
          borderWidth: 1, 
          borderColor: getSurpriseColor(report.percent), 
          alignItems: 'center' 
        }}>
          <Text style={{ 
            fontSize: 11, 
            fontWeight: '600', 
            color: getSurpriseColor(report.percent)
          }}>
            {report.percent > 0 ? '+' : ''}{report.percent.toFixed(1)}%
          </Text>
        </View>
      )}
      
    </Pressable>
  );
};

export default function EarningsReportsTab() {
  const [reports, setReports] = useState<EarningsReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<EarningsReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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
      console.log('📈 EarningsReportsTab: Loading earnings reports for date:', selectedDate.toISOString().split('T')[0]);
      setLoading(true);
      
      // שליפה אחת של כל הנתונים
      const allReports = await EarningsService.getAll();
      console.log('📊 Loaded all reports:', allReports.length);
      
      // סינון לפי התאריך הנבחר
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      const dateReports = EarningsService.filterByDate(allReports, selectedDateStr);
      
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
      console.log(`   BeforeMarket: ${beforeCount}, AfterMarket: ${afterCount}, NULL: ${nullCount}`);
      
      setReports(allReports); // שמירת כל הנתונים
      setFilteredReports(sortedReports); // הצגת דיווחי התאריך הנבחר ממוינים
      
    } catch (error) {
      console.error('❌ EarningsReportsTab: Error loading reports:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את דיווחי התוצאות');
      setReports([]);
      setFilteredReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    setRefreshing(true);
    
    // קודם כל, רענן את הנתונים מהשרת (אם אפשר)
    try {
      await EarningsService.refreshData();
    } catch (error) {
      console.log('⚠️ Could not refresh from server, loading from cache');
    }
    
    // ואז טען את הנתונים מהטבלה
    await loadEarningsReports();
  }, [loadEarningsReports]);

  // בחירת דיווח
  const handleReportPress = useCallback((report: EarningsReport) => {
    console.log('📈 EarningsReportsTab: Report pressed:', report.code);
    Alert.alert(
      `${report.code.replace('.US', '')} - דיווח תוצאות`,
      `תאריך דיווח: ${report.report_date}\nתקופה: ${report.date}\nזמן: ${report.before_after_market || 'טרם נקבע'}`,
      [
        { text: 'סגור', style: 'cancel' },
        { text: 'פרטים נוספים', onPress: () => console.log('פתיחת פרטים') }
      ]
    );
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Ionicons 
          name="bar-chart-outline" 
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
          {isToday ? 'אין דיווחי תוצאות היום' : `אין דיווחי תוצאות ב${dateStr}`}
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
            ? 'השווקים רגועים היום - אין דיווחי תוצאות מתוכננים'
            : `לא נמצאו דיווחי תוצאות בתאריך זה`
          }{'\n'}מקור: EODHD API - נתונים אמיתיים
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 20,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 20,
            backgroundColor: '#00D84A'
          }}
          onPress={loadEarningsReports}
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
                  טוען דיווחי תוצאות...
                </Text>
              </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* ניווט יומי */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        {/* כפתור חזרה להיום - מעל הניווט */}
        {selectedDate.toDateString() !== new Date().toDateString() && (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity
              onPress={goToToday}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#00D84A',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Ionicons 
                name="today" 
                size={22} 
                color="white" 
              />
            </TouchableOpacity>
          </View>
        )}

        {/* ניווט תאריכים */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12
        }}>
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
