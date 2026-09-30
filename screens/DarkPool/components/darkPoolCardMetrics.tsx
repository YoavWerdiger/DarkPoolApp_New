import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';

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
      direction: 'rtl',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.divider,
    },
    cell: {
      minWidth: '30%',
      flexGrow: 1,
      alignItems: 'stretch',
    },
    label: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      fontWeight: DARK_POOL_TYPE.cardMetricLabel.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    value: {
      marginTop: 3,
      fontSize: DARK_POOL_TYPE.cardMetricValueSecondary.fontSize,
      lineHeight: DARK_POOL_TYPE.cardMetricValueSecondary.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardMetricValueSecondary.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'right',
    },
  });
}

export function darkPoolHeaderStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    header: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
    },
    headerMain: {
      flex: 1,
      minWidth: 0,
      alignItems: 'stretch',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    ticker: {
      fontSize: DARK_POOL_TYPE.cardTitle.fontSize,
      lineHeight: DARK_POOL_TYPE.cardTitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      letterSpacing: -0.4,
      writingDirection: 'ltr',
    },
    subtitle: {
      ...darkPoolPhysicalRightText,
      marginTop: 2,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: tokens.colors.background.navChrome,
    },
    badgeText: {
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      lineHeight: DARK_POOL_TYPE.caption2.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption2.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'rtl',
    },
    scoreBox: {
      alignItems: 'center',
      minWidth: 44,
    },
    scoreNum: {
      fontSize: DARK_POOL_TYPE.sectionTitle.fontSize,
      lineHeight: DARK_POOL_TYPE.sectionTitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.sectionTitle.fontWeight,
      letterSpacing: -0.5,
      writingDirection: 'ltr',
    },
    scoreLbl: {
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      fontWeight: DARK_POOL_TYPE.caption2.fontWeight,
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    reason: {
      ...darkPoolPhysicalRightText,
      marginTop: 8,
      fontSize: DARK_POOL_TYPE.sectionSubtitle.fontSize,
      lineHeight: DARK_POOL_TYPE.sectionSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.sectionSubtitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
  });
}
