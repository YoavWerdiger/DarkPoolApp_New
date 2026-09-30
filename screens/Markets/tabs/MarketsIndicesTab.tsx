import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { getTradingViewMarketOverviewHTML } from '../embeds/tradingViewEmbeds';
import { MARKETS_LAYOUT, marketsCardTitleStyle, UI_CARD_RADIUS } from '../marketsLayout';
import { MarketsTradingView } from '../components/MarketsTradingView';

/** כרטיס מדדים — כותרת קומפקטית, הווידג'ט ברוחב מלא של הכרטיס (ללא «מסגרת» פנימית סביב TradingView) */
export function MarketsIndicesCard() {
  const tokens = useDesignTokens();
  const { height: winH } = useWindowDimensions();

  const marketOverviewHtml = useMemo(() => getTradingViewMarketOverviewHTML(tokens), [tokens]);

  const chartHeight = useMemo(() => {
    // Markets screen — give the indices/futures chart more vertical room.
    return Math.round(Math.min(Math.max(winH * 0.55, 360), winH * 0.65));
  }, [winH]);

  const styles = useMemo(
    () => ({
      card: {
        marginTop: 0,
        marginBottom: MARKETS_LAYOUT.cardStackGap,
        borderRadius: UI_CARD_RADIUS,
        overflow: 'hidden' as const,
        backgroundColor: tokens.colors.background.cardSolid,
      },
      title: {
        ...marketsCardTitleStyle,
        color: tokens.colors.text.primary,
      },
      titlePad: {
        paddingHorizontal: MARKETS_LAYOUT.cardPadding,
        paddingTop: MARKETS_LAYOUT.cardPadding,
        paddingBottom: MARKETS_LAYOUT.cardTitleToBodyGap,
      },
    }),
    [tokens]
  );

  return (
    <UICard variant="soft" padding="none" style={styles.card}>
      <View style={styles.titlePad}>
        <Text style={styles.title}>מדדים וחוזים עתידיים</Text>
      </View>
      <View style={{ width: '100%', overflow: 'hidden' }}>
        <MarketsTradingView
          html={marketOverviewHtml}
          instanceKey="market-overview"
          height={chartHeight}
        />
      </View>
    </UICard>
  );
}
