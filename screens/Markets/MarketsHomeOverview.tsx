import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import FearAndGreedMiniCard from '../../components/News/FearAndGreedMiniCard';
import { MARKETS_LAYOUT } from './marketsLayout';
import { MarketsIndicesCard } from './tabs/MarketsIndicesTab';
import { MarketsTopMoversCard } from './components/MarketsTopMoversCard';

/**
 * סקירת שווקים — Fear & Greed מינימליסטי בראש, גרף מדדים וחוזים גבוה,
 * ולסיום כרטיס Top Gainers / Losers / Most Active.
 */
export function MarketsHomeOverview() {
  const tokens = useDesignTokens();

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingHorizontal: MARKETS_LAYOUT.screenPaddingHorizontal,
          paddingTop: MARKETS_LAYOUT.sectionHeaderToContent,
          paddingBottom: tokens.spacing['2xl'],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Fear & Greed — מינימליסטי, בראש העמוד */}
        <View style={{ marginBottom: MARKETS_LAYOUT.cardStackGap }}>
          <FearAndGreedMiniCard />
        </View>

        {/* Top Movers — מי זז היום בשוק (Gainers / Losers / Most Active) */}
        <MarketsTopMoversCard />

        {/* מדדים וחוזים עתידיים — גרף גבוה יותר */}
        <MarketsIndicesCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
