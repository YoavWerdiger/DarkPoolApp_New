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
import { MARKETS_LAYOUT, MARKETS_TYPE, UI_CARD_RADIUS } from '../marketsLayout';
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
  const pad = MARKETS_LAYOUT.screenPaddingHorizontal;

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
                fontSize: MARKETS_TYPE.body.fontSize,
                lineHeight: MARKETS_TYPE.body.lineHeight,
                fontWeight: active
                  ? MARKETS_TYPE.sectionTitle.fontWeight
                  : MARKETS_TYPE.groupLabel.fontWeight,
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

  const hp = MARKETS_LAYOUT.screenPaddingHorizontal;

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ paddingHorizontal: hp, marginBottom: tokens.spacing.md }}>
        <FearAndGreedMiniCard />
      </View>

      <HeatmapTabToggle value={heatmapType} onChange={setHeatmapType} />

      <View style={{ flex: 1, minHeight: 0, paddingHorizontal: hp }}>
        <UICard
          variant="soft"
          padding="none"
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: UI_CARD_RADIUS,
            backgroundColor: tokens.colors.background.cardSolid,
          }}
          contentContainerStyle={{ flex: 1, minHeight: 0 }}
        >
          <View style={{ flex: 1, borderRadius: UI_CARD_RADIUS, overflow: 'hidden', minHeight: 0 }}>
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
