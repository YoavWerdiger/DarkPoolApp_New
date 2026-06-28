import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
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
            <UICard variant="glass" glassIntensity="light" padding="sm" style={styles.chip}>
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
      fontSize: 13,
      fontWeight: '700',
      color: tokens.colors.text.tertiary,
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
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    chipTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    ticker: {
      fontSize: 15,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    type: {
      fontSize: 11,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    call: { color: tokens.colors.primary.main },
    put: { color: tokens.colors.text.danger },
    prem: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    rule: {
      marginTop: 4,
      fontSize: 10,
      lineHeight: 14,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
  });
}
