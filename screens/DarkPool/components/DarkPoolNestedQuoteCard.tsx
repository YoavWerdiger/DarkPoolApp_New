/**
 * קן טיקר פנימי — מחיר חי / מאז העסקה.
 * UICard פנימי בתוך הכרטיס החיצוני (יומן: כרטיס-בתוך-כרטיס).
 * משותף לגיבור פרטי עסקה ולכרטיס הפיד.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChangeDot, type ChangeTone } from '../../../components/ui/ChangeDot';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { toDataIsland } from '../utils/bidi';
import { FEED_QUOTE_PLACEHOLDER } from '../utils/feedQuoteSlots';
import { formatFeedTickerBare } from '../utils/feedTradeDisplay';
import { FEED_CARD_TYPE, FEED_NESTED_RADIUS } from './darkPoolFeedCardStyles';

const NESTED_LOGO = 40;

interface Props {
  ticker: string;
  priceText: string | null;
  changeText: string | null;
  changeColor: string;
  changeTone?: ChangeTone;
  loading?: boolean;
  missingText?: string | null;
}

export function DarkPoolNestedQuoteCard({
  ticker,
  priceText,
  changeText,
  changeColor,
  changeTone,
  loading = false,
  missingText = null,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const tickerBare = formatFeedTickerBare(ticker);
  const priceKnown = Boolean(priceText);
  const changeKnown = Boolean(changeText);
  const priceDisplay = priceText ?? missingText ?? FEED_QUOTE_PLACEHOLDER;
  const changeDisplay = changeText ?? FEED_QUOTE_PLACEHOLDER;
  const placeholderOpacity = loading && (!priceKnown || !changeKnown) ? 0.55 : 1;

  return (
    <UICard
      variant="soft"
      padding="none"
      disableBlur
      style={{
        borderRadius: FEED_NESTED_RADIUS,
        backgroundColor: tokens.colors.background.tertiary,
      }}
    >
      <View style={styles.nested} pointerEvents="none" accessibilityRole="summary">
        <View style={styles.nestedTicker}>
          <View style={styles.nestedLogo}>
            <TickerLogo
              symbol={ticker}
              size={NESTED_LOGO}
              borderRadius={NESTED_LOGO / 2}
            />
          </View>
          <Text style={styles.nestedTickerText} numberOfLines={1}>
            {toDataIsland(tickerBare)}
          </Text>
        </View>
        <View style={styles.nestedPrice}>
          <Text style={styles.nestedPriceLabel}>מחיר חי</Text>
          <Text
            style={[
              priceKnown ? styles.nestedPriceValue : styles.nestedPriceMissing,
              { opacity: priceKnown ? 1 : placeholderOpacity },
            ]}
            numberOfLines={1}
          >
            {toDataIsland(priceDisplay)}
          </Text>
          <View style={styles.nestedSinceRow}>
            {changeKnown && changeTone ? <ChangeDot tone={changeTone} /> : null}
            <Text
              style={[
                styles.nestedSinceValue,
                {
                  color: changeKnown ? changeColor : tokens.colors.text.tertiary,
                  opacity: changeKnown ? 1 : placeholderOpacity,
                },
              ]}
            >
              {toDataIsland(changeDisplay)}
            </Text>
            <Text style={styles.nestedSinceLabel}>מאז העסקה</Text>
          </View>
        </View>
      </View>
    </UICard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    nested: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: 'transparent',
    },
    nestedTicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    nestedLogo: {
      width: NESTED_LOGO,
      height: NESTED_LOGO,
      borderRadius: NESTED_LOGO / 2,
      overflow: 'hidden',
      flexShrink: 0,
    },
    nestedTickerText: {
      fontSize: FEED_CARD_TYPE.nestedTicker.fontSize,
      lineHeight: FEED_CARD_TYPE.nestedTicker.lineHeight,
      fontWeight: FEED_CARD_TYPE.nestedTicker.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      flexShrink: 0,
    },
    nestedPrice: {
      direction: 'ltr',
      alignItems: 'flex-end',
      flexShrink: 1,
      minWidth: 0,
      gap: 2,
    },
    nestedPriceLabel: {
      writingDirection: 'rtl',
      textAlign: 'right',
      fontSize: FEED_CARD_TYPE.nestedLabel.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedLabel.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    nestedPriceValue: {
      fontSize: FEED_CARD_TYPE.nestedPrice.fontSize,
      lineHeight: FEED_CARD_TYPE.nestedPrice.lineHeight,
      fontWeight: FEED_CARD_TYPE.nestedPrice.fontWeight,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    nestedPriceMissing: {
      writingDirection: 'rtl',
      textAlign: 'right',
      fontSize: FEED_CARD_TYPE.nestedLabel.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedLabel.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    nestedSinceRow: {
      marginTop: 4,
      direction: 'ltr',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      gap: 4,
    },
    nestedSinceLabel: {
      fontSize: FEED_CARD_TYPE.nestedLabel.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedLabel.fontWeight,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'right',
      flexShrink: 1,
    },
    nestedSinceValue: {
      fontSize: FEED_CARD_TYPE.nestedSince.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedSince.fontWeight,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'right',
      flexShrink: 0,
    },
  });
}
