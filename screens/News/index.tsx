import React, { useState, ErrorInfo, ReactNode, useEffect } from 'react';
import { View, Text, ActivityIndicator, type TextStyle, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import BreakingNewsTab from './BreakingNewsTab';
import { NewsScreenShell } from './NewsScreenShell';

type ErrorBoundaryProps = {
  children: ReactNode;
  errorStyles: {
    container: ViewStyle;
    title: TextStyle;
    message: TextStyle;
  };
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean; error: Error | null }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      const { errorStyles } = this.props;
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>שגיאה בטעינת המסך</Text>
          <Text style={errorStyles.message}>{this.state.error?.message || 'שגיאה לא ידועה'}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * חדשות — רק חדשות מתפרצות. יומן כלכלי ודיווחי רווח במסכי מגירה נפרדים.
 */
export default function NewsScreen({ route }: { route?: any }) {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const [isReady, setIsReady] = useState(false);

  /** תאימות לאחור: params.tab מנווט למסכי המגירה */
  useEffect(() => {
    const tab = route?.params?.tab;
    if (tab === 'calendar') {
      (navigation as any).navigate('NewsCalendar');
    } else if (tab === 'earnings') {
      (navigation as any).navigate('NewsEarnings');
    }
  }, [route?.params?.tab, navigation]);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <NewsScreenShell title="חדשות">
      {!isReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={styles.loadingText}>טוען...</Text>
        </View>
      ) : (
        <ErrorBoundary errorStyles={styles.errorBoundary}>
          <BreakingNewsTab />
        </ErrorBoundary>
      )}
    </NewsScreenShell>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  ({
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
