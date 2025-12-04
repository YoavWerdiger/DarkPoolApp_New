import React, { useState, ErrorInfo, ReactNode, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useDesignTokens } from '../../components/ui/DesignTokens';

// קומפוננטים פנימיים
import BreakingNewsTab from './BreakingNewsTab';
import EconomicCalendarTab from './EconomicCalendarTab';
import EarningsReportsTab from './EarningsReportsTab';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ NewsScreen Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#121212' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 10 }}>
            שגיאה בטעינת המסך
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
            {this.state.error?.message || 'שגיאה לא ידועה'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function NewsScreen() {
  console.log('📰 NewsScreen: Component mounted/rendering...');
  const DesignTokens = useDesignTokens();
  const [activeTab, setActiveTab] = useState<'breaking' | 'calendar' | 'earnings'>('breaking');
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    console.log('📰 NewsScreen: useEffect - Component mounted');
    // דיליי קטן כדי לוודא שהמסך נטען
    setTimeout(() => {
      setIsReady(true);
      console.log('📰 NewsScreen: Component is ready');
    }, 100);
    return () => {
      console.log('📰 NewsScreen: useEffect - Component unmounted');
    };
  }, []);

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

  console.log('📰 NewsScreen: About to render, activeTab:', activeTab, 'isReady:', isReady);
  
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignTokens.colors.background.primary }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={{ color: DesignTokens.colors.text.secondary, marginTop: 16 }}>
          טוען...
        </Text>
      </View>
    );
  }
  
  return (
    <View 
      style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}
    >
      <StatusBar style="light" backgroundColor={DesignTokens.colors.background.primary} />
      
      {/* Header */}
      <View style={{ 
        backgroundColor: DesignTokens.colors.background.secondary,
        borderBottomLeftRadius: DesignTokens.borderRadius.lg,
        borderBottomRightRadius: DesignTokens.borderRadius.lg,
        overflow: 'hidden',
      }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DesignTokens.colors.background.secondary }}>
          <View style={{ 
            paddingHorizontal: DesignTokens.spacing.lg,
            paddingTop: DesignTokens.spacing.md,
            paddingBottom: DesignTokens.spacing.md,
          }}>
            <Text style={{ 
              fontSize: DesignTokens.typography.fontSize['2xl'],
              fontWeight: DesignTokens.typography.fontWeight.bold,
              color: DesignTokens.colors.text.primary,
              textAlign: 'right',
            }}>
              חדשות פיננסיות
            </Text>
            <Text style={{ 
              fontSize: DesignTokens.typography.fontSize.base,
              fontWeight: DesignTokens.typography.fontWeight.normal,
              color: DesignTokens.colors.text.secondary,
              textAlign: 'right',
              marginTop: DesignTokens.spacing.xs,
            }}>
              כל אירוע פיננסי שסוחר צריך - בזמן אמת
            </Text>
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView 
        style={{ 
          flex: 1,
          backgroundColor: DesignTokens.colors.background.primary,
        }}
        edges={[]}
      >

        {/* טאבים */}
        <View style={{ 
          paddingHorizontal: DesignTokens.spacing.lg, 
          paddingTop: DesignTokens.spacing.md,
          marginBottom: DesignTokens.spacing.md 
        }}>
          <View style={{ 
            flexDirection: 'row',
            backgroundColor: DesignTokens.colors.background.secondary,
            borderRadius: 30,
            padding: 4,
            alignSelf: 'center',
            width: '100%',
            maxWidth: 400
          }}>
            {tabs.map((tab, index) => {
              const isActive = activeTab === tab.id;
              return (
              <TouchableOpacity
                key={`tab-${tab.id}-${index}`}
                onPress={() => {
                  console.log(`📰 NewsScreen: Switching to tab ${tab.id}`);
                  setActiveTab(tab.id);
                }}
                activeOpacity={1}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 26,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginHorizontal: 2
                }}
              >
                {isActive && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 26,
                      backgroundColor: `${DesignTokens.colors.primary.main}14`,
                    }}
                  />
                )}
                <Text style={{ 
                  fontSize: 14,
                  fontWeight: isActive ? '700' : '600',
                  color: isActive ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                  position: 'relative',
                  zIndex: 1
                }}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        {/* תוכן הטאב הפעיל עם Error Boundary */}
        <View style={{ flex: 1 }}>
          <ErrorBoundary>
            <ActiveComponent />
          </ErrorBoundary>
        </View>
      </SafeAreaView>
    </View>
  );
}
