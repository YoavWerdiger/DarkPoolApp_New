import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { CongressTradeCard } from '../../../services/darkpool/uwExploreService';
import { ExploreCongressCard } from './ExploreCongressCard';

interface Props {
  title: string;
  subtitle?: string;
  trades: CongressTradeCard[];
  onTradePress?: (trade: CongressTradeCard) => void;
}

export function ExploreCongressSection({
  title,
  subtitle,
  trades,
  onTradePress,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  if (!trades.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {trades.map((t) => (
          <ExploreCongressCard
            key={t.id}
            trade={t}
            onPress={onTradePress ? () => onTradePress(t) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: { marginBottom: tokens.spacing.lg },
    header: {
      paddingHorizontal: tokens.layout.screenPadding,
      marginBottom: tokens.spacing.sm,
      alignItems: 'flex-end',
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    row: {
      flexDirection: 'row-reverse',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: 12,
      paddingBottom: 4,
    },
  });
}
