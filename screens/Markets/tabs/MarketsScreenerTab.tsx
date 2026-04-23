import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { getTradingViewScreenerHTML, type ScreenerKind } from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';
import { MarketsSegmentedControl } from '../components/MarketsSegmentedControl';

const SCREENER_SEGMENTS: { id: ScreenerKind; label: string }[] = [
  { id: 'crypto', label: 'קריפטו' },
  { id: 'nasdaq', label: 'Nasdaq' },
  { id: 'sp500', label: 'S&P500' },
];

export function MarketsScreenerTab() {
  const tokens = useDesignTokens();
  const [screenerType, setScreenerType] = useState<ScreenerKind>('sp500');

  const screenerHtml = useMemo(() => getTradingViewScreenerHTML(screenerType), [screenerType]);

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
          options={SCREENER_SEGMENTS}
          value={screenerType}
          onChange={setScreenerType}
          accessibilityGroupLabel="סורק"
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
            html={screenerHtml}
            instanceKey={`screener-${screenerType}`}
            flexFill
          />
        </View>
      </UICard>
    </View>
  );
}
