import React, { useState, ErrorInfo, ReactNode, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenGradientBackground } from '../../components/VideoBackground';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';

// קומפוננטים פנימיים
import BreakingNewsTab from './BreakingNewsTab';
import EconomicCalendarTab from './EconomicCalendarTab';
import EarningsReportsTab from './EarningsReportsTab';

type ErrorBoundaryProps = {
  children: ReactNode;
  errorStyles: {
    container: ViewStyle;
    title: TextStyle;
    message: TextStyle;
  };
};

// Error Boundary Component
class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean; error: Error | null }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  }

  render() {
    if (this.state.hasError) {
      const { errorStyles } = this.props;
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>
            שגיאה בטעינת המסך
          </Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'שגיאה לא ידועה'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function NewsScreen({ route }: { route?: any }) {
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  // deep-link מהתראה: route.params?.tab יכול להיות 'breaking' | 'calendar' | 'earnings'
  const initialTab: 'breaking' | 'calendar' | 'earnings' =
    route?.params?.tab === 'calendar' ? 'calendar'
    : route?.params?.tab === 'earnings' ? 'earnings'
    : 'breaking';

  const [activeTab, setActiveTab] = useState<'breaking' | 'calendar' | 'earnings'>(initialTab);
  const [isReady, setIsReady] = useState(false);

  // כשמגיע param חדש מהתראה (המסך כבר פתוח ב-background), עדכן את הטאב
  useEffect(() => {
    if (!route?.params?.tab) return;
    const incoming = route.params.tab;
    if (incoming === 'calendar' || incoming === 'earnings' || incoming === 'breaking') {
      setActiveTab(incoming);
    }
  }, [route?.params?.tab]);
  
  useEffect(() => {
    // דיליי קטן כדי לוודא שהמסך נטען
    setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => {
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

  return (
    <View style={{ flex: 1 }}>
      <ScreenGradientBackground style={styles.gradientContainer} />
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
            <ErrorBoundary errorStyles={styles.errorBoundary}>
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
      paddingHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.xl,
      paddingTop: tokens.spacing.lg,
    },
    headerTitle: {
      fontSize: tokens.typography.displayXs.size,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    headerSubtitle: {
      fontSize: tokens.typography.body.size,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      marginTop: tokens.spacing.xs,
    },
    tabsContainer: {
      paddingHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.xl,
      paddingTop: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    tabsCard: {
      borderRadius: tokens.borderRadius['3xl'],
      overflow: 'hidden',
      alignSelf: 'center',
      width: '100%',
      maxWidth: 400,
    },
    tabs: {
      flexDirection: 'row',
      padding: tokens.spacing.xs,
    },
    tab: {
      flex: 1,
      height: 44,
      borderRadius: tokens.borderRadius['3xl'],
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
      borderRadius: tokens.borderRadius['3xl'],
      backgroundColor: tokens.colors.background.cardSolid,
    },
    tabText: {
      fontSize: tokens.typography.bodySmall.size,
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
      fontSize: tokens.typography.body.size,
      color: tokens.colors.text.secondary,
    },
    errorBoundary: {
      container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacing.xl,
        backgroundColor: tokens.colors.background.primary,
      },
      title: {
        color: tokens.colors.text.primary,
        fontSize: tokens.typography.titleSmall.size,
        fontWeight: tokens.typography.fontWeight.semibold as any,
        marginBottom: tokens.spacing.sm,
        textAlign: 'center',
      },
      message: {
        color: tokens.colors.text.secondary,
        fontSize: tokens.typography.bodySmall.size,
        textAlign: 'center',
      },
    },
  } as const);
