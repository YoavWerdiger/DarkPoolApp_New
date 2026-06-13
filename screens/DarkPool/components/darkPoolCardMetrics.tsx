import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { useDesignTokens } from '../../../components/ui/DesignTokens';

export function DarkPoolMetricsGrid({
  children,
  tokens,
}: {
  children: React.ReactNode;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  const styles = createMetricStyles(tokens);
  return <View style={styles.grid}>{children}</View>;
}

export function DarkPoolMetricCell({
  label,
  value,
  valueColor,
  tokens,
}: {
  label: string;
  value: string;
  valueColor?: string;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  const styles = createMetricStyles(tokens);
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function createMetricStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.colors.border.subtle,
    },
    cell: {
      minWidth: '30%',
      flexGrow: 1,
      alignItems: 'flex-start',
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    value: {
      marginTop: 3,
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
  });
}

export function darkPoolHeaderStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
    },
    headerMain: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    ticker: {
      fontSize: 17,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      letterSpacing: -0.4,
      writingDirection: 'ltr',
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'left',
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: tokens.colors.primary.dim,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: tokens.colors.primary.main,
      writingDirection: 'rtl',
    },
    scoreBox: {
      alignItems: 'center',
      minWidth: 44,
    },
    scoreNum: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.5,
      writingDirection: 'ltr',
    },
    scoreLbl: {
      fontSize: 10,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    reason: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 19,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'left',
    },
  });
}
