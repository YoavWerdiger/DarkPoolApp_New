/**
 * מעטפת כרטיס פיד — מילוי cardSolid של הערכה הפעילה.
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  FEED_CARD_STACK_GAP,
  FEED_RHYTHM,
  TRADE_HERO_UICARD,
  tradeHeroGlassFrameStyle,
  tradeHeroInnerCardStyle,
} from './darkPoolFeedCardStyles';

const feedPadStyles = StyleSheet.create({
  feedCardStack: {
    paddingBottom: FEED_CARD_STACK_GAP,
  },
  feedCardPad: {
    direction: 'rtl',
    alignSelf: 'stretch',
    paddingHorizontal: FEED_RHYTHM.cardPadH,
    paddingVertical: FEED_RHYTHM.cardPadV,
  },
});

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  /** מסגרת ירוקה — קונפלוונס / סיגנל חזק */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  haptic?: boolean;
}

export function DarkPoolFeedCard({
  children,
  onPress,
  accent = false,
  style,
  accessibilityLabel,
  haptic = true,
}: Props) {
  const tokens = useDesignTokens();
  const frameStyle = tradeHeroGlassFrameStyle(tokens, { accent });

  return (
    <View style={feedPadStyles.feedCardStack}>
      <View style={frameStyle}>
        <UICard
          variant={TRADE_HERO_UICARD.variant}
          glassIntensity={TRADE_HERO_UICARD.glassIntensity}
          padding={TRADE_HERO_UICARD.padding}
          disableBlur={TRADE_HERO_UICARD.disableBlur}
          enableBlur={TRADE_HERO_UICARD.enableBlur}
          showGlassBorder={TRADE_HERO_UICARD.showGlassBorder}
          onPress={onPress}
          accessibilityLabel={accessibilityLabel}
          haptic={haptic}
          contentContainerStyle={feedPadStyles.feedCardPad}
          style={[tradeHeroInnerCardStyle(tokens), style]}
        >
          {children}
        </UICard>
      </View>
    </View>
  );
}
