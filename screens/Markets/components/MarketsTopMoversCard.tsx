import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { getTradingViewHotListsHTML } from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from './MarketsTradingView';

/**
 * כרטיס "המניות הזזות" — Top Gainers / Top Losers / Most Active
 * מתוך TradingView Hot Lists. אותו סגנון של `MarketsIndicesCard`.
 */
export function MarketsTopMoversCard() {
  const tokens = useDesignTokens();
  const { height: winH } = useWindowDimensions();

  const hotListsHtml = useMemo(() => getTradingViewHotListsHTML(tokens), [tokens]);

  const chartHeight = useMemo(() => {
    return Math.round(Math.min(Math.max(winH * 0.45, 320), winH * 0.55));
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
        <Text style={styles.title}>מה זז היום בשוק</Text>
      </View>
      <View style={{ width: '100%', overflow: 'hidden' }}>
        <MarketsTradingView
          html={hotListsHtml}
          instanceKey="market-hotlists"
          height={chartHeight}
        />
      </View>
    </UICard>
  );
}
