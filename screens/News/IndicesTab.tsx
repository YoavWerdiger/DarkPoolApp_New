import React, { useMemo } from 'react';
import { View, Text, Dimensions, ScrollView } from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import UICard from '../../components/ui/UICard';
import FearAndGreedCard from '../../components/News/FearAndGreedCard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { getTradingViewMarketOverviewHTML } from '../Markets/embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../Markets/components/MarketsTradingView';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function IndicesTab() {
  const DesignTokens = useDesignTokens();
  const mainTabsHeight = useMainTabsHeight();
  const styles = useMemo(
    () => ({
      container: {
        flex: 1,
      },
      scrollContent: {
        paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        paddingTop: APP_LAYOUT.sectionHeaderToContent,
      },
      widgetCard: {
        marginTop: APP_LAYOUT.stackGapSmall,
        marginBottom: APP_LAYOUT.componentGap,
        borderRadius: UI_CARD_RADIUS,
      } as const,
      widgetTitle: {
        ...APP_TYPE.cardTitle,
        color: DesignTokens.colors.text.primary,
        textAlign: 'right' as const,
        marginBottom: APP_LAYOUT.cardTitleToBodyGap,
      },
      webviewContainer: {
        height: SCREEN_HEIGHT * 0.4,
        borderRadius: DesignTokens.borderRadius.md,
        overflow: 'hidden' as const,
      },
    }),
    [DesignTokens]
  );

  const widgetHtml = useMemo(
    () => getTradingViewMarketOverviewHTML(DesignTokens),
    [DesignTokens]
  );

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <UICard
            variant="soft"
            padding="md"
            style={styles.widgetCard}
          >
            <Text style={styles.widgetTitle}>מדדי שוק מרכזיים</Text>
            <View style={styles.webviewContainer}>
              <MarketsTradingView
                html={widgetHtml}
                instanceKey="news-indices-overview"
                height={SCREEN_HEIGHT * 0.4}
              />
            </View>
          </UICard>

          <FearAndGreedCard initialExpanded disableToggle fullWidth />
        </ScrollView>
      </View>
    </View>
  );
}
