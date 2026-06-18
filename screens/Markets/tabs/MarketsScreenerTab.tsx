import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { getTradingViewScreenerHTML, type ScreenerKind } from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';
import { MarketsEmbedSwitcher } from '../components/MarketsEmbedSwitcher';
import type { SegmentedOption } from '../components/MarketsSegmentedControl';

export function MarketsScreenerTab() {
  const tokens = useDesignTokens();
  const [screenerType, setScreenerType] = useState<ScreenerKind>('sp500');

  const screenerHtml = useMemo(() => getTradingViewScreenerHTML(screenerType), [screenerType]);

  const hp = tokens.layout.screenPadding;

  const screenerSegments: SegmentedOption<ScreenerKind>[] = useMemo(
    () => [
      { id: 'sp500', label: 'S&P 500' },
      { id: 'nasdaq', label: 'נאסד״ק' },
      { id: 'crypto', label: 'קריפטו' },
    ],
    []
  );

  return (
    <View style={{ flex: 1, minHeight: 0, paddingHorizontal: hp }}>
      <View style={{ marginBottom: tokens.spacing.sm }}>
        <MarketsEmbedSwitcher
          options={screenerSegments}
          value={screenerType}
          onChange={setScreenerType}
          accessibilityGroupLabel="סורק"
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
            html={screenerHtml}
            instanceKey={`screener-${screenerType}`}
            flexFill
          />
        </View>
      </UICard>
    </View>
  );
}
