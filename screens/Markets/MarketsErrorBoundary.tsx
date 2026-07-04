import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string | null };

class MarketsErrorBoundaryInner extends Component<
  Props & { onGetStyles: () => { container: object; title: object; body: object } },
  State
> {
  constructor(props: Props & { onGetStyles: () => { container: object; title: object; body: object } }) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      const s = this.props.onGetStyles();
      return (
        <View style={s.container}>
          <Text style={s.title}>שגיאה בטעינת השווקים</Text>
          <Text style={s.body}>{this.state.message ?? 'נסה לחזור למסך מאוחר יותר.'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export function MarketsErrorBoundary({ children }: Props) {
  const tokens = useDesignTokens();
  const getStyles = () => ({
    container: {
      ...StyleSheet.absoluteFillObject,
      padding: tokens.spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: tokens.colors.background.primary,
    },
    title: {
      fontSize: tokens.typography.titleSmall.size,
      fontWeight: tokens.typography.fontWeight.bold as '700',
      color: tokens.colors.text.primary,
      textAlign: 'center',
      marginBottom: tokens.spacing.sm,
    },
    body: {
      fontSize: tokens.typography.bodySmall.size,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
  });

  return (
    <MarketsErrorBoundaryInner onGetStyles={getStyles}>
      {children}
    </MarketsErrorBoundaryInner>
  );
}
