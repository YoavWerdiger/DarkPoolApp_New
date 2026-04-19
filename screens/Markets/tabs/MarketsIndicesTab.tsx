import React, { useMemo } from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { getTradingViewMarketOverviewHTML } from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = { mainTabsHeight: number };

export function MarketsIndicesTab({ mainTabsHeight }: Props) {
  const tokens = useDesignTokens();

  const marketOverviewHtml = useMemo(() => getTradingViewMarketOverviewHTML(tokens), [tokens]);

  const styles = useMemo(
    () => ({
      widgetCard: {
        marginTop: tokens.spacing.xs,
        marginBottom: tokens.spacing.lg,
      },
      widgetTitle: {
        fontSize: tokens.typography.titleSmall.size,
        fontWeight: tokens.typography.fontWeight.bold as '700',
        color: tokens.colors.text.primary,
        textAlign: 'right' as const,
        marginBottom: tokens.spacing.sm,
      },
    }),
    [tokens]
  );

  return (
    <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: tokens.spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <UICard variant="blur" padding="md" style={{ ...styles.widgetCard, ...tokens.shadows.lg }}>
          <Text style={styles.widgetTitle}>מדדים ועתידיים</Text>
          <View style={{ borderRadius: tokens.borderRadius.lg, overflow: 'hidden' }}>
            <MarketsTradingView
              html={marketOverviewHtml}
              instanceKey="market-overview"
              height={SCREEN_HEIGHT * 0.45}
            />
          </View>
        </UICard>
      </ScrollView>
    </View>
  );
}
