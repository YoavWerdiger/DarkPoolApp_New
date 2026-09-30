import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { FlowAlertItem } from '../../../services/darkpool/uwSignalsService';
import { formatUsdCompact } from '../utils/darkPoolFormat';

interface Props {
  alerts: FlowAlertItem[];
  onTickerPress?: (ticker: string) => void;
}

export function FlowAlertStrip({ alerts, onTickerPress }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  if (!alerts.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>זרימת אופציות</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {alerts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              void HapticFeedback.selection();
              onTickerPress?.(a.ticker);
            }}
          >
            <UICard variant="soft" glassIntensity="light" padding="sm" disableBlur style={styles.chip}>
              <View style={styles.chipTop}>
                <TickerLogo symbol={a.ticker} size={28} borderRadius={8} />
                <Text style={styles.ticker}>{a.ticker}</Text>
              </View>
              <Text
                style={[
                  styles.type,
                  a.type === 'call' ? styles.call : styles.put,
                ]}
              >
                {a.type === 'call' ? 'קול' : 'פוט'}
              </Text>
              <Text style={styles.prem}>{formatUsdCompact(a.premium)}</Text>
              <Text style={styles.rule} numberOfLines={2}>
                {a.rule}
              </Text>
            </UICard>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: { marginBottom: tokens.spacing.lg },
    title: {
      fontSize: APP_TYPE.groupLabel.fontSize,
      lineHeight: APP_TYPE.groupLabel.lineHeight,
      fontWeight: APP_TYPE.groupLabel.fontWeight,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
      marginBottom: 8,
      writingDirection: 'rtl',
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 2,
    },
    chip: {
      width: 128,
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: 'transparent',
    },
    chipTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    ticker: {
      fontSize: APP_TYPE.cardTitle.fontSize,
      lineHeight: APP_TYPE.cardTitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    type: {
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      writingDirection: 'rtl',
    },
    call: { color: tokens.colors.primary.main },
    put: { color: tokens.colors.text.danger },
    prem: {
      marginTop: 4,
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    rule: {
      marginTop: 4,
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
  });
}
