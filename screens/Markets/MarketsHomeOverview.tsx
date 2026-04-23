import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import FearAndGreedCard from '../../components/News/FearAndGreedCard';
import { MarketsIndicesCard } from './tabs/MarketsIndicesTab';

/**
 * סקירת שווקים — מדדים (TradingView) ואחריהם כרטיס מדד הפחד והתאווה עם כותרת בכרטיס.
 */
export function MarketsHomeOverview() {
  const tokens = useDesignTokens();
  const hp = tokens.layout.screenPadding;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingHorizontal: hp,
        paddingTop: tokens.spacing.sm,
        paddingBottom: tokens.spacing['2xl'],
      }}
      showsVerticalScrollIndicator={false}
    >
      <MarketsIndicesCard />

      <View style={{ marginTop: tokens.spacing.md, marginBottom: tokens.spacing.sm }}>
        <FearAndGreedCard
          initialExpanded
          disableToggle
          fullWidth
          cardPadding="none"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
