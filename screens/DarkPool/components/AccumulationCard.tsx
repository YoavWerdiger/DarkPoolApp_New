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
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';

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
        variant="soft"
        glassIntensity="light"
        padding="sm"
        disableBlur
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
      borderRadius: UI_CARD_RADIUS,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    rtl: { direction: 'rtl' },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    ticker: {
      fontSize: APP_TYPE.cardTitle.fontSize,
      lineHeight: APP_TYPE.cardTitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    label: {
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      color: tokens.colors.text.tertiary,
      ...darkPoolPhysicalRightText,
    },
    value: {
      marginTop: 2,
      fontSize: APP_TYPE.cardMetricValueSecondary.fontSize,
      lineHeight: APP_TYPE.cardMetricValueSecondary.lineHeight,
      fontWeight: APP_TYPE.cardMetricValueSecondary.fontWeight,
      textAlign: 'right',
      writingDirection: 'ltr',
    },
    statsRow: {
      marginTop: tokens.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stat: { flex: 1, alignItems: 'stretch' },
    statLabel: {
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      color: tokens.colors.text.tertiary,
      ...darkPoolPhysicalRightText,
    },
    statValue: {
      marginTop: 2,
      fontSize: APP_TYPE.cardSubtitle.fontSize,
      lineHeight: APP_TYPE.cardSubtitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: tokens.colors.border.divider,
    },
  });
}
