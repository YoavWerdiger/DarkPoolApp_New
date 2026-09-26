import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import FearAndGreedMiniCard from '../../../components/News/FearAndGreedMiniCard';
import {
  getTradingViewHeatmapHTML,
  type HeatmapKind,
} from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';
import { HapticFeedback } from '../../../utils/hapticFeedback';

const HEATMAP_TABS: { id: HeatmapKind; label: string }[] = [
  { id: 'sp500', label: 'S&P 500' },
  { id: 'nasdaq', label: 'נאסד״ק' },
  { id: 'crypto', label: 'קריפטו' },
];

function HeatmapTabToggle({
  value,
  onChange,
}: {
  value: HeatmapKind;
  onChange: (tab: HeatmapKind) => void;
}) {
  const tokens = useDesignTokens();
  const pad = tokens.layout?.screenPadding ?? 20;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row-reverse',
        paddingHorizontal: pad,
        paddingBottom: tokens.spacing.md,
        backgroundColor: 'transparent',
      }}
    >
      {HEATMAP_TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              if (!active) void HapticFeedback.selection();
              onChange(tab.id);
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={`מפת חום: ${tab.label}`}
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingTop: tokens.spacing.sm,
              backgroundColor: 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: tokens.typography.body.size,
                fontWeight: active
                  ? (tokens.typography.fontWeight.bold as '700')
                  : (tokens.typography.fontWeight.medium as '500'),
                color: active
                  ? tokens.colors.text.primary
                  : tokens.colors.text.secondary,
                backgroundColor: 'transparent',
              }}
            >
              {tab.label}
            </Text>
            <View
              style={{
                marginTop: 8,
                height: 2,
                alignSelf: 'stretch',
                marginHorizontal: 12,
                backgroundColor: active ? tokens.colors.text.primary : 'transparent',
              }}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function MarketsHeatmapsTab() {
  const tokens = useDesignTokens();
  const [heatmapType, setHeatmapType] = useState<HeatmapKind>('sp500');

  const heatmapHtml = useMemo(() => getTradingViewHeatmapHTML(heatmapType), [heatmapType]);

  const hp = tokens.layout.screenPadding;

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ paddingHorizontal: hp, marginBottom: tokens.spacing.md }}>
        <FearAndGreedMiniCard />
      </View>

      <HeatmapTabToggle value={heatmapType} onChange={setHeatmapType} />

      <View style={{ flex: 1, minHeight: 0, paddingHorizontal: hp }}>
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
    </View>
  );
}
