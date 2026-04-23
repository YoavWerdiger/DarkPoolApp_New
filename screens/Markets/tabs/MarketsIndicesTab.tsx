import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { getTradingViewMarketOverviewHTML } from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';

/** כרטיס מדדים — כותרת קומפקטית, הווידג'ט ברוחב מלא של הכרטיס (ללא «מסגרת» פנימית סביב TradingView) */
export function MarketsIndicesCard() {
  const tokens = useDesignTokens();
  const { height: winH } = useWindowDimensions();

  const marketOverviewHtml = useMemo(() => getTradingViewMarketOverviewHTML(tokens), [tokens]);

  const chartHeight = useMemo(() => {
    return Math.round(Math.min(Math.max(winH * 0.42, 260), winH * 0.52));
  }, [winH]);

  const styles = useMemo(
    () => ({
      card: {
        marginTop: 0,
        marginBottom: tokens.spacing.lg,
        borderRadius: tokens.borderRadius.lg,
        overflow: 'hidden' as const,
      },
      title: {
        fontSize: tokens.typography.titleSmall.size,
        fontWeight: tokens.typography.fontWeight.bold as '700',
        color: tokens.colors.text.primary,
        textAlign: 'center' as const,
        writingDirection: 'rtl' as const,
        width: '100%' as const,
      },
      titlePad: {
        paddingHorizontal: tokens.spacing.md,
        paddingTop: tokens.spacing.md,
        paddingBottom: tokens.spacing.sm,
        alignItems: 'center' as const,
      },
    }),
    [tokens]
  );

  return (
    <UICard variant="blur" padding="none" style={{ ...styles.card, ...tokens.shadows.lg }}>
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
