import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import FearAndGreedMiniCard from '../../../components/News/FearAndGreedMiniCard';
import {
  getTradingViewHeatmapHTML,
  type HeatmapKind,
} from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';
import { MarketsEmbedSwitcher } from '../components/MarketsEmbedSwitcher';
import type { SegmentedOption } from '../components/MarketsSegmentedControl';

export function MarketsHeatmapsTab() {
  const tokens = useDesignTokens();
  const [heatmapType, setHeatmapType] = useState<HeatmapKind>('sp500');

  const heatmapHtml = useMemo(() => getTradingViewHeatmapHTML(heatmapType), [heatmapType]);

  const hp = tokens.layout.screenPadding;

  const heatmapSegments: SegmentedOption<HeatmapKind>[] = useMemo(
    () => [
      { id: 'sp500', label: 'S&P 500' },
      { id: 'nasdaq', label: 'נאסד״ק' },
      { id: 'crypto', label: 'קריפטו' },
    ],
    []
  );

  return (
    <View style={{ flex: 1, minHeight: 0, paddingHorizontal: hp }}>
      <View style={{ marginBottom: tokens.spacing.md }}>
        <FearAndGreedMiniCard />
      </View>

      <View style={{ marginBottom: tokens.spacing.sm }}>
        <MarketsEmbedSwitcher
          options={heatmapSegments}
          value={heatmapType}
          onChange={setHeatmapType}
          accessibilityGroupLabel="מפת חום"
        />
      </View>

      <UICard
        variant="blur"
        padding="none"
        style={{ flex: 1, ...tokens.shadows.lg, minHeight: 0 }}
        contentContainerStyle={{ flex: 1, minHeight: 0 }}
      >
        <View style={{ flex: 1, borderRadius: tokens.borderRadius.lg, overflow: 'hidden', minHeight: 0 }}>
          <MarketsTradingView
            html={heatmapHtml}
            instanceKey={`heatmap-${heatmapType}`}
            flexFill
          />
        </View>
      </UICard>
    </View>
  );
}
