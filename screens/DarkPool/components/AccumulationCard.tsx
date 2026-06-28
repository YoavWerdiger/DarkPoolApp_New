/**
 * כרטיס צבירה — קרוסלה אופקית, UICard glass.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { TopAccumulationRow } from '../../../types/darkpool.types';
import { formatPercent, formatUsdCompact } from '../utils/darkPoolFormat';

interface AccumulationCardProps {
  row: TopAccumulationRow;
  onPress?: (ticker: string) => void;
}

const CARD_WIDTH = 168;

export function AccumulationCard({ row, onPress }: AccumulationCardProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const positive = row.net_flow_3d > 0;
  const valueColor = positive
    ? tokens.colors.primary.main
    : tokens.colors.text.danger;

  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          void HapticFeedback.selection();
          onPress(row.ticker);
        }
      }}
      style={{ width: CARD_WIDTH }}
      accessibilityRole="button"
    >
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="sm"
        style={styles.card}
      >
        <View style={styles.rtl}>
          <View style={styles.top}>
            <TickerLogo symbol={row.ticker} size={32} borderRadius={8} />
            <Text style={styles.ticker}>{row.ticker}</Text>
          </View>
          <Text style={styles.label}>נטו 3 ימים</Text>
          <Text style={[styles.value, { color: valueColor }]}>
            {(positive ? '+' : '')}
            {formatUsdCompact(row.net_flow_3d)}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>יחס ק/מ</Text>
              <Text style={styles.statValue}>{formatPercent(row.net_flow_ratio, 0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>לווייתנים</Text>
              <Text style={styles.statValue}>{row.whales_3d}</Text>
            </View>
          </View>
        </View>
      </UICard>
    </Pressable>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    rtl: { direction: 'rtl' },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    ticker: {
      fontSize: 16,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    value: {
      marginTop: 2,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    statsRow: {
      marginTop: tokens.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stat: { flex: 1, alignItems: 'flex-start' },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    statValue: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: tokens.colors.border.subtle,
    },
  });
}
