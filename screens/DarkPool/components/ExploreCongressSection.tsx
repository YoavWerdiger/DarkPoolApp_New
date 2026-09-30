import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';
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
      ...darkPoolPhysicalRightText,
      fontSize: APP_TYPE.sectionTitle.fontSize,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      ...darkPoolPhysicalRightText,
      marginTop: APP_LAYOUT.titleSubtitleGap,
      fontSize: APP_TYPE.cardSubtitle.fontSize,
      lineHeight: APP_TYPE.cardSubtitle.lineHeight,
      fontWeight: APP_TYPE.cardSubtitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
    row: {
      flexDirection: 'row-reverse',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: 12,
      paddingBottom: 4,
    },
  });
}
