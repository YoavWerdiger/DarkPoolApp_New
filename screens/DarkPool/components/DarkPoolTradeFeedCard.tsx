/**
 * כרטיס עסקה בפיד — קל יותר מגיבור פרטי העסקה:
 *
 *   UICard חיצוני (זכוכית)
 *     דיוקן + שם · פעולה · טיקר, ובשורה מתחת הטווח או הכמות והתאריך.
 *
 * טיקר/מחיר — שורה plain בתוך אותו UICard (בלי כרטיס פנימי).
 * הקשה על הכרטיס = פרטי עסקה. הקשה על דיוקן/שם = פרופיל.
 * לא מניות מומצאות מטווח STOCK Act.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { InsiderAvatar } from './InsiderAvatar';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import {
  createTradeHeroCardStyles,
  FEED_AVATAR_SIZE,
  FEED_CARD_TYPE,
} from './darkPoolFeedCardStyles';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { resolveFeedPortraitUrl } from '../utils/feedPortrait';
import { isolateData, ltrNameText } from '../utils/bidi';
import { formatDisclosedAmountRange } from '../utils/congressTradeDisplay';
import { formatInsiderShares } from '../utils/insiderTradeDisplay';
import {
  buildCongressTradeDetailSummary,
  buildInsiderTradeDetailSummary,
} from '../utils/tradeDetailSummary';

interface Props {
  ticker: string;
  personName: string;
  transactionType: string;
  /** Form 4 `Shares` מדויק — לא midpoint של STOCK Act. */
  shares?: number | null;
  amountLabel?: string | null;
  /** Form 4 מחיר למניה — 0 בהענקה = אין מחיר, לא "$0". */
  price?: number | null;
  transactionDate?: string | null;
  changeSinceTradePct?: number | null;
  currentPrice?: number | null;
  portraitUrl?: string | null;
  personId?: string | null;
  onPersonPress?: () => void;
  onCardPress?: () => void;
  onTickerPress?: () => void;
  personKind?: 'politician' | 'insider';
  /** לא מוצג בכרטיס — התפקיד נשאר בפירוט העסקה. */
  personHint?: string | null;
}

const CONGRESS_BELL = require('../../../assets/icons/nav/notifications.png');

export function DarkPoolTradeFeedCard({
  ticker,
  personName,
  transactionType,
  shares,
  amountLabel,
  price,
  transactionDate,
  portraitUrl,
  personId,
  onPersonPress,
  onCardPress,
  personKind = 'insider',
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createTradeHeroCardStyles(tokens), [tokens]);
  const line = useMemo(() => createLineStyles(tokens), [tokens]);
  const isCongress = personKind === 'politician';
  const displayName =
    personKind === 'insider' ? formatInsiderDisplayName(personName) : personName;
  const logoUrl = resolveFeedPortraitUrl({
    storedUrl: portraitUrl,
    personKind,
    personId,
    personName: displayName,
  });

  const summary = isCongress
    ? buildCongressTradeDetailSummary({
        transactionType,
        ticker,
        amountLabel,
        transactionDate,
      })
    : buildInsiderTradeDetailSummary({
        transactionType,
        ticker,
        shares,
        price,
        transactionDate,
      });
  const tone = summary.tone;
  const toneColor =
    tone === 'buy'
      ? tokens.colors.primary.main
      : tone === 'sell'
        ? tokens.colors.text.danger
        : tokens.colors.text.primary;

  const detailBits: string[] = [];
  if (isCongress) {
    const range = formatDisclosedAmountRange(amountLabel);
    if (range) detailBits.push(isolateData(range));
  } else {
    const sharesText = formatInsiderShares(shares);
    if (sharesText) detailBits.push(`${isolateData(sharesText)} מניות`);
  }
  if (summary.metaRender) detailBits.push(summary.metaRender);
  const detailLine = detailBits.join(' ');

  const a11y = [displayName, summary.sentence]
    .filter(Boolean)
    .join(', ');

  return (
    <DarkPoolFeedCard
      style={styles.heroCard}
      onPress={onCardPress ?? onPersonPress}
      accessibilityLabel={a11y}
      haptic
    >
      <View style={styles.heroBody}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={onPersonPress}
            disabled={!onPersonPress}
            style={styles.avatarHit}
            accessibilityRole={onPersonPress ? 'button' : undefined}
            accessibilityLabel={onPersonPress ? `פרופיל ${displayName}` : undefined}
          >
            <InsiderAvatar
              name={displayName}
              logoUrl={logoUrl}
              size={FEED_AVATAR_SIZE}
              fallbackSource={isCongress ? CONGRESS_BELL : undefined}
            />
          </Pressable>
          <View style={styles.textCol}>
            <View style={line.sentence}>
              <Pressable
                onPress={onPersonPress}
                disabled={!onPersonPress}
                style={line.nameHit}
                accessibilityRole={onPersonPress ? 'button' : undefined}
                accessibilityLabel={onPersonPress ? `פרופיל ${displayName}` : undefined}
              >
                <Text style={line.name} numberOfLines={1} ellipsizeMode="tail">
                  {displayName}
                </Text>
              </Pressable>
              <Text style={line.wordSpace}>{'\u00A0'}</Text>
              <Text style={[line.verb, { color: toneColor }]} numberOfLines={1}>
                {summary.verb}
              </Text>
              {summary.tickerDisplay ? (
                <>
                  <Text style={line.wordSpace}>{'\u00A0'}</Text>
                  <Text style={line.ticker} numberOfLines={1}>
                    {isolateData(summary.tickerDisplay)}
                  </Text>
                </>
              ) : null}
            </View>
            {detailLine ? (
              <Text style={styles.actionMeta} numberOfLines={2}>
                {detailLine}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </DarkPoolFeedCard>
  );
}

function createLineStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    sentence: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      minWidth: 0,
    },
    nameHit: {
      flexShrink: 1,
      minWidth: 0,
    },
    wordSpace: {
      flexShrink: 0,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
    },
    name: {
      ...ltrNameText,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.name.fontWeight,
      color: tokens.colors.text.primary,
    },
    verb: {
      flexShrink: 0,
      writingDirection: 'rtl',
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.action.fontWeight,
    },
    ticker: {
      flexShrink: 0,
      writingDirection: 'ltr',
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.name.fontWeight,
      color: tokens.colors.text.primary,
    },
  });
}
