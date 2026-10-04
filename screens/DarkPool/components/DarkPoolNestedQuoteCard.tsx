/**
 * קן טיקר פנימי — מחיר חי / מאז העסקה.
 * UICard פנימי בתוך הכרטיס החיצוני (יומן: כרטיס-בתוך-כרטיס).
 * משותף לגיבור פרטי עסקה ולכרטיס הפיד.
 *
 * שתי שורות מיושרות משני הצדדים:
 *   [לוגו] TICKER  ↔  $price
 *          מחיר חי ↔  X% מאז העסקה
 * גובה הלוגו = שורה 1 + מרווח + שורה 2. הטקסט יושב בראש השורה, לא במרכזה.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type ChangeTone } from '../../../components/ui/ChangeDot';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { toDataIsland } from '../utils/bidi';
import { FEED_QUOTE_PLACEHOLDER } from '../utils/feedQuoteSlots';
import { formatFeedTickerBare } from '../utils/feedTradeDisplay';
import { FEED_CARD_TYPE, FEED_NESTED_RADIUS } from './darkPoolFeedCardStyles';

/** צמוד יותר מ-lineHeight של APP_TYPE — הכרטיס הפנימי בפרטי עסקה. */
const NESTED_VALUE_LINE = 18;
const NESTED_CAPTION_LINE = 14;
const ROW_GAP = 4;
const NESTED_LOGO = NESTED_VALUE_LINE + ROW_GAP + NESTED_CAPTION_LINE;

/** בלי ריפוד פונט — הגליף יושב בראש ה-line box (במיוחד באנדרואיד). */
const TEXT_TOP = {
  includeFontPadding: false,
  textAlignVertical: 'top' as const,
};

interface Props {
  ticker: string;
  priceText: string | null;
  changeText: string | null;
  changeColor: string;
  changeTone?: ChangeTone;
  loading?: boolean;
  missingText?: string | null;
  /** `nestedCard` = UICard פנימי (פרטי עסקה). `plain` = שורה בתוך כרטיס הפיד בלבד. */
  shell?: 'nestedCard' | 'plain';
}

export function DarkPoolNestedQuoteCard({
  ticker,
  priceText,
  changeText,
  changeColor,
  changeTone,
  loading = false,
  missingText = null,
  shell = 'nestedCard',
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const tickerBare = formatFeedTickerBare(ticker);
  const priceKnown = Boolean(priceText);
  const changeKnown = Boolean(changeText);
  const priceDisplay = priceText ?? missingText ?? FEED_QUOTE_PLACEHOLDER;
  const changeDisplay = changeText ?? FEED_QUOTE_PLACEHOLDER;
  const placeholderOpacity = loading && (!priceKnown || !changeKnown) ? 0.55 : 1;

  const body = (
    <View
      style={[styles.nested, shell === 'plain' && styles.nestedPlain]}
      pointerEvents="none"
      accessibilityRole="summary"
    >
      <View style={styles.nestedTicker}>
        <View style={styles.nestedLogo}>
          <TickerLogo
            symbol={ticker}
            size={NESTED_LOGO}
            borderRadius={NESTED_LOGO / 2}
            backgroundColor={tokens.colors.background.cardSolid}
          />
          <View style={styles.nestedLogoRing} />
        </View>
        <View style={styles.nestedTickerCol}>
          <Text style={styles.nestedTickerText} numberOfLines={1}>
            {toDataIsland(tickerBare)}
          </Text>
          <Text style={styles.nestedPriceLabel} numberOfLines={1}>
            מחיר חי
          </Text>
        </View>
      </View>
      <View style={styles.nestedPrice}>
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
          <Text
            style={[
              styles.nestedSinceValue,
              {
                color: changeKnown ? changeColor : tokens.colors.text.tertiary,
                opacity: changeKnown ? 1 : placeholderOpacity,
              },
            ]}
            numberOfLines={1}
          >
            {toDataIsland(changeDisplay)}
          </Text>
          <Text style={styles.nestedSinceLabel} numberOfLines={1}>
            מאז העסקה
          </Text>
        </View>
      </View>
    </View>
  );

  if (shell === 'plain') {
    return body;
  }

  return (
    <UICard
      variant="soft"
      padding="none"
      disableBlur
      style={{
        borderRadius: FEED_NESTED_RADIUS,
        backgroundColor: tokens.colors.background.primary,
      }}
    >
      {body}
    </UICard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    nested: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: APP_LAYOUT.stackGapTight,
      paddingVertical: APP_LAYOUT.stackGapTight,
      paddingHorizontal: APP_LAYOUT.stackGapTight,
      backgroundColor: 'transparent',
    },
    nestedPlain: {
      paddingHorizontal: 0,
      paddingBottom: 0,
      paddingTop: 4,
    },
    nestedTicker: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: APP_LAYOUT.stackGapSmall,
      flexShrink: 0,
    },
    nestedLogo: {
      width: NESTED_LOGO,
      height: NESTED_LOGO,
      borderRadius: NESTED_LOGO / 2,
      overflow: 'hidden',
      flexShrink: 0,
    },
    nestedLogoRing: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: NESTED_LOGO / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.divider,
    },
    nestedTickerCol: {
      alignItems: 'flex-start',
      gap: ROW_GAP,
    },
    nestedTickerText: {
      ...TEXT_TOP,
      fontSize: FEED_CARD_TYPE.nestedRowValue.fontSize,
      lineHeight: NESTED_VALUE_LINE,
      fontWeight: FEED_CARD_TYPE.nestedRowValue.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      flexShrink: 0,
    },
    nestedPrice: {
      direction: 'ltr',
      alignItems: 'flex-end',
      flexShrink: 1,
      minWidth: 0,
      gap: ROW_GAP,
    },
    nestedPriceLabel: {
      ...TEXT_TOP,
      writingDirection: 'rtl',
      textAlign: 'right',
      fontSize: FEED_CARD_TYPE.nestedRowCaption.fontSize,
      lineHeight: NESTED_CAPTION_LINE,
      fontWeight: FEED_CARD_TYPE.nestedRowCaption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    nestedPriceValue: {
      ...TEXT_TOP,
      fontSize: FEED_CARD_TYPE.nestedRowValue.fontSize,
      lineHeight: NESTED_VALUE_LINE,
      fontWeight: FEED_CARD_TYPE.nestedRowValue.fontWeight,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    nestedPriceMissing: {
      ...TEXT_TOP,
      writingDirection: 'rtl',
      textAlign: 'right',
      fontSize: FEED_CARD_TYPE.nestedRowValueMuted.fontSize,
      lineHeight: NESTED_VALUE_LINE,
      fontWeight: FEED_CARD_TYPE.nestedRowValueMuted.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    nestedSinceRow: {
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      gap: 4,
    },
    nestedSinceLabel: {
      ...TEXT_TOP,
      fontSize: FEED_CARD_TYPE.nestedRowCaption.fontSize,
      lineHeight: NESTED_CAPTION_LINE,
      fontWeight: FEED_CARD_TYPE.nestedRowCaption.fontWeight,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'right',
      flexShrink: 1,
    },
    nestedSinceValue: {
      ...TEXT_TOP,
      fontSize: FEED_CARD_TYPE.nestedRowCaptionStrong.fontSize,
      lineHeight: NESTED_CAPTION_LINE,
      fontWeight: FEED_CARD_TYPE.nestedRowCaptionStrong.fontWeight,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'right',
      flexShrink: 0,
    },
  });
}
