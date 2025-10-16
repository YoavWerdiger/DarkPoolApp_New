import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Ionicons הוסר כאן כי הבורר ללא אייקונים
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../components/ui/DesignTokens';

// קומפוננטים פנימיים
import BreakingNewsTab from './BreakingNewsTab';
import EconomicCalendarTab from './EconomicCalendarTab';
import EarningsReportsTab from './EarningsReportsTab';

export default function NewsScreen() {
  const [activeTab, setActiveTab] = useState<'breaking' | 'calendar' | 'earnings'>('breaking');
  const [pressedTab, setPressedTab] = useState<'breaking' | 'calendar' | 'earnings' | null>(null);

  const tabs = [
    {
      id: 'breaking' as const,
      title: 'חדשות מתפרצות',
      icon: 'newspaper',
      component: BreakingNewsTab
    },
    {
      id: 'calendar' as const,
      title: 'יומן כלכלי',
      icon: 'calendar-sharp',
      component: EconomicCalendarTab
    },
    {
      id: 'earnings' as const,
      title: 'דיווחים רבעוניים',
      icon: 'trending-up',
      component: EarningsReportsTab
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || BreakingNewsTab;

  return (
    <View 
      className="flex-1"
      style={{ backgroundColor: DesignTokens.colors.background.primary }}
    >
      <StatusBar style="light" backgroundColor={DesignTokens.colors.background.primary} />
      
      {/* רקע גרדיאנט הוסר כאן כדי שה-Header לא יושפע */}
      
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          {/* גרדיאנט בהדר בלבד */}
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.14)', 'rgba(0, 230, 84, 0.06)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 136 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
            <Text style={{ 
              fontSize: 22, 
              fontWeight: '800',
              color: DesignTokens.colors.text.primary,
              textAlign: 'right',
              letterSpacing: 0.2
            }}>
              חדשות פיננסיות
            </Text>
          </View>
          {/* קו הפרדה תחתון */}
        </View>

        {/* טאבים - ממורכז ומסודר */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={{ 
            flexDirection: 'row',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: 18,
            padding: 4,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
            alignSelf: 'center',
            width: '100%',
            maxWidth: 400
          }}>
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                onPressIn={() => setPressedTab(tab.id)}
                onPressOut={() => setPressedTab(null)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: pressedTab === tab.id && activeTab !== tab.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginHorizontal: 2
                }}
              >
                {activeTab === tab.id ? (
                  <LinearGradient
                    colors={['#00D84A', '#00A85A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 14
                    }}
                  />
                ) : null}
                <Text style={{ 
                  fontSize: 14,
                  fontWeight: activeTab === tab.id ? '700' : '600',
                  color: activeTab === tab.id ? '#FFFFFF' : DesignTokens.colors.text.secondary,
                  textAlign: 'center',
                  writingDirection: 'rtl'
                }}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6 }} />
        {/* תוכן הטאב הפעיל */}
        <View className="flex-1">
          <ActiveComponent />
        </View>
      </SafeAreaView>
    </View>
    
  );
  
} 