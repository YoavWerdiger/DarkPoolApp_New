import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import {
  getTradingViewHeatmapHTML,
  type HeatmapKind,
} from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';
import { MarketsSegmentedControl } from '../components/MarketsSegmentedControl';

const HEATMAP_SEGMENTS: { id: HeatmapKind; label: string }[] = [
  { id: 'crypto', label: 'קריפטו' },
  { id: 'nasdaq', label: 'Nasdaq' },
  { id: 'sp500', label: 'S&P500' },
];

export function MarketsHeatmapsTab() {
  const tokens = useDesignTokens();
  const [heatmapType, setHeatmapType] = useState<HeatmapKind>('sp500');

  const heatmapHtml = useMemo(() => getTradingViewHeatmapHTML(heatmapType), [heatmapType]);

  const hp = tokens.layout.screenPadding;

  return (
    <View style={{ flex: 1, minHeight: 0, paddingHorizontal: hp }}>
      <UICard
        variant="blur"
        padding="none"
        style={{
          borderRadius: tokens.borderRadius['3xl'],
          overflow: 'hidden',
          marginBottom: tokens.spacing.md,
        }}
      >
        <MarketsSegmentedControl
          options={HEATMAP_SEGMENTS}
          value={heatmapType}
          onChange={setHeatmapType}
          accessibilityGroupLabel="מפת חום"
        />
      </UICard>

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
