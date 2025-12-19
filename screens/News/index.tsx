import React, { useState, ErrorInfo, ReactNode, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LinearGradient } from 'expo-linear-gradient';
import UICard from '../../components/ui/UICard';

// קומפוננטים פנימיים
import BreakingNewsTab from './BreakingNewsTab';
import EconomicCalendarTab from './EconomicCalendarTab';
import EarningsReportsTab from './EarningsReportsTab';
import IndicesTab from './IndicesTab';

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
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const [activeTab, setActiveTab] = useState<'indices' | 'breaking' | 'calendar' | 'earnings'>('indices');
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
      id: 'indices' as const,
      title: 'מדדים',
      icon: 'stats-chart',
      component: IndicesTab
    },
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
  
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        style={styles.gradientContainer}
      />
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        {/* כותרת */}
        <View style={styles.headerContainer}>
          <UICard variant="blur" padding="lg">
            <Text style={styles.headerTitle}>חדשות פיננסיות</Text>
            <Text style={styles.headerSubtitle}>
              כל אירוע פיננסי שסוחר צריך - בזמן אמת
            </Text>
          </UICard>
        </View>

        {/* טאבים */}
        <View style={styles.tabsContainer}>
          <UICard variant="blur" padding="none" style={styles.tabsCard}>
            <View style={styles.tabs}>
              {tabs.map((tab, index) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={`tab-${tab.id}-${index}`}
                    onPress={() => {
                      console.log(`📰 NewsScreen: Switching to tab ${tab.id}`);
                      setActiveTab(tab.id);
                    }}
                    activeOpacity={0.7}
                    style={styles.tab}
                  >
                    {isActive && <View style={styles.tabActiveIndicator} />}
                    <Text
                      style={[
                        styles.tabText,
                        isActive && styles.tabTextActive,
                      ]}
                    >
                      {tab.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </UICard>
        </View>

        {/* תוכן הטאב הפעיל עם Error Boundary */}
        <View style={styles.tabContent}>
          {!isReady ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              <Text style={styles.loadingText}>טוען...</Text>
            </View>
          ) : (
            <ErrorBoundary>
              <ActiveComponent />
            </ErrorBoundary>
          )}
        </View>
      </RNSafeAreaView>
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  ({
    gradientContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    safeAreaContainer: {
      flex: 1,
    },
    headerContainer: {
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.lg,
    },
    headerTitle: {
      fontSize: tokens.typography.fontSize['2xl'],
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    headerSubtitle: {
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      marginTop: tokens.spacing.xs,
    },
    tabsContainer: {
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    tabsCard: {
      borderRadius: 30,
      overflow: 'hidden',
      alignSelf: 'center',
      width: '100%',
      maxWidth: 400,
    },
    tabs: {
      flexDirection: 'row',
      padding: 4,
    },
    tab: {
      flex: 1,
      height: 44,
      borderRadius: 26,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 2,
      position: 'relative',
    },
    tabActiveIndicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 26,
      backgroundColor: `${tokens.colors.primary.main}14`,
    },
    tabText: {
      fontSize: 14,
      fontWeight: tokens.typography.fontWeight.medium as any,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      writingDirection: 'rtl' as any,
    },
    tabTextActive: {
      color: tokens.colors.primary.main,
      fontWeight: tokens.typography.fontWeight.bold as any,
    },
    tabContent: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: tokens.spacing.md,
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.secondary,
    },
  } as const);
