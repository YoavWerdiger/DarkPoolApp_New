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

type Props = { mainTabsHeight: number };

export function MarketsScreenerTab({ mainTabsHeight }: Props) {
  const tokens = useDesignTokens();
  const [screenerType, setScreenerType] = useState<ScreenerKind>('sp500');

  const screenerHtml = useMemo(() => getTradingViewScreenerHTML(screenerType), [screenerType]);

  return (
    <View style={{ flex: 1, paddingHorizontal: tokens.spacing.lg, marginBottom: mainTabsHeight - 12 }}>
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
