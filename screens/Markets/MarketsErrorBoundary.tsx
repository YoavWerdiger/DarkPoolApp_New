import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { MARKETS_LAYOUT, MARKETS_TYPE } from './marketsLayout';

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
      ...StyleSheet.absoluteFill,
      padding: MARKETS_LAYOUT.screenPaddingHorizontal,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: tokens.colors.background.screen,
    },
    title: {
      fontSize: MARKETS_TYPE.sectionTitle.fontSize,
      fontWeight: MARKETS_TYPE.sectionTitle.fontWeight,
      lineHeight: MARKETS_TYPE.sectionTitle.lineHeight,
      letterSpacing: MARKETS_TYPE.sectionTitle.letterSpacing,
      color: tokens.colors.text.primary,
      textAlign: 'center' as const,
      marginBottom: MARKETS_LAYOUT.cardTitleToBodyGap,
    },
    body: {
      fontSize: MARKETS_TYPE.body.fontSize,
      fontWeight: MARKETS_TYPE.body.fontWeight,
      lineHeight: MARKETS_TYPE.body.lineHeight,
      color: tokens.colors.text.secondary,
      textAlign: 'center' as const,
    },
  });

  return (
    <MarketsErrorBoundaryInner onGetStyles={getStyles}>
      {children}
    </MarketsErrorBoundaryInner>
  );
}
